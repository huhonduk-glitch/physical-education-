/**
 * 왕복오래달리기 반 전체 세기 (재설계 B-1, 2026-10-21).
 *
 * 예전에는 학생 카드를 회마다 한 번씩 눌렀다(25명 × 40회 ≈ 1,000번).
 * 이제는 신호가 울릴 때 교사가 [회차 +1]을 한 번 누르고, 신호 전에 못 들어온 학생만 [늦음]을 누른다.
 *
 * 기록 규칙 (paps-standards.json recordingRules.shuttleRun, 학교건강검사규칙 별표3):
 *   "신호 전 도착 못 한 첫 회는 △(계속), 두 번째면 종료하고 직전 횟수 기록"
 * - 회차(lap) = 지금까지 [회차 +1]을 누른 횟수 = 울린 신호 수
 * - 늦음은 '방금 울린 신호'(= 지금 회차)에 못 들어온 것으로 적는다. 그래서 신호가 울리면 [+1]을 먼저, 늦은 학생을 그다음에 누른다.
 * - 첫 늦음: △, 계속 달린다 (끝까지 달리면 그 회차도 센다)
 * - 두 번째 늦음: 끝. 기록 = 그 회차 − 1 (직전 횟수)
 * - 아직 달리는 학생: 기록 = 지금 회차
 *
 * 저장 구조 없이 '누른 순서'만 남기고 매번 다시 계산한다 → 되돌리기가 쉽고 sessionStorage에 그대로 둘 수 있다.
 */

export type ShuttleAction = { kind: 'lap' } | { kind: 'miss'; id: string }

export interface ShuttleRunner {
  /** 첫 번째 늦은 회차 (△) */
  warnedAt: number | null
  /** 두 번째 늦은 회차 (끝) */
  outAt: number | null
  /** 지금 기준 기록 (회) */
  record: number
  running: boolean
}

export interface ShuttleState {
  lap: number
  misses: Map<string, number[]>
}

export function replayShuttle(actions: readonly ShuttleAction[]): ShuttleState {
  let lap = 0
  const misses = new Map<string, number[]>()
  for (const a of actions) {
    if (a.kind === 'lap') {
      lap += 1
      continue
    }
    const m = misses.get(a.id) ?? []
    // 이미 끝난 학생, 같은 회차에 두 번 누른 것(실수로 두 번 탭)은 무시
    if (m.length >= 2 || m.includes(lap)) continue
    misses.set(a.id, [...m, lap])
  }
  return { lap, misses }
}

export function runnerOf(state: ShuttleState, id: string): ShuttleRunner {
  const m = state.misses.get(id) ?? []
  const warnedAt = m[0] ?? null
  const outAt = m[1] ?? null
  if (outAt !== null) return { warnedAt, outAt, record: Math.max(0, outAt - 1), running: false }
  return { warnedAt, outAt: null, record: state.lap, running: true }
}

/** 이 동작을 지금 해도 되는지 (끝난 학생·같은 회차 두 번 누름은 막는다) */
export function canMiss(state: ShuttleState, id: string): boolean {
  const m = state.misses.get(id) ?? []
  return m.length < 2 && !m.includes(state.lap)
}

/** 동작 더하기. 반영되지 않을 늦음(끝난 학생·같은 회차 두 번)은 남기지 않는다 → 되돌리기는 마지막 하나만 빼면 된다 */
export function pushShuttle(actions: readonly ShuttleAction[], a: ShuttleAction): ShuttleAction[] {
  if (a.kind === 'miss' && !canMiss(replayShuttle(actions), a.id)) return [...actions]
  return [...actions, a]
}

/** 마지막 동작 하나 되돌리기 */
export function undoShuttle(actions: readonly ShuttleAction[]): ShuttleAction[] {
  return actions.slice(0, -1)
}
