import { describe, expect, it } from 'vitest'
import type { PapsResult, PapsRound } from '../src/db/types'
import {
  filterRound,
  groupByStudentRound,
  nextRoundNo,
  OTHER_GROUP,
  pickFactorRounds,
  pickRounds,
  resultsForFactorPick,
  resultsForPick,
  roundsOf,
  type PickGroup,
  type RoundScore,
} from '../src/lib/papsRounds'

const EX = '__excluded__'
let n = 0
const row = (studentId: string, eventId: string, value: number, roundId?: string, attempt: number | null = null): PapsResult => ({
  id: `r${++n}`,
  schoolYear: 2026,
  studentId,
  eventId,
  attempt,
  side: null,
  value,
  excluded: false,
  measuredAt: n,
  ...(roundId ? { roundId } : {}),
})
const round = (id: string, no: number, date = '2026-06-01'): PapsRound => ({ id, schoolYear: 2026, grade: 1, classNo: 1, round: no, date, createdAt: no })

describe('PAPS 회차 목록', () => {
  it('행이 없어도 1회차는 있다 (예전 기록 = 1회차)', () => {
    expect(roundsOf([])).toEqual([{ id: null, round: 1, date: null, rowId: null }])
  })
  it('1회차 날짜 행 + 2·3회차, 번호순', () => {
    const r = roundsOf([round('c', 3), round('a', 1, '2026-03-15'), round('b', 2)])
    expect(r.map((x) => [x.id, x.round, x.date])).toEqual([
      [null, 1, '2026-03-15'],
      ['b', 2, '2026-06-01'],
      ['c', 3, '2026-06-01'],
    ])
    expect(r[0].rowId).toBe('a')
  })
  it('다음 회차 번호', () => {
    expect(nextRoundNo([])).toBe(2)
    expect(nextRoundNo([round('b', 2), round('c', 3)])).toBe(4)
  })
})

describe('회차별로 나누기', () => {
  const rows = [row('s1', 'shuttleRun', 30), row('s1', 'shuttleRun', 40, 'R2'), { ...row('s1', EX, 0), excluded: true }]
  it('1회차는 회차 없는 기록만, 측정 제외 행은 늘 포함', () => {
    expect(filterRound(rows, null, EX).map((r) => r.value)).toEqual([30, 0])
    expect(filterRound(rows, 'R2', EX).map((r) => r.value)).toEqual([40, 0])
  })
  it('학생 → 회차 묶음 (제외 행 빼고)', () => {
    const g = groupByStudentRound(rows, EX)
    expect(g.get('s1')?.get(null)?.length).toBe(1)
    expect(g.get('s1')?.get('R2')?.length).toBe(1)
  })
})

describe('나이스 내보내기: 학생마다 회차 하나를 통째로 고른다', () => {
  const rounds = roundsOf([round('R2', 2), round('R3', 3)])
  // 점수: 왕복오래달리기 값 그대로를 합계로, 'complete'는 악력(grip)까지 있으면
  const scoreOf = (_: string, rs: PapsResult[]): RoundScore => ({
    complete: rs.some((r) => r.eventId === 'grip'),
    total: rs.filter((r) => r.eventId === 'shuttleRun').reduce((a, r) => a + r.value!, 0),
  })
  const results = [
    row('s1', 'shuttleRun', 30), // 1회차
    row('s1', 'grip', 1),
    row('s1', 'shuttleRun', 50, 'R2'), // 2회차: 점수 높지만 미완료
    row('s1', 'shuttleRun', 40, 'R3'), // 3회차: 완료
    row('s1', 'grip', 1, 'R3'),
    row('s2', 'shuttleRun', 20), // s2는 1회차만
    row('s3', 'shuttleRun', 33, 'R2'), // s3는 2회차만
    row('s3', 'grip', 1, 'R2'),
    row('s4', 'shuttleRun', 40), // s4: 1·2회차 동점 → 늦은 회차
    row('s4', 'shuttleRun', 40, 'R2'),
  ]
  const by = groupByStudentRound(results, EX)
  const ids = ['s1', 's2', 's3', 's4', 's5']

  it('최근 회차: 기록이 있는 가장 늦은 회차', () => {
    const p = pickRounds(ids, by, rounds, 'latest', scoreOf)
    expect(Object.fromEntries(p)).toEqual({ s1: 'R3', s2: null, s3: 'R2', s4: 'R2', s5: null })
  })

  it('최고 회차: 다 측정된 회차 먼저 → 점수 높은 회차 → 같으면 늦은 회차', () => {
    const p = pickRounds(ids, by, rounds, 'best', scoreOf)
    // s1: 2회차(50) 점수가 더 높지만 미완료 → 완료된 회차 중 3회차(40) vs 1회차(30) → 3회차
    expect(p.get('s1')).toBe('R3')
    expect(p.get('s2')).toBe(null)
    expect(p.get('s3')).toBe('R2')
    expect(p.get('s4')).toBe('R2')
    expect(p.get('s5')).toBe(null) // 기록 없음 → 1회차(내보내기에서 누락으로 보임)
  })

  it('고른 회차의 칸만 남는다 — 다른 회차 칸이 섞이지 않는다', () => {
    const p = pickRounds(ids, by, rounds, 'best', scoreOf)
    const kept = resultsForPick(results, p, EX).filter((r) => r.studentId === 's1')
    expect(kept.map((r) => [r.eventId, r.value, r.roundId])).toEqual([
      ['shuttleRun', 40, 'R3'],
      ['grip', 1, 'R3'],
    ])
  })
})

describe('나이스 내보내기: 요인별 최고 — 요인마다 회차를 따로, 요인 안에서는 섞지 않는다', () => {
  const rounds = roundsOf([round('R2', 2)])
  const groups: PickGroup[] = [
    { key: '심폐지구력', events: ['shuttleRun'], mode: 'best' },
    { key: '근력·근지구력', events: ['gripStrength'], mode: 'best' },
    { key: '비만', events: ['height', 'weight'], mode: 'latest' },
  ]
  // 점수: 묶음 안 값 중 최고값, complete: 악력은 2칸 다 있어야
  const scoreOf = (_: string, g: string, rs: PapsResult[]): RoundScore => ({
    complete: g !== '근력·근지구력' || rs.length >= 2,
    total: Math.max(...rs.map((r) => r.value!)),
  })
  const results = [
    row('s1', 'shuttleRun', 50), // 1회차 심폐가 더 좋음
    row('s1', 'gripStrength', 30, undefined, 1),
    row('s1', 'gripStrength', 31, undefined, 2),
    row('s1', 'height', 160),
    row('s1', 'weight', 50),
    row('s1', 'shuttleRun', 40, 'R2'),
    row('s1', 'gripStrength', 35, 'R2', 1), // 2회차 악력이 더 좋음
    row('s1', 'gripStrength', 34, 'R2', 2),
    row('s1', 'height', 162, 'R2'),
    row('s1', 'weight', 49, 'R2'), // 신장·체중은 최근
    row('s2', 'gripStrength', 30, undefined, 1),
    row('s2', 'gripStrength', 30, undefined, 2),
    row('s2', 'gripStrength', 40, 'R2', 1), // 2회차 악력은 1칸뿐 → 다 있는 1회차가 먼저
    row('s2', 'shuttleRun', 30), // 동점 → 늦은 회차
    row('s2', 'shuttleRun', 30, 'R2'),
    row('s2', 'sitAndReach', 5), // 묶음에 없는 종목 → 최근 회차(여기선 1회차뿐)
  ]
  const by = groupByStudentRound(results, EX)
  const p = pickFactorRounds(['s1', 's2', 's3'], by, rounds, groups, scoreOf)

  it('요인마다 점수가 높은 회차를 따로 고른다', () => {
    expect(Object.fromEntries(p.get('s1')!)).toEqual({ 심폐지구력: null, '근력·근지구력': 'R2', 비만: 'R2', [OTHER_GROUP]: null })
  })
  it('칸이 다 있는 회차 먼저, 같으면 늦은 회차, 기록 없으면 1회차', () => {
    expect(p.get('s2')!.get('근력·근지구력')).toBe(null)
    expect(p.get('s2')!.get('심폐지구력')).toBe('R2')
    expect(p.get('s2')!.get(OTHER_GROUP)).toBe(null)
    expect([...p.get('s3')!.values()].every((v) => v === null)).toBe(true)
  })
  it('요인 안의 칸(1차·2차)은 고른 회차 하나에서만 — 섞이지 않는다', () => {
    const kept = resultsForFactorPick(results, p, groups, EX).filter((r) => r.studentId === 's1')
    expect(kept.map((r) => [r.eventId, r.value])).toEqual([
      ['shuttleRun', 50],
      ['gripStrength', 35],
      ['gripStrength', 34],
      ['height', 162],
      ['weight', 49],
    ])
    expect(resultsForFactorPick(results, p, groups, EX).filter((r) => r.studentId === 's2').map((r) => [r.eventId, r.value, r.roundId ?? null])).toEqual([
      ['gripStrength', 30, null],
      ['gripStrength', 30, null],
      ['shuttleRun', 30, 'R2'],
      ['sitAndReach', 5, null],
    ])
  })
})

describe('회차 사이 변화', () => {
  it('값이 있는 마지막 두 회차의 차이', async () => {
    const { lastChange } = await import('../src/lib/papsRounds')
    expect(lastChange([52, 60])).toBe(8)
    expect(lastChange([52, null, 47])).toBe(-5)
    expect(lastChange([null, 60])).toBeNull()
    expect(lastChange([])).toBeNull()
  })
})
