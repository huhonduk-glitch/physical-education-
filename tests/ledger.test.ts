import { describe, expect, it } from 'vitest'
import { ledgerCells, ledgerColumns, ledgerTotals, shiftMonth, weekOfMonth, weekSpans } from '../src/lib/ledger'

describe('누가 기록표 (나이스 모양)', () => {
  it('주차: 1일이 있는 주가 1주, 월요일마다 다음 주', () => {
    // 2026-11-01은 일요일
    expect(weekOfMonth('2026-11-01')).toBe(1)
    expect(weekOfMonth('2026-11-02')).toBe(2)
    expect(weekOfMonth('2026-11-09')).toBe(3)
    expect(weekOfMonth('2026-11-30')).toBe(6)
  })
  it('수업 요일 날짜 + 기록 있는 다른 날', () => {
    const cols = ledgerColumns('2026-11', new Set([1, 3]), ['2026-11-07', '2026-10-30'])
    expect(cols.slice(0, 3).map((c) => c.date)).toEqual(['2026-11-02', '2026-11-04', '2026-11-07'])
    expect(cols.every((c) => c.date.startsWith('2026-11'))).toBe(true)
    expect(cols.filter((c) => c.weekday === 1).length).toBe(5)
    expect(weekSpans(cols.slice(0, 5)).map((w) => [w.week, w.span])).toEqual([
      [2, 3],
      [3, 2],
    ])
  })
  it('칸: 칭찬 · 지도 · 견학 · 출결(무거운 것)', () => {
    const cells = ledgerCells(
      [
        { studentId: 'a', date: '2026-11-02', type: 'exemplary' },
        { studentId: 'a', date: '2026-11-02', type: 'exemplary' },
        { studentId: 'a', date: '2026-11-02', type: 'unprepared' },
      ],
      [{ studentId: 'b', date: '2026-11-02' }],
      [
        { studentId: 'b', date: '2026-11-04', status: 'late' },
        { studentId: 'b', date: '2026-11-04', status: 'absent' },
      ],
    )
    expect(cells.get('a|2026-11-02')).toMatchObject({ praise: 2, guide: 1 })
    expect(cells.get('b|2026-11-02')?.absence).toBe(true)
    expect(cells.get('b|2026-11-04')?.attend).toBe('absent')
    const cols = ledgerColumns('2026-11', new Set([1, 3]))
    expect(ledgerTotals(cells, 'b', cols)).toEqual({ praise: 0, guide: 0, absence: 1, absent: 1 })
  })
  it('달 넘기기', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
