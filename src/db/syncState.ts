/**
 * 구글 드라이브 자동 맞추기 상태 · 지운 기록(tombstone) (2026-11-13).
 * - syncConf: 켰는지 · 비밀번호 · 기기 이름 · 마지막 맞춘 때. 비밀번호는 이 기기에만(백업 파일 · 합치기에서 빠짐, backup.ts SECRET_KEYS)
 * - syncTombstones: 이 기기에서 지운 줄 { 표, id, 지운 때 } — 다른 기기에서도 지우려고 드라이브 파일에 같이 넣는다.
 *   (잠금 파일 '합치기'는 지운 기록을 몰라서 지운 줄이 되살아났다 — 자동 맞추기에서는 지운 것도 따라가야 한다)
 * - Dexie 'deleting' 훅으로 모든 자료 표의 지우기를 잡는다(설정 표 · 표 비우기(복원)는 빼고). 맞추기를 켰을 때만 적는다.
 */
import type { PeDatabase } from './db'
import { BACKUP_TABLES } from './backup'

export interface SyncConf {
  enabled: boolean
  /** 잠금 비밀번호 (이 기기에만) */
  pass: string
  /** 이 기기 이름 (드라이브 파일에 마지막으로 올린 기기 표시) */
  device: string
  lastAt?: number
  lastNote?: string
}

export interface Tombstone {
  t: string
  id: string
  at: number
}

export const SYNC_CONF_KEY = 'syncConf'
export const SYNC_TOMB_KEY = 'syncTombstones'
/** 지운 기록은 이만큼만 둔다 (그 사이 모든 기기가 한 번은 맞춘다고 봄) */
export const TOMB_KEEP_MS = 180 * 24 * 3600 * 1000

export async function readSyncConf(db: PeDatabase): Promise<SyncConf | null> {
  const row = await db.settings.get(SYNC_CONF_KEY)
  return (row?.value as SyncConf | undefined) ?? null
}

export async function writeSyncConf(db: PeDatabase, conf: SyncConf | null): Promise<void> {
  if (conf) await db.settings.put({ key: SYNC_CONF_KEY, value: conf })
  else await db.settings.delete(SYNC_CONF_KEY)
  recording.set(db, !!conf?.enabled)
}

export async function readTombstones(db: PeDatabase): Promise<Tombstone[]> {
  const row = await db.settings.get(SYNC_TOMB_KEY)
  return (row?.value as Tombstone[] | undefined) ?? []
}

/** 지운 기록 합치기: 같은 줄이면 늦은 때, 오래된 것은 버림 */
export function mergeTombstones(a: readonly Tombstone[], b: readonly Tombstone[], now = Date.now()): Tombstone[] {
  const m = new Map<string, Tombstone>()
  for (const x of [...a, ...b]) {
    if (now - x.at > TOMB_KEEP_MS) continue
    const k = `${x.t}:${x.id}`
    const old = m.get(k)
    if (!old || x.at > old.at) m.set(k, x)
  }
  return [...m.values()]
}

export async function writeTombstones(db: PeDatabase, list: readonly Tombstone[]): Promise<void> {
  await db.settings.put({ key: SYNC_TOMB_KEY, value: mergeTombstones(list, []) })
}

// ── 지우기 잡기 (Dexie 훅) ──

const recording = new WeakMap<PeDatabase, boolean>()
const pending = new WeakMap<PeDatabase, Tombstone[]>()
const timers = new WeakMap<PeDatabase, ReturnType<typeof setTimeout>>()
const installed = new WeakSet<PeDatabase>()
/** 바뀐 것이 있으면 true (자동 맞추기 때를 정하려고) */
const dirty = new WeakMap<PeDatabase, number>()

export function changeCount(db: PeDatabase): number {
  return dirty.get(db) ?? 0
}

async function flush(db: PeDatabase) {
  const add = pending.get(db) ?? []
  pending.set(db, [])
  if (!add.length) return
  const cur = await readTombstones(db)
  await writeTombstones(db, mergeTombstones(cur, add))
}

/** 앱을 켤 때 한 번. 맞추기가 켜져 있으면 지운 줄을 적는다 */
export async function installSyncHooks(db: PeDatabase): Promise<void> {
  if (!installed.has(db)) {
    installed.add(db)
    for (const t of BACKUP_TABLES) {
      if (t === 'settings') continue
      const table = db.table(t)
      const bump = () => dirty.set(db, (dirty.get(db) ?? 0) + 1)
      table.hook('creating', function () {
        this.onsuccess = bump
      })
      table.hook('updating', function () {
        this.onsuccess = bump
      })
      table.hook('deleting', function (primKey) {
        this.onsuccess = () => {
          bump()
          if (!recording.get(db)) return
          pending.set(db, [...(pending.get(db) ?? []), { t, id: String(primKey), at: Date.now() }])
          clearTimeout(timers.get(db))
          timers.set(
            db,
            setTimeout(() => void flush(db).catch(() => undefined), 200),
          )
        }
      })
    }
  }
  const conf = await readSyncConf(db).catch(() => null)
  recording.set(db, !!conf?.enabled)
}

/** 시험 · 맞추기 직전에: 아직 안 적은 지운 줄을 바로 적기 */
export async function flushTombstones(db: PeDatabase): Promise<void> {
  clearTimeout(timers.get(db))
  await flush(db)
}
