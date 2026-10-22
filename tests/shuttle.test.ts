import { describe, expect, it } from 'vitest'
import { canMiss, pushShuttle, replayShuttle, runnerOf, undoShuttle, type ShuttleAction } from '../src/lib/shuttle'

const laps = (n: number): ShuttleAction[] => Array.from({ length: n }, () => ({ kind: 'lap' as const }))
const miss = (id: string): ShuttleAction => ({ kind: 'miss', id })

describe('왕복오래달리기 반 전체 세기 (별표3: 첫 늦음 △ 계속, 두 번째 끝 → 직전 횟수)', () => {
  it('늦지 않은 학생은 지금 회차가 기록', () => {
    const s = replayShuttle(laps(34))
    expect(runnerOf(s, 'a')).toEqual({ warnedAt: null, outAt: null, record: 34, running: true })
  })

  it('첫 늦음은 △만 표시하고 계속 센다', () => {
    const s = replayShuttle([...laps(20), miss('a'), ...laps(5)])
    expect(runnerOf(s, 'a')).toMatchObject({ warnedAt: 20, outAt: null, record: 25, running: true })
  })

  it('두 번째 늦음이면 끝, 기록은 그 회차 − 1', () => {
    const s = replayShuttle([...laps(20), miss('a'), ...laps(15), miss('a'), ...laps(10)])
    expect(runnerOf(s, 'a')).toMatchObject({ warnedAt: 20, outAt: 35, record: 34, running: false })
    // 다른 학생은 계속
    expect(runnerOf(s, 'b').record).toBe(45)
  })

  it('연달아 두 번 늦으면 첫 늦음 직전 회차', () => {
    const s = replayShuttle([...laps(10), miss('a'), ...laps(1), miss('a')])
    expect(runnerOf(s, 'a')).toMatchObject({ warnedAt: 10, outAt: 11, record: 10 })
  })

  it('같은 회차에 두 번 누르면 한 번만 (실수 탭)', () => {
    const s = replayShuttle([...laps(10), miss('a'), miss('a')])
    expect(runnerOf(s, 'a')).toMatchObject({ warnedAt: 10, outAt: null, running: true })
    expect(canMiss(s, 'a')).toBe(false)
  })

  it('끝난 학생은 더 늦음을 받지 않는다', () => {
    const s = replayShuttle([...laps(3), miss('a'), ...laps(1), miss('a'), ...laps(1), miss('a')])
    expect(runnerOf(s, 'a').outAt).toBe(4)
    expect(canMiss(s, 'a')).toBe(false)
  })

  it('시작 전(0회)에 끝나도 기록은 0 아래로 내려가지 않는다', () => {
    const s = replayShuttle([miss('a'), ...laps(1), miss('a')])
    expect(runnerOf(s, 'a').record).toBe(0)
  })

  it('반영 안 될 탭은 남기지 않아서, 되돌리기는 마지막 하나만 뺀다', () => {
    let acts = laps(10)
    acts = pushShuttle(acts, miss('a'))
    acts = pushShuttle(acts, miss('a')) // 같은 회차 두 번 → 안 남김
    expect(acts.length).toBe(11)
    const back = undoShuttle(acts)
    expect(runnerOf(replayShuttle(back), 'a').warnedAt).toBeNull()
    expect(replayShuttle(back).lap).toBe(10)
    expect(replayShuttle(undoShuttle(laps(5))).lap).toBe(4)
    expect(undoShuttle([])).toEqual([])
  })

  it('한 반 누르는 횟수: 40회 + 25명 × 늦음 2번 = 90번 (예전 약 1,000번)', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `s${i}`)
    const acts: ShuttleAction[] = []
    for (let lap = 1; lap <= 40; lap++) {
      acts.push({ kind: 'lap' })
      for (const [i, id] of ids.entries()) if (lap === 15 + i || lap === 16 + i) acts.push(miss(id))
    }
    expect(acts.length).toBe(90)
    const s = replayShuttle(acts)
    expect(runnerOf(s, 's0').record).toBe(15)
    expect(runnerOf(s, 's24').record).toBe(39)
  })
})
