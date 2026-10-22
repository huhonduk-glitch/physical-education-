/**
 * PAPS 통계·시각화 계산 (재설계 B-4, 2026-10-22).
 *
 * 새 기준을 만들지 않는다. 모든 값은 공식 기준표(paps-standards.json)로 이미 계산한
 * 요인별 점수(0~20)·등급·종합점수를 **세고 평균 낼 뿐**이다. 화면에는 "앱 계산(확인용)"이라고 적는다.
 */
import { FACTORS, type Band, type Factor, type StudentPaps } from './paps'

export interface StatInput {
  id: string
  gender: 'M' | 'F' | null
  paps: StudentPaps | null
  excluded: boolean
}

export interface FactorStat {
  factor: Factor
  /** 측정한 학생들의 요인 점수 평균 (0~20) */
  avg: number | null
  /** 그 요인을 측정한 학생 수 */
  n: number
  /** 그 요인 1·2등급 학생 비율 (숫자 등급 요인만. 비만은 null) */
  topRate: number | null
}

export interface ClassStat {
  /** 반 학생 수 (제외 포함) */
  students: number
  excluded: number
  /** 요인을 하나라도 측정한 학생 */
  measured: number
  /** 5개 요인 다 측정 */
  complete: number
  /** 다 측정한 학생의 종합점수 평균 */
  avgTotal: number | null
  /** 종합등급 1~5 학생 수 (index 0 = 1등급) */
  gradeDist: [number, number, number, number, number]
  /** 종합 1·2등급 비율 (다 측정한 학생 중) */
  topRate: number | null
  factors: FactorStat[]
  /** 학생마다 점수가 가장 낮은 요인(동점이면 모두)을 센 것 — "반에서 많이 약한 요인", 많은 순 */
  weakest: { factor: Factor; count: number }[]
  /** 비만(BMI) 판정별 학생 수 */
  bmi: { label: string; count: number }[]
}

const round1 = (x: number) => Math.round(x * 10) / 10
const avgOf = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export function classStat(list: readonly StatInput[]): ClassStat {
  const active = list.filter((s) => !s.excluded)
  const withData = active.filter((s) => s.paps && s.paps.factors.some((f) => f.points !== null))
  const complete = active.filter((s) => s.paps?.complete)
  const gradeDist: ClassStat['gradeDist'] = [0, 0, 0, 0, 0]
  for (const s of complete) if (s.paps!.grade) gradeDist[s.paps!.grade - 1]++
  const factors: FactorStat[] = FACTORS.map((factor) => {
    const rs = withData.map((s) => s.paps!.factors.find((f) => f.factor === factor)).filter((f) => f && f.points !== null)
    const numeric = rs.filter((f) => typeof f!.band?.grade === 'number')
    return {
      factor,
      avg: avgOf(rs.map((f) => f!.points!)),
      n: rs.length,
      topRate: factor === '비만' || numeric.length === 0 ? null : numeric.filter((f) => (f!.band!.grade as number) <= 2).length / numeric.length,
    }
  })
  const weakCount = new Map<Factor, number>()
  for (const s of withData) {
    const pts = s.paps!.factors.filter((f) => f.points !== null)
    if (pts.length < 2) continue // 하나만 측정하면 '약한 요인'을 말할 수 없다
    const min = Math.min(...pts.map((f) => f.points!))
    for (const f of pts) if (f.points === min) weakCount.set(f.factor, (weakCount.get(f.factor) ?? 0) + 1)
  }
  const bmiCount = new Map<string, number>()
  for (const s of withData) {
    const g = s.paps!.factors.find((f) => f.factor === '비만')?.band?.grade
    if (typeof g === 'string') bmiCount.set(g, (bmiCount.get(g) ?? 0) + 1)
  }
  return {
    students: list.length,
    excluded: list.length - active.length,
    measured: withData.length,
    complete: complete.length,
    avgTotal: avgOf(complete.map((s) => s.paps!.total!)),
    gradeDist,
    topRate: complete.length ? (gradeDist[0] + gradeDist[1]) / complete.length : null,
    factors,
    weakest: [...weakCount].map(([factor, count]) => ({ factor, count })).sort((a, b) => b.count - a.count || FACTORS.indexOf(a.factor) - FACTORS.indexOf(b.factor)),
    bmi: BMI_ORDER.filter((l) => bmiCount.has(l)).map((label) => ({ label, count: bmiCount.get(label)! })).concat(
      [...bmiCount].filter(([l]) => !BMI_ORDER.includes(l)).map(([label, count]) => ({ label, count })),
    ),
  }
}

/** 공식표의 BMI 판정 순서 (마름 → 고도비만) */
const BMI_ORDER = ['마름', '정상', '과체중', '경도비만', '고도비만']

/** 두 회차 사이 종합점수 변화: 둘 다 다 측정한 학생만 */
export function improvement(prev: readonly (StudentPaps | null)[], next: readonly (StudentPaps | null)[]): { n: number; up: number; same: number; down: number; avgDelta: number | null } {
  const deltas: number[] = []
  for (let i = 0; i < Math.min(prev.length, next.length); i++) {
    const a = prev[i]
    const b = next[i]
    if (a?.complete && b?.complete) deltas.push(b.total! - a.total!)
  }
  return {
    n: deltas.length,
    up: deltas.filter((d) => d > 0).length,
    same: deltas.filter((d) => d === 0).length,
    down: deltas.filter((d) => d < 0).length,
    avgDelta: avgOf(deltas),
  }
}

/** 한 요인의 학생별 대표 기록·등급 (분포 그림용). 기록이 없는 학생은 뺀다 */
export function factorValues(list: readonly StatInput[], factor: Factor): { id: string; gender: 'M' | 'F' | null; value: number; band: Band | null; points: number | null }[] {
  const out = []
  for (const s of list) {
    if (s.excluded) continue
    const f = s.paps?.factors.find((x) => x.factor === factor)
    if (f && f.value !== null) out.push({ id: s.id, gender: s.gender, value: f.value, band: f.band, points: f.points })
  }
  return out
}

/**
 * 공식표 구간 → 등급이 바뀌는 경계만 (분포 그림의 세로선).
 * 공식표는 점수(0~20점)마다 구간이 나뉘어 같은 등급이 여러 구간이라, 등급이 바뀌는 곳만 남긴다.
 */
export function gradeEdges(bands: readonly Band[]): { min: number; label: string }[] {
  const out: { min: number; label: string }[] = []
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].grade === bands[i - 1].grade) continue
    const g = bands[i].grade
    out.push({ min: bands[i].min, label: typeof g === 'number' ? `${g}등급` : String(g) })
  }
  return out
}

/** 등급이 낮은(4·5등급) 학생: 종합등급 또는 요인 등급 기준 — 지도가 필요한 학생 목록 */
export function needsSupport(list: readonly StatInput[]): { id: string; reasons: string[] }[] {
  const out: { id: string; reasons: string[] }[] = []
  for (const s of list) {
    if (s.excluded || !s.paps) continue
    const reasons: string[] = []
    if (s.paps.complete && (s.paps.grade ?? 0) >= 4) reasons.push(`종합 ${s.paps.grade}등급`)
    for (const f of s.paps.factors) if (typeof f.band?.grade === 'number' && f.band.grade >= 4) reasons.push(`${f.factor} ${f.band.grade}등급`)
    if (reasons.length) out.push({ id: s.id, reasons })
  }
  return out
}
