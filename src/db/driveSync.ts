/**
 * 구글 동기화 (2026-11-13 교사 결정 — 처음엔 '자동 맞추기'였으나 교사 요청으로 스쿨보드처럼 '올리기 · 내려받기'로 바꿈).
 *   올리기(이 기기 → 구글): 구글 사본을 받아 풀고, 이 기기 자료를 그 사본에 합쳐 다시 잠가 올린다. 이 기기 자료는 바뀌지 않는다.
 *   내려받기(구글 → 이 기기): 구글 사본을 받아 풀고, 이 기기에 합친다. 구글 사본은 바뀌지 않는다.
 * 합치기 규칙은 잠금 파일 '합치기'와 같고(같은 학생 · 수업반 맞추기, 최근에 고친 것), 지운 기록을 따라가며,
 * 고친 시각으로 가릴 수 없으면 보내는 쪽을 남긴다. 어느 쪽도 다른 쪽에만 있는 기록을 지우지 않는다(지운 기록 빼고).
 * 구글에는 잠긴 글자만 간다. 비밀번호는 이 기기 설정에만(syncConf, 백업에서 빠짐).
 */
import { BACKUP_TABLES, checkBackup, exportAll, type BackupFile } from './backup'
import type { PeDatabase } from './db'
import { applyPlan, applyPlanToTables, mergeSummary, planMerge, type MergePlan, type TableName } from './syncMerge'
import { flushTombstones, mergeTombstones, readTombstones, writeTombstones, type Tombstone } from './syncState'
import { DriveError, type DriveApi, type DriveFileMeta } from '../lib/gdrive'
import { LockError, isLocked, lockJson, unlockJson } from '../lib/lockFile'

export const SYNC_FORMAT = 'pe-log-sync'

/** 구글 사본 안(풀었을 때) 모양 */
export interface SyncPayload {
  format: typeof SYNC_FORMAT
  v: 1
  savedAt: string
  /** 마지막으로 올린 기기 */
  device: string
  backup: BackupFile
  tombstones: Tombstone[]
}

export interface SyncResult {
  /** 구글 사본이 없었는지 (올리기 = 처음 만듦, 내려받기 = 받을 것이 없음) */
  empty: boolean
  /** 바뀐 것 한 줄들 ('누가기록 +3 · 지움 1') — 올리기는 구글 사본에서, 내려받기는 이 기기에서 */
  lines: string[]
  plan: MergePlan | null
  /** 구글 사본: 마지막으로 올린 때 · 기기 (올리기 뒤에는 이 기기) */
  remote?: { savedAt: string; device: string }
}

export class SyncPassError extends Error {}

type Opts = { pass: string; device: string; labels?: Partial<Record<string, string>>; iterations?: number }
type Tables = Partial<Record<TableName, Record<string, unknown>[]>>

// 올리기 · 내려받기는 한 번에 하나씩
let queue: Promise<unknown> = Promise.resolve()
function one<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => undefined)
  return next
}

/** 구글 사본 받아서 풀기 (없으면 null) */
async function readRemote(drive: DriveApi, pass: string): Promise<{ meta: DriveFileMeta; payload: SyncPayload } | null> {
  const meta = await drive.find()
  if (!meta) return null
  const text = await drive.download(meta.id)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new DriveError('구글에 있는 동기화 파일이 망가졌어요. [연결 끊기]에서 구글 사본을 지우고 다시 연결해 주세요.')
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
export function peekRemote(drive: DriveApi, pass: string): Promise<{ savedAt: string; device: string } | null> {
  return one(async () => {
    const r = await readRemote(drive, pass)
    return r ? { savedAt: r.payload.savedAt, device: r.payload.device } : null
  })
}

/** 올리기: 이 기기 자료를 구글 사본에 합쳐 올린다 (이 기기는 그대로) */
export function pushNow(db: PeDatabase, drive: DriveApi, opts: Opts): Promise<SyncResult> {
  return one(async () => {
    await flushTombstones(db)
    const remote = await readRemote(drive, opts.pass)
    const mine = await exportAll(db)
    const myTomb = await readTombstones(db)
    let backup: BackupFile = mine
    let tombstones = myTomb
    let plan: MergePlan | null = null
    if (remote) {
      const cloud = remote.payload.backup.tables as Tables
      plan = planMerge(cloud, mine.tables as Tables, { localTomb: remote.payload.tombstones ?? [], remoteTomb: myTomb, preferIncoming: true })
      backup = { ...mine, tables: applyPlanToTables(cloud, plan) as BackupFile['tables'] }
      tombstones = mergeTombstones(remote.payload.tombstones ?? [], myTomb)
    }
    const payload: SyncPayload = { format: SYNC_FORMAT, v: 1, savedAt: new Date().toISOString(), device: opts.device, backup, tombstones }
    const locked = await lockJson(payload, opts.pass, opts.iterations ? { iterations: opts.iterations } : {})
    await drive.upload(JSON.stringify(locked), remote?.meta.id)
    return { empty: !remote, lines: plan ? mergeSummary(plan, opts.labels ?? {}) : [], plan, remote: { savedAt: payload.savedAt, device: payload.device } }
  })
}

/** 내려받기: 구글 사본을 이 기기에 합친다 (구글 사본은 그대로) */
export function pullNow(db: PeDatabase, drive: DriveApi, opts: Opts): Promise<SyncResult> {
  return one(async () => {
    await flushTombstones(db)
    const remote = await readRemote(drive, opts.pass)
    if (!remote) return { empty: true, lines: [], plan: null }
    const here: Tables = {}
    for (const t of BACKUP_TABLES) here[t] = (await db.table(t).toArray()) as Record<string, unknown>[]
    const plan = planMerge(here, remote.payload.backup.tables as Tables, {
      localTomb: await readTombstones(db),
      remoteTomb: remote.payload.tombstones ?? [],
      preferIncoming: true,
    })
    await applyPlan(db, plan)
    await flushTombstones(db)
    // 다른 기기에서 지운 기록도 이 기기에 남긴다(이 기기가 올릴 때 되살리지 않게)
    await writeTombstones(db, mergeTombstones(await readTombstones(db), remote.payload.tombstones ?? []))
    return { empty: false, lines: mergeSummary(plan, opts.labels ?? {}), plan, remote: { savedAt: remote.payload.savedAt, device: remote.payload.device } }
  })
}

/** 구글 사본 지우기 (연결 끊을 때 선택) */
export async function removeRemote(drive: DriveApi): Promise<boolean> {
  const meta = await drive.find()
  if (!meta) return false
  await drive.remove(meta.id)
  return true
}
