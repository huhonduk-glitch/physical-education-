import { IS_DEMO } from '../lib/demo'

/**
 * 교사가 넣은 참고 자료 파일(교육청 PDF 등)을 이 기기에만 둔다 (6-11 G, 2026-11-04 교사 결정: 추천 방식).
 * - 공개 저장소에 원본을 넣지 않기 위해, 교사가 자기 기기에 한 번 넣고 앱 안에서 그 쪽을 연다
 * - 학생 자료 저장소와 따로(pe-records-docs): 백업 파일 · 학년도 이월과 상관없고, 커서 백업을 무겁게 하지 않는다
 * - 인터넷으로 보내지 않는다
 */

export interface StoredDocMeta {
  key: string
  name: string
  size: number
  pages: number
  savedAt: number
}
interface StoredDoc extends StoredDocMeta {
  data: Blob
}

const STORE = 'files'
export const docsDbName = (demo = IS_DEMO) => (demo ? 'pe-records-demo-docs' : 'pe-records-docs')

function open(name = docsDbName()): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, name?: string): Promise<T> {
  return open(name).then(
    (idb) =>
      new Promise<T>((resolve, reject) => {
        const tx = idb.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => {
          idb.close()
          resolve(req.result)
        }
        tx.onerror = () => {
          idb.close()
          reject(tx.error ?? req.error)
        }
      }),
  )
}

export async function saveDoc(key: string, file: Blob & { name?: string }, pages: number, name?: string): Promise<StoredDocMeta> {
  const row: StoredDoc = { key, name: name ?? file.name ?? key, size: file.size, pages, savedAt: Date.now(), data: file }
  await run('readwrite', (s) => s.put(row))
  const { data: _data, ...meta } = row
  void _data
  return meta
}

export async function listDocs(name?: string): Promise<StoredDocMeta[]> {
  const rows = (await run('readonly', (s) => s.getAll(), name)) as StoredDoc[]
  return rows.map(({ data: _data, ...meta }) => (void _data, meta))
}

export async function getDocData(key: string, name?: string): Promise<Blob | null> {
  const row = (await run('readonly', (s) => s.get(key), name)) as StoredDoc | undefined
  return row?.data ?? null
}

export async function removeDoc(key: string, name?: string): Promise<void> {
  await run('readwrite', (s) => s.delete(key), name)
}
