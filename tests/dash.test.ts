import { describe, expect, it } from 'vitest'
import { ddayText, leftText, marksOn, monthMarks, periodRange, pickDdays, schoolKind, weatherEmoji, weekDates } from '../src/lib/dash'
import type { WorkEvent } from '../src/lib/workCal'

const school = [
  { date: '2026-11-13', name: '학교 축제', grades: [] },
  { date: '2026-11-19', name: '대학수학능력시험', grades: [3] },
  { date: '2026-12-08', name: '2학기 2차 지필평가', grades: [] },
  { date: '2026-12-09', name: '2학기 2차 지필평가', grades: [] },
  { date: '2026-12-25', name: '성탄절', grades: [] },
]
const work: WorkEvent[] = [{ id: 'w1', date: '2026-11-16', end: '2026-11-20', title: 'PAPS 2회차 측정', kind: 'paps' }]

describe('홈 대시보드', () => {
  it('날씨 그림: 비 · 눈이 먼저, 밤에 맑으면 달', () => {
    expect(weatherEmoji(1, 1, 10)).toBe('🌧️')
    expect(weatherEmoji(3, 4, 10)).toBe('❄️')
    expect(weatherEmoji(0, 1, 10)).toBe('☀️')
    expect(weatherEmoji(0, 1, 21)).toBe('🌙')
    expect(weatherEmoji(0, 3, 10)).toBe('⛅')
    expect(weatherEmoji(0, 4, 3)).toBe('☁️')
    expect(weatherEmoji(undefined, undefined, 10)).toBe('🌡️')
  })
  it('학사일정 종류: 고사 · 쉬는 날 · 그 밖', () => {
    expect(schoolKind('2학기 2차 지필평가')).toBe('exam')
    expect(schoolKind('성탄절')).toBe('off')
    expect(schoolKind('겨울 방학')).toBe('off')
    expect(schoolKind('학교 축제')).toBe('school')
  })
  it('그날 일정: 업무 일정(여러 날) 먼저, 학사일정 다음', () => {
    expect(marksOn('2026-11-19', school, work).map((m) => [m.label, m.kind])).toEqual([
      ['PAPS 2회차 측정', 'work'],
      ['대학수학능력시험', 'exam'],
    ])
    expect(marksOn('2026-11-12', school, work)).toEqual([])
    const map = monthMarks(['2026-11-12', '2026-11-13', '2026-11-18'], school, work)
    expect([...map.keys()]).toEqual(['2026-11-13', '2026-11-18'])
  })
  it('D-day: 업무 일정 · 고사가 먼저, 같은 이름은 첫날만', () => {
    const d = pickDdays(school, work, '2026-11-12')
    expect(d[0]).toMatchObject({ title: 'PAPS 2회차 측정', days: 4, kind: 'work' })
    expect(d.map((x) => x.title)).toEqual(['PAPS 2회차 측정', '학교 축제', '대학수학능력시험', '2학기 2차 지필평가', '성탄절'])
    // 진행 중인 업무 일정은 D-Day
    expect(pickDdays([], work, '2026-11-18')[0]).toMatchObject({ days: 0 })
    // 고사 · 업무가 없으면 가장 가까운 학사일정
    expect(pickDdays([school[0], school[4]], [], '2026-11-12')[0].title).toBe('학교 축제')
    expect(pickDdays([], [], '2026-11-12')).toEqual([])
    expect(ddayText(0)).toBe('D-Day')
    expect(ddayText(7)).toBe('D-7')
  })
  it('교시 시각 · 남은 시간 · 이번 주 날짜', () => {
    expect(periodRange('08:40', 50)).toBe('08:40~09:30')
    expect(periodRange(undefined, 50)).toBe('')
    expect(leftText(40)).toBe('40초')
    expect(leftText(61)).toBe('2분')
    expect(leftText(3900)).toBe('1시간 5분')
    expect(weekDates('2026-11-12')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
    expect(weekDates('2026-11-15')[0]).toBe('2026-11-09') // 일요일 → 지난 월요일
  })
})
