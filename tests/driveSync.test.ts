import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'
import { SyncPassError, removeRemote, syncNow } from '../src/db/driveSync'
import { planMerge } from '../src/db/syncMerge'
import { installSyncHooks, mergeTombstones, readTombstones, writeSyncConf, flushTombstones, TOMB_KEEP_MS } from '../src/db/syncState'
import { DRIVE_SCOPE, DriveError, driveApi, type DriveApi } from '../src/lib/gdrive'
import { isLocked } from '../src/lib/lockFile'

// 학생 이름은 모두 지어낸 가명
const FAST = 100_000
const PASS = '체육관2026봄'

/** 드라이브 앱 전용 칸 흉내 (파일 하나) */
function fakeDrive(): DriveApi & { file: { id: string; text: string } | null } {
  const d = {
    file: null as { id: string; text: string } | null,
    async find() {
      return d.file ? { id: d.file.id } : null
    },
    async download(id: string) {
      if (d.file?.id !== id) throw new Error('없음')
      return d.file.text
    },
    async upload(text: string, id?: string) {
      d.file = { id: id ?? 'f1', text }
      return d.file.id
    },
    async remove() {
      d.file = null
    },
  }
  return d
}

let n = 0
async function device() {
  n += 1
  const db = new PeDatabase(`sync-${n}`)
  await installSyncHooks(db)
  await writeSyncConf(db, { enabled: true, pass: PASS, device: `기기${n}` })
  return db
}
const stu = (id: string, code: string, name: string) => ({ id, schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: Number(code.slice(-2)), name, gender: 'M', studentCode: code, status: '재학', memo: '' })
const rec = (id: string, studentId: string, at: number) => ({ id, schoolYear: 2026, studentId, date: '2026-11-13', type: 'exemplary', category: '친구 도움', keywordIds: [], createdAt: at, updatedAt: at })
const opts = (device: string) => ({ pass: PASS, device, iterations: FAST, labels: { records: '누가기록', students: '학생' } })

describe('드라이브 자동 맞추기', () => {
  it('A → 드라이브 → B, B에서 지우면 A에서도 지움, 드라이브에는 잠긴 글자만', async () => {
    const drive = fakeDrive()
    const a = await device()
    const b = await device()
    await a.students.add(stu('sa', '10101', '가나다') as never)
    await a.records.bulkAdd([rec('r1', 'sa', 1000), rec('r2', 'sa', 1000)] as never)

    const first = await syncNow(a, drive, opts('A'))
    expect(first.first).toBe(true)
    expect(isLocked(JSON.parse(drive.file!.text))).toBe(true)
    expect(drive.file!.text).not.toContain('가나다')

    await syncNow(b, drive, opts('B'))
    expect(await b.records.count()).toBe(2)
    expect((await b.students.toArray())[0].name).toBe('가나다')

    await b.records.delete('r2')
    await flushTombstones(b)
    expect((await readTombstones(b)).map((x) => x.id)).toEqual(['r2'])
    await syncNow(b, drive, opts('B'))

    const back = await syncNow(a, drive, opts('A'))
    expect(await a.records.count()).toBe(1)
    expect(back.lines).toContain('누가기록 지움 1')
    // 다시 맞춰도 되살아나지 않음
    await syncNow(b, drive, opts('B'))
    expect(await b.records.count()).toBe(1)
  })

  it('비밀번호가 다르면 막음', async () => {
    const drive = fakeDrive()
    const a = await device()
    await syncNow(a, drive, opts('A'))
    const c = await device()
    await expect(syncNow(c, drive, { ...opts('C'), pass: '다른비밀번호123' })).rejects.toBeInstanceOf(SyncPassError)
  })

  it('끄면서 드라이브 사본 지우기', async () => {
    const drive = fakeDrive()
    const a = await device()
    await syncNow(a, drive, opts('A'))
    expect(await removeRemote(drive)).toBe(true)
    expect(drive.file).toBeNull()
    expect(await removeRemote(drive)).toBe(false)
  })

  it('맞추기 비밀번호 · 지운 기록은 백업 파일에 들어가지 않음', async () => {
    const a = await device()
    await a.records.add(rec('x', 's', 1) as never)
    await a.records.delete('x')
    await flushTombstones(a)
    const file = await exportAll(a)
    const keys = (file.tables.settings as { key: string }[]).map((r) => r.key)
    expect(keys).not.toContain('syncConf')
    expect(keys).not.toContain('syncTombstones')
  })
})

describe('지운 기록 합치기 규칙', () => {
  it('여기서 지운 줄은 되살리지 않고, 지운 뒤 다른 기기에서 고친 줄은 살림', () => {
    const plan = planMerge({}, { records: [rec('r1', 's', 100), rec('r2', 's', 900)] as never }, { localTomb: [{ t: 'records', id: 'r1', at: 500 }, { t: 'records', id: 'r2', at: 500 }] })
    expect(plan.put.records?.map((r) => r.id)).toEqual(['r2'])
  })
  it('다른 기기에서 지운 줄은 여기서도 지움 — 지운 뒤 여기서 고친 줄은 둠', () => {
    const plan = planMerge({ records: [rec('r1', 's', 100), rec('r2', 's', 900)] as never }, {}, { remoteTomb: [{ t: 'records', id: 'r1', at: 500 }, { t: 'records', id: 'r2', at: 500 }, { t: 'settings', id: 'x', at: 1 }] })
    expect(plan.remove.records).toEqual(['r1'])
    expect(plan.remove.settings).toBeUndefined()
  })
  it('같은 줄은 늦은 때 하나, 오래된 것은 버림', () => {
    const now = 10 * TOMB_KEEP_MS
    const m = mergeTombstones([{ t: 'records', id: 'a', at: now - 5 }], [{ t: 'records', id: 'a', at: now - 1 }, { t: 'records', id: 'old', at: now - TOMB_KEEP_MS - 1 }], now)
    expect(m).toEqual([{ t: 'records', id: 'a', at: now - 1 }])
  })
})

describe('드라이브 요청 모양', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('앱 전용 칸만 찾고, 새 파일은 appDataFolder에 만듦, 토큰은 머리글로', async () => {
    const calls: [string, RequestInit][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([url, init])
        return new Response(url.includes('uploadType') ? JSON.stringify({ id: 'new1' }) : JSON.stringify({ files: [] }), { status: 200 })
      }),
    )
    const api = driveApi('tok')
    expect(await api.find()).toBeNull()
    expect(calls[0][0]).toContain('spaces=appDataFolder')
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(await api.upload('{"a":1}')).toBe('new1')
    expect(String(calls[1][1].body)).toContain('"parents":["appDataFolder"]')
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.appdata')
  })
  it('401이면 다시 로그인 오류', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const err = await driveApi('tok')
      .find()
      .catch((e) => e)
    expect(err).toBeInstanceOf(DriveError)
    expect(err.kind).toBe('auth')
  })
})
