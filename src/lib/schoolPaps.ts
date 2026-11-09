/**
 * 학교 전체 PAPS 결과 · 건강체력교실 대상 (2026-11-09 교사 승인).
 *
 * 근거: 학교체육 진흥법 제9조 ① "학교의 장은 제8조에 따른 학생건강체력평가에서 저체력 또는 비만 판정을 받은 학생을
 * 대상으로 … 건강체력교실을 운영하여야 한다." · 시행규칙 제5조(매년 운영계획: 시기 · 담당자, 프로그램, 참여 학생 지도 · 관리).
 * 법령 본문에는 '등급'이 없다. '종합 4·5등급 = 저체력'은 교육부 발표 · 보도의 분류라 **기본값**으로만 두고,
 * 교사가 학교 지침에 맞게 등급 · 비만 판정을 고친다(lowGrades · obeseLabels).
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
