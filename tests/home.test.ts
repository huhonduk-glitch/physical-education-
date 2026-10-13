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
