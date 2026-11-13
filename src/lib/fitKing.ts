/**
 * 체력왕 선발 (2026-11-13 교사 요청 — 교사가 실제로 시상한 엑셀 방식을 그대로).
 *
 * 방식: PAPS 종목(BMI 빼고)마다 **가장 좋은 기록**(모든 회차 · 차수 · 좌우 가운데) → 점수 → 합계 → 순위 →
 * 위에서부터 시상(최우수 1 · 우수 2 · 그 아래 장려, 최우수까지 포함해 기본 20%).
 *  - 한 종목이라도 안 잰 학생 · 측정 제외 학생은 수상에서 빠진다.
 *  - 합계가 같으면 심폐지구력 → 순발력 → 근력·근지구력 → 유연성 순으로 가린다(교사 엑셀: 왕복오래달리기 → 제자리멀리뛰기 → 악력).
 *    남녀를 한 순위로 매길 때는 기록을 바로 견줄 수 없어 그 종목 **점수**로, 한 성별끼리면 **기록**으로 가린다.
 *  - 그래도 같으면 같은 순위. 장려상은 같은 순위 묶음이 시상 인원을 넘으면 그 묶음을 통째로 뺀다(교사 엑셀 수식 그대로).
 *
 * 점수 기준 두 가지:
 *  - 'custom' 학교 자체 기준: 종목 · 성별마다 기준 기록 여러 개(낮은 점수부터). 넘은 기준 하나에 5점. **PAPS 등급이 아니다.**
 *  - 'official' 공식 PAPS 점수(종목당 0~20점, 교육부 기준표로 이미 계산하는 값) 합.
 * 새 PAPS 기준을 만들지 않는다 — 학교 자체 기준은 교사가 넣는 시상용 숫자이고 화면에 그렇게 표시한다.
 */
import { eventPoints, lookup, type EventId, type Factor, type FlexMode, type Gender, type PapsStandards } from './paps'

/** 체력왕에 쓰는 체력요인 (BMI 제외). 동점 가리는 순서이기도 하다 */
export const KING_FACTORS: Factor[] = ['심폐지구력', '순발력', '근력·근지구력', '유연성']
/** 화면 · 엑셀에 보이는 순서 */
export const KING_COLUMNS: Factor[] = ['심폐지구력', '근력·근지구력', '순발력', '유연성']
export const CUT_STEP = 5

export type KingMode = 'custom' | 'official'
export type CutGender = 'A' | Gender

export interface KingConf {
  mode: KingMode
  /** 시상 비율 % (최우수 포함) */
  percent: number
  /** 시상 인원을 직접 정하면 비율 대신 이 수 (null이면 비율) */
  count: number | null
  /** 최우수상 인원 */
  gold: number
  /** 우수상 인원 */
  silver: number
  /** 남녀 따로 순위 (기본 한 순위 — 기준이 남녀 따로라서) */
  split: boolean
  /** 학교 자체 기준: '학년|종목|성별(A·M·F)' → 기준 기록들 (5점 기준부터) */
  cuts: Record<string, number[]>
}

export const DEFAULT_KING_CONF: KingConf = { mode: 'custom', percent: 20, count: null, gold: 1, silver: 2, split: false, cuts: {} }

/** 예시 기준: 이 기능을 요청한 교사가 2026학년도 3학년 시상에 쓴 표 (성별 구분 없이 한 벌). 학교마다 고쳐 쓴다 */
export const EXAMPLE_CUTS: Partial<Record<EventId, number[]>> = {
  shuttleRun: [40, 45, 50, 55, 60],
  gripStrength: [18, 25, 29.5, 37.5, 42],
  standingLongJump: [160, 170, 180, 190, 200],
  sitAndReach: [5, 10, 15, 20, 25],
}

export const cutKey = (grade: number, eventId: string, g: CutGender) => `${grade}|${eventId}|${g}`

/** 이 학생에게 쓸 기준: 성별 기준이 있으면 그것, 없으면 공통(A) */
export function cutsFor(conf: Pick<KingConf, 'cuts'>, grade: number, eventId: string, gender: Gender | null): number[] | null {
  const own = gender ? conf.cuts[cutKey(grade, eventId, gender)] : undefined
  const list = own?.length ? own : conf.cuts[cutKey(grade, eventId, 'A')]
  return list?.length ? list : null
}

/** 학교 자체 기준 점수: 넘은 기준 하나에 5점 (낮을수록 좋은 종목은 기준 이하) */
export function customPoints(cuts: readonly number[], value: number, lower: boolean): number {
  return cuts.filter((c) => (lower ? value <= c + 1e-9 : value >= c - 1e-9)).length * CUT_STEP
}

/**
 * 공식 등급 경계로 기준 채우기: 4등급 · 3등급 · 2등급 · 1등급이 되는 기록 (5 · 10 · 15 · 20점).
 * 교육부 기준표의 값을 그대로 읽는다 — 더 높은 기준(25점)은 교사가 직접 더한다.
 */
export function officialCuts(std: PapsStandards, eventId: EventId, lvKey: string, gender: Gender): number[] | null {
  const bands = std.table[eventId]?.[lvKey]?.[gender]
  if (!bands?.length) return null
  const lower = std.events[eventId]?.direction === 'lower'
  const out: number[] = []
  for (const g of [4, 3, 2, 1]) {
    const mine = bands.filter((b) => b.grade === g)
    if (mine.length === 0) return null
    out.push(lower ? Math.max(...mine.map((b) => b.max)) : Math.min(...mine.map((b) => b.min)))
  }
  return out
}

export interface KingStudent {
  studentId: string
  grade: number
  classNo: number
  number: number
  name: string
  gender: Gender | null
  /** 측정 제외 학생 */
  excluded: boolean
  /** 이 학생 반의 체력요인별 측정 종목 */
  events: Partial<Record<Factor, EventId>>
  /** 종목별 가장 좋은 기록 (모든 회차) */
  best: Partial<Record<EventId, number>>
}

export interface KingFactor {
  factor: Factor
  eventId: EventId | null
  value: number | null
  points: number | null
  max: number | null
}

export type KingStatus = '측정완료' | '일부 미측정' | '미측정' | '측정 제외' | '기준 없음'
export type KingAward = '최우수상' | '우수상' | '장려상'

export interface KingRow {
  student: KingStudent
  factors: KingFactor[]
  /** 네 요인이 다 있을 때만 */
  total: number | null
  status: KingStatus
  rank: number | null
  /** 같은 순위 학생 수 */
  ties: number
  award: KingAward | null
}

export interface KingGroup {
  key: 'all' | Gender
  label: string
  /** 시상 비율의 바탕: 측정 제외를 뺀 학생 수 */
  eligible: number
  /** 측정완료 학생 수 */
  complete: number
  /** 시상 인원 (최우수 포함) */
  quota: number
  rows: KingRow[]
  /** 장려상에서 같은 순위 묶음이 인원을 넘어 빠진 학생 수 */
  cutTies: number
}

export interface KingResult {
  groups: KingGroup[]
  /** 학교 자체 기준이 없는 종목 (그 종목을 잰 학생이 있는데 기준이 비어 있음) */
  missing: { eventId: EventId; gender: Gender | null }[]
  /** 만점 (학생마다 종목이 같을 때) */
  max: number | null
}

interface Ctx {
  std: PapsStandards
  schoolLevel: string
  flexMode: FlexMode
}

function scoreStudent(ctx: Ctx, conf: KingConf, s: KingStudent): { factors: KingFactor[]; noCuts: EventId[] } {
  const noCuts: EventId[] = []
  const factors = KING_COLUMNS.map((factor): KingFactor => {
    const eventId = s.events[factor] ?? null
    if (!eventId) return { factor, eventId: null, value: null, points: null, max: null }
    const value = s.best[eventId] ?? null
    if (conf.mode === 'official') {
      const max = ctx.std.totalScore.factorMax
      if (value === null || !s.gender) return { factor, eventId, value, points: null, max }
      const band = lookup(ctx.std, eventId, `${ctx.schoolLevel}${s.grade}`, s.gender, value)
      return { factor, eventId, value, points: band ? eventPoints(ctx.std, eventId, band, ctx.flexMode) : null, max }
    }
    const cuts = cutsFor(conf, s.grade, eventId, s.gender)
    if (!cuts) {
      if (value !== null) noCuts.push(eventId)
      return { factor, eventId, value, points: null, max: null }
    }
    const lower = ctx.std.events[eventId]?.direction === 'lower'
    return { factor, eventId, value, points: value === null ? null : customPoints(cuts, value, lower), max: cuts.length * CUT_STEP }
  })
  return { factors, noCuts }
}

/** 시상 인원: 직접 정한 수가 있으면 그 수, 아니면 비율(반올림, 대상이 있으면 적어도 1명) */
export function quotaOf(conf: Pick<KingConf, 'percent' | 'count'>, eligible: number): number {
  if (eligible <= 0) return 0
  if (conf.count !== null && conf.count >= 0) return Math.min(Math.floor(conf.count), eligible)
  return Math.min(eligible, Math.max(1, Math.round((eligible * conf.percent) / 100)))
}

function rankGroup(ctx: Ctx, conf: KingConf, key: KingGroup['key'], label: string, rows: KingRow[]): KingGroup {
  const done = rows.filter((r) => r.total !== null)
  const genders = new Set(done.map((r) => r.student.gender))
  const sameEvents = (f: Factor) => new Set(done.map((r) => r.student.events[f])).size === 1
  // 동점 가리기: 한 성별 · 같은 종목이면 기록으로, 아니면 그 요인 점수로
  const byRecord = (f: Factor) => genders.size <= 1 && sameEvents(f)
  const keyOf = (r: KingRow): number[] => [
    r.total!,
    ...KING_FACTORS.map((f) => {
      const x = r.factors.find((y) => y.factor === f)!
      if (!byRecord(f)) return x.points ?? 0
      const lower = x.eventId ? ctx.std.events[x.eventId]?.direction === 'lower' : false
      return lower ? -(x.value ?? 0) : (x.value ?? 0)
    }),
  ]
  const keys = new Map(done.map((r) => [r, keyOf(r)]))
  const cmp = (a: KingRow, b: KingRow) => {
    const ka = keys.get(a)!
    const kb = keys.get(b)!
    for (let i = 0; i < ka.length; i++) if (Math.abs(ka[i] - kb[i]) > 1e-9) return kb[i] - ka[i]
    return 0
  }
  done.sort((a, b) => cmp(a, b) || a.student.classNo - b.student.classNo || a.student.number - b.student.number)
  done.forEach((r, i) => {
    r.rank = i > 0 && cmp(done[i - 1], r) === 0 ? done[i - 1].rank : i + 1
  })
  for (const r of done) r.ties = done.filter((x) => x.rank === r.rank).length

  const eligible = rows.filter((r) => r.status !== '측정 제외').length
  const quota = quotaOf(conf, eligible)
  let cutTies = 0
  for (const r of done) {
    const rank = r.rank!
    if (rank > quota) continue
    if (rank <= conf.gold) r.award = '최우수상'
    else if (rank <= conf.gold + conf.silver) r.award = '우수상'
    else if (rank + r.ties - 1 <= quota) r.award = '장려상'
    else cutTies++
  }
  const rest = rows.filter((r) => r.total === null).sort((a, b) => a.student.classNo - b.student.classNo || a.student.number - b.student.number)
  return { key, label, eligible, complete: done.length, quota, rows: [...done, ...rest], cutTies }
}

/** 체력왕 순위 · 수상 */
export function rankKings(ctx: Ctx, conf: KingConf, students: readonly KingStudent[]): KingResult {
  const missing = new Map<string, { eventId: EventId; gender: Gender | null }>()
  const rows = students.map((s): KingRow => {
    const { factors, noCuts } = scoreStudent(ctx, conf, s)
    for (const e of noCuts) missing.set(`${e}|${s.gender}`, { eventId: e, gender: s.gender })
    const measured = factors.filter((f) => f.value !== null).length
    const scored = factors.filter((f) => f.points !== null).length
    const all = factors.every((f) => f.eventId !== null)
    const status: KingStatus = s.excluded
      ? '측정 제외'
      : measured === 0
        ? '미측정'
        : measured < factors.length || !all
          ? '일부 미측정'
          : scored < factors.length
            ? '기준 없음'
            : '측정완료'
    return { student: s, factors, total: status === '측정완료' ? factors.reduce((a, f) => a + f.points!, 0) : null, status, rank: null, ties: 0, award: null }
  })
  const groups: KingGroup[] = conf.split
    ? (['M', 'F'] as const)
        .map((g) => rankGroup(ctx, conf, g, g === 'M' ? '남학생' : '여학생', rows.filter((r) => r.student.gender === g)))
        .filter((g) => g.rows.length > 0)
    : [rankGroup(ctx, conf, 'all', '전체', rows)]
  const maxes = new Set(rows.filter((r) => r.total !== null).map((r) => r.factors.reduce((a, f) => a + (f.max ?? 0), 0)))
  return { groups, missing: [...missing.values()], max: maxes.size === 1 ? [...maxes][0] : null }
}

/** 수상자만 (순위 순) */
export function winners(g: KingGroup): KingRow[] {
  return g.rows.filter((r) => r.award)
}

/** 수상자 명단 글 (복사용) */
export function winnersText(title: string, groups: readonly KingGroup[]): string {
  const lines = [title]
  for (const g of groups) {
    if (groups.length > 1) lines.push('', `[${g.label}]`)
    for (const a of ['최우수상', '우수상', '장려상'] as const) {
      const list = g.rows.filter((r) => r.award === a)
      if (list.length) lines.push(`${a} (${list.length}명): ${list.map((r) => `${r.student.grade}-${r.student.classNo} ${r.student.number}번 ${r.student.name}`).join(', ')}`)
    }
  }
  return lines.join('\n')
}

/** 기준 입력 글 → 숫자들 ('40, 45, 50' · 빈칸 구분). 숫자가 아닌 것이 있으면 null */
export function parseCuts(text: string): number[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean)
  const nums = parts.map(Number)
  return nums.every((n) => Number.isFinite(n)) ? nums : null
}

/** 기준이 한 방향으로 나아지는지 (높을수록 좋은 종목은 커져야, 낮을수록 좋은 종목은 작아져야) */
export function cutsInOrder(cuts: readonly number[], lower: boolean): boolean {
  return cuts.every((c, i) => i === 0 || (lower ? c < cuts[i - 1] : c > cuts[i - 1]))
}
