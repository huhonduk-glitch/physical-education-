/**
 * PAPS 등급·점수 계산 (CLAUDE.md 4-5). 순수 함수.
 * 기준값은 src/data/paps-standards.json(교육부 PAPS_standard.xls 변환본)을 그대로 쓴다 — 여기서 값을 만들지 않는다.
 */
import standardsJson from '../data/paps-standards.json'

export type Gender = 'M' | 'F'
export type EventId =
  | 'shuttleRun'
  | 'longRunWalk'
  | 'stepTest'
  | 'gripStrength'
  | 'curlUp'
  | 'pushUp'
  | 'sitAndReach'
  | 'totalFlexibility'
  | 'sprint50m'
  | 'standingLongJump'
  | 'bmi'

export interface Band {
  grade: number | string
  points: number
  min: number
  max: number
}

export interface EventInfo {
  name: string
  unit: string
  factor: string
  direction: 'higher' | 'lower' | 'range'
  decimals: number
  allowNegative?: boolean
  byGender?: Record<Gender, string>
}

export interface PapsStandards {
  version: string
  source: string
  events: Record<string, EventInfo>
  table: Record<string, Record<string, Record<string, Band[]>>>
  totalScore: { factorMax: number; totalMax: number; factors: string[]; grades: { grade: number; min: number; max: number }[] }
  schoolLevelEvents: Record<string, string[]>
  totalFlexibilityPoints: { active: string; regulation: Record<string, number> }
  suggestedNeisRanges: Record<string, unknown>
  recordingRules: Record<string, { step?: number; rounding?: 'ceil' | 'floor'; foulPenaltySec?: number }>
  [k: string]: unknown
}

export const DEFAULT_STANDARDS = standardsJson as unknown as PapsStandards

export const FACTORS = ['심폐지구력', '근력·근지구력', '유연성', '순발력', '비만'] as const
export type Factor = (typeof FACTORS)[number]

export const EVENT_IDS = Object.keys(DEFAULT_STANDARDS.events) as EventId[]

/** 기준표 교체용 형식 검사. 문제 목록을 돌려준다(빈 배열이면 통과). */
export function validateStandards(x: unknown): string[] {
  const errs: string[] = []
  const s = x as Partial<PapsStandards>
  if (!s || typeof s !== 'object') return ['JSON 객체가 아니에요']
  if (typeof s.version !== 'string') errs.push('version(버전)이 없어요')
  if (!s.events || typeof s.events !== 'object') errs.push('events(종목 정보)가 없어요')
  if (!s.table || typeof s.table !== 'object') errs.push('table(기준표)가 없어요')
  if (!s.totalScore?.grades?.length) errs.push('totalScore(종합등급)가 없어요')
  if (errs.length) return errs
  for (const id of EVENT_IDS) {
    const t = s.table![id]
    if (!t) {
      errs.push(`${id} 종목 기준이 없어요`)
      continue
    }
    for (const [lv, byG] of Object.entries(t)) {
      for (const g of ['M', 'F']) {
        const bands = byG?.[g]
        if (!Array.isArray(bands) || bands.length === 0) errs.push(`${id} ${lv} ${g} 구간이 없어요`)
        else if (bands.some((b, i) => typeof b.min !== 'number' || typeof b.points !== 'number' || (i > 0 && b.min < bands[i - 1].min)))
          errs.push(`${id} ${lv} ${g} 구간이 min 오름차순이 아니거나 숫자가 아니에요`)
      }
    }
  }
  return errs
}

/** 학교급 + 학년 → 기준표 학년키. 예: ('고', 1) → '고1' */
export function levelKey(schoolLevel: string, grade: number): string {
  return `${schoolLevel}${grade}`
}

/** 부동소수점 오차를 없앤 소수 자릿수 맞춤 (표시·내보내기용 글자) */
export function fixed(v: number, decimals: number): string {
  const s = v.toFixed(decimals)
  return decimals > 0 ? s.replace(/\.?0+$/, '') : s
}

/** 0.1 단위 올림 (BMI·악력·PEI: '0.01 단위에서 올림'). 부동소수점 오차 방지 */
export function ceil1(x: number): number {
  return Math.ceil(x * 10 - 1e-9) / 10
}

/**
 * 조회 규칙 (JSON lookupRule): min ≤ v 인 마지막 구간.
 * 구간 사이 소수 틈, BMI 구간 겹침(마지막 구간 우선)도 이 규칙으로 처리한다. 첫 구간보다 작으면 null.
 */
export function lookup(std: PapsStandards, eventId: EventId, lvKey: string, gender: Gender, v: number): Band | null {
  const bands = std.table[eventId]?.[lvKey]?.[gender]
  if (!bands || !Number.isFinite(v)) return null
  let found: Band | null = null
  for (const b of bands) {
    if (b.min <= v + 1e-9) found = b
    else break
  }
  return found
}

/** 기준표 전체 범위 (이상치 경고용) */
export function tableRange(std: PapsStandards, eventId: EventId, lvKey: string, gender: Gender): { min: number; max: number } | null {
  const bands = std.table[eventId]?.[lvKey]?.[gender]
  if (!bands?.length) return null
  return { min: bands[0].min, max: Math.max(...bands.map((b) => b.max)) }
}

/** BMI = 체중 ÷ 신장(m)² 을 0.01 단위에서 올림 */
export function bmi(heightCm: number, weightKg: number): number | null {
  if (!(heightCm > 0) || !(weightKg > 0)) return null
  const m = heightCm / 100
  return ceil1(weightKg / (m * m))
}

export type StepMethod = 'palpation' | 'monitor'

/**
 * 스텝검사 PEI (CLAUDE.md 4-5, 학교건강검사규칙 별표3). 0.01 단위에서 올림.
 * @param highMale 고등학교 남학생이면 true (다른 공식)
 * @param hr 심박수 3회. 고등 남은 첫 번째(1:00~1:30 또는 1분)만 쓴다
 */
export function pei(method: StepMethod, highMale: boolean, D: number, hr: [number?, number?, number?]): number | null {
  if (!(D > 0)) return null
  if (highMale) {
    const p = hr[0]
    if (!(p && p > 0)) return null
    const x = method === 'palpation' ? (D * 100) / (5.5 * p) + 0.22 * (300 - D) : (D * 100) / ((5.5 * p) / 2) + 0.22 * (300 - D)
    return ceil1(x)
  }
  if (!hr.every((h) => h && h > 0)) return null
  const P = (hr[0] ?? 0) + (hr[1] ?? 0) + (hr[2] ?? 0)
  const x = method === 'palpation' ? (D / (2 * P)) * 100 : (D / P) * 100
  return ceil1(x)
}

/** 오래달리기-걷기: 분·초 → 초. 0.1초 단위 버림 + 파울 1회당 5초 */
export function longRunSeconds(min: number, sec: number, fouls = 0): number {
  return Math.floor(min * 60 + sec + 1e-9) + fouls * 5
}

/**
 * 공식 기록 단위대로면 어떻게 되는지 (자동으로 바꾸지 않고 제안만 한다).
 * 규칙에 올림/버림이 있는 종목만. 바꿀 필요가 없으면 null.
 */
export function officialSuggestion(std: PapsStandards, eventId: EventId, v: number): number | null {
  const r = std.recordingRules[eventId]
  if (!r?.rounding || !r.step) return null
  const f = 1 / r.step
  const out = r.rounding === 'ceil' ? Math.ceil(v * f - 1e-9) / f : Math.floor(v * f + 1e-9) / f
  return Math.abs(out - v) > 1e-9 ? out : null
}

/** 칸 하나 (원자료) */
export interface Cell {
  attempt: 1 | 2 | null
  side: 'R' | 'L' | null
  value: number
}

/**
 * 대표 기록 (JSON representative):
 * 악력은 좌우·차수 구분 없이 최고값, 낮을수록 좋은 종목은 최소값, 그 외 최대값.
 */
export function representative(std: PapsStandards, eventId: EventId, cells: readonly Cell[]): Cell | null {
  const vals = cells.filter((c) => Number.isFinite(c.value))
  if (vals.length === 0) return null
  const lower = std.events[eventId]?.direction === 'lower'
  return vals.reduce((best, c) => (lower ? (c.value < best.value ? c : best) : c.value > best.value ? c : best))
}

export type FlexMode = 'regulation' | 'table'

/** 종목 점수. 종합유연성은 법령 모드면 등급별 고정점수(별표5) */
export function eventPoints(std: PapsStandards, eventId: EventId, band: Band, flexMode: FlexMode): number {
  if (eventId === 'totalFlexibility' && flexMode === 'regulation') {
    return std.totalFlexibilityPoints.regulation[String(band.grade)] ?? band.points
  }
  return band.points
}

export function totalGrade(std: PapsStandards, total: number): number | null {
  const g = std.totalScore.grades.find((x) => total >= x.min && total <= x.max)
  return g ? g.grade : null
}

export interface FactorResult {
  factor: Factor
  eventId: EventId | null
  value: number | null
  band: Band | null
  points: number | null
}

export interface StudentPaps {
  factors: FactorResult[]
  /** 측정된 요인 점수 합 */
  sum: number
  complete: boolean
  total: number | null
  grade: number | null
  /** 숫자 등급 요인들의 평균 (팀 편성 수준용) */
  avgGrade: number | null
}

/**
 * 학생 한 명의 종합 (5개 체력요인). 요인마다 선택한 종목의 대표 기록 → 점수 → 합계.
 * 5개가 다 없으면 complete=false, total=null (화면에는 '미완료' + 현재 합계).
 */
export function studentPaps(
  std: PapsStandards,
  args: {
    lvKey: string
    gender: Gender
    selected: Partial<Record<Factor, EventId>>
    cells: Partial<Record<EventId, Cell[]>>
    flexMode: FlexMode
    /** BMI는 신장·체중으로 계산해서 넣는다 */
    bmiValue?: number | null
  },
): StudentPaps {
  const factors: FactorResult[] = FACTORS.map((factor) => {
    const eventId = factor === '비만' ? 'bmi' : (args.selected[factor] ?? null)
    if (!eventId) return { factor, eventId: null, value: null, band: null, points: null }
    const value = eventId === 'bmi' ? (args.bmiValue ?? null) : (representative(std, eventId, args.cells[eventId] ?? [])?.value ?? null)
    const band = value === null ? null : lookup(std, eventId, args.lvKey, args.gender, value)
    const points = band ? eventPoints(std, eventId, band, args.flexMode) : null
    return { factor, eventId, value, band, points }
  })
  const got = factors.filter((f) => f.points !== null)
  const sum = got.reduce((a, f) => a + (f.points ?? 0), 0)
  const complete = got.length === FACTORS.length
  const numeric = factors.filter((f) => typeof f.band?.grade === 'number').map((f) => f.band!.grade as number)
  return {
    factors,
    sum,
    complete,
    total: complete ? sum : null,
    grade: complete ? totalGrade(std, sum) : null,
    avgGrade: numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null,
  }
}

/** 학교급별 요인 선택지 (JSON schoolLevelEvents) */
export function factorChoices(std: PapsStandards, schoolLevel: string, grade: number): Record<Factor, EventId[]> {
  const key = schoolLevel === '초' ? (grade <= 4 ? '초3~4' : '초5~6') : '중1~고3'
  const list = std.schoolLevelEvents[key] ?? []
  const out = Object.fromEntries(FACTORS.map((f) => [f, [] as EventId[]])) as unknown as Record<Factor, EventId[]>
  for (const group of list) {
    for (const id of group.split('|') as EventId[]) {
      const f = std.events[id]?.factor as Factor | undefined
      if (f && !out[f].includes(id)) out[f].push(id)
    }
  }
  return out
}

/** 성별에 따라 다르게 부르는 종목 이름 (팔굽혀펴기) */
export function eventName(std: PapsStandards, eventId: EventId, gender?: Gender): string {
  const e = std.events[eventId]
  if (!e) return eventId
  if (gender && e.byGender?.[gender]) return e.byGender[gender]
  return e.name
}

/** 팀 편성 수준: 종합등급 1~2 상, 3 중, 4~5 하. 없으면 평균 등급(2.0 이하 상, 3.0 이하 중, 그 외 하). 미측정이면 null */
export function teamLevel(p: Pick<StudentPaps, 'grade' | 'avgGrade'>): '상' | '중' | '하' | null {
  if (p.grade !== null) return p.grade <= 2 ? '상' : p.grade === 3 ? '중' : '하'
  if (p.avgGrade === null) return null
  return p.avgGrade <= 2 ? '상' : p.avgGrade <= 3 ? '중' : '하'
}
