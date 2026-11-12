/**
 * 구글 동기화 상태 (2026-11-13). 교사 결정: 구글 드라이브 사본이 기준 — 올리기 = 구글 사본을 이 기기 자료로 바꿈,
 * 내려받기 = 이 기기 자료를 구글 사본으로 바꿈(덮어쓰기). 지운 기록은 따로 남기지 않는다(통째로 바꾸므로 따라간다).
 * - syncConf: 연결했는지 · 비밀번호 · 기기 이름 · 마지막으로 구글과 같아진 때의 표시(base). 이 기기에만(백업 파일 · 합치기에서 빠짐)
 * - 바뀜 세기: Dexie 훅으로 자료 표가 바뀔 때마다 센다(자동 올리기 때를 정하려고, 이 탭 안에서만)
 */
import type { PeDatabase } from './db'
import { BACKUP_TABLES } from './backup'

export interface SyncConf {
  enabled: boolean
  /** 잠금 비밀번호 (이 기기에만) */
  pass: string
  /** 이 기기 이름 (구글 사본에 '마지막으로 올린 기기'로) */
  device: string
  /** 연결한 구글 계정 메일 (화면 표시용, 못 읽으면 없음) */
  account?: string
  /** 기록하면 자동으로 올리기 (없으면 켜짐) */
  autoUp?: boolean
  /** 마지막으로 구글과 같아졌을 때: 구글 사본의 바뀐 때(드라이브 modifiedTime) · 이 기기 자료 지문 */
  baseRemote?: string
  baseHash?: string
  /** 이 기기에서 마지막으로 올린 때 · 내려받은 때 (ms) */
  upAt?: number
  downAt?: number
  /** 구글 사본: 마지막으로 올린 때(ISO) · 기기 */
  remoteAt?: string
  remoteDevice?: string
  /** 마지막 결과 한 줄 */
  lastNote?: string
}

export const SYNC_CONF_KEY = 'syncConf'

export async function readSyncConf(db: PeDatabase): Promise<SyncConf | null> {
  const row = await db.settings.get(SYNC_CONF_KEY)
  return (row?.value as SyncConf | undefined) ?? null
}

export async function writeSyncConf(db: PeDatabase, conf: SyncConf | null): Promise<void> {
  if (conf) await db.settings.put({ key: SYNC_CONF_KEY, value: conf })
  else await db.settings.delete(SYNC_CONF_KEY)
}

/** 설정을 조금 고치기 (읽고 · 합쳐 · 쓰기) */
export async function patchSyncConf(db: PeDatabase, patch: Partial<SyncConf>): Promise<SyncConf | null> {
  const cur = await readSyncConf(db)
  if (!cur) return null
  const next = { ...cur, ...patch }
  await writeSyncConf(db, next)
  return next
}

// ── 바뀜 세기 (Dexie 훅) ──

const installed = new WeakSet<PeDatabase>()
const dirty = new WeakMap<PeDatabase, number>()

/** 이 탭에서 자료 표가 바뀐 수 */
export function changeCount(db: PeDatabase): number {
  return dirty.get(db) ?? 0
}

/** 앱을 켤 때 한 번 */
export function installSyncHooks(db: PeDatabase): void {
  if (installed.has(db)) return
  installed.add(db)
  for (const t of BACKUP_TABLES) {
    if (t === 'settings') continue
    const bump = () => dirty.set(db, (dirty.get(db) ?? 0) + 1)
    const table = db.table(t)
    table.hook('creating', function () {
      this.onsuccess = bump
    })
    table.hook('updating', function () {
      this.onsuccess = bump
    })
    table.hook('deleting', function () {
      this.onsuccess = bump
    })
  }
}
