/**
 * 업데이트 전 자동 백업 (재설계 B-5, 2026-10-22 교사 결정: "바꾸기 전에 기존 데이터 자동 백업부터").
 *
 * 저장 구조가 바뀌는 업데이트(Dexie 버전이 오름)를 처음 켤 때, 새 버전으로 열기 **전에**
 * 옛 저장소를 있는 그대로 읽어 이 기기 안의 별도 저장소(pe-records-autobackup)에 통째로 복사한다.
 * - 원래 저장소에는 아무것도 쓰지 않는다 (읽기만)
 * - 형식은 백업 파일과 같다 → [백업 · 학년도]에서 파일로 받거나 그대로 되돌릴 수 있다
 * - 이미 새 버전이면 아무것도 안 한다 (한 번만 실행)
 * - 서버로 보내는 것은 없다
 */
import Dexie, { type EntityTable } from 'dexie'
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile } from './backup'

export const MAIN_DB = 'pe-records'
export const AUTO_DB = 'pe-records-autobackup'
/** 이 버전으로 올라갈 때 자동 백업한다 (Dexie 버전. IndexedDB 안에서는 ×10으로 보인다) */
export const UPGRADE_TO = 5 // db.ts의 마지막 version()과 같게
/** 자동 백업했다는 알림을 홈에 한 번 보여 주려고 남겨 두는 표시 (localStorage) */
export const AUTO_BACKUP_NOTICE_KEY = 'pelog.autoBackupNotice'
/** 자동 백업은 최근 이만큼만 남긴다 */
const KEEP = 5

export interface AutoSnapshot {
  id: string
  createdAt: number
  /** 왜 만들었는지 (화면에 보임) */
  reason: string
  /** 백업할 때의 저장소 버전 (Dexie 버전) */
  fromVersion: number
  file: BackupFile
}

export class AutoBackupDb extends Dexie {
  snapshots!: EntityTable<AutoSnapshot, 'id'>
  constructor(name = AUTO_DB) {
    super(name)
    this.version(1).stores({ snapshots: 'id, createdAt' })
  }
}

/** 저장소를 버전을 정하지 않고 그대로 연다. 없으면 만들지 않고 null */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onupgradeneeded = () => {
      // 버전 없이 열었는데 업그레이드가 필요하다 = 저장소가 없었다 → 만들지 않고 취소
      req.transaction?.abort()
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      if (req.error?.name === 'AbortError') resolve(null)
      else reject(req.error)
    }
    req.onblocked = () => reject(new Error('다른 탭이 저장소를 쓰고 있어요'))
  })
}

function getAll(idb: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const req = idb.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 옛 저장소를 읽기만 해서 백업 파일 모양으로 만든다 */
async function readAll(idb: IDBDatabase): Promise<BackupFile> {
  const tables = {} as BackupFile['tables']
  const counts = {} as BackupFile['counts']
  for (const t of BACKUP_TABLES) {
    const rows = idb.objectStoreNames.contains(t) ? await getAll(idb, t) : []
    tables[t] = rows
    counts[t] = rows.length
  }
  // 옛 저장소에서 읽은 자료라 형식 버전은 1 (회차 없음)
  return { format: BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(), counts, tables }
}

export type PrepareResult =
  | { status: 'none' } // 저장소가 아직 없음 (처음 쓰는 기기)
  | { status: 'not-needed' } // 이미 새 버전
  | { status: 'saved'; snapshotId: string; counts: BackupFile['counts'] }
  | { status: 'failed'; error: string; file: BackupFile | null }

/**
 * 새 버전으로 열기 전에 부른다. 저장소가 옛 버전이면 통째로 복사해 둔다.
 * 실패하면 status 'failed' + 읽은 자료(file)를 돌려준다 → 화면에서 파일로라도 받게 한다.
 */
export async function prepareUpgrade(opts: { mainDb?: string; autoDb?: string; upgradeTo?: number; reason?: string } = {}): Promise<PrepareResult> {
  const { mainDb = MAIN_DB, autoDb = AUTO_DB, upgradeTo = UPGRADE_TO, reason = 'PAPS 여러 번 측정 업데이트 전' } = opts
  if (typeof indexedDB === 'undefined') return { status: 'none' }
  let idb: IDBDatabase | null = null
  let file: BackupFile | null = null
  try {
    idb = await openExisting(mainDb)
    if (!idb) return { status: 'none' }
    const fromVersion = idb.version / 10
    if (fromVersion >= upgradeTo) return { status: 'not-needed' }
    file = await readAll(idb)
    idb.close()
    idb = null
    const store = new AutoBackupDb(autoDb)
    const snap: AutoSnapshot = { id: crypto.randomUUID(), createdAt: Date.now(), reason, fromVersion, file }
    await store.snapshots.add(snap)
    const all = await store.snapshots.orderBy('createdAt').toArray()
    if (all.length > KEEP) await store.snapshots.bulkDelete(all.slice(0, all.length - KEEP).map((s) => s.id))
    store.close()
    return { status: 'saved', snapshotId: snap.id, counts: file.counts }
  } catch (e) {
    idb?.close()
    return { status: 'failed', error: e instanceof Error ? e.message : String(e), file }
  }
}

export async function listSnapshots(autoDb = AUTO_DB): Promise<AutoSnapshot[]> {
  const store = new AutoBackupDb(autoDb)
  try {
    return (await store.snapshots.orderBy('createdAt').reverse().toArray()) ?? []
  } finally {
    store.close()
  }
}
