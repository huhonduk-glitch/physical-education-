import { describe, expect, it } from 'vitest'
import { defaultTerm, heldClasses, heldNote, planSessions, termFromSchedule, termSessions } from '../src/lib/creditBase'

describe('출석률의 수업 횟수', () => {
  it('고르는 순서: 진도표 → 시간표 → 기록한 날', () => {
    expect(heldClasses({ planTarget: 34, sessions: 30, recordedDays: 5 })).toEqual({ held: 34, source: 'plan' })
    expect(heldClasses({ planTarget: 0, sessions: 30, recordedDays: 5 })).toEqual({ held: 30, source: 'timetable' })
    expect(heldClasses({ planTarget: 0, sessions: 0, recordedDays: 5 })).toEqual({ held: 5, source: 'records' })
  })
  it('학기 기간 어림', () => {
    expect(defaultTerm(2026, 2)).toEqual({ start: '2026-08-16', end: '2026-12-31' })
    expect(defaultTerm(2026, 1).start).toBe('2026-03-02')
  })
  it('시간표로 세기: 이 반 교시 × 학기, 휴업일 · 방학은 빼고', () => {
    // 2026-11-02(월) ~ 2026-11-13(금), 이 반은 월 · 수 1교시씩 → 4번
    const tt = [
      { day: 1, period: 1, groupId: 'g' },
      { day: 3, period: 2, groupId: 'g' },
      { day: 2, period: 1, groupId: 'other' },
    ]
    const term = { start: '2026-11-02', end: '2026-11-13' }
    expect(termSessions('g', tt, term, [])).toBe(4)
    // 11/4(수) 재량휴업일
    expect(termSessions('g', tt, term, [{ date: '2026-11-04', name: '재량휴업일', grades: [] }])).toBe(3)
    // 다른 학년만 쉬는 날은 빼지 않음
    expect(termSessions('g', tt, term, [{ date: '2026-11-04', name: '재량휴업일', grades: [3] }], 1)).toBe(4)
  })
})

describe('출석률 수업 횟수 다듬기 (2026-11-14)', () => {
  const ev = (date: string, name: string, grades: number[] = []) => ({ date, name, grades })
  it('학기 기간을 학사일정의 방학식 · 개학식에서 찾음', () => {
    const events = [ev('2026-07-17', '여름방학식'), ev('2026-07-18', '여름방학'), ev('2026-08-14', '여름방학'), ev('2026-08-17', '개학식'), ev('2027-01-06', '겨울방학식')]
    expect(termFromSchedule(2026, 1, events)).toEqual({ start: '2026-03-02', end: '2026-07-17' })
    expect(termFromSchedule(2026, 2, events)).toEqual({ start: '2026-08-17', end: '2027-01-06' })
    expect(termFromSchedule(2026, 0, events).end).toBe('2027-01-06')
  })
  it('방학식이 없으면 방학 날짜로, 아무것도 없으면 어림값', () => {
    const events = [ev('2026-07-22', '여름방학'), ev('2026-08-18', '여름방학'), ev('2026-12-31', '겨울방학')]
    expect(termFromSchedule(2026, 1, events).end).toBe('2026-07-21')
    expect(termFromSchedule(2026, 2, events)).toEqual({ start: '2026-08-19', end: '2026-12-30' })
    expect(termFromSchedule(2026, 2, [])).toEqual(defaultTerm(2026, 2))
    // 다른 학년만의 일정은 보지 않음
    expect(termFromSchedule(2026, 1, [ev('2026-07-10', '방학식', [3])], 1).end).toBe('2026-07-31')
  })
  it('진도표로 센 수: 쉬는 날 · 빠진 수업 빼고, 목표와 다르면 같이 보여 줌', () => {
    const tt = [{ day: 1, period: 1, groupId: 'g' }, { day: 3, period: 2, groupId: 'g' }]
    const plan = { startDate: '2026-11-02', endDate: '2026-11-13', offDays: ['2026-11-04'], skips: { g: ['2026-11-09|1'] } }
    expect(planSessions('g', tt, plan)).toBe(2)
    const h = heldClasses({ planTarget: 4, sessions: 0, recordedDays: 0, planSessions: 2 })
    expect(h).toEqual({ held: 4, source: 'plan', counted: 2 })
    expect(heldNote(h)).toBe('진도표 목표 차시 · 시간표로 세면 2번')
    expect(heldClasses({ planTarget: 4, sessions: 0, recordedDays: 0, planSessions: 4 })).toEqual({ held: 4, source: 'plan' })
  })
})
