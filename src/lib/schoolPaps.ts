/**
 * 학교 전체 PAPS 결과 · 건강체력교실 대상 (2026-11-09 교사 승인).
 *
 * 근거: 학교체육 진흥법 제9조 ① "학교의 장은 제8조에 따른 학생건강체력평가에서 저체력 또는 비만 판정을 받은 학생을
 * 대상으로 … 건강체력교실을 운영하여야 한다." · 시행규칙 제5조(매년 운영계획: 시기 · 담당자, 프로그램, 참여 학생 지도 · 관리).
 * 법령 본문에는 '등급'이 없다. 기본값은 제주특별자치도교육청 「2026학년도 학교체육 운영방향」(2026-02-11 게시) 23~24쪽:
 * "대상: 학생건강체력평가 결과 4~5등급, 비만 판정 학생 및 참여 희망자 등" · "학년초 학교별 건강체력교실 운영계획 수립 운영 (필수)" ·
 * "학교별 건강체력교실 참여 학생의 학생건강체력 변화 분석". 다른 교육청 지침에 맞게 교사가 고친다(lowGrades · obeseLabels).
 * 같은 문서 서식 '14. PAPS 측정결과'(학년별 1~5등급 남 · 여 · 계 · 비율, 4~5등급, 전체인원)와 '12. 미측정 학생 관리부'를 채운다.
 * 새 기준을 만들지 않는다 — 등급 · BMI 판정은 공식 기준표로 이미 계산한 값(StudentPaps)을 센다.
 */
import type { StudentPaps } from './paps'

export interface SchoolPapsRow {
  studentId: string
  grade: number
  classNo: number
  number: number
  name: string
  gender: 'M' | 'F' | null
  paps: StudentPaps | null
  excluded: boolean
  /** 측정 제외 사유 (서식 12 비고) */
  excludeReason?: string
}

export interface ClinicRule {
  /** 저체력으로 볼 종합등급 (기본 4 · 5) */
  lowGrades: number[]
  /** 비만으로 볼 BMI 판정 (기본 경도비만 · 고도비만) */
  obeseLabels: string[]
}
export const DEFAULT_CLINIC_RULE: ClinicRule = { lowGrades: [4, 5], obeseLabels: ['경도비만', '고도비만'] }
/** 공식표 BMI 판정 이름 (고르기 칩) */
export const BMI_LABELS = ['마름', '정상', '과체중', '경도비만', '고도비만']

export interface ClassPapsStat {
  grade: number
  classNo: number
  students: number
  excluded: number
  /** 5개 요인 다 측정 */
  complete: number
  /** 종합등급 1~5 학생 수 */
  dist: [number, number, number, number, number]
  /** 저체력(lowGrades) 학생 수 */
  low: number
  /** 비만(obeseLabels) 학생 수 */
  obese: number
  avgTotal: number | null
}

const bmiLabel = (p: StudentPaps | null) => {
  const g = p?.factors.find((f) => f.factor === '비만')?.band?.grade
  return typeof g === 'string' ? g : null
}

function stat(rows: readonly SchoolPapsRow[], rule: ClinicRule, grade: number, classNo: number): ClassPapsStat {
  const dist: ClassPapsStat['dist'] = [0, 0, 0, 0, 0]
  let complete = 0
  let low = 0
  let obese = 0
  let sum = 0
  for (const r of rows) {
    if (r.excluded) continue
    if (r.paps?.complete && r.paps.grade) {
      complete++
      dist[r.paps.grade - 1]++
      sum += r.paps.total!
      if (rule.lowGrades.includes(r.paps.grade)) low++
    }
    const b = bmiLabel(r.paps)
    if (b && rule.obeseLabels.includes(b)) obese++
  }
  return { grade, classNo, students: rows.length, excluded: rows.filter((r) => r.excluded).length, complete, dist, low, obese, avgTotal: complete ? Math.round((sum / complete) * 10) / 10 : null }
}

/** 반마다 · 학년마다 · 학교 전체 집계 */
export function schoolPapsStats(rows: readonly SchoolPapsRow[], rule: ClinicRule = DEFAULT_CLINIC_RULE): { classes: ClassPapsStat[]; grades: ClassPapsStat[]; school: ClassPapsStat } {
  const byClass = new Map<string, SchoolPapsRow[]>()
  for (const r of rows) byClass.set(`${r.grade}-${r.classNo}`, [...(byClass.get(`${r.grade}-${r.classNo}`) ?? []), r])
  const classes = [...byClass.values()].map((list) => stat(list, rule, list[0].grade, list[0].classNo)).sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
  const gradeNos = [...new Set(rows.map((r) => r.grade))].sort((a, b) => a - b)
  const grades = gradeNos.map((g) => stat(rows.filter((r) => r.grade === g), rule, g, 0))
  return { classes, grades, school: stat(rows, rule, 0, 0) }
}

export interface ClinicTarget {
  row: SchoolPapsRow
  /** 대상이 된 까닭: '종합 4등급' · '고도비만' */
  reasons: string[]
}

/** 건강체력교실 대상 후보: 저체력(종합등급) 또는 비만(BMI 판정). 측정 제외 학생은 빼고 학년 · 반 · 번호 순 */
export function clinicTargets(rows: readonly SchoolPapsRow[], rule: ClinicRule = DEFAULT_CLINIC_RULE): ClinicTarget[] {
  const out: ClinicTarget[] = []
  for (const r of rows) {
    if (r.excluded || !r.paps) continue
    const reasons: string[] = []
    if (r.paps.complete && r.paps.grade && rule.lowGrades.includes(r.paps.grade)) reasons.push(`종합 ${r.paps.grade}등급`)
    const b = bmiLabel(r.paps)
    if (b && rule.obeseLabels.includes(b)) reasons.push(b)
    if (reasons.length) out.push({ row: r, reasons })
  }
  return out.sort((a, b) => a.row.grade - b.row.grade || a.row.classNo - b.row.classNo || a.row.number - b.row.number)
}

/** 비율 글: 0.169 → '16.9%' (분모 0이면 —) */
export function rate(n: number, of: number): string {
  return of ? `${Math.round((n / of) * 1000) / 10}%` : '—'
}

/**
 * 서식 '14. PAPS 측정결과' 한 줄(학년마다): 1~5등급과 4~5등급의 남 · 여 · 계 · 비율, 전체인원.
 * 서식 예시(초4: 1등급 136 / 전체 446 = 30.49…)처럼 전체인원 = 종합등급이 나온 학생 수, 비율 = 계 ÷ 전체인원 × 100.
 */
export interface FormRow {
  grade: number
  cells: { M: number; F: number; total: number; rate: number }[] // 1~5등급, 마지막은 4~5등급
  total: number
}
export function resultFormRows(rows: readonly SchoolPapsRow[]): FormRow[] {
  const grades = [...new Set(rows.map((r) => r.grade))].sort((a, b) => a - b)
  return grades.map((g) => {
    const counts = Array.from({ length: 6 }, () => ({ M: 0, F: 0, total: 0, rate: 0 }))
    let total = 0
    for (const r of rows) {
      if (r.grade !== g || r.excluded || !r.paps?.complete || !r.paps.grade) continue
      total++
      const idx = [r.paps.grade - 1, ...(r.paps.grade >= 4 ? [5] : [])]
      for (const i of idx) {
        counts[i].total++
        if (r.gender === 'M') counts[i].M++
        else if (r.gender === 'F') counts[i].F++
      }
    }
    for (const c of counts) c.rate = total ? Math.round((c.total / total) * 10000) / 100 : 0
    return { grade: g, cells: counts, total }
  })
}

/** 서식 '12. 미측정 학생 관리부': 측정 제외 학생과 5개 요인을 다 측정하지 못한 학생 (비고 = 사유) */
export function unmeasuredRows(rows: readonly SchoolPapsRow[]): { row: SchoolPapsRow; note: string }[] {
  const out: { row: SchoolPapsRow; note: string }[] = []
  for (const r of rows) {
    if (r.excluded) out.push({ row: r, note: r.excludeReason ? `측정 제외 · ${r.excludeReason}` : '측정 제외' })
    else if (!r.paps?.complete) {
      const missing = r.paps ? r.paps.factors.filter((f) => f.points === null).map((f) => f.factor) : []
      out.push({ row: r, note: missing.length ? `미측정 요인: ${missing.join(', ')}` : '기록 없음' })
    }
  }
  return out.sort((a, b) => a.row.grade - b.row.grade || a.row.classNo - b.row.classNo || a.row.number - b.row.number)
}

/** 작년과 비교 (같은 학년끼리: 2025 고1 ↔ 2026 고1) — 저체력 비율 · 평균 종합점수 */
export function compareYears(now: readonly SchoolPapsRow[], last: readonly SchoolPapsRow[], rule: ClinicRule = DEFAULT_CLINIC_RULE): { grade: number; now: ClassPapsStat | null; last: ClassPapsStat | null }[] {
  const a = schoolPapsStats(now, rule).grades
  const b = schoolPapsStats(last, rule).grades
  const grades = [...new Set([...a, ...b].map((g) => g.grade))].sort((x, y) => x - y)
  return grades.map((g) => ({ grade: g, now: a.find((x) => x.grade === g) ?? null, last: b.find((x) => x.grade === g) ?? null }))
}

/**
 * 전년 대비 향상 학생 (같은 학생 = 이름 · 성별 같고 한 학년 위, 후보가 하나일 때만) — 운영방향 22쪽 'PAPS 우수학생 학교장 표창 예시:
 * 전년 대비 최우수 체력 향상 학생'. 두 해 모두 5개 요인을 다 측정한 학생만, 종합점수가 많이 오른 순.
 */
export function yearImprovers(now: readonly SchoolPapsRow[], last: readonly SchoolPapsRow[], top = 5): { row: SchoolPapsRow; before: number; after: number; delta: number }[] {
  const key = (r: SchoolPapsRow, grade: number) => `${r.name.replace(/\s+/g, '')}|${r.gender ?? ''}|${grade}`
  const prev = new Map<string, SchoolPapsRow[]>()
  for (const r of last) prev.set(key(r, r.grade + 1), [...(prev.get(key(r, r.grade + 1)) ?? []), r])
  const out: { row: SchoolPapsRow; before: number; after: number; delta: number }[] = []
  for (const r of now) {
    if (r.excluded || !r.paps?.complete) continue
    const c = prev.get(key(r, r.grade))
    if (!c || c.length !== 1 || c[0].excluded || !c[0].paps?.complete) continue
    out.push({ row: r, before: c[0].paps.total!, after: r.paps.total!, delta: Math.round((r.paps.total! - c[0].paps.total!) * 10) / 10 })
  }
  return out.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, top)
}
