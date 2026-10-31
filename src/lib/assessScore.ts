import type { AssessItem, Assessment, AssessmentScore, RubricItem } from '../db/types'

type Gender = 'M' | 'F' | null

/**
 * 수행평가 점수 계산 (재설계 3단계). 순수 함수.
 * 평가 1개 = 나이스 양식의 영역 1칸. 영역 점수 = 채점 요소 점수의 합, 영역 만점 = 요소 만점의 합.
 */

export const fmtNum = (n: number) => String(Math.round(n * 100) / 100)

/** 요소 만점 */
export function itemMax(it: AssessItem): number {
  if (it.method === 'level') return Math.max(0, ...(it.levels ?? []).map((l) => l.points))
  if (it.method === 'record') return Math.max(0, it.basePoints ?? 0, it.basePointsF ?? 0, ...(it.bands ?? []).map((b) => b.points), ...(it.bandsF ?? []).map((b) => b.points))
  return it.max ?? 0
}

/** 기록표 구간 찾기: 높을수록 → 기록 ≥ 기준 중 가장 높은 기준, 낮을수록 → 기록 ≤ 기준 중 가장 낮은 기준 */
export function recordPoints(it: AssessItem, value: number, gender?: Gender): number {
  // 여학생 기준이 따로 있으면 여학생은 그 기준으로
  const female = gender === 'F' && (it.bandsF?.length ?? 0) > 0
  const bands = female ? it.bandsF! : (it.bands ?? [])
  const base = female ? (it.basePointsF ?? it.basePoints ?? 0) : (it.basePoints ?? 0)
  if (it.better === 'lower') {
    const hit = [...bands].sort((a, b) => a.limit - b.limit).find((b) => value <= b.limit)
    return hit ? hit.points : base
  }
  const hit = [...bands].sort((a, b) => b.limit - a.limit).find((b) => value >= b.limit)
  return hit ? hit.points : base
}

/** '미참여' 입력 (자발적 미참여 · 장기 미인정 결석) */
export const NON_PART = '미참여'

/** 입력값 하나를 점수로. 비었거나 알 수 없으면 null */
export function itemPoints(it: AssessItem, raw: string | number | undefined | null, gender?: Gender): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (raw === NON_PART && it.nonPartPoints !== undefined) return it.nonPartPoints
  if (it.method === 'level') return it.levels?.find((l) => l.label === String(raw))?.points ?? null
  const v = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(v)) return null
  if (it.method === 'record') return recordPoints(it, v, gender)
  return v
}

/** 직접 입력 점수의 문제 (범위) */
export function directProblem(it: AssessItem, raw: string | number | undefined): string | null {
  if (it.method !== 'direct' || raw === undefined || raw === '') return null
  const v = Number(raw)
  if (!Number.isFinite(v)) return '숫자가 아니에요'
  if (v < 0 || v > (it.max ?? 0)) return `0~${it.max ?? 0}점 사이로`
  return null
}

export interface AssessTotal {
  total: number
  max: number
  /** 모든 요소가 채점됐는지 */
  complete: boolean
  /** 채점된 요소 수 */
  done: number
}

export function totalOf(items: readonly AssessItem[], scores: Record<string, string | number> | undefined, gender?: Gender): AssessTotal {
  let total = 0
  let max = 0
  let done = 0
  for (const it of items) {
    max += itemMax(it)
    const p = itemPoints(it, scores?.[it.id], gender)
    if (p !== null) {
      total += p
      done++
    }
  }
  return { total: Math.round(total * 100) / 100, max, complete: done === items.length && items.length > 0, done }
}

/**
 * 평가 전체 점수: 제출 구분(백지 제출 · 미응시 …)을 골랐으면 그 점수, 아니면 요소 점수의 합.
 * 제출 구분 점수도 채점이 끝난 것으로 본다(나이스로 보낼 수 있음).
 */
export function areaTotal(
  a: Assessment,
  sc: Pick<AssessmentScore, 'scores' | 'status'> | undefined,
  gender?: Gender,
  items: readonly AssessItem[] = itemsOf(a),
): AssessTotal & { status?: string } {
  const t = totalOf(items, sc?.scores, gender)
  const sp = sc?.status ? a.specials?.find((x) => x.label === sc.status) : undefined
  if (!sp) return t
  return { total: sp.points, max: t.max, complete: true, done: items.length, status: sp.label }
}

/** 성취 수준: 합계 ÷ 만점 × 100이 min 이상인 첫 수준 (min 높은 순). 수준을 안 쓰면 '' */
export function levelOf(cuts: readonly { label: string; min: number }[] | undefined, total: number, max: number): string {
  if (!cuts?.length || max <= 0) return ''
  const pct = (total / max) * 100
  const hit = [...cuts].sort((x, y) => y.min - x.min).find((c) => pct >= c.min - 1e-9)
  return hit?.label ?? ''
}

/** 성취 수준 기본안 */
export const LEVEL_CUT_PRESETS: Record<'3' | '5', { label: string; min: number }[]> = {
  '3': [
    { label: '상', min: 90 },
    { label: '중', min: 60 },
    { label: '하', min: 0 },
  ],
  '5': [
    { label: 'A', min: 90 },
    { label: 'B', min: 80 },
    { label: 'C', min: 70 },
    { label: 'D', min: 60 },
    { label: 'E', min: 0 },
  ],
}

/** 체크리스트 항목 하나를 켜고 끈다 → 새 목록(번호 순)과 만족한 개수 */
export function toggleCheck(list: readonly number[] | undefined, idx: number): { list: number[]; count: number } {
  const set = new Set(list ?? [])
  if (set.has(idx)) set.delete(idx)
  else set.add(idx)
  const next = [...set].sort((x, y) => x - y)
  return { list: next, count: next.length }
}

/** 체크리스트 개수별 점수: 0개 = base, 1개마다 step점 (예: 30 + 개수 × 10) */
export function checklistBands(n: number, base: number, step: number): { limit: number; points: number }[] {
  return Array.from({ length: n }, (_, i) => ({ limit: n - i, points: Math.round((base + (n - i) * step) * 100) / 100 }))
}

/** 예전 방식(rubric) 평가를 새 채점 요소로 바꾼다. id를 그대로 둬서 예전 점수가 그대로 읽힌다. 등급 점수는 교사가 정한다 */
export function itemsFromRubric(rubric: readonly RubricItem[]): AssessItem[] {
  return rubric.map((r) =>
    r.scale === 'AE'
      ? { id: r.id, label: r.label, method: 'level' as const, levels: ['A', 'B', 'C', 'D', 'E'].map((label) => ({ label, points: 0 })) }
      : { id: r.id, label: r.label, method: 'direct' as const, max: r.maxScore ?? 10 },
  )
}

export function itemsOf(a: Assessment): AssessItem[] {
  return a.items ?? itemsFromRubric(a.rubric)
}

/** 등급표 기본안: A부터 만점을 n단계로 고르게 나눈다 (교사가 고칠 수 있는 출발점) */
export function levelPreset(labels: string[], max: number): { label: string; points: number }[] {
  const n = labels.length
  return labels.map((label, i) => ({ label, points: Math.round((max * (n - i)) / n * 100) / 100 }))
}

/** 평가 설정 확인: 저장 전에 보여 줄 문제 목록 */
export function assessmentProblems(title: string, items: readonly AssessItem[]): string[] {
  const p: string[] = []
  if (!title.trim()) p.push('평가 이름(나이스 영역 이름)을 적어 주세요')
  if (items.length === 0) p.push('채점 요소를 하나 이상 넣어 주세요')
  items.forEach((it, i) => {
    const name = it.label.trim() || `${i + 1}번째 요소`
    if (!it.label.trim()) p.push(`${i + 1}번째 요소 이름을 적어 주세요`)
    if (it.method === 'level') {
      const lv = it.levels ?? []
      if (lv.length < 2) p.push(`${name}: 등급을 2개 이상 넣어 주세요`)
      if (new Set(lv.map((l) => l.label)).size !== lv.length) p.push(`${name}: 같은 등급 이름이 있어요`)
      if (lv.some((l) => !l.label.trim())) p.push(`${name}: 비어 있는 등급 이름이 있어요`)
    }
    if (it.method === 'record' && (it.bands ?? []).length === 0) p.push(`${name}: 기록 구간을 하나 이상 넣어 주세요`)
    if (it.method === 'direct' && !((it.max ?? 0) > 0)) p.push(`${name}: 만점을 적어 주세요`)
    if (itemMax(it) <= 0) p.push(`${name}: 만점이 0점이에요`)
  })
  return p
}

/** 이 학생이 받는 평가인지: 평가에 연결된 수업반 학생이면 (예전 방식은 학년이 같으면) */
export function appliesTo(a: Assessment, s: { id: string; grade: number; classNo: number; schoolYear: number }, groups: readonly { id: string; kind: string; grade?: number; classNo?: number; memberIds: string[] }[]): boolean {
  if (!a.groupIds) return a.grade === s.grade
  return groups.some(
    (g) => a.groupIds!.includes(g.id) && (g.kind === 'homeroom' ? g.grade === s.grade && g.classNo === s.classNo : g.memberIds.includes(s.id)),
  )
}
