/**
 * 리그전 (6-5 ④, 2026-10-27). 수업반 안에서 팀끼리 모두 한 번씩(또는 두 번씩) 겨루고 순위를 낸다.
 * - 대진: 원형 돌리기(circle method). 팀 수가 홀수면 매 라운드 한 팀이 쉰다
 * - 점수 매기기: 득점 경기(농구 · 축구 · 풋살) / 세트 경기(배구 · 배드민턴)
 * - 순위: 승점 → 같으면 그 팀들끼리 경기만 따로(승점 · 득실 · 득점) → 전체 득실 · 득점.
 *   이 순서는 FIBA 공식 규칙 부록 D(D.1.3 · D.1.4)를 따랐다. 다른 종목도 같은 순서를 쓴다(교사가 승점은 바꿀 수 있다)
 */

export type SportId = 'basketball' | 'volleyball' | 'football' | 'futsal' | 'badminton'
export type ScoreKind = 'goals' | 'sets'

export interface PointsRule {
  win: number
  draw: number
  loss: number
  /** 몰수패(나오지 않음 등) */
  forfeit: number
  /** 세트 경기에서 마지막 세트까지 가서 이긴 팀 · 진 팀 (없으면 win · loss) */
  winDecider?: number
  lossDecider?: number
}

export interface SetRule {
  /** 이 점수를 먼저 내면 세트 승리 (배구 25, 배드민턴 21) */
  target: number
  /** 마지막 세트 점수 (배구 5세트 15) */
  decider: number
  /** 이만큼 앞서야 이김 (2) */
  winBy: number
  /** 이 점수를 먼저 내면 앞서지 않아도 이김 (배드민턴 30) */
  cap?: number
  /** 이만큼 세트를 이기면 경기 승리 (3판 2선승 = 2, 5판 3선승 = 3) */
  setsToWin: number
}

export interface LeagueTeam {
  id: string
  name: string
  color: string
  /** 수업반 학생 id (선택) */
  memberIds: string[]
}

export interface LeagueMatch {
  id: string
  round: number
  home: string
  away: string
  /** 득점 경기 */
  homeScore?: number
  awayScore?: number
  /** 세트 경기: [홈, 원정] 세트마다 */
  sets?: [number, number][]
  /** 몰수패한 팀 */
  forfeit?: 'home' | 'away'
  date?: string
  done: boolean
}

export interface LeagueRules {
  kind: ScoreKind
  allowDraw: boolean
  points: PointsRule
  setRule?: SetRule
}

/** 원형 돌리기 대진. 홀수면 null(쉼)을 넣어 짝을 맞추고, 쉬는 경기는 빼고 돌려준다. double이면 홈 · 원정을 바꿔 한 번 더 */
export function roundRobin(teamIds: readonly string[], double = false): { round: number; home: string; away: string }[] {
  const ids: (string | null)[] = [...teamIds]
  if (ids.length < 2) return []
  if (ids.length % 2) ids.push(null)
  const n = ids.length
  const out: { round: number; home: string; away: string }[] = []
  let arr = [...ids]
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a === null || b === null) continue
      // 홈 · 원정이 한쪽에 몰리지 않게 라운드마다 번갈아
      const swap = (r + i) % 2 === 1
      out.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b })
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  if (double) {
    const first = out.length
    for (let i = 0; i < first; i++) out.push({ round: out[i].round + (n - 1), home: out[i].away, away: out[i].home })
  }
  return out
}

/** 한 세트가 끝났는지: 'a' | 'b' 이긴 쪽, 아직이면 null */
export function setWinner(a: number, b: number, rule: SetRule, decider = false): 'a' | 'b' | null {
  const target = decider ? rule.decider : rule.target
  const hi = Math.max(a, b)
  const lead = Math.abs(a - b)
  if (rule.cap !== undefined && !decider && hi >= rule.cap) return a > b ? 'a' : 'b'
  if (hi >= target && lead >= rule.winBy) return a > b ? 'a' : 'b'
  return null
}

export interface MatchResult {
  winner: 'home' | 'away' | 'draw'
  /** 득점(세트 경기는 이긴 세트 수) */
  homeFor: number
  awayFor: number
  /** 마지막 세트까지 갔는지 */
  decider: boolean
}

/** 경기 결과. 아직 안 끝났거나 점수가 규칙에 맞지 않으면 null (순위에 넣지 않음) */
export function matchResult(m: LeagueMatch, rules: LeagueRules): MatchResult | null {
  if (!m.done) return null
  if (m.forfeit) return { winner: m.forfeit === 'home' ? 'away' : 'home', homeFor: 0, awayFor: 0, decider: false }
  if (rules.kind === 'goals') {
    if (m.homeScore === undefined || m.awayScore === undefined) return null
    const winner = m.homeScore > m.awayScore ? 'home' : m.awayScore > m.homeScore ? 'away' : 'draw'
    if (winner === 'draw' && !rules.allowDraw) return null
    return { winner, homeFor: m.homeScore, awayFor: m.awayScore, decider: false }
  }
  const rule = rules.setRule
  if (!rule || !m.sets?.length) return null
  let h = 0
  let a = 0
  const maxSets = rule.setsToWin * 2 - 1
  for (let i = 0; i < m.sets.length; i++) {
    if (h === rule.setsToWin || a === rule.setsToWin) return null // 끝난 뒤에 세트가 더 있음
    const w = setWinner(m.sets[i][0], m.sets[i][1], rule, i === maxSets - 1)
    if (!w) return null
    if (w === 'a') h++
    else a++
  }
  if (h !== rule.setsToWin && a !== rule.setsToWin) return null
  return { winner: h > a ? 'home' : 'away', homeFor: h, awayFor: a, decider: h + a === maxSets && maxSets > 1 }
}

export interface StandingRow {
  teamId: string
  played: number
  win: number
  draw: number
  loss: number
  for: number
  against: number
  diff: number
  points: number
  rank: number
}

function pointsFor(side: 'home' | 'away', r: MatchResult, m: LeagueMatch, p: PointsRule): number {
  if (r.winner === 'draw') return p.draw
  const won = r.winner === side
  if (m.forfeit) return won ? p.win : p.forfeit
  if (r.decider) return won ? (p.winDecider ?? p.win) : (p.lossDecider ?? p.loss)
  return won ? p.win : p.loss
}

function table(teamIds: readonly string[], matches: readonly LeagueMatch[], rules: LeagueRules): Map<string, StandingRow> {
  const rows = new Map<string, StandingRow>(teamIds.map((id) => [id, { teamId: id, played: 0, win: 0, draw: 0, loss: 0, for: 0, against: 0, diff: 0, points: 0, rank: 0 }]))
  for (const m of matches) {
    const h = rows.get(m.home)
    const a = rows.get(m.away)
    const r = h && a ? matchResult(m, rules) : null
    if (!h || !a || !r) continue
    h.played++
    a.played++
    h.for += r.homeFor
    h.against += r.awayFor
    a.for += r.awayFor
    a.against += r.homeFor
    if (r.winner === 'draw') (h.draw++, a.draw++)
    else if (r.winner === 'home') (h.win++, a.loss++)
    else (a.win++, h.loss++)
    h.points += pointsFor('home', r, m, rules.points)
    a.points += pointsFor('away', r, m, rules.points)
  }
  for (const r of rows.values()) r.diff = r.for - r.against
  return rows
}

/**
 * 순위표. 같은 승점이면 FIBA 부록 D.1.3 순서: 그 팀들끼리 경기의 승점 → 득실 → 득점 → 전체 득실 → 전체 득점.
 * 어떤 기준에서 일부 팀이 갈리면 남은 팀끼리 처음부터 다시 (D.1.4). 끝까지 같으면 같은 순위.
 */
export function standings(teamIds: readonly string[], matches: readonly LeagueMatch[], rules: LeagueRules): StandingRow[] {
  const all = table(teamIds, matches, rules)
  const order = (ids: string[]): string[][] => {
    if (ids.length <= 1) return [ids]
    const among = ids.length === teamIds.length ? all : table(ids, matches, rules)
    const crit: ((id: string) => number)[] = [
      (id) => all.get(id)!.points,
      (id) => among.get(id)!.points,
      (id) => among.get(id)!.diff,
      (id) => among.get(id)!.for,
      (id) => all.get(id)!.diff,
      (id) => all.get(id)!.for,
    ]
    for (const c of crit) {
      const groups = new Map<number, string[]>()
      for (const id of ids) groups.set(c(id), [...(groups.get(c(id)) ?? []), id])
      if (groups.size > 1)
        return [...groups.entries()].sort((x, y) => y[0] - x[0]).flatMap(([, g]) => order(g))
    }
    return [ids]
  }
  const out: StandingRow[] = []
  let place = 1
  for (const g of order([...teamIds])) {
    for (const id of g) out.push({ ...all.get(id)!, rank: place })
    place += g.length
  }
  return out
}
