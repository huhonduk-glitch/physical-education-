import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { exportAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'
import { mergeInto, mergeSummary, planMerge, rewriteIds } from '../src/db/syncMerge'
import { LockError, isLocked, lockJson, lockedFileName, passwordProblem, unlockJson } from '../src/lib/lockFile'

// 학생 이름 · 학번은 모두 지어낸 가명

const FAST = { iterations: 100_000 }

describe('잠금 파일', () => {
  it('잠그고 풀기 · 밖에서는 내용이 안 보임', async () => {
    const value = { format: 'pe-records-backup', tables: { students: [{ id: 's1', name: '가나다' }] } }
    const f = await lockJson(value, 'pelog-2026!', FAST)
    expect(isLocked(f)).toBe(true)
    expect(JSON.stringify(f)).not.toContain('가나다')
    expect(await unlockJson(f, 'pelog-2026!')).toEqual(value)
  })
  it('비밀번호가 틀리면 오류', async () => {
    const f = await lockJson({ a: 1 }, 'pelog-2026!', FAST)
    await expect(unlockJson(f, 'pelog-2027!')).rejects.toThrow(LockError)
  })
  it('같은 내용도 잠글 때마다 다른 글자 (소금 · iv)', async () => {
    const a = await lockJson({ a: 1 }, 'pelog-2026!', FAST)
    const b = await lockJson({ a: 1 }, 'pelog-2026!', FAST)
    expect(a.data).not.toBe(b.data)
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
  })
  it('비밀번호 규칙', async () => {
    expect(passwordProblem('1234567')).toMatch('8자')
    expect(passwordProblem('aaaaaaaa')).toMatch('반복')
    expect(passwordProblem('11223344')).toMatch('숫자')
    expect(passwordProblem('체육관2026봄')).toBeNull()
    await expect(lockJson({}, 'short', FAST)).rejects.toThrow(LockError)
  })
  it('파일 이름은 backup으로 시작 (.gitignore)', () => {
    expect(lockedFileName(new Date(2026, 10, 12, 9, 5))).toBe('backup_잠금_체육기록_20261112_0905.json')
  })
})

const stu = (id: string, code: string, name: string) => ({ id, schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: Number(code.slice(-2)), name, gender: 'M', studentCode: code, status: '재학', memo: '' })

describe('합치기 계획', () => {
  it('id 바꾸기: 글자 · 배열 · 객체 열쇠', () => {
    const m = new Map([['old', 'new']])
    expect(rewriteIds({ a: 'old', b: ['x', 'old'], c: { old: ['old'] }, d: 3 }, m)).toEqual({ a: 'new', b: ['x', 'new'], c: { new: ['new'] }, d: 3 })
  })

  it('따로 올린 같은 학생은 하나로, 기록은 이 기기 학생에 붙는다', () => {
    const here = { students: [stu('h1', '10101', '가나다')], groups: [{ id: 'gh', schoolYear: 2026, kind: 'homeroom', grade: 1, classNo: 1, semester: 0, name: '1-1', memberIds: [] }] }
    const incoming = {
      students: [stu('p1', '10101', '가나다'), stu('p2', '10102', '라마바')],
      groups: [{ id: 'gp', schoolYear: 2026, kind: 'homeroom', grade: 1, classNo: 1, semester: 0, name: '1-1', memberIds: [] }],
      records: [{ id: 'r1', schoolYear: 2026, studentId: 'p1', groupId: 'gp', date: '2026-11-03', type: 'exemplary', category: '정리정돈', keywordIds: [], createdAt: 1, updatedAt: 1 }],
    }
    const plan = planMerge(here, incoming)
    expect(plan.matched).toBe(2)
    expect(plan.put.students?.map((r) => r.id)).toEqual(['p2'])
    expect(plan.put.records?.[0]).toMatchObject({ id: 'r1', studentId: 'h1', groupId: 'gh' })
    expect(plan.put.groups).toBeUndefined()
    expect(plan.stats.students).toEqual({ added: 1, updated: 0, kept: 0, same: 1 })
  })

  it('같은 줄: 더 최근 것, 시각이 없으면 이 기기 것', () => {
    const here = {
      records: [{ id: 'r1', note: '이 기기', updatedAt: 10 }],
      captains: [{ id: 'c1', studentId: 's', role: '부장', from: '2026-03-02', to: undefined }],
    }
    const incoming = {
      records: [{ id: 'r1', note: '다른 기기', updatedAt: 20 }],
      captains: [{ id: 'c1', studentId: 's', role: '부장', from: '2026-03-02', to: '2026-07-01' }],
    }
    const plan = planMerge(here, incoming)
    expect(plan.put.records?.[0].note).toBe('다른 기기')
    expect(plan.put.captains).toBeUndefined()
    expect(plan.stats.captains?.kept).toBe(1)
    const older = planMerge(here, { records: [{ id: 'r1', note: '옛것', updatedAt: 5 }] })
    expect(older.put.records).toBeUndefined()
  })

  it('PAPS 칸 · 출결은 id가 달라도 같은 자리면 한 줄', () => {
    const here = {
      papsResults: [{ id: 'a', studentId: 's', eventId: 'gripStrength', attempt: 1, side: 'R', value: 30, excluded: false, measuredAt: 10 }],
      attendance: [{ id: 'x', groupId: 'g', studentId: 's', date: '2026-11-03', period: 2, status: 'late', updatedAt: 50 }],
    }
    const incoming = {
      papsResults: [{ id: 'b', studentId: 's', eventId: 'gripStrength', attempt: 1, side: 'R', value: 31.5, excluded: false, measuredAt: 20 }],
      attendance: [{ id: 'y', groupId: 'g', studentId: 's', date: '2026-11-03', period: 2, status: 'absent', updatedAt: 40 }],
    }
    const plan = planMerge(here, incoming)
    expect(plan.put.papsResults).toEqual([{ id: 'a', studentId: 's', eventId: 'gripStrength', attempt: 1, side: 'R', value: 31.5, excluded: false, measuredAt: 20 }])
    expect(plan.put.attendance).toBeUndefined()
  })

  it('수강반 학생 목록은 합친다', () => {
    const g = (id: string, members: string[]) => ({ id, schoolYear: 2026, kind: 'elective', name: '스포츠 생활', semester: 2, memberIds: members })
    const plan = planMerge({ groups: [g('g1', ['a', 'b'])] }, { groups: [g('g2', ['b', 'c'])] })
    expect(plan.put.groups?.[0]).toMatchObject({ id: 'g1', memberIds: ['a', 'b', 'c'] })
  })

  it('설정: 이 기기에 없는 것만, 비밀 값은 안 가져옴', () => {
    const plan = planMerge(
      { settings: [{ key: 'schoolName', value: '이 기기' }] },
      {
        settings: [
          { key: 'schoolName', value: '파일' },
          { key: 'timetable', value: [1] },
          { key: 'claudeApiKey', value: 'sk-x' },
        ],
      },
    )
    expect(plan.put.settings).toEqual([{ key: 'timetable', value: [1] }])
  })
})

describe('저장소에 합치기', () => {
  it('폰 자료 + PC 자료 → 둘 다 남고 같은 학생은 하나', async () => {
    const pc = new PeDatabase('merge-pc')
    const phone = new PeDatabase('merge-phone')
    await pc.students.bulkAdd([stu('pc1', '10101', '가나다'), stu('pc2', '10102', '라마바')] as never)
    await phone.students.bulkAdd([stu('ph1', '10101', '가나다')] as never)
    await phone.records.add({ id: 'rec', schoolYear: 2026, studentId: 'ph1', date: '2026-11-12', type: 'exemplary', category: '친구 도움', keywordIds: [], createdAt: 1, updatedAt: 1 } as never)
    const file = await exportAll(phone)
    const plan = await mergeInto(pc, file)
    expect(await pc.students.count()).toBe(2)
    const rec = await pc.records.get('rec')
    expect(rec?.studentId).toBe('pc1')
    expect(mergeSummary(plan, { records: '누가기록', students: '학생' })).toEqual(['누가기록 +1'])
    // 두 번 합쳐도 늘지 않는다
    await mergeInto(pc, file)
    expect(await pc.records.count()).toBe(1)
    expect(await pc.students.count()).toBe(2)
    // 교사가 만들지 않은 수업반이 생기지 않는다
    expect(await pc.groups.count()).toBe(0)
  })
})
