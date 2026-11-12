/**
 * 구글 동기화 (2026-11-13 교사 결정: "아이클라우드처럼 구글 드라이브를 기준으로, 올려서 백업하고 거기서 내려받기").
 *   올리기(이 기기 → 구글): 구글 사본을 이 기기 자료로 통째로 바꾼다.
 *   내려받기(구글 → 이 기기): 이 기기 자료를 구글 사본으로 통째로 바꾼다. 바꾸기 전 이 기기 자료는 자동 백업에 남기고,
 *     이 기기에만 맞는 설정(PIN · 이용 안내 동의 · 홈 배치 · 비밀 값)은 그대로 둔다.
 *   둘 다 살리기(양쪽이 모두 바뀌었을 때만 고르는 길): 구글 사본을 이 기기에 합친 뒤(잠금 파일 '합치기'와 같은 규칙) 올린다.
 * 덮어쓰기로 기록이 사라지지 않게, 마지막으로 구글과 같아졌을 때의 표시(base)를 기억해 두고
 *   - 구글 사본이 그 뒤 다른 기기에서 바뀌었는지(remoteChanged) = 드라이브 파일의 바뀐 때가 다름
 *   - 이 기기에 아직 안 올린 기록이 있는지(localChanged) = 자료 지문(SHA-256)이 다름
 * 을 보고 화면에서 먼저 묻는다(state/driveSync.ts decide).
 * 구글에는 잠긴 글자만 간다. 비밀번호는 이 기기 설정에만(syncConf, 백업에서 빠짐).
 */
import { saveSnapshot, SYNC_SNAPSHOT_REASON } from './autoBackup'
import { BACKUP_TABLES, checkBackup, exportAll, restoreAll, type BackupFile } from './backup'
import type { PeDatabase } from './db'
import { mergeInto, mergeSummary } from './syncMerge'
import { DriveError, type DriveApi, type DriveFileMeta } from '../lib/gdrive'
import { LockError, isLocked, lockJson, unlockJson } from '../lib/lockFile'

export const SYNC_FORMAT = 'pe-log-sync'

/** 구글 사본 안(풀었을 때) 모양 */
export interface SyncPayload {
  format: typeof SYNC_FORMAT
  v: number
  savedAt: string
  /** 마지막으로 올린 기기 */
  device: string
  backup: BackupFile
}

/** 내려받아도 이 기기 것을 그대로 두는 설정 (기기마다 다른 것) */
export const DEVICE_KEYS = ['pinHash', 'termsAgreed', 'homeLayout', 'weatherCache', 'lastBackupAt']

export interface SyncBase {
  baseRemote?: string
  baseHash?: string
}

/** 구글 사본과 이 기기를 견준 것 */
export interface SyncStatus {
  remote: DriveFileMeta | null
  /** 마지막으로 같아진 뒤 구글 사본이 (다른 기기에서) 바뀜 */
  remoteChanged: boolean
  /** 마지막으로 같아진 뒤 이 기기 자료가 바뀜 (아직 안 올린 기록) */
  localChanged: boolean
}

export interface SyncDone {
  /** 새 base */
  base: Required<SyncBase>
  savedAt: string
  device: string
  /** 사람이 읽는 수 ('학생 25 · 누가기록 130') 또는 합친 결과 */
  lines: string[]
}

export class SyncPassError extends Error {}

type Opts = { pass: string; device: string; labels?: Partial<Record<string, string>>; iterations?: number; autoDb?: string; base?: SyncBase }

// 한 번에 하나씩
let queue: Promise<unknown> = Promise.resolve()
function one<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => undefined)
  return next
}

/** 자료 지문: 설정을 뺀 모든 자료 표 (같은 자료면 같은 값) */
export async function fingerprintTables(tables: BackupFile['tables']): Promise<string> {
  const data = BACKUP_TABLES.filter((t) => t !== 'settings').map((t) => [t, tables[t] ?? []])
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
}
export async function fingerprint(db: PeDatabase): Promise<string> {
  return fingerprintTables((await exportAll(db)).tables)
}

/** 선생님이 넣은 자료가 있는지 (기본 키워드 · 타이머 설정만 있으면 없음) */
async function hasOwnData(db: PeDatabase): Promise<boolean> {
  for (const t of BACKUP_TABLES) {
    if (t === 'settings' || t === 'keywords' || t === 'timerPresets') continue
    if ((await db.table(t).count()) > 0) return true
  }
  return false
}

const countLines = (file: BackupFile, labels: Partial<Record<string, string>>) =>
  Object.entries(labels)
    .map(([t, label]) => [label, (file.tables[t as keyof BackupFile['tables']] ?? []).length] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}`)

/** 구글 사본 받아서 풀기 (없으면 null) */
async function readRemote(drive: DriveApi, pass: string): Promise<{ meta: DriveFileMeta; payload: SyncPayload } | null> {
  const meta = await drive.find()
  if (!meta) return null
  const text = await drive.download(meta.id)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new DriveError('구글에 있는 동기화 파일이 망가졌어요. 자료가 맞는 기기에서 [올리기]를 하면 새로 만들어져요.')
  }
  if (!isLocked(raw)) throw new DriveError('구글에 있는 동기화 파일 모양이 달라요.')
  let payload: SyncPayload
  try {
    payload = (await unlockJson(raw, pass)) as SyncPayload
  } catch (e) {
    if (e instanceof LockError) throw new SyncPassError('동기화 비밀번호가 처음 정한 것과 달라요. 다른 기기에서 정한 비밀번호를 넣어 주세요.')
    throw e
  }
  if (payload?.format !== SYNC_FORMAT) throw new DriveError('구글에 있는 동기화 파일 모양이 달라요.')
  const c = checkBackup(payload.backup)
  if (!c.ok) throw new DriveError(c.error)
  return { meta, payload }
}

/** 연결할 때: 구글 사본이 있는지 · 비밀번호가 맞는지만 본다 (아무것도 바꾸지 않음) */
export function peekRemote(drive: DriveApi, pass: string): Promise<{ savedAt: string; device: string; modifiedTime?: string } | null> {
  return one(async () => {
    const r = await readRemote(drive, pass)
    return r ? { savedAt: r.payload.savedAt, device: r.payload.device, modifiedTime: r.meta.modifiedTime } : null
  })
}

/** 구글 사본과 이 기기 견주기 (내려받지 않음 — 파일 정보만) */
export function syncStatus(db: PeDatabase, drive: DriveApi, base: SyncBase): Promise<SyncStatus> {
  return one(async () => {
    const remote = await drive.find()
    const remoteChanged = !!remote && remote.modifiedTime !== base.baseRemote
    const localChanged = base.baseHash ? (await fingerprint(db)) !== base.baseHash : await hasOwnData(db)
    return { remote, remoteChanged, localChanged }
  })
}

async function upload(db: PeDatabase, drive: DriveApi, opts: Opts, verified = false): Promise<SyncDone> {
  const existing = await drive.find()
  // 이 기기가 마지막으로 맞춘 사본이 아니면, 바꾸기 전에 비밀번호가 맞는지 확인한다
  // (다른 비밀번호로 덮어쓰면 다른 기기들이 사본을 못 열게 된다)
  if (existing && !verified && existing.modifiedTime !== opts.base?.baseRemote) await readRemote(drive, opts.pass)
  const file = await exportAll(db)
  const hash = await fingerprintTables(file.tables)
  const payload: SyncPayload = { format: SYNC_FORMAT, v: 2, savedAt: new Date().toISOString(), device: opts.device, backup: file }
  const locked = await lockJson(payload, opts.pass, opts.iterations ? { iterations: opts.iterations } : {})
  const meta = await drive.upload(JSON.stringify(locked), existing?.id)
  return { base: { baseRemote: meta.modifiedTime ?? '', baseHash: hash }, savedAt: payload.savedAt, device: payload.device, lines: countLines(file, opts.labels ?? {}) }
}

/** 올리기: 구글 사본을 이 기기 자료로 통째로 바꾼다 */
export function uploadNow(db: PeDatabase, drive: DriveApi, opts: Opts): Promise<SyncDone> {
  return one(() => upload(db, drive, opts))
}

/** 내려받기: 이 기기 자료를 구글 사본으로 통째로 바꾼다 (없으면 null). 바꾸기 전 이 기기 자료는 자동 백업에 */
export function downloadNow(db: PeDatabase, drive: DriveApi, opts: Opts): Promise<SyncDone | null> {
  return one(async () => {
    const r = await readRemote(drive, opts.pass)
    if (!r) return null
    await saveSnapshot(await exportAll(db), SYNC_SNAPSHOT_REASON, { autoDb: opts.autoDb })
    const keep = (await db.settings.bulkGet(DEVICE_KEYS)).filter((x): x is NonNullable<typeof x> => !!x)
    await restoreAll(db, r.payload.backup)
    await db.transaction('rw', db.settings, async () => {
      for (const k of DEVICE_KEYS) await db.settings.delete(k)
      for (const row of keep) await db.settings.put(row)
    })
    const hash = await fingerprint(db)
    return {
      base: { baseRemote: r.meta.modifiedTime ?? '', baseHash: hash },
      savedAt: r.payload.savedAt,
      device: r.payload.device,
      lines: countLines(r.payload.backup, opts.labels ?? {}),
    }
  })
}

/** 둘 다 살리기: 구글 사본을 이 기기에 합친 뒤 올린다 (양쪽이 모두 바뀌었을 때) */
export function mergeBothNow(db: PeDatabase, drive: DriveApi, opts: Opts): Promise<SyncDone> {
  return one(async () => {
    const r = await readRemote(drive, opts.pass)
    let lines: string[] = []
    if (r) {
      await saveSnapshot(await exportAll(db), SYNC_SNAPSHOT_REASON, { autoDb: opts.autoDb })
      lines = mergeSummary(await mergeInto(db, r.payload.backup), opts.labels ?? {})
    }
    const done = await upload(db, drive, opts, true)
    return { ...done, lines }
  })
}

/** 구글 사본 지우기 (연결 끊을 때 선택) */
export async function removeRemote(drive: DriveApi): Promise<boolean> {
  const meta = await drive.find()
  if (!meta) return false
  await drive.remove(meta.id)
  return true
}
