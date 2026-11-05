import { describe, expect, it } from 'vitest'
import { defaultTerm, heldClasses, termSessions } from '../src/lib/creditBase'

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
