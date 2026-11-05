import { describe, expect, it } from 'vitest'
import { bookingAt, bookingClashes, gearLeft, inviteText, lendStatus, weekDates, type Booking, type Gear, type Lend, type SpaceRow } from '../src/lib/space'

const row = <T,>(id: string, data: T): SpaceRow<T> => ({ id, data, updated: 0, by: '' })

describe('학교 공유 공간 계산', () => {
  it('대여 상태: 반납 · 늦음 · 빌림', () => {
    const l: Lend = { gearId: 'g', gearName: '농구공', qty: 5, teacher: '김', from: '2026-11-01', due: '2026-11-04' }
    expect(lendStatus(l, '2026-11-03')).toBe('out')
    expect(lendStatus(l, '2026-11-05')).toBe('overdue')
    expect(lendStatus({ ...l, returned: '2026-11-04' }, '2026-11-05')).toBe('returned')
  })
  it('남은 수량 = 전체 − 반납 안 한 대여', () => {
    const gear = [row<Gear>('g1', { name: '농구공', qty: 20 })]
    const lends = [row<Lend>('l1', { gearId: 'g1', gearName: '농구공', qty: 5, teacher: '김', from: 'a', due: 'b' }), row<Lend>('l2', { gearId: 'g1', gearName: '농구공', qty: 3, teacher: '이', from: 'a', due: 'b', returned: 'c' })]
    expect(gearLeft(gear, lends).get('g1')).toBe(15)
  })
  it('예약 칸 · 겹침', () => {
    const list = [row<Booking>('b1', { place: '체육관', date: '2026-11-09', period: 3, teacher: '김' }), row<Booking>('b2', { place: '체육관', date: '2026-11-09', period: 3, teacher: '이' }), row<Booking>('b3', { place: '운동장', date: '2026-11-09', period: 3, teacher: '박' })]
    expect(bookingAt(list, '운동장', '2026-11-09', 3)?.data.teacher).toBe('박')
    expect(bookingClashes(list)).toEqual(['체육관|2026-11-09|3'])
  })
  it('그 주 월~금', () => {
    expect(weekDates('2026-11-05')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(weekDates('2026-11-08')[0]).toBe('2026-11-02') // 일요일은 그 주
  })
  it('초대 글에 비밀번호는 넣지 않음', () => {
    const t = inviteText({ name: '시연고', code: 'ABCD2345' })
    expect(t).toContain('ABCD2345')
    expect(t).not.toMatch(/비밀번호\s*[:：]/)
  })
})
