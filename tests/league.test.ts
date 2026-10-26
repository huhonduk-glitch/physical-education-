import { describe, expect, it } from 'vitest'
import { matchResult, roundRobin, setWinner, standings, type LeagueMatch, type LeagueRules, type SetRule } from '../src/lib/league'

const fiba: LeagueRules = { kind: 'goals', allowDraw: false, points: { win: 2, draw: 0, loss: 1, forfeit: 0 } }
const games = (list: [string, string, number, number][]): LeagueMatch[] =>
  list.map(([home, away, h, a], i) => ({ id: String(i), round: 1, home, away, homeScore: h, awayScore: a, done: true }))
const order = (ms: LeagueMatch[], ids = ['A', 'B', 'C', 'D']) => standings(ids, ms, fiba).map((r) => r.teamId)

describe('대진 (원형 돌리기)', () => {
  it('짝수 팀: 모든 팀이 서로 한 번씩, 라운드마다 한 경기씩', () => {
    const m = roundRobin(['a', 'b', 'c', 'd'])
    expect(m).toHaveLength(6)
    const pairs = new Set(m.map((x) => [x.home, x.away].sort().join('')))
    expect(pairs.size).toBe(6)
    for (let r = 1; r <= 3; r++) {
      const teams = m.filter((x) => x.round === r).flatMap((x) => [x.home, x.away])
      expect(new Set(teams).size).toBe(4)
    }
  })
  it('홀수 팀: 라운드마다 한 팀이 쉬고, 두 번씩이면 홈 · 원정을 바꿔 한 번 더', () => {
    const m = roundRobin(['a', 'b', 'c', 'd', 'e'])
    expect(m).toHaveLength(10)
    expect(Math.max(...m.map((x) => x.round))).toBe(5)
    const d = roundRobin(['a', 'b', 'c'], true)
    expect(d).toHaveLength(6)
    expect(d.slice(3).map((x) => x.home + x.away)).toEqual(d.slice(0, 3).map((x) => x.away + x.home))
  })
  it('한 팀이면 경기 없음', () => expect(roundRobin(['a'])).toEqual([]))
})

describe('순위 — FIBA 공식 규칙 2024 부록 D.2 보기 그대로', () => {
  it('보기 1: 두 팀씩 같으면 서로 경기 승자', () => {
    expect(order(games([['A', 'B', 100, 55], ['A', 'C', 90, 85], ['A', 'D', 75, 80], ['B', 'C', 100, 95], ['B', 'D', 80, 75], ['C', 'D', 60, 55]]))).toEqual(['A', 'B', 'C', 'D'])
    const s = standings(['A', 'B', 'C', 'D'], games([['A', 'B', 100, 55], ['A', 'C', 90, 85], ['A', 'D', 75, 80], ['B', 'C', 100, 95], ['B', 'D', 80, 75], ['C', 'D', 60, 55]]), fiba)
    expect(s[0]).toMatchObject({ teamId: 'A', win: 2, loss: 1, points: 5, for: 265, against: 220, diff: 45 })
  })
  it('보기 2: 세 팀이 같으면 그 팀끼리 경기 득실, 남은 둘은 처음부터 다시(서로 경기 승자)', () => {
    expect(order(games([['A', 'B', 100, 55], ['A', 'C', 90, 85], ['A', 'D', 120, 75], ['B', 'C', 100, 85], ['B', 'D', 75, 80], ['C', 'D', 65, 55]]))).toEqual(['A', 'B', 'C', 'D'])
  })
  it('보기 3: 그 팀끼리 득실 C +5 · D 0 · B -5', () => {
    expect(order(games([['A', 'B', 85, 90], ['A', 'C', 55, 100], ['A', 'D', 75, 120], ['B', 'C', 100, 95], ['B', 'D', 75, 85], ['C', 'D', 65, 55]]))).toEqual(['C', 'D', 'B', 'A'])
  })
  it('보기 4: 그 팀끼리 득실도 같으면 그 팀끼리 득점 B 175 · C 155 · D 140', () => {
    expect(order(games([['A', 'B', 85, 90], ['A', 'C', 55, 100], ['A', 'D', 75, 120], ['B', 'C', 100, 90], ['B', 'D', 75, 85], ['C', 'D', 65, 55]]))).toEqual(['B', 'C', 'D', 'A'])
  })
  it('끝까지 같으면 같은 순위, 안 끝난 경기 · 농구 무승부는 넣지 않음', () => {
    const ms = games([['A', 'B', 50, 50]])
    const s = standings(['A', 'B'], ms, fiba)
    expect(s.map((r) => r.rank)).toEqual([1, 1])
    expect(s[0].played).toBe(0)
    expect(standings(['A', 'B'], [{ id: 'x', round: 1, home: 'A', away: 'B', homeScore: 3, awayScore: 1, done: false }], fiba)[0].played).toBe(0)
  })
  it('몰수패: 이긴 팀은 승 점수, 몰수 팀은 0점 (D.1.1)', () => {
    const s = standings(['A', 'B'], [{ id: 'x', round: 1, home: 'A', away: 'B', forfeit: 'away', done: true }], fiba)
    expect(s.map((r) => [r.teamId, r.points])).toEqual([['A', 2], ['B', 0]])
  })
})

describe('축구 · 풋살 승점 (승 3 · 무 1 · 패 0)', () => {
  it('무승부를 센다', () => {
    const rules: LeagueRules = { kind: 'goals', allowDraw: true, points: { win: 3, draw: 1, loss: 0, forfeit: 0 } }
    const s = standings(['A', 'B', 'C'], games([['A', 'B', 1, 1], ['A', 'C', 2, 0], ['B', 'C', 0, 3]]), rules)
    expect(s.map((r) => [r.teamId, r.points, r.draw])).toEqual([['A', 4, 1], ['C', 3, 0], ['B', 1, 1]])
  })
})

describe('세트 경기', () => {
  const vb: SetRule = { target: 25, decider: 15, winBy: 2, setsToWin: 3 }
  const bd: SetRule = { target: 21, decider: 21, winBy: 2, cap: 30, setsToWin: 2 }
  it('배구 세트: 25점 · 2점 앞서야, 5세트는 15점 (FIVB 6.2 · 6.3)', () => {
    expect(setWinner(25, 23, vb)).toBe('a')
    expect(setWinner(25, 24, vb)).toBeNull()
    expect(setWinner(26, 28, vb)).toBe('b')
    expect(setWinner(15, 13, vb, true)).toBe('a')
    expect(setWinner(15, 14, vb, true)).toBeNull()
  })
  it('배드민턴 게임: 21점 · 20-20이면 2점 앞서야 · 29-29면 30점 (BWF 7.3~7.5)', () => {
    expect(setWinner(21, 19, bd)).toBe('a')
    expect(setWinner(21, 20, bd)).toBeNull()
    expect(setWinner(22, 20, bd)).toBe('a')
    expect(setWinner(30, 29, bd)).toBe('a')
  })
  it('경기 결과: 이긴 세트 수, 끝나지 않았거나 남는 세트가 있으면 순위에 넣지 않음', () => {
    const rules: LeagueRules = { kind: 'sets', allowDraw: false, points: { win: 3, draw: 0, loss: 0, forfeit: 0, winDecider: 2, lossDecider: 1 }, setRule: vb }
    const m = (sets: [number, number][]): LeagueMatch => ({ id: 'm', round: 1, home: 'A', away: 'B', sets, done: true })
    expect(matchResult(m([[25, 20], [25, 18], [25, 10]]), rules)).toEqual({ winner: 'home', homeFor: 3, awayFor: 0, decider: false })
    expect(matchResult(m([[25, 20], [20, 25], [25, 20], [18, 25], [13, 15]]), rules)).toEqual({ winner: 'away', homeFor: 2, awayFor: 3, decider: true })
    expect(matchResult(m([[25, 20], [25, 18]]), rules)).toBeNull()
    expect(matchResult(m([[25, 20], [25, 18], [25, 10], [25, 3]]), rules)).toBeNull()
    expect(matchResult(m([[25, 24]]), rules)).toBeNull()
    // 풀세트 승 2 · 패 1
    const s = standings(['A', 'B'], [m([[25, 20], [20, 25], [25, 20], [18, 25], [13, 15]])], rules)
    expect(s.map((r) => [r.teamId, r.points, r.for, r.against])).toEqual([['B', 2, 3, 2], ['A', 1, 2, 3]])
  })
})
