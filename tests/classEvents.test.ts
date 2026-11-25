import { describe, expect, it } from 'vitest'
import type { PapsRound, PlanItem, ProgressPlan } from '../src/db/types'
import { classEvents } from '../src/lib/classEvents'
import { marksOn } from '../src/lib/dash'

const item = (id: string, evalNote?: string): PlanItem => ({ id, unit: '농구', content: id, standards: [], evalNote })
// 2026-09-07(월)부터 두 주, 1-1은 월 · 수 2교시
const plan: ProgressPlan = {
  id: 'p',
  schoolYear: 2026,
  semester: 2,
  title: '체육',
  subject: '체육',
  weeklyHours: 2,
  weeks: 2,
  target: 4,
  startDate: '2026-09-07',
  endDate: '2026-09-20',
  offDays: [],
  groupIds: ['g1', 'gone'],
  items: [item('a'), item('b', '레이업 슛 수행평가'), item('c'), item('d')],
  skips: {},
  done: {},
  createdAt: 0,
  updatedAt: 0,
}
const timetable = [
  { day: 1, period: 2, groupId: 'g1' },
  { day: 3, period: 2, groupId: 'g1' },
]
const round = (grade: number, classNo: number, r: number, date: string): PapsRound => ({ id: `${grade}${classNo}${r}`, schoolYear: 2026, grade, classNo, round: r, date, createdAt: 0 })

describe('달력의 수업 일정', () => {
  it('진도표: 평가 연계를 적은 차시만, 계산한 날짜 · 교시로 (없는 반은 건너뜀)', () => {
    const ev = classEvents({ plans: [plan], groups: [{ id: 'g1', name: '1학년 1반' }], timetable, rounds: [] })
    // a = 9/7(월), b = 9/9(수)
    expect(ev).toEqual([{ date: '2026-09-09', label: '1학년 1반 2교시 평가: 레이업 슛 수행평가', kind: 'eval' }])
  })
  it('PAPS: 같은 날 같은 회차는 반을 모아 한 줄 · 날짜 없는 회차는 뺌', () => {
    const ev = classEvents({ plans: [], groups: [], timetable: [], rounds: [round(1, 2, 2, '2026-10-05'), round(1, 1, 2, '2026-10-05'), round(2, 1, 1, '2026-10-06'), round(1, 3, 3, '')] })
    expect(ev).toEqual([
      { date: '2026-10-05', label: 'PAPS 2회차 측정 (1-1 · 1-2)', kind: 'paps' },
      { date: '2026-10-06', label: 'PAPS 1회차 측정 (2-1)', kind: 'paps' },
    ])
  })
  it('달력 칸: 업무 일정 다음 · 학사일정 앞, 수업 일정 색', () => {
    const m = marksOn('2026-10-05', [{ date: '2026-10-05', name: '체육대회' }] as never, [], [{ date: '2026-10-05', label: 'PAPS 2회차 측정 (1-1)', kind: 'paps' }])
    expect(m.map((x) => [x.kind, x.label])).toEqual([
      ['class', 'PAPS 2회차 측정 (1-1)'],
      ['school', '체육대회'],
    ])
  })
})
