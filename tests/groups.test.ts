import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { runGroupMigration } from '../src/db/groupsRepo'
import type { ClassGroup, Student } from '../src/db/types'
import { groupMembers, matchMembers, memberNo, missingHomerooms } from '../src/lib/groups'
import { parsePastedRoster } from '../src/lib/rosterParser'

const st = (id: string, grade: number, classNo: number, number: number, name: string, extra: Partial<Student> = {}): Student => ({
  id,
  schoolYear: 2026,
  grade,
  classNo,
  classCode: String(classNo).padStart(2, '0'),
  number,
  name,
  gender: 'F',
  studentCode: `${grade}${String(classNo).padStart(2, '0')}${String(number).padStart(2, '0')}`,
  status: '재학',
  memo: '',
  ...extra,
})
const students = [st('a', 2, 1, 2, '학생가'), st('b', 2, 1, 1, '학생나'), st('c', 2, 3, 5, '학생다'), st('d', 2, 3, 6, '학생라', { status: '전출' })]
const group = (p: Partial<ClassGroup>): ClassGroup => ({
  id: 'g',
  schoolYear: 2026,
  semester: 0,
  kind: 'homeroom',
  name: '',
  subject: '체육',
  memberIds: [],
  color: 'blue',
  sortOrder: 0,
  archived: false,
  createdAt: 0,
  ...p,
})

describe('수업반 학생', () => {
  it('학적반은 학년·반으로 찾고 번호순, 전출생 빼기', () => {
    expect(groupMembers(group({ grade: 2, classNo: 1 }), students).map((s) => s.id)).toEqual(['b', 'a'])
    expect(groupMembers(group({ grade: 2, classNo: 3 }), students).map((s) => s.id)).toEqual(['c'])
  })
  it('수강반은 고른 학생만 학번순, 카드 번호는 학번', () => {
    const g = group({ kind: 'elective', memberIds: ['c', 'a', 'd'] })
    expect(groupMembers(g, students).map((s) => s.id)).toEqual(['a', 'c'])
    expect(memberNo(g, students[0])).toBe('20102')
    expect(memberNo(group({ grade: 2, classNo: 1 }), students[0])).toBe('2')
  })
  it('아직 수업반이 없는 학적반', () => {
    expect(missingHomerooms(students, [group({ grade: 2, classNo: 1 })], 2026)).toEqual([{ grade: 2, classNo: 3 }])
  })
})

describe('수강반 명단 붙여넣기 맞추기', () => {
  const rows = (text: string) => parsePastedRoster(text, { grade: null, classNo: null }).rows
  it('학번으로 찾고, 명렬에 없는 학생은 새로 만들 목록에', () => {
    const m = matchMembers(rows('20102 학생가\n20305 학생다\n20407 학생마'), students, 2026)
    expect(m.found.map((s) => s.id)).toEqual(['a', 'c'])
    expect(m.create).toEqual([{ grade: 2, classNo: 4, number: 7, name: '학생마', gender: null }])
    expect(m.problems).toEqual([])
  })
  it('이름만 있으면 이름으로 찾는다. 없는 이름·이름 다름은 문제로', () => {
    const m = matchMembers(rows('학생나\n학생하\n20102 학생카'), students, 2026)
    expect(m.found.map((s) => s.id)).toEqual(['b'])
    expect(m.problems.map((p) => p.text)).toEqual([
      '학생하 — 명렬에 없어요. 학번(예: 10312)을 같이 적으면 새로 만들어요',
      '2-1-2 학생카 — 명렬에는 학생가(으)로 되어 있어요',
    ])
  })
  it('전출생은 찾지 않는다, 같은 학생 두 번은 한 번만', () => {
    const m = matchMembers(rows('학생라\n20102 학생가\n20102 학생가'), students, 2026)
    expect(m.found.map((s) => s.id)).toEqual(['a'])
    expect(m.problems).toHaveLength(1)
  })
})

describe('예전 자료(v2) → 수업반(v3) 옮기기', () => {
  let name = ''
  afterEach(async () => {
    await Dexie.delete(name)
  })

  it('저장소를 열면 학적반 수업반이 생기고 기록·견학·시간표가 거기에 붙는다', async () => {
    name = `mig-${Math.random()}`
    // 예전 버전(v2) 저장소를 흉내 낸다
    const old = new Dexie(name)
    old.version(2).stores({
      settings: 'key',
      students: 'id, schoolYear, [schoolYear+grade+classNo], [schoolYear+grade+classNo+number], studentCode, status',
      records: 'id, schoolYear, studentId, date, type, [studentId+date]',
      captains: 'id, schoolYear, [schoolYear+grade+classNo], studentId',
      absences: 'id, schoolYear, studentId, date',
      keywords: 'id, category, isActive, sortOrder',
      papsConfigs: 'id, [schoolYear+grade+classNo]',
      papsResults: 'id, schoolYear, studentId, eventId, [studentId+eventId]',
      assessments: 'id, schoolYear, grade',
      assessmentScores: 'id, assessmentId, studentId, [assessmentId+studentId]',
      timerPresets: 'id',
      audioFiles: 'id',
    })
    await old.open()
    await old.table('students').bulkAdd(students)
    await old.table('records').add({ id: 'r1', schoolYear: 2026, studentId: 'c', date: '2026-04-01', type: 'exemplary', category: '정리정돈', keywordIds: [], createdAt: 1, updatedAt: 1 })
    await old.table('absences').add({ id: 'x1', schoolYear: 2026, studentId: 'a', date: '2026-04-02', reason: '부상', altTaskDone: false })
    await old.table('settings').bulkPut([
      { key: 'schoolYear', value: 2026 },
      { key: 'timetable', value: [{ day: 1, period: 1, grade: 2, classNo: 3 }] },
    ])
    old.close()

    const db = new PeDatabase(name)
    const groups = await db.groups.toArray()
    expect(groups.map((g) => g.name).sort()).toEqual(['2학년 1반', '2학년 3반'])
    const g3 = groups.find((g) => g.classNo === 3)!
    expect((await db.records.get('r1'))?.groupId).toBe(g3.id)
    expect((await db.absences.get('x1'))?.groupId).toBe(groups.find((g) => g.classNo === 1)!.id)
    expect((await db.settings.get('timetable'))?.value).toEqual([{ day: 1, period: 1, groupId: g3.id }])
    expect(await db.records.where('[groupId+date]').equals([g3.id, '2026-04-01']).count()).toBe(1)

    // 다시 돌려도 그대로 (백업 복원 뒤에도 쓰는 함수)
    await runGroupMigration(db)
    expect(await db.groups.count()).toBe(2)
    db.close()
  })
})
