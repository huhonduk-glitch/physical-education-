import { describe, expect, it } from 'vitest'
import { defaultSettings, type AppSettings } from '../src/db/settings'
import type { Assessment, ProgressPlan } from '../src/db/types'
import { budgetOf, carryAssessment, carryEvents, carryPlan, newYearDue, newYearPatch, shiftYear } from '../src/lib/newYear'
import { packPlan, unpackPlan } from '../src/lib/share'
import type { WorkEvent } from '../src/lib/workCal'

const card = { fetchedAt: 1, fileName: '사업관리카드.xls', card: { items: [], total: null } } as unknown as NonNullable<AppSettings['budgetCard']>
const manualItem = { key: 'm1', name: '배구공', budget: 100000, spent: 0 } as unknown as AppSettings['budgetManual'][number]

function settings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    ...defaultSettings(),
    schoolYear: 2026,
    latestYear: 2026,
    schoolName: '가상고등학교',
    timetable: [{ day: 1, period: 2, groupId: 'g1' }],
    periodStarts: ['08:40', '09:40'],
    neisSchool: { code: 'S1' } as unknown as AppSettings['neisSchool'],
    comciSchool: { code: 1 } as unknown as AppSettings['comciSchool'],
    comciTeacherName: '교사01',
    neisSchedule: { fetchedAt: 1, events: [] },
    neisPeWeek: { fetchedAt: 1, from: '2026-11-09', slots: [] },
    comciWeek: { fetchedAt: 1, week: 1, label: '', myNo: null, peNos: [], data: {} as never },
    weatherLoc: { nx: 60, ny: 127 } as unknown as AppSettings['weatherLoc'],
    space: { code: 'abc' } as unknown as AppSettings['space'],
    budgetCard: card,
    budgetManual: [manualItem],
    budgetPicks: { m1: true },
    seteukStyle: '내 문체',
    ...over,
  }
}

describe('새 학년도 설정 바꾸기', () => {
  it('같은 학교: 학년도 · 시간표 · 받아 둔 일정과 주간 시간표를 비우고, 예산은 지난 학년도로 보관', () => {
    const s = settings()
    const p = newYearPatch(s, { next: 2027, moved: false })
    expect(p).toMatchObject({ schoolYear: 2027, latestYear: 2027, timetable: [], neisSchedule: null, neisPeWeek: null, comciWeek: null, budgetCard: null, budgetManual: [] })
    expect(p.budgetArchive?.['2026']).toEqual({ card, manual: [manualItem] })
    // 학교 정보 · 교시 시각 · 날씨 · 공유 공간 · 고른 예산 항목 · 세특 문체는 그대로 (바꾸는 칸에 없음)
    for (const k of ['schoolName', 'neisSchool', 'comciSchool', 'periodStarts', 'weatherLoc', 'space', 'budgetPicks', 'seteukStyle', 'comciTeacherName'] as const) expect(k in p).toBe(false)
  })

  it('다른 학교로 옮김: 학교에 딸린 것도 비움 (선생님 이름 · 문체 · 키는 그대로)', () => {
    const s = settings()
    const p = newYearPatch(s, { next: 2027, moved: true })
    const d = defaultSettings()
    expect(p).toMatchObject({ schoolName: '', neisSchool: null, comciSchool: null, weatherLoc: null, weatherCache: null, space: null, budgetPicks: {} })
    expect(p.periodStarts).toEqual(d.periodStarts)
    expect(p.periodMinutes).toBe(d.periodMinutes)
    expect(p.budgetLayout).toEqual(d.budgetLayout)
    expect('comciTeacherName' in p).toBe(false)
    expect('seteukStyle' in p).toBe(false)
  })

  it('예산이 비어 있으면 보관하지 않고, 이미 보관한 다른 해는 그대로', () => {
    const s = settings({ budgetCard: null, budgetManual: [], budgetArchive: { '2025': { card, manual: [] } } })
    const p = newYearPatch(s, { next: 2027, moved: false })
    expect(p.budgetArchive).toEqual({ '2025': { card, manual: [] } })
  })
})

describe('보고 있는 학년도의 예산', () => {
  it('지금 학년도는 지금 예산, 지난 학년도는 보관한 예산', () => {
    const now = settings({ schoolYear: 2027, latestYear: 2027, budgetCard: null, budgetManual: [], budgetArchive: { '2026': { card, manual: [manualItem] } } })
    expect(budgetOf(now)).toEqual({ card: null, manual: [], archived: false })
    expect(budgetOf({ ...now, schoolYear: 2026 })).toEqual({ card, manual: [manualItem], archived: true })
    expect(budgetOf({ ...now, schoolYear: 2025 })).toEqual({ card: null, manual: [], archived: true })
  })
  it('학년도를 한 번도 넘기지 않았으면(latestYear 0) 지금 예산', () => {
    expect(budgetOf(settings({ latestYear: 0 })).card).toBe(card)
  })
})

describe('3월 새 학년도 알림', () => {
  it('3월 1일부터 다음 학년도를 알림, 1 · 2월은 아직 지난 학년도', () => {
    const s = settings()
    expect(newYearDue(s, new Date(2027, 1, 28))).toBeNull()
    expect(newYearDue(s, new Date(2027, 2, 1))).toBe(2027)
    expect(newYearDue(s, new Date(2026, 10, 15))).toBeNull()
  })
  it('지난 학년도를 보고 있어도 가장 최근 학년도로 판단', () => {
    expect(newYearDue(settings({ schoolYear: 2025, latestYear: 2026 }), new Date(2026, 5, 1))).toBeNull()
    expect(newYearDue(settings({ schoolYear: 2025, latestYear: 2026 }), new Date(2027, 2, 2))).toBe(2027)
  })
})

const plan: ProgressPlan = {
  id: 'p1',
  schoolYear: 2026,
  semester: 2,
  title: '1학년 체육1 (농구)',
  subject: '체육1',
  grade: 1,
  weeklyHours: 2,
  weeks: 17,
  target: 34,
  startDate: '2026-08-18',
  endDate: '2026-12-31',
  offDays: ['2026-10-03'],
  groupIds: ['g1'],
  items: [
    { id: 'i1', unit: '농구', content: '드리블', standards: ['[12체02-01]'] },
    { id: 'i2', unit: '농구', content: '수행평가', standards: [], lockedDate: '2026-11-20' },
  ],
  skips: { g1: ['2026-09-01|2'] },
  done: { g1: ['i1'] },
  extras: [{ when: '9월 2주', label: '안전' }],
  createdAt: 1,
  updatedAt: 2,
}

describe('지난해 진도표 · 수행평가 가져오기', () => {
  it('진도표: 차시는 그대로, 반 · 끝냄 · 빠짐은 빼고, 날짜는 새 학년도 학기로 (고정 날짜 · 쉬는 날은 풀림)', () => {
    const p = carryPlan(plan, { id: 'n1', schoolYear: 2027, now: 9 })
    expect(p).toMatchObject({ id: 'n1', schoolYear: 2027, groupIds: [], done: {}, skips: {}, offDays: [], title: plan.title, target: 34, startDate: '2027-08-17', endDate: '2027-12-31', createdAt: 9 })
    expect(p.items.map((i) => i.content)).toEqual(['드리블', '수행평가'])
    expect(p.items[1].lockedDate).toBeUndefined()
    expect(p.extras).toEqual(plan.extras)
    expect(plan.items[1].lockedDate).toBe('2026-11-20') // 원본은 그대로
  })
  it('같은 학년도에 받은 진도표는 날짜 · 쉬는 날을 그대로 (같은 학교 선생님이 보낸 것)', () => {
    const p = unpackPlan(packPlan(plan), { id: 'n2', schoolYear: 2026, groupIds: [], now: 1 })
    expect(p).toMatchObject({ startDate: '2026-08-18', offDays: ['2026-10-03'] })
    expect(p.items[1].lockedDate).toBe('2026-11-20')
  })
  it('다른 학년도에 만든 진도표를 받으면 받는 학년도 학기로', () => {
    const p = unpackPlan(packPlan({ ...plan, semester: 1, startDate: '2025-03-03', endDate: '2025-07-18' }), { id: 'n3', schoolYear: 2026, groupIds: ['g'], now: 1 })
    expect(p).toMatchObject({ startDate: '2026-03-02', endDate: '2026-07-18', offDays: [] })
  })
  it('수행평가: 채점 요소는 그대로, 반 연결은 빼고 이 학년도로', () => {
    const a: Assessment = { id: 'a1', schoolYear: 2026, title: '농구 레이업 슛', grade: 1, rubric: [], altTaskEnabled: true, groupIds: ['g1'], items: [{ id: 'e1', label: '기능', method: 'score', max: 30 } as never], semester: 2 }
    const c = carryAssessment(a, { id: 'n4', schoolYear: 2027 })
    expect(c).toMatchObject({ id: 'n4', schoolYear: 2027, groupIds: [], title: '농구 레이업 슛', semester: 2 })
    expect(c.items).toEqual(a.items)
  })
})

describe('업무 달력 일정 1년 뒤로', () => {
  const ev = (id: string, date: string, end?: string): WorkEvent => ({ id, date, end, title: id, kind: 'etc' })
  it('날짜를 1년 뒤로 (2월 29일은 28일)', () => {
    expect(shiftYear('2026-05-04', 1)).toBe('2027-05-04')
    expect(shiftYear('2028-02-29', 1)).toBe('2029-02-28')
  })
  it('지난 학년도(3월 ~ 다음 해 2월)에 직접 넣은 일정만 후보, 교육청 제출 일정은 빼고', () => {
    const list = [ev('a', '2026-03-10'), ev('b', '2027-02-20'), ev('c', '2026-02-27'), ev('pedocs-2026-0-04-10', '2026-04-10'), ev('d', '2027-03-02')]
    const got = carryEvents(list, 2026)
    expect(got.map((e) => e.from)).toEqual(['a', 'b'])
    expect(got.map((e) => e.event.date)).toEqual(['2027-03-10', '2028-02-20'])
  })
  it('여러 날 일정은 끝날도 옮기고, 새 id', () => {
    const [g] = carryEvents([ev('a', '2026-07-20', '2026-07-24')], 2026, () => 'new')
    expect(g.event).toEqual({ id: 'new', date: '2027-07-20', end: '2027-07-24', title: 'a', kind: 'etc' })
  })
})
