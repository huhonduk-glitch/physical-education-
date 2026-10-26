import { describe, expect, it } from 'vitest'
import type { PlanItem } from '../src/db/types'
import type { TimetableEntry } from '../src/db/settings'
import {
  examDaysFromSchedule,
  fitToTarget,
  groupProgress,
  itemsFromUnits,
  itemsFromWeeks,
  itemsOn,
  meetings,
  moveItem,
  nextItem,
  offDaysFromSchedule,
  planRows,
  schedule,
  standardCoverage,
  targetFor,
  toggleSkip,
  unitBlocks,
} from '../src/lib/progressPlan'

const it_ = (id: string, o: Partial<PlanItem> = {}): PlanItem => ({ id, unit: 'U', content: id, standards: [], ...o })
// 2026-09-07 = 월요일. 이 반은 월 3교시 · 목 5교시
const tt: TimetableEntry[] = [
  { day: 1, period: 3, groupId: 'g' },
  { day: 4, period: 5, groupId: 'g' },
  { day: 2, period: 1, groupId: 'other' },
]
const term = { startDate: '2026-09-07', endDate: '2026-09-20', offDays: [] as string[] }

describe('진도표 — 목표 차시', () => {
  it('주당 시간 × 주 수', () => {
    expect(targetFor(1, 17)).toBe(17)
    expect(targetFor(2, 17)).toBe(34)
    expect(targetFor(3, 17)).toBe(51)
  })
})

describe('진도표 — 수업 날짜', () => {
  it('시간표의 이 반 칸만, 날짜·교시 순', () => {
    expect(meetings('g', tt, term)).toEqual([
      { date: '2026-09-07', period: 3 },
      { date: '2026-09-10', period: 5 },
      { date: '2026-09-14', period: 3 },
      { date: '2026-09-17', period: 5 },
    ])
  })
  it('쉬는 날과 빠진 수업은 건너뛴다', () => {
    const m = meetings('g', tt, { ...term, offDays: ['2026-09-10'] }, ['2026-09-14|3'])
    expect(m.map((x) => x.date)).toEqual(['2026-09-07', '2026-09-17'])
  })
  it('시간표에 이 반이 없거나 기간이 거꾸로면 빈 목록', () => {
    expect(meetings('none', tt, term)).toEqual([])
    expect(meetings('g', tt, { ...term, startDate: '2026-10-01' })).toEqual([])
  })
})

describe('진도표 — 차시 놓기 · 밀기', () => {
  const ms = meetings('g', tt, term)
  it('차례로 놓고, 수업이 모자라면 자리 없음', () => {
    const s = schedule([it_('a'), it_('b'), it_('c'), it_('d'), it_('e')], ms)
    expect(s.map((x) => x.meeting?.date ?? null)).toEqual(['2026-09-07', '2026-09-10', '2026-09-14', '2026-09-17', null])
    expect(s.map((x) => x.no)).toEqual([1, 2, 3, 4, 5])
  })
  it('밀기: 빠진 수업 뒤 차시가 한 칸씩 밀리고, 다시 누르면 되돌아온다', () => {
    const skips = toggleSkip([], { date: '2026-09-10', period: 5 })
    expect(skips).toEqual(['2026-09-10|5'])
    const s = schedule([it_('a'), it_('b'), it_('c')], meetings('g', tt, term, skips))
    expect(s.map((x) => x.meeting?.date)).toEqual(['2026-09-07', '2026-09-14', '2026-09-17'])
    expect(toggleSkip(skips, { date: '2026-09-10', period: 5 })).toEqual([])
  })
  it('고정한 차시(평가일)는 그날에 두고 나머지가 피해 간다', () => {
    const s = schedule([it_('a'), it_('b'), it_('test', { lockedDate: '2026-09-14' }), it_('c')], ms)
    expect(s.map((x) => [x.item.id, x.meeting?.date])).toEqual([
      ['a', '2026-09-07'],
      ['b', '2026-09-10'],
      ['test', '2026-09-14'],
      ['c', '2026-09-17'],
    ])
    // 앞에서 한 시간 빠져도 고정한 차시는 그대로
    const s2 = schedule([it_('a'), it_('b'), it_('test', { lockedDate: '2026-09-14' }), it_('c')], meetings('g', tt, term, ['2026-09-07|3']))
    expect(s2.find((x) => x.item.id === 'test')?.meeting?.date).toBe('2026-09-14')
    expect(s2.find((x) => x.item.id === 'c')?.meeting).toBeNull()
  })
  it('고정한 날에 수업이 없으면 자리 없음으로 알린다', () => {
    const s = schedule([it_('x', { lockedDate: '2026-09-08' })], ms)
    expect(s[0].meeting).toBeNull()
  })
})

describe('진도표 — 진도 비교', () => {
  const s = schedule([it_('a'), it_('b'), it_('c'), it_('d'), it_('e')], meetings('g', tt, term))
  it('오늘까지 계획 vs 끝낸 차시', () => {
    // 9/14 수업(c)은 아직 안 끝냈으니 계획에 안 셈 → a, b 2차시
    expect(groupProgress(s, ['a'], '2026-09-14')).toEqual({ planned: 2, done: 1, diff: -1, lastDone: 1, overflow: 1 })
    // 오늘 수업을 끝내면 그때 셈
    expect(groupProgress(s, ['a', 'b', 'c'], '2026-09-14')).toMatchObject({ planned: 3, done: 3, diff: 0 })
    expect(groupProgress(s, ['a', 'b', 'c', 'd'], '2026-09-10')).toMatchObject({ planned: 2, done: 4, diff: 2, lastDone: 4 })
  })
  it('그날 할 차시 · 다음 차시', () => {
    expect(itemsOn(s, '2026-09-10').map((x) => x.item.id)).toEqual(['b'])
    expect(nextItem(s, ['a', 'b'])?.item.id).toBe('c')
    expect(nextItem(s, ['a', 'b', 'c', 'd', 'e'])).toBeUndefined()
  })
})

describe('진도표 — 만들기', () => {
  it('단원별 시수로 차시 만들기', () => {
    const r = itemsFromUnits([
      { unit: '오리엔테이션', hours: 1 },
      { unit: '배드민턴 이해하기', hours: 2, standards: ['[12스생2-01-01]'] },
    ])
    expect(r.map((x) => [x.unit, x.content, x.standards])).toEqual([
      ['오리엔테이션', '오리엔테이션', []],
      ['배드민턴 이해하기', '배드민턴 이해하기 (1/2)', ['[12스생2-01-01]']],
      ['배드민턴 이해하기', '배드민턴 이해하기 (2/2)', ['[12스생2-01-01]']],
    ])
  })
  it('주차 계획 → 차시: 시수만큼 펼치고 고사 주는 차시 없이 표시만', () => {
    const r = itemsFromWeeks([
      { week: 1, hours: 1, unit: '오리엔테이션', standards: [] },
      { week: 5, hours: 2, unit: '간이 경기', standards: ['[12스생2-01-02]'], method: '탐구학습' },
      { week: 9, hours: 0, unit: '', standards: [], event: '중간고사' },
    ])
    expect(r.items).toHaveLength(3)
    expect(r.items[1]).toMatchObject({ unit: '간이 경기', content: '5주 (1/2)', method: '탐구학습', standards: ['[12스생2-01-02]'] })
    expect(r.events).toEqual([{ week: 9, label: '중간고사' }])
  })
  it('목표 차시에 맞추기: 남으면 자르고 모자라면 더한다', () => {
    const items = [it_('a'), it_('b'), it_('c')]
    expect(fitToTarget(items, 2)).toMatchObject({ cut: 1, added: 0 })
    const f = fitToTarget(items, 5)
    expect(f.items).toHaveLength(5)
    expect(f.added).toBe(2)
    expect(f.items[4].unit).toBe('U')
  })
  it('순서 바꾸기 · 단원 묶음 · 성취기준 진도', () => {
    const items = [it_('a', { unit: '이해', standards: ['[A]'] }), it_('b', { unit: '이해' }), it_('c', { unit: '경기', standards: ['[B]'] })]
    expect(moveItem(items, 2, 0).map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(moveItem(items, 0, 9).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(unitBlocks(items)).toEqual([
      { unit: '이해', from: 1, to: 2, standards: ['[A]'] },
      { unit: '경기', from: 3, to: 3, standards: ['[B]'] },
    ])
    expect(standardCoverage(items, ['[A]', '[B]', '[C]'])).toEqual([
      { code: '[A]', count: 1 },
      { code: '[B]', count: 1 },
      { code: '[C]', count: 0 },
    ])
  })
})

describe('진도표 — 학사일정 · 엑셀', () => {
  const ev = [
    { date: '2026-10-05', name: '대체공휴일', grades: [] },
    { date: '2026-10-09', name: '한글날', grades: [] },
    { date: '2026-10-12', name: '2학기 중간고사', grades: [2] },
    { date: '2026-10-20', name: '재량 휴업일', grades: [] },
    { date: '2026-10-21', name: '수학여행', grades: [1] },
    { date: '2026-12-31', name: '겨울방학', grades: [] },
  ]
  it('쉬는 날 후보 (기간 안, 띄어쓰기 무시)', () => {
    expect(offDaysFromSchedule(ev, '2026-09-01', '2026-12-20')).toEqual(['2026-10-05', '2026-10-09', '2026-10-20'])
    expect(examDaysFromSchedule(ev, '2026-09-01', '2026-12-20')).toEqual(['2026-10-12'])
  })
  it('엑셀 줄', () => {
    const s = schedule([it_('a', { unit: '이해', standards: ['[A]', '[B]'] })], meetings('g', tt, term))
    const rows = planRows(s, ['a'])
    expect(rows[0][0]).toBe('차시')
    expect(rows[1]).toEqual([1, '2026-09-07', 3, '이해', 'a', '[A] [B]', '', '', 'O'])
  })
})
