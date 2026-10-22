/**
 * PAPS 여러 번 측정 (재설계 B-5, 2026-10-22).
 *
 * - 같은 학생이 한 학기에 여러 번(1회차·2회차…) 측정한다. 회차마다 날짜가 있다.
 * - 회차 없는 기록(예전 기록) = 1회차. 예전 기록은 고치지 않는다.
 * - 한 회차 안의 1차·2차·좌우 칸은 지금과 같다 (나이스 원자료 칸).
 * - 나이스 내보내기는 학생마다 **회차 하나를 통째로** 고른다 (교사 결정: 칸마다 다른 회차를 섞지 않는다 —
 *   실제로 측정한 적 없는 조합이 되므로).
 *   · 최근 회차: 그 학생 기록이 있는 가장 늦은 회차
 *   · 최고 회차: 그 학생의 회차 중 ① 5개 요인이 다 측정된 회차를 먼저 ② 종합점수(합계)가 높은 회차 ③ 같으면 늦은 회차
 */
import type { PapsResult, PapsRound } from '../db/types'

/** 화면·계산에서 쓰는 회차. id가 null이면 1회차(회차 없는 기록) */
export interface RoundInfo {
  id: string | null
  round: number
  date: string | null
  /** 1회차의 날짜만 적어 둔 행이 있으면 그 행 id (날짜 고칠 때) */
  rowId: string | null
}

export type RoundPick = 'best' | 'latest'

export const roundKeyOf = (r: Pick<PapsResult, 'roundId'>): string | null => r.roundId ?? null

/** 반의 회차 목록 (1회차는 행이 없어도 있다). 회차 번호순 */
export function roundsOf(rows: readonly PapsRound[]): RoundInfo[] {
  const first = rows.find((r) => r.round === 1)
  const out: RoundInfo[] = [{ id: null, round: 1, date: first?.date ?? null, rowId: first?.id ?? null }]
  for (const r of [...rows].filter((x) => x.round > 1).sort((a, b) => a.round - b.round)) out.push({ id: r.id, round: r.round, date: r.date, rowId: r.id })
  return out
}

/** 다음 회차 번호 */
export function nextRoundNo(rows: readonly PapsRound[]): number {
  return Math.max(1, ...rows.map((r) => r.round)) + 1
}

/** 측정 제외 행인지 (회차와 상관없이 그 학년도 전체) */
const isExcludedRow = (r: PapsResult, excludedKey: string) => r.eventId === excludedKey

/** 한 회차의 기록만 (측정 제외 행은 늘 포함) */
export function filterRound(results: readonly PapsResult[], roundId: string | null, excludedKey: string): PapsResult[] {
  return results.filter((r) => isExcludedRow(r, excludedKey) || roundKeyOf(r) === roundId)
}

/** 학생 → 회차 → 기록 (측정 제외 행은 뺀다) */
export function groupByStudentRound(results: readonly PapsResult[], excludedKey: string): Map<string, Map<string | null, PapsResult[]>> {
  const out = new Map<string, Map<string | null, PapsResult[]>>()
  for (const r of results) {
    if (isExcludedRow(r, excludedKey) || r.value === undefined) continue
    let m = out.get(r.studentId)
    if (!m) out.set(r.studentId, (m = new Map()))
    const k = roundKeyOf(r)
    m.set(k, [...(m.get(k) ?? []), r])
  }
  return out
}

/** 회차 하나의 점수 요약 (계산은 부르는 쪽: studentSummary) */
export interface RoundScore {
  complete: boolean
  total: number
}

/**
 * 학생마다 내보낼 회차 하나를 고른다.
 * 기록이 하나도 없는 학생은 1회차(null)로 둔다 → 내보내기 검사에서 '누락'으로 보인다.
 */
export function pickRounds(
  studentIds: readonly string[],
  byStudent: Map<string, Map<string | null, PapsResult[]>>,
  rounds: readonly RoundInfo[],
  mode: RoundPick,
  scoreOf: (studentId: string, rows: PapsResult[]) => RoundScore | null,
): Map<string, string | null> {
  const order = new Map(rounds.map((r) => [r.id, r.round]))
  const out = new Map<string, string | null>()
  for (const sid of studentIds) {
    const mine = byStudent.get(sid)
    const candidates = rounds.filter((r) => (mine?.get(r.id)?.length ?? 0) > 0)
    if (candidates.length === 0) {
      out.set(sid, null)
      continue
    }
    if (mode === 'latest') {
      out.set(sid, candidates[candidates.length - 1].id)
      continue
    }
    let best: { id: string | null; s: RoundScore } | null = null
    for (const r of candidates) {
      const s = scoreOf(sid, mine!.get(r.id)!) ?? { complete: false, total: 0 }
      const better =
        !best ||
        (s.complete && !best.s.complete) ||
        (s.complete === best.s.complete && s.total > best.s.total) ||
        (s.complete === best.s.complete && s.total === best.s.total && (order.get(r.id) ?? 0) > (order.get(best.id) ?? 0))
      if (better) best = { id: r.id, s }
    }
    out.set(sid, best!.id)
  }
  return out
}

/** 고른 회차의 기록만 남긴다 (측정 제외 행은 늘 포함) */
export function resultsForPick(results: readonly PapsResult[], pick: Map<string, string | null>, excludedKey: string): PapsResult[] {
  return results.filter((r) => isExcludedRow(r, excludedKey) || roundKeyOf(r) === (pick.get(r.studentId) ?? null))
}

/** 회차별 값 → 마지막 두 값의 차이 (값이 있는 회차끼리). 비교할 두 값이 없으면 null */
export function lastChange(values: readonly (number | null)[]): number | null {
  const has = values.filter((v): v is number => v !== null)
  if (has.length < 2) return null
  return Math.round((has[has.length - 1] - has[has.length - 2]) * 100) / 100
}
