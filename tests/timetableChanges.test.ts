import { describe, expect, it } from 'vitest'
import type { TimetableChange } from '../src/db/settings'
import type { ComciData } from '../src/lib/comcigan'
import { classColumns } from '../src/lib/ledger'
import { meetings } from '../src/lib/progressPlan'
import { changeKindFor, classForNow, lessonClock, lessonsOnDate, todaysLessons, upsertChange } from '../src/lib/timetable'
import { applyCandidates, comciChanges, comciWeekStart, groupForPick } from '../src/lib/timetableChanges'

// 2026-11-23(월) ~ 27(금). 요일 시간표: 월 1교시 A, 수 2교시 A, 목 3교시 B
const tt = [
  { day: 1, period: 1, groupId: 'A' },
  { day: 3, period: 2, groupId: 'A' },
  { day: 4, period: 3, groupId: 'B' },
]
const ch = (date: string, period: number, groupId: string | null, kind: TimetableChange['kind'] = changeKindFor(null, groupId)): TimetableChange => ({ id: `${date}-${period}`, date, period, groupId, kind })

describe('이번 주만 바꾸기', () => {
  it('그날 수업: 바뀐 교시만 갈아 끼움 · 결강은 빠짐 · 보강은 더함 · 다른 날은 그대로', () => {
    const changes = [ch('2026-11-25', 2, null, '결강'), ch('2026-11-25', 5, 'B', '보강'), ch('2026-11-26', 3, 'A', '교환')]
    expect(lessonsOnDate('2026-11-25', tt, changes)).toEqual([{ day: 3, period: 5, groupId: 'B' }])
    expect(lessonsOnDate('2026-11-26', tt, changes)).toEqual([{ day: 4, period: 3, groupId: 'A' }])
    expect(lessonsOnDate('2026-12-02', tt, changes)).toEqual([{ day: 3, period: 2, groupId: 'A' }])
    expect(lessonsOnDate('2026-11-28', tt, [ch('2026-11-28', 1, 'A', '보강')])).toEqual([{ day: 6, period: 1, groupId: 'A' }]) // 토요일 보강
  })
  it('종류 추천 · 같은 날짜 · 교시는 하나만', () => {
    expect(changeKindFor('A', null)).toBe('결강')
    expect(changeKindFor(null, 'A')).toBe('보강')
    expect(changeKindFor('A', 'B')).toBe('교환')
    const l = upsertChange([ch('2026-11-26', 3, 'A')], { ...ch('2026-11-26', 3, null, '행사'), id: 'new' })
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ id: 'new', groupId: null, kind: '행사' })
  })
  it('지금 수업 · 수업 끝까지도 바뀐 수업을 따른다', () => {
    const starts = ['09:00', '10:00', '11:00', '12:00', '13:00']
    const wed10 = new Date(2026, 10, 25, 10, 20) // 수 2교시
    expect(classForNow(wed10, tt, starts, 50)).toEqual({ groupId: 'A', period: 2 })
    expect(classForNow(wed10, tt, starts, 50, [ch('2026-11-25', 2, null, '결강')])).toBeNull()
    expect(classForNow(wed10, tt, starts, 50, [ch('2026-11-25', 2, 'B', '교환')])).toEqual({ groupId: 'B', period: 2 })
    expect(todaysLessons(wed10, tt, [ch('2026-11-25', 4, 'B')]).map((l) => l.period)).toEqual([2, 4])
    expect(lessonClock(wed10, tt, starts, 50, [ch('2026-11-25', 2, null, '결강'), ch('2026-11-25', 4, 'B')])).toMatchObject({ kind: 'next', period: 4, groupId: 'B' })
  })
  it('진도표 수업 날짜: 결강이면 빠지고(뒤 차시가 밀림) 보강은 더해진다', () => {
    const plan = { startDate: '2026-11-23', endDate: '2026-11-27', offDays: [] }
    expect(meetings('A', tt, plan)).toEqual([
      { date: '2026-11-23', period: 1 },
      { date: '2026-11-25', period: 2 },
    ])
    expect(meetings('A', tt, plan, [], [ch('2026-11-25', 2, null, '결강'), ch('2026-11-27', 4, 'A', '보강')])).toEqual([
      { date: '2026-11-23', period: 1 },
      { date: '2026-11-27', period: 4 },
    ])
    // 요일 시간표에 없는 반도 보강이 있으면 수업이 생긴다
    expect(meetings('C', tt, plan, [], [ch('2026-11-24', 2, 'C')])).toEqual([{ date: '2026-11-24', period: 2 }])
  })
  it('기록표 수업일: 보강 날은 더하고 결강 날은 빼되, 그날 기록이 있으면 남김', () => {
    const cols = (keep: string[] = []) => classColumns('2026-11', 'A', tt, [ch('2026-11-25', 2, null, '결강'), ch('2026-11-27', 4, 'A', '보강')], keep).map((c) => c.date)
    expect(cols()).toContain('2026-11-27')
    expect(cols()).not.toContain('2026-11-25')
    expect(cols()).toContain('2026-11-18') // 다른 주 수요일은 그대로
    expect(cols(['2026-11-25'])).toContain('2026-11-25')
  })
})

describe('컴시간에서 이번 주 변경 가져오기', () => {
  const data = (lessons: ComciData['lessons']): ComciData => ({ school: 'x', teachers: ['', '교사01'], subjects: [], classCount: [], periodTimes: [], weeks: [], lessons })
  const L = (day: number, period: number, grade: number, classNo: number, changed = false, subject = '체육') => ({ day, period, grade, classNo, subject, teacher: '교사01', teacherNo: 1, changed })
  const groups = [
    { id: 'A', kind: 'homeroom' as const, name: '1학년 1반', grade: 1, classNo: 1 },
    { id: 'B', kind: 'homeroom' as const, name: '1학년 2반', grade: 1, classNo: 2 },
    { id: 'E', kind: 'elective' as const, name: '체육 2-1·2-2' },
  ]
  it('주 첫날 · 수업반 찾기(학적반 · 합반 이름)', () => {
    expect(comciWeekStart('26-11-23 ~ 26-11-28')).toBe('2026-11-23')
    expect(comciWeekStart('')).toBeNull()
    expect(groupForPick(groups, { subject: '체육', classes: [{ grade: 1, classNo: 2 }] })).toBe('B')
    expect(groupForPick(groups, { subject: '체육', classes: [{ grade: 2, classNo: 2 }, { grade: 2, classNo: 1 }] })).toBe('E')
    expect(groupForPick(groups, { subject: '체육', classes: [{ grade: 3, classNo: 1 }] })).toBeNull()
  })
  it('요일 시간표와 다른 칸만 · 바뀐 표시가 있으면 미리 고름 · 반을 못 찾으면 넣지 않음', () => {
    // 컴시간 이번 주: 월1 A(같음), 수2 없음(→ 결강), 목3 B(같음), 금4 1-1 바뀜(→ 보강), 화5 3-1(반 없음)
    const c = comciChanges({
      data: data([L(1, 1, 1, 1), L(4, 3, 1, 2), L(5, 4, 1, 1, true), L(2, 5, 3, 1)]),
      myNo: 1,
      label: '26-11-23 ~ 26-11-28',
      timetable: tt,
      groups,
    })
    expect(c.map((x) => [x.date, x.period, x.before, x.after, x.kind, x.flagged, x.unmapped ?? ''])).toEqual([
      ['2026-11-24', 5, null, null, '보강', false, '3-1'],
      ['2026-11-25', 2, 'A', null, '결강', true, ''],
      ['2026-11-27', 4, null, 'A', '보강', true, ''],
    ])
    const next = applyCandidates([ch('2026-11-27', 4, 'B', '교환')], c, (() => { let n = 0; return () => `n${++n}` })())
    expect(next.map((x) => [x.date, x.period, x.groupId, x.kind, x.note])).toEqual([
      ['2026-11-25', 2, null, '결강', '컴시간'],
      ['2026-11-27', 4, 'A', '보강', '컴시간'],
    ])
  })
  it('바뀐 표시가 하나도 없으면 다른 칸도 미리 고르지 않는다 (요일 시간표가 틀렸을 수 있음)', () => {
    const c = comciChanges({ data: data([L(1, 1, 1, 1), L(4, 3, 1, 2)]), myNo: 1, label: '26-11-23 ~ 26-11-28', timetable: tt, groups })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ date: '2026-11-25', period: 2, kind: '결강', flagged: false })
  })
})
