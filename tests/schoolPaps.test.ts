import { describe, expect, it } from 'vitest'
import type { Factor, StudentPaps } from '../src/lib/paps'
import { clinicTargets, compareYears, DEFAULT_CLINIC_RULE, rate, resultFormRows, schoolPapsStats, unmeasuredRows, yearImprovers, type SchoolPapsRow } from '../src/lib/schoolPaps'

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

describe('운영방향 서식 · 작년 비교 (2026-11-09)', () => {
  const mk = (grade: number, g: number | null, gender: 'M' | 'F', name = `x${++n}`, total = 50, excluded = false, excludeReason?: string): SchoolPapsRow => ({
    studentId: `t${++n}`,
    grade,
    classNo: 1,
    number: n,
    name,
    gender,
    paps: g === null ? null : paps(g, '정상', total),
    excluded,
    ...(excludeReason ? { excludeReason } : {}),
  })
  it('서식 14: 학년마다 1~5등급 남 · 여 · 계 · 비율과 4~5등급, 전체인원 = 등급이 나온 학생', () => {
    const rows = [mk(1, 1, 'M'), mk(1, 1, 'F'), mk(1, 4, 'M'), mk(1, 5, 'F'), mk(1, null, 'M'), mk(2, 3, 'F')]
    const f = resultFormRows(rows)
    expect(f.map((x) => [x.grade, x.total])).toEqual([
      [1, 4],
      [2, 1],
    ])
    expect(f[0].cells[0]).toEqual({ M: 1, F: 1, total: 2, rate: 50 })
    expect(f[0].cells[5]).toEqual({ M: 1, F: 1, total: 2, rate: 50 }) // 4~5등급
    expect(f[0].cells[2].total).toBe(0)
  })
  it('서식 12: 측정 제외(사유)와 다 측정 못 한 학생', () => {
    const rows = [mk(1, 2, 'M'), mk(1, null, 'F', '가', 0, true, '발목 부상'), mk(1, null, 'M', '나')]
    expect(unmeasuredRows(rows).map((x) => [x.row.name, x.note])).toEqual([
      ['가', '측정 제외 · 발목 부상'],
      ['나', '기록 없음'],
    ])
  })
  it('작년 같은 학년과 비교 · 전년 대비 향상 학생 (이름 · 성별 같고 한 학년 위, 오른 학생만)', () => {
    const last = [mk(1, 4, 'M', '김하늘', 30), mk(1, 3, 'F', '이바다', 50), mk(1, 3, 'F', '박구름', 55)]
    const now = [mk(2, 2, 'M', '김하늘', 70), mk(2, 3, 'F', '이바다', 45), mk(1, 2, 'F', '박구름', 60), mk(1, 5, 'M', '최별', 10)]
    const c = compareYears(now, last)
    expect(c.map((x) => [x.grade, x.last?.complete ?? 0, x.now?.complete ?? 0])).toEqual([
      [1, 3, 2],
      [2, 0, 2],
    ])
    expect(yearImprovers(now, last).map((x) => [x.row.name, x.before, x.after, x.delta])).toEqual([['김하늘', 30, 70, 40]])
  })
})
