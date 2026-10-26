import { describe, expect, it } from 'vitest'
import { looksLikePe, slotGroups, type NeisLesson } from '../src/lib/neisOpenApi'
import { groupLabel, maxPeriod, peCells, peSummary } from '../src/lib/peTimetable'

const L = (day: number, period: number, grade: number, classNo: number, subject: string): NeisLesson => ({ date: '', day, period, grade, classNo, className: String(classNo), subject })

describe('전체 체육 시간표', () => {
  const lessons = [
    L(1, 1, 1, 1, '체육'),
    L(1, 1, 1, 2, '체육'), // 같은 시각 같은 과목 다른 반 → 합반으로 한 묶음
    L(1, 1, 2, 3, '스포츠 생활2'), // 같은 시각 다른 체육 수업 → 겹침
    L(1, 2, 1, 1, '수학'),
    L(2, 3, 3, 1, '운동과 건강'),
    L(2, 7, 2, 1, '스포츠 생활2'),
  ]
  const pe = slotGroups(lessons, looksLikePe)
  const cells = peCells(pe, [
    { day: 1, period: 1 },
    { day: 3, period: 4 },
  ])

  it('체육 칸만 요일 × 교시로, 겹침과 내 칸', () => {
    const c11 = cells.get('1|1')!
    expect(c11.count).toBe(2)
    expect(c11.mine).toBe(true)
    expect(c11.groups.map(groupLabel)).toEqual(['2-3 스포츠 생활2', '1-1·1-2 체육'])
    expect(cells.get('1|2')).toBeUndefined() // 수학은 빠짐
    expect(cells.get('3|4')).toMatchObject({ count: 0, mine: true }) // 내 시간표에만 있는 칸
    expect(maxPeriod(cells)).toBe(7)
  })
  it('요약: 묶음 수 · 겹치는 칸 · 내 수업 겹침', () => {
    expect(peSummary(cells)).toEqual({ lessons: 4, overlaps: 1, peak: 2, mineOverlaps: 1 })
  })
})
