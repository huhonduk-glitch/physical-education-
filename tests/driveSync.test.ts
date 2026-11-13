import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listSnapshots, SYNC_SNAPSHOT_REASON } from '../src/db/autoBackup'
import { exportAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'
import { SyncPassError, downloadNow, mergeBothNow, peekRemote, removeRemote, syncStatus, uploadNow, type SyncBase } from '../src/db/driveSync'
import { ensureKeywordSeed } from '../src/db/recordsRepo'
import { planMerge } from '../src/db/syncMerge'
import { writeSyncConf } from '../src/db/syncState'
import { DRIVE_SCOPE, DriveError, driveApi, type DriveApi } from '../src/lib/gdrive'
import { isLocked } from '../src/lib/lockFile'
import { decide } from '../src/state/driveSync'

// 학생 이름은 모두 지어낸 가명
const FAST = 100_000
const PASS = '체육관2026봄'

/** 드라이브 앱 전용 칸 흉내 (파일 하나, 올릴 때마다 바뀐 때가 달라짐) */
function fakeDrive(): DriveApi & { file: { id: string; text: string; modifiedTime: string } | null } {
  let tick = 0
  const d = {
    file: null as { id: string; text: string; modifiedTime: string } | null,
    async find() {
      return d.file ? { id: d.file.id, modifiedTime: d.file.modifiedTime } : null
    },
    async download(id: string) {
      if (d.file?.id !== id) throw new Error('없음')
      return d.file.text
    },
    async upload(text: string, id?: string) {
      tick += 1
      d.file = { id: id ?? 'f1', text, modifiedTime: `2026-11-13T00:00:${String(tick).padStart(2, '0')}.000Z` }
      return { id: d.file.id, modifiedTime: d.file.modifiedTime }
    },
    async remove() {
      d.file = null
    },
  }
  return d
}

let n = 0
async function device(pin: string) {
  n += 1
  const db = new PeDatabase(`sync-${n}`)
  await ensureKeywordSeed(db)
  await db.settings.put({ key: 'pinHash', value: pin })
  await writeSyncConf(db, { enabled: true, pass: PASS, device: `기기${n}` })
  return db
}
const stu = (id: string, code: string, name: string) => ({ id, schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: Number(code.slice(-2)), name, gender: 'M', studentCode: code, status: '재학', memo: '' })
const rec = (id: string, studentId: string, at: number, category = '친구 도움') => ({ id, schoolYear: 2026, studentId, date: '2026-11-13', type: 'exemplary', category, keywordIds: [], createdAt: at, updatedAt: at })
const opts = (dev: string, base?: SyncBase) => ({ pass: PASS, device: dev, iterations: FAST, labels: { records: '누가기록', students: '학생' }, autoDb: `autobk-${dev}-${n}`, base })
const st = async (db: PeDatabase, drive: DriveApi, base: SyncBase) => {
  const s = await syncStatus(db, drive, base)
  return { remote: !!s.remote, remoteChanged: s.remoteChanged, localChanged: s.localChanged }
}

describe('구글 동기화 — 구글 사본이 기준(덮어쓰기)', () => {
  it('A 올리기 → B(새 기기) 동기화 = 내려받기: 학생 2명 · B의 PIN은 그대로 · 바꾸기 전 자료는 자동 백업', async () => {
    const drive = fakeDrive()
    const a = await device('A-pin')
    const b = await device('B-pin')
    await a.students.bulkAdd([stu('sa', '10101', '가나다'), stu('sb', '10102', '라마바')] as never)

    expect(decide('auto', await st(a, drive, {}))).toBe('up') // 구글 사본 없음 + A에 자료
    const upA = await uploadNow(a, drive, opts('A'))
    expect(isLocked(JSON.parse(drive.file!.text))).toBe(true)
    expect(drive.file!.text).not.toContain('가나다')
    expect(upA.lines).toContain('학생 2')

    const sB = await st(b, drive, {})
    expect(sB).toEqual({ remote: true, remoteChanged: true, localChanged: false }) // B엔 기본 키워드뿐
    expect(decide('auto', sB)).toBe('down')
    const o = opts('B')
    const downB = await downloadNow(b, drive, o)
    expect(downB?.device).toBe('A')
    expect(await b.students.count()).toBe(2)
    expect(await b.keywords.count()).toBe(await a.keywords.count())
    expect((await b.settings.get('pinHash'))?.value).toBe('B-pin')
    expect((await b.settings.get('syncConf'))?.value).toMatchObject({ device: '기기2' }) // 이 기기 동기화 설정도 그대로
    const snaps = await listSnapshots(o.autoDb)
    expect(snaps.map((s) => s.reason)).toEqual([SYNC_SNAPSHOT_REASON])

    // 맞춘 뒤에는 둘 다 그대로
    expect(await st(b, drive, downB!.base)).toEqual({ remote: true, remoteChanged: false, localChanged: false })
    expect(decide('down', await st(b, drive, downB!.base))).toBe('none')
  })

  it('덮어쓰면 사라질 때 묻기 · 둘 다 살리기 · 지운 기록은 통째로 바꾸니 따라감', async () => {
    const drive = fakeDrive()
    const a = await device('A-pin')
    const b = await device('B-pin')
    await a.students.add(stu('sa', '10101', '가나다') as never)
    await a.records.add(rec('r1', 'sa', 1000) as never)
    let baseA = (await uploadNow(a, drive, opts('A'))).base
    let baseB = (await downloadNow(b, drive, opts('B')))!.base

    // B에서 기록 → 올리기 (구글은 그대로였으니 묻지 않음)
    await b.records.add(rec('r2', 'sa', 2000, '정리정돈') as never)
    expect(decide('up', await st(b, drive, baseB))).toBe('up')
    baseB = (await uploadNow(b, drive, opts('B', baseB))).base

    // A도 따로 기록 → 이제 양쪽 모두 바뀜
    await a.records.add(rec('r3', 'sa', 3000, '리더십') as never)
    const sA = await st(a, drive, baseA)
    expect(sA).toEqual({ remote: true, remoteChanged: true, localChanged: true })
    expect(decide('up', sA)).toEqual({ ask: 'both' })
    expect(decide('down', sA)).toEqual({ ask: 'both' })
    expect(decide('auto', sA)).toEqual({ ask: 'both' })
    // 한쪽만 바뀐 경우
    expect(decide('up', { remote: true, remoteChanged: true, localChanged: false })).toEqual({ ask: 'remote' })
    expect(decide('down', { remote: true, remoteChanged: false, localChanged: true })).toEqual({ ask: 'local' })
    expect(decide('down', { remote: false, remoteChanged: false, localChanged: true })).toBe('empty')

    // 둘 다 살리기 → A에 셋 다, 구글에도
    const merged = await mergeBothNow(a, drive, opts('A', baseA))
    expect(merged.lines).toContain('누가기록 +1')
    expect((await a.records.toArray()).map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3'])
    baseA = merged.base
    expect(decide('down', await st(b, drive, baseB))).toBe('down')
    baseB = (await downloadNow(b, drive, opts('B', baseB)))!.base
    expect(await b.records.count()).toBe(3)

    // B에서 지우고 올리면 A가 내려받을 때 같이 사라짐
    await b.records.delete('r1')
    baseB = (await uploadNow(b, drive, opts('B', baseB))).base
    expect(decide('auto', await st(a, drive, baseA))).toBe('down')
    await downloadNow(a, drive, opts('A', baseA))
    expect((await a.records.toArray()).map((r) => r.id).sort()).toEqual(['r2', 'r3'])
  })

  it('비밀번호가 다르면 확인 · 내려받기 · 둘 다 살리기 · (남이 바꾼 사본) 올리기 모두 막음', async () => {
    const drive = fakeDrive()
    const a = await device('A-pin')
    await uploadNow(a, drive, opts('A'))
    const c = await device('C-pin')
    const wrong = { ...opts('C'), pass: '다른비밀번호123' }
    await expect(peekRemote(drive, wrong.pass)).rejects.toBeInstanceOf(SyncPassError)
    await expect(downloadNow(c, drive, wrong)).rejects.toBeInstanceOf(SyncPassError)
    await expect(mergeBothNow(c, drive, wrong)).rejects.toBeInstanceOf(SyncPassError)
    await expect(uploadNow(c, drive, wrong)).rejects.toBeInstanceOf(SyncPassError)
    expect(await peekRemote(drive, PASS)).toMatchObject({ device: 'A' })
    expect(await peekRemote(fakeDrive(), PASS)).toBeNull()
    expect(await downloadNow(c, fakeDrive(), opts('C'))).toBeNull() // 받을 것 없음
  })

  it('연결 끊으면서 구글 사본 지우기', async () => {
    const drive = fakeDrive()
    const a = await device('A-pin')
    await uploadNow(a, drive, opts('A'))
    expect(await removeRemote(drive)).toBe(true)
    expect(drive.file).toBeNull()
    expect(await removeRemote(drive)).toBe(false)
  })

  it('동기화 비밀번호는 백업 파일 · 구글 사본에 들어가지 않음', async () => {
    const a = await device('A-pin')
    const keys = ((await exportAll(a)).tables.settings as { key: string }[]).map((r) => r.key)
    expect(keys).not.toContain('syncConf')
  })
})

describe('두 기기에서 같은 것을 따로 넣었을 때 (잠금 파일 합치기 · 둘 다 살리기)', () => {
  const lesson = (id: string, at: number, activity: string) => ({ id, schoolYear: 2026, groupId: 'g1', date: '2026-11-13', activity, createdAt: at, updatedAt: at })
  const absence = (id: string, reason: string) => ({ id, schoolYear: 2026, studentId: 's1', date: '2026-11-13', reason, altTaskDone: false })
  const praise = (id: string, category = '친구 도움', at = 1) => ({ ...rec(id, 's1', at, category), groupId: 'g1' })

  it('수업 일지는 수업반 · 날짜마다 하나 — 나중에 고친 글이 남음', () => {
    const plan = planMerge({ lessons: [lesson('L1', 100, '드리블')] as never }, { lessons: [lesson('L9', 200, '드리블 · 패스')] as never })
    expect(plan.put.lessons).toEqual([{ ...lesson('L9', 200, '드리블 · 패스'), id: 'L1' }])
  })
  it('견학은 학생 · 날짜마다 하나', () => {
    const plan = planMerge({ absences: [absence('A1', '부상')] as never }, { absences: [absence('A9', '질병')] as never })
    expect(plan.put.absences).toBeUndefined()
    expect(plan.stats.absences).toMatchObject({ added: 0, kept: 1 })
  })
  it('누가기록: 두 기기에서 같은 칭찬을 따로 넣으면 하나, 항목이 다르면 둘', () => {
    const same = planMerge({ records: [praise('R1')] as never }, { records: [praise('R9', '친구 도움', 5)] as never })
    expect(same.put.records?.map((r) => r.id)).toEqual(['R1'])
    expect(same.stats.records).toMatchObject({ added: 0, updated: 1 })
    const diff = planMerge({ records: [praise('R1')] as never }, { records: [praise('R9', '정리정돈')] as never })
    expect(diff.put.records?.map((r) => r.id)).toEqual(['R9'])
  })
  it('누가기록: 한 기기에서 같은 칭찬을 두 번 준 것은 두 줄', () => {
    const up = planMerge({ records: [praise('R1')] as never }, { records: [praise('R1'), praise('R2')] as never })
    expect(up.put.records?.map((r) => r.id)).toEqual(['R2'])
    const down = planMerge({ records: [praise('X1')] as never }, { records: [praise('R1'), praise('R2')] as never })
    expect(down.put.records?.map((r) => r.id)).toEqual(['R2'])
  })
})

describe('드라이브 요청 모양', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('앱 전용 칸만 찾고, 새 파일은 appDataFolder에 만듦, 바뀐 때를 받음, 토큰은 머리글로', async () => {
    const calls: [string, RequestInit][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([url, init])
        return new Response(
          url.includes('uploadType') ? JSON.stringify({ id: 'new1', modifiedTime: '2026-11-13T01:02:03.000Z' }) : url.includes('/about') ? JSON.stringify({ user: { emailAddress: 'teacher@example.com' } }) : JSON.stringify({ files: [] }),
          { status: 200 },
        )
      }),
    )
    const api = driveApi('tok')
    expect(await api.find()).toBeNull()
    expect(calls[0][0]).toContain('spaces=appDataFolder')
    expect(calls[0][0]).toContain('modifiedTime')
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(await api.upload('{"a":1}')).toEqual({ id: 'new1', modifiedTime: '2026-11-13T01:02:03.000Z' })
    expect(String(calls[1][1].body)).toContain('"parents":["appDataFolder"]')
    expect(calls[1][0]).toContain('fields=id,modifiedTime')
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
