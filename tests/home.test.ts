import { describe, expect, it } from 'vitest'
import { lessonFocus, setupProgress, setupSteps } from '../src/lib/home'

const starts = ['09:00', '10:00', '11:00', '12:00', '13:50']
const tt = [
  { day: 2, period: 1, groupId: 'a' },
  { day: 2, period: 3, groupId: 'b' },
  { day: 2, period: 5, groupId: 'c' },
]
const tue = (h: number, m: number) => new Date(2026, 9, 13, h, m) // 2026-10-13 화요일

describe('홈: 시작 준비', () => {
  it('처음: 0/4, 다음 할 일은 명렬', () => {
    const p = setupProgress(setupSteps({ students: 0, groups: 0, timetable: 0, lastBackupAt: 0 }))
    expect(p).toMatchObject({ done: 0, total: 4 })
    expect(p.next?.id).toBe('roster')
  })
  it('명렬·수업반 끝 → 다음은 시간표(선택), 다 하면 next 없음', () => {
    const p = setupProgress(setupSteps({ students: 25, groups: 1, timetable: 0, lastBackupAt: 0 }))
    expect(p.done).toBe(2)
    expect(p.next?.id).toBe('timetable')
    expect(setupProgress(setupSteps({ students: 25, groups: 1, timetable: 3, lastBackupAt: 1 })).next).toBeNull()
  })
})

describe('홈: 지금·다음 수업', () => {
  it('수업 중이면 지금 수업', () => {
    expect(lessonFocus(tue(10, 55), tt, starts, 50)).toMatchObject({ status: 'now', entry: { groupId: 'b' } }) // 시작 10분 전부터 '지금'
    expect(lessonFocus(tue(11, 5), tt, starts, 50)).toMatchObject({ status: 'now', entry: { groupId: 'b' }, start: '11:00' })
  })
  it('쉬는 시간·빈 교시면 오늘 남은 다음 수업', () => {
    expect(lessonFocus(tue(8, 0), tt, starts, 50)).toMatchObject({ status: 'next', entry: { groupId: 'a' } })
    expect(lessonFocus(tue(12, 20), tt, starts, 50)).toMatchObject({ status: 'next', entry: { groupId: 'c' }, start: '13:50' })
  })
  it('오늘 수업이 끝났거나 없는 요일이면 null', () => {
    expect(lessonFocus(tue(16, 0), tt, starts, 50)).toBeNull()
    expect(lessonFocus(new Date(2026, 9, 14, 9, 5), tt, starts, 50)).toBeNull()
  })
})

describe('수업 시간에 맞추기 (타이머)', () => {
  it('지금 수업 끝까지 · 다음 수업 시작까지 남은 초', async () => {
    const { lessonClock } = await import('../src/lib/timetable')
    const tt = [
      { day: 3, period: 2, groupId: 'a' },
      { day: 3, period: 5, groupId: 'b' },
      { day: 4, period: 1, groupId: 'c' },
    ]
    const starts = ['08:40', '09:40', '10:40', '11:40', '13:30', '14:30']
    const at = (h: number, m: number, s = 0) => new Date(2026, 10, 11, h, m, s) // 2026-11-11 수요일
    expect(lessonClock(at(9, 50, 30), tt, starts, 50)).toEqual({ kind: 'now', period: 2, groupId: 'a', seconds: 39 * 60 + 30 })
    // 쉬는 시간 · 수업 전 10분도 '다음 수업'
    expect(lessonClock(at(9, 35), tt, starts, 50)).toEqual({ kind: 'next', period: 2, groupId: 'a', seconds: 300 })
    expect(lessonClock(at(10, 30), tt, starts, 50)).toEqual({ kind: 'next', period: 5, groupId: 'b', seconds: 3 * 3600 })
    expect(lessonClock(at(14, 20), tt, starts, 50)).toBeNull() // 5교시 끝난 뒤
    expect(lessonClock(new Date(2026, 10, 14, 9, 50), tt, starts, 50)).toBeNull() // 토요일
    expect(lessonClock(at(9, 50), tt, [], 50)).toBeNull() // 교시 시각 없음
  })
})
