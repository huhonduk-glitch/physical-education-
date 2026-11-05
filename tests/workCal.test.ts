import { describe, expect, it } from 'vitest'
import { dday, eventsOn, mergeEvents, monthGrid, upcoming, type WorkEvent } from '../src/lib/workCal'

const ev = (id: string, date: string, title: string, end?: string): WorkEvent => ({ id, date, title, kind: 'etc', ...(end ? { end } : {}) })

describe('업무 달력', () => {
  it('달력 칸: 월요일 시작, 그 달을 덮는 주만', () => {
    const g = monthGrid('2026-11') // 11/1 일요일
    expect(g[0][0]).toMatchObject({ date: '2026-10-26', out: true })
    expect(g[0][6]).toMatchObject({ date: '2026-11-01', out: false })
    expect(g[g.length - 1].some((c) => c.date === '2026-11-30')).toBe(true)
    expect(g.length).toBe(6)
    expect(monthGrid('2027-02').length).toBe(4) // 2027-02-01 월요일, 28일
  })
  it('여러 날 일정 · 다가오는 일정', () => {
    const list = [ev('a', '2026-11-10', 'PAPS 측정', '2026-11-14'), ev('b', '2026-11-20', '나이스 입력 마감'), ev('c', '2026-12-30', '먼 일정')]
    expect(eventsOn('2026-11-12', list).map((e) => e.id)).toEqual(['a'])
    expect(upcoming(list, '2026-11-12').map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('받은 일정 합치기: 같은 날 · 제목은 건너뜀', () => {
    let n = 0
    const r = mergeEvents([ev('a', '2026-11-20', '나이스 입력 마감')], [{ date: '2026-11-20', title: '나이스 입력 마감 ', kind: 'neis' }, { date: '2026-11-21', title: '교육감배', kind: 'contest' }, { date: 'x', title: '잘못', kind: 'etc' }], () => `n${++n}`)
    expect(r.added).toBe(1)
    expect(r.list.map((e) => e.title)).toEqual(['나이스 입력 마감', '교육감배'])
  })
  it('D-day', () => {
    expect(dday('2026-11-20', '2026-11-17')).toBe('D-3')
    expect(dday('2026-11-17', '2026-11-17')).toBe('D-Day')
  })
})
