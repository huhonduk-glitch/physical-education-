import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'
import { SyncPassError, peekRemote, pullNow, pushNow, removeRemote } from '../src/db/driveSync'
import { ensureKeywordSeed } from '../src/db/recordsRepo'
import { applyPlanToTables, planMerge } from '../src/db/syncMerge'
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
const stu = (id: string, code: string, name: string, memo = '') => ({ id, schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: Number(code.slice(-2)), name, gender: 'M', studentCode: code, status: '재학', memo })
const rec = (id: string, studentId: string, at: number) => ({ id, schoolYear: 2026, studentId, date: '2026-11-13', type: 'exemplary', category: '친구 도움', keywordIds: [], createdAt: at, updatedAt: at })
const opts = (device: string) => ({ pass: PASS, device, iterations: FAST, labels: { records: '누가기록', students: '학생' } })

describe('구글 동기화 — 올리기 · 내려받기', () => {
  it('실제처럼: 두 기기 모두 기본 키워드가 있고, A에만 학생 → A 올리기 → B 내려받기', async () => {
    const drive = fakeDrive()
    const a = await device()
    const b = await device()
    await ensureKeywordSeed(a)
    await ensureKeywordSeed(b)
    const kw = await a.keywords.count()
    expect(kw).toBeGreaterThan(100)
    await a.students.bulkAdd([stu('sa', '10101', '가나다'), stu('sb', '10102', '라마바')] as never)

    expect((await pullNow(b, drive, opts('B'))).empty).toBe(true) // 아직 받을 것 없음
    const up = await pushNow(a, drive, opts('A'))
    expect(up.empty).toBe(true)
    expect(isLocked(JSON.parse(drive.file!.text))).toBe(true)
    expect(drive.file!.text).not.toContain('가나다')

    const down = await pullNow(b, drive, opts('B'))
    expect(down.empty).toBe(false)
    expect(down.lines).toContain('학생 +2')
    expect(await b.students.count()).toBe(2)
    expect(await b.keywords.count()).toBe(kw) // 키워드는 겹치지 않음
    expect(down.remote?.device).toBe('A')
  })

  it('올리기는 이 기기를 바꾸지 않고, 다른 기기가 올린 기록도 지우지 않음 / 내려받기는 구글 사본을 바꾸지 않음', async () => {
    const drive = fakeDrive()
    const a = await device()
    const b = await device()
    await a.students.add(stu('sa', '10101', '가나다') as never)
    await a.records.bulkAdd([rec('r1', 'sa', 1000)] as never)
    await pushNow(a, drive, opts('A'))

    // B는 내려받지 않고 자기 기록만 올림 → 구글에는 둘 다
    await b.students.add(stu('sb', '10101', '가나다') as never) // 같은 학생을 따로 넣음
    await b.records.add(rec('r9', 'sb', 2000) as never)
    const up = await pushNow(b, drive, opts('B'))
    expect(up.lines).toContain('누가기록 +1')
    expect(await b.records.count()).toBe(1) // B는 그대로
    const before = drive.file!.text

    const down = await pullNow(a, drive, opts('A'))
    expect(down.lines).toContain('누가기록 +1')
    expect(down.lines.join()).not.toContain('학생') // 같은 학생으로 맞춤
    const recs = await a.records.toArray()
    expect(recs.map((r) => r.id).sort()).toEqual(['r1', 'r9'])
    expect(recs.every((r) => r.studentId === 'sa')).toBe(true) // B 쪽 학생 id를 A 학생으로
    expect(drive.file!.text).toBe(before) // 내려받기는 구글 사본을 안 바꿈
  })

  it('지운 기록 따라가기: B에서 지우고 올리면 A가 내려받을 때 지움, A가 다시 올려도 되살아나지 않음', async () => {
    const drive = fakeDrive()
    const a = await device()
    const b = await device()
    await a.students.add(stu('sa', '10101', '가나다') as never)
    await a.records.bulkAdd([rec('r1', 'sa', 1000), rec('r2', 'sa', 1000)] as never)
    await pushNow(a, drive, opts('A'))
    await pullNow(b, drive, opts('B'))

    await b.records.delete('r2')
    await flushTombstones(b)
    expect((await readTombstones(b)).map((x) => x.id)).toEqual(['r2'])
    await pushNow(b, drive, opts('B'))

    // A가 내려받기 전에 올려도 구글에서 되살아나지 않음
    await pushNow(a, drive, opts('A'))
    const back = await pullNow(a, drive, opts('A'))
    expect(back.lines).toContain('누가기록 지움 1')
    expect(await a.records.count()).toBe(1)
    await pullNow(b, drive, opts('B'))
    expect(await b.records.count()).toBe(1)
  })

  it('고친 시각이 없는 줄은 보내는 쪽이 남음 (올린 학생 메모가 내려받은 기기에 반영)', async () => {
    const drive = fakeDrive()
    const a = await device()
    const b = await device()
    await a.students.add(stu('sa', '10101', '가나다') as never)
    await pushNow(a, drive, opts('A'))
    await pullNow(b, drive, opts('B'))
    await a.students.update('sa', { memo: '왼손잡이' })
    await pushNow(a, drive, opts('A'))
    await pullNow(b, drive, opts('B'))
    expect((await b.students.get('sa'))?.memo).toBe('왼손잡이')
  })

  it('비밀번호가 다르면 연결 확인 · 올리기 · 내려받기 모두 막음', async () => {
    const drive = fakeDrive()
    const a = await device()
    await pushNow(a, drive, opts('A'))
    const c = await device()
    const wrong = { ...opts('C'), pass: '다른비밀번호123' }
    await expect(peekRemote(drive, wrong.pass)).rejects.toBeInstanceOf(SyncPassError)
    await expect(pullNow(c, drive, wrong)).rejects.toBeInstanceOf(SyncPassError)
    await expect(pushNow(c, drive, wrong)).rejects.toBeInstanceOf(SyncPassError)
    expect(await peekRemote(drive, PASS)).toMatchObject({ device: 'A' })
    expect(await peekRemote(fakeDrive(), PASS)).toBeNull()
  })

  it('연결 끊으면서 구글 사본 지우기', async () => {
    const drive = fakeDrive()
    const a = await device()
    await pushNow(a, drive, opts('A'))
    expect(await removeRemote(drive)).toBe(true)
    expect(drive.file).toBeNull()
    expect(await removeRemote(drive)).toBe(false)
  })

  it('동기화 비밀번호 · 지운 기록은 백업 파일에 들어가지 않음', async () => {
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
  it('계획을 표 묶음에 적용 (설정은 key로)', () => {
    const tables = { settings: [{ key: 'a', value: 1 }], records: [rec('r1', 's', 1), rec('r2', 's', 1)] } as never
    const out = applyPlanToTables(tables, { put: { settings: [{ key: 'b', value: 2 }], records: [rec('r3', 's', 1)] }, remove: { records: ['r1'] }, stats: {}, matched: 0 } as never)
    expect(out.settings?.map((r) => r.key)).toEqual(['a', 'b'])
    expect(out.records?.map((r) => r.id)).toEqual(['r2', 'r3'])
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
        return new Response(url.includes('uploadType') ? JSON.stringify({ id: 'new1' }) : url.includes('/about') ? JSON.stringify({ user: { emailAddress: 'teacher@example.com' } }) : JSON.stringify({ files: [] }), { status: 200 })
      }),
    )
    const api = driveApi('tok')
    expect(await api.find()).toBeNull()
    expect(calls[0][0]).toContain('spaces=appDataFolder')
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(await api.upload('{"a":1}')).toBe('new1')
    expect(String(calls[1][1].body)).toContain('"parents":["appDataFolder"]')
    expect(await api.account?.()).toBe('teacher@example.com')
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.appdata')
  })
  it('401이면 다시 로그인 오류, 계정 메일을 못 읽으면 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const err = await driveApi('tok')
      .find()
      .catch((e) => e)
    expect(err).toBeInstanceOf(DriveError)
    expect(err.kind).toBe('auth')
    expect(await driveApi('tok').account?.()).toBeNull()
  })
})
