import type { AssessItem, RecordBand } from '../db/types'

/**
 * 평가계획서 읽기 (6-5 ②). 순수 함수.
 * 채점 기준 표의 '기대 수행' 문장과 배점을 기록표(남녀 기준) · 체크리스트로 바꾸고,
 * 겹치는 구간 · 빈 구간 · 점수 순서를 검사한다(나이스에 내기 전에 계획서 오류를 잡는다).
 */

export interface Range {
  min?: number
  max?: number
}

export type Expect =
  | { kind: 'range'; m: Range; f: Range; unit: string }
  | { kind: 'count'; min?: number; max?: number; all?: boolean }
  | { kind: 'nonpart' }
  | { kind: 'unknown'; text: string }

const NUM = '(\\d+(?:\\.\\d+)?)'
const UNIT = '(회|초|cm|m|개|점|kg|번)?'

/** "18-19회" · "20회 이상" · "11회 이하" · "12초 미만" → 범위 */
function parseRange(s: string): { r: Range; unit: string } | null {
  const t = s.replace(/\s+/g, '')
  let m = new RegExp(`^${NUM}${UNIT}?[-~∼]${NUM}${UNIT}$`).exec(t)
  if (m) return { r: { min: Number(m[1]), max: Number(m[3]) }, unit: m[4] || m[2] || '' }
  m = new RegExp(`^${NUM}${UNIT}(이상|초과)$`).exec(t)
  if (m) return { r: { min: m[3] === '초과' ? Number(m[1]) + 1e-9 : Number(m[1]) }, unit: m[2] || '' }
  m = new RegExp(`^${NUM}${UNIT}(이하|미만)$`).exec(t)
  if (m) return { r: { max: m[3] === '미만' ? Number(m[1]) - 1e-9 : Number(m[1]) }, unit: m[2] || '' }
  m = new RegExp(`^${NUM}${UNIT}$`).exec(t)
  if (m) return { r: { min: Number(m[1]), max: Number(m[1]) }, unit: m[2] || '' }
  return null
}

/** 기대 수행 문장 하나 */
export function parseExpect(text: string): Expect {
  const s = text.replace(/\s+/g, ' ').trim()
  if (/미참여|미인정\s*결석|불참|미제출/.test(s) && !/\d/.test(s.replace(/\d+개/, ''))) return { kind: 'nonpart' }
  // 체크리스트: '평가 요소를 모두 만족', '6개 만족', '2개 이하로 만족'
  if (/만족|충족|해당/.test(s)) {
    if (/모두|전부|모든/.test(s)) return { kind: 'count', all: true }
    const m = /(\d+)\s*개\s*(이상|이하)?/.exec(s)
    if (m) return m[2] === '이하' ? { kind: 'count', max: Number(m[1]) } : m[2] === '이상' ? { kind: 'count', min: Number(m[1]) } : { kind: 'count', min: Number(m[1]), max: Number(m[1]) }
  }
  const male = /남(?:자|학생)?\s*([^,，여]+)/.exec(s)
  const female = /여(?:자|학생)?\s*([^,，]+)/.exec(s)
  if (male || female) {
    const pm = male ? parseRange(male[1]) : null
    const pf = female ? parseRange(female[1]) : null
    if ((male && !pm) || (female && !pf)) return { kind: 'unknown', text: s }
    return { kind: 'range', m: pm?.r ?? pf!.r, f: pf?.r ?? pm!.r, unit: pm?.unit || pf?.unit || '' }
  }
  const p = parseRange(s)
  if (p) return { kind: 'range', m: p.r, f: p.r, unit: p.unit }
  return { kind: 'unknown', text: s }
}

export interface ScoreRow {
  expect: string
  points: number
}

export interface BuiltItem {
  item: AssessItem
  problems: string[]
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)
const showRange = (r: Range, unit: string) =>
  r.min !== undefined && r.max !== undefined ? (r.min === r.max ? `${fmt(r.min)}${unit}` : `${fmt(r.min)}~${fmt(r.max)}${unit}`) : r.min !== undefined ? `${fmt(r.min)}${unit} 이상` : `${fmt(r.max!)}${unit} 이하`

/** 한 성별의 구간 목록 검사: 겹침 · 빈 곳(정수 기록) · 점수 순서 */
export function checkRanges(rows: { r: Range; points: number }[], unit: string, who: string): string[] {
  const out: string[] = []
  const integer = /회|개|번/.test(unit) || rows.every((x) => [x.r.min, x.r.max].every((v) => v === undefined || Number.isInteger(v)))
  for (let i = 0; i < rows.length; i++)
    for (let k = i + 1; k < rows.length; k++) {
      const a = rows[i].r
      const b = rows[k].r
      const lo = Math.max(a.min ?? -Infinity, b.min ?? -Infinity)
      const hi = Math.min(a.max ?? Infinity, b.max ?? Infinity)
      if (lo <= hi)
        out.push(`${who} ${showRange({ min: Number.isFinite(lo) ? lo : undefined, max: Number.isFinite(hi) ? hi : undefined }, unit)}가 ${fmt(rows[i].points)}점(${showRange(a, unit)})과 ${fmt(rows[k].points)}점(${showRange(b, unit)}) 두 구간에 겹쳐요`)
    }
  if (integer && !out.length) {
    const sorted = [...rows].sort((a, b) => (a.r.min ?? -Infinity) - (b.r.min ?? -Infinity))
    for (let i = 1; i < sorted.length; i++) {
      const prevMax = sorted[i - 1].r.max
      const curMin = sorted[i].r.min
      if (prevMax !== undefined && curMin !== undefined && curMin - prevMax > 1) out.push(`${who} ${fmt(prevMax + 1)}~${fmt(curMin - 1)}${unit}는 어느 구간에도 없어요`)
    }
  }
  // 기록이 좋을수록 점수가 높아야 한다 (높을수록 좋은 종목 기준)
  const byMin = [...rows].filter((x) => x.r.min !== undefined).sort((a, b) => a.r.min! - b.r.min!)
  for (let i = 1; i < byMin.length; i++) if (byMin[i].points < byMin[i - 1].points) out.push(`${who} 기록이 더 좋은 ${showRange(byMin[i].r, unit)}의 점수(${fmt(byMin[i].points)})가 더 낮아요`)
  return out
}

/** 채점 기준 표 → 채점 요소 하나 (기록표 · 남녀 기준 · 미참여 점수 · 체크리스트) */
export function buildItem(label: string, rows: readonly ScoreRow[], opts: { id: string; checks?: string[] }): BuiltItem {
  const parsed = rows.map((r) => ({ ...r, e: parseExpect(r.expect) }))
  const problems: string[] = []
  const unknown = parsed.filter((p) => p.e.kind === 'unknown')
  for (const u of unknown) problems.push(`'${u.expect}'(${fmt(u.points)}점)을 기록 구간으로 읽지 못했어요. 직접 고쳐 주세요`)
  const nonPart = parsed.find((p) => p.e.kind === 'nonpart')
  const counts = parsed.filter((p) => p.e.kind === 'count')
  const ranges = parsed.filter((p) => p.e.kind === 'range') as (ScoreRow & { e: Extract<Expect, { kind: 'range' }> })[]

  const item: AssessItem = { id: opts.id, label, method: 'record', better: 'higher', bands: [] }
  if (nonPart) item.nonPartPoints = nonPart.points

  if (counts.length) {
    const n = opts.checks?.length ?? Math.max(0, ...counts.map((c) => (c.e as { min?: number }).min ?? 0)) + 1
    item.unit = '개'
    if (opts.checks?.length) item.checks = [...opts.checks]
    const crs = counts.map((c) => {
      const e = c.e as Extract<Expect, { kind: 'count' }>
      return { r: e.all ? { min: n, max: n } : { min: e.min, max: e.max }, points: c.points }
    })
    problems.push(...checkRanges(crs, '개', '만족 개수'))
    for (const c of crs) {
      if (c.r.min === undefined) item.basePoints = c.points
      else item.bands!.push({ limit: c.r.min, points: c.points })
    }
    return { item, problems }
  }

  const unit = ranges.find((r) => r.e.unit)?.e.unit ?? ''
  item.unit = unit
  // '이하'가 가장 높은 점수면 낮을수록 좋은 종목(달리기 시간 등)
  const top = [...ranges].sort((a, b) => b.points - a.points)[0]
  const lower = !!top && top.e.m.min === undefined && top.e.m.max !== undefined
  item.better = lower ? 'lower' : 'higher'
  const split = ranges.some((r) => JSON.stringify(r.e.m) !== JSON.stringify(r.e.f))
  const side = (g: 'm' | 'f') => {
    const bands: RecordBand[] = []
    let base: number | undefined
    for (const r of ranges) {
      const rg = r.e[g]
      const edge = lower ? rg.max : rg.min
      if (edge === undefined) base = r.points
      else bands.push({ limit: edge, points: r.points })
    }
    return { bands, base }
  }
  const m = side('m')
  item.bands = m.bands
  if (m.base !== undefined) item.basePoints = m.base
  if (!lower) problems.push(...checkRanges(ranges.map((r) => ({ r: r.e.m, points: r.points })), unit, split ? '남자' : ''))
  if (split) {
    const f = side('f')
    item.bandsF = f.bands
    if (f.base !== undefined) item.basePointsF = f.base
    if (!lower) problems.push(...checkRanges(ranges.map((r) => ({ r: r.e.f, points: r.points })), unit, '여자'))
  }
  return { item, problems: problems.map((p) => p.trim()) }
}

/** '배드민턴 스트로크 수행하기 (40점)' → 이름 · 만점 */
export function titleAndMax(s: string): { title: string; max?: number } {
  const m = /^(.*?)\s*[(（]\s*(\d+(?:\.\d+)?)\s*점\s*[)）]\s*$/.exec(s.replace(/\s+/g, ' ').trim())
  return m ? { title: m[1].trim(), max: Number(m[2]) } : { title: s.replace(/\s+/g, ' ').trim() }
}

/** 평가방법 칸에서 ■로 고른 것만: '■ 실기·시연 □ 포트폴리오 ■ 교사 관찰 및 기록' → ['실기·시연', '교사 관찰 및 기록'] */
export function checkedMethods(s: string): string[] {
  return [...s.matchAll(/[■▣☑✔]\s*([^□■▣☑✔o○◯]+)/g)].map((m) => m[1].replace(/\(\s*\)/, '').trim()).filter(Boolean)
}

/** 평가요소 칸의 '1) …? 2) …?' 목록 → 체크리스트 항목 */
export function checklistFrom(s: string): string[] {
  const parts = s.split(/\s*\d+\)\s+/).slice(1)
  return parts.map((p) => p.trim()).filter(Boolean)
}
