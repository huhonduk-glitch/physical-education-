/**
 * 구글 드라이브 자동 맞추기 한 번 (2026-11-13).
 *   ① 드라이브 앱 전용 칸의 잠금 파일을 받아 비밀번호로 풀기 (없으면 처음)
 *   ② 이 기기 자료와 합치기 — 잠금 파일 '합치기'와 같은 규칙(같은 학생 · 수업반 맞추기, 최근 고친 것) + 지운 기록 따라가기
 *   ③ 합친 자료 + 지운 기록을 다시 잠가서 올리기
 * 구글에는 잠긴 글자만 간다. 비밀번호는 이 기기 설정에만(syncConf, 백업에서 빠짐).
 * 두 기기가 같은 순간에 맞추면 나중에 올린 쪽이 남지만, 올리기 전에 늘 받아서 합치므로 다음 맞추기 때 채워진다.
 */
import { BACKUP_TABLES, checkBackup, exportAll, type BackupFile } from './backup'
import type { PeDatabase } from './db'
import { applyPlan, mergeSummary, planMerge, type MergePlan, type TableName } from './syncMerge'
import { flushTombstones, mergeTombstones, readTombstones, writeTombstones, type Tombstone } from './syncState'
import { DriveError, type DriveApi } from '../lib/gdrive'
import { LockError, isLocked, lockJson, unlockJson } from '../lib/lockFile'

export const SYNC_FORMAT = 'pe-log-sync'

/** 드라이브 파일 안(풀었을 때) 모양 */
export interface SyncPayload {
  format: typeof SYNC_FORMAT
  v: 1
  savedAt: string
  device: string
  backup: BackupFile
  tombstones: Tombstone[]
}

export interface SyncResult {
  /** 드라이브에 파일이 처음 생겼는지 */
  first: boolean
  /** 합친 결과 한 줄들 ('누가기록 +3 · 지움 1') */
  lines: string[]
  plan: MergePlan | null
}

export class SyncPassError extends Error {}

let running: Promise<SyncResult> | null = null

/** 한 번 맞추기. 이미 돌고 있으면 그 결과를 같이 기다린다 */
export function syncNow(db: PeDatabase, drive: DriveApi, opts: { pass: string; device: string; labels?: Partial<Record<string, string>>; iterations?: number }): Promise<SyncResult> {
  running ??= run(db, drive, opts).finally(() => {
    running = null
  })
  return running
}

async function run(db: PeDatabase, drive: DriveApi, opts: { pass: string; device: string; labels?: Partial<Record<string, string>>; iterations?: number }): Promise<SyncResult> {
  await flushTombstones(db)
  const meta = await drive.find()
  let remote: SyncPayload | null = null
  if (meta) {
    const text = await drive.download(meta.id)
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new DriveError('드라이브의 맞추기 파일이 망가졌어요. [끄기]에서 드라이브 사본을 지우고 다시 켜 주세요.')
    }
    if (!isLocked(raw)) throw new DriveError('드라이브의 맞추기 파일 모양이 달라요.')
    try {
      remote = (await unlockJson(raw, opts.pass)) as SyncPayload
    } catch (e) {
      if (e instanceof LockError) throw new SyncPassError('비밀번호가 다른 기기에서 정한 것과 달라요. 처음 켠 기기와 같은 비밀번호를 넣어 주세요.')
      throw e
    }
    if (remote?.format !== SYNC_FORMAT) throw new DriveError('드라이브의 맞추기 파일 모양이 달라요.')
    const c = checkBackup(remote.backup)
    if (!c.ok) throw new DriveError(c.error)
  }

  const localTomb = await readTombstones(db)
  let plan: MergePlan | null = null
  if (remote) {
    const here: Partial<Record<TableName, Record<string, unknown>[]>> = {}
    for (const t of BACKUP_TABLES) here[t] = (await db.table(t).toArray()) as Record<string, unknown>[]
    plan = planMerge(here, remote.backup.tables as typeof here, { localTomb, remoteTomb: remote.tombstones ?? [] })
    await applyPlan(db, plan)
    await flushTombstones(db)
  }
  // 지운 기록: 양쪽을 합쳐 이 기기에도 남긴다(다음에 다른 기기가 또 올려도 되살리지 않게)
  const allTomb = mergeTombstones(await readTombstones(db), remote?.tombstones ?? [])
  await writeTombstones(db, allTomb)

  const payload: SyncPayload = { format: SYNC_FORMAT, v: 1, savedAt: new Date().toISOString(), device: opts.device, backup: await exportAll(db), tombstones: allTomb }
  const locked = await lockJson(payload, opts.pass, opts.iterations ? { iterations: opts.iterations } : {})
  await drive.upload(JSON.stringify(locked), meta?.id)
  return { first: !meta, lines: plan ? mergeSummary(plan, opts.labels ?? {}) : [], plan }
}

/** 드라이브의 맞추기 파일 지우기 (끌 때 선택) */
export async function removeRemote(drive: DriveApi): Promise<boolean> {
  const meta = await drive.find()
  if (!meta) return false
  await drive.remove(meta.id)
  return true
}
