import { describe, expect, it } from 'vitest'
import type { Factor, StudentPaps } from '../src/lib/paps'
import { clinicTargets, DEFAULT_CLINIC_RULE, rate, schoolPapsStats, type SchoolPapsRow } from '../src/lib/schoolPaps'

const F: Factor[] = ['심폐지구력', '근력·근지구력', '유연성', '순발력', '비만']
/** 종합등급 · BMI 판정으로 학생 결과 (테스트용) */
function paps(grade: number | null, bmi = '정상', total = 50): StudentPaps {
  const complete = grade !== null
  return {
    factors: F.map((factor) => ({ factor, eventId: null, value: 1, band: { grade: factor === '비만' ? bmi : 3, points: 10, min: 0, max: 0 }, points: 10 })) as StudentPaps['factors'],
    sum: total,
    complete,
    total: complete ? total : null,
    grade,
    avgGrade: null,
  }
}
let n = 0
const row = (grade: number, classNo: number, p: StudentPaps | null, excluded = false): SchoolPapsRow => ({ studentId: `s${++n}`, grade, classNo, number: n, name: `학생${n}`, gender: 'M', paps: p, excluded })

describe('학교 전체 PAPS · 건강체력교실', () => {
  const rows = [
    row(1, 1, paps(1, '정상', 85)),
    row(1, 1, paps(4, '정상', 30)),
    row(1, 1, paps(2, '고도비만', 65)),
    row(1, 2, paps(5, '경도비만', 15)),
    row(1, 2, paps(null, '과체중')), // 미완료: 등급 분포에서 빠지지만 BMI는 셈
    row(2, 1, paps(4, '정상', 25), true), // 측정 제외
    row(2, 1, null),
  ]

  it('반 · 학년 · 학교 집계 (기본: 종합 4·5등급 = 저체력, 경도 · 고도비만 = 비만)', () => {
    const s = schoolPapsStats(rows)
    expect(s.classes.map((c) => `${c.grade}-${c.classNo}`)).toEqual(['1-1', '1-2', '2-1'])
    expect(s.classes[0]).toMatchObject({ students: 3, complete: 3, dist: [1, 1, 0, 1, 0], low: 1, obese: 1, avgTotal: 60 })
    expect(s.classes[1]).toMatchObject({ complete: 1, low: 1, obese: 1 })
    expect(s.classes[2]).toMatchObject({ students: 2, excluded: 1, complete: 0, avgTotal: null })
    expect(s.grades.map((g) => g.grade)).toEqual([1, 2])
    expect(s.school).toMatchObject({ students: 7, complete: 4, low: 2, obese: 2, dist: [1, 1, 0, 1, 1] })
  })

  it('대상 후보: 저체력 또는 비만, 까닭 함께, 측정 제외는 빼기', () => {
    const t = clinicTargets(rows)
    expect(t.map((x) => [x.row.grade, x.row.classNo, x.reasons])).toEqual([
      [1, 1, ['종합 4등급']],
      [1, 1, ['고도비만']],
      [1, 2, ['종합 5등급', '경도비만']],
    ])
  })

  it('학교 지침에 맞게 기준을 바꿀 수 있다 (예: 5등급만 · 과체중 포함)', () => {
    const t = clinicTargets(rows, { lowGrades: [5], obeseLabels: ['과체중', '경도비만', '고도비만'] })
    expect(t.map((x) => x.reasons)).toEqual([['고도비만'], ['종합 5등급', '경도비만'], ['과체중']])
    expect(DEFAULT_CLINIC_RULE.lowGrades).toEqual([4, 5])
  })

  it('비율 글', () => {
    expect(rate(169, 1000)).toBe('16.9%')
    expect(rate(1, 0)).toBe('—')
  })
})
