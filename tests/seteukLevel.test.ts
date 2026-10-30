import { describe, expect, it } from 'vitest'
import { assignLevels, DEFAULT_WEIGHTS, frameFor, frameIndex, frameInstruction, levelScores, percentile, type LevelSignals } from '../src/lib/seteukLevel'

const sig = (id: string, p: Partial<LevelSignals> = {}): LevelSignals => ({ studentId: id, assess: null, praise: 0, notes: 0, keywords: 0, captain: false, paps: null, guide: 0, evidence: 3, ...p })

describe('세특 수준 나누기', () => {
  it('반 안 순위: 같은 값은 같은 자리, 모두 같으면 가운데', () => {
    expect(percentile([1, 2, 3])).toEqual([0, 0.5, 1])
    expect(percentile([2, 2, 5])).toEqual([0.25, 0.25, 1])
    expect(percentile([4, 4])).toEqual([0.5, 0.5])
  })
  it('수행평가 · 활동 · PAPS 비중으로 점수, 없는 요인은 빼고 나눔', () => {
    const [a, b, c] = levelScores([sig('a', { assess: 1, praise: 5, paps: 1 }), sig('b', { assess: 0.5, praise: 0, paps: 5 }), sig('c', { assess: null, praise: 4, paps: null })])
    expect(a.score).toBe(100)
    // b: 수행 0.5×50 + 활동 0×35 + PAPS 0×15 = 25 / 100
    expect(b.score).toBe(25)
    // c: 수행 · PAPS 없음 → 활동(가운데 0.5)만
    expect(c.score).toBe(50)
  })
  it('지도 기록은 감점 (최대 비중만큼)', () => {
    const [x, y] = levelScores([sig('x', { assess: 0.8, guide: 0 }), sig('y', { assess: 0.8, guide: 4 })], { ...DEFAULT_WEIGHTS, activity: 0, paps: 0 })
    expect(x.score).toBe(80)
    expect(y.score).toBe(70)
  })
  it('근거가 적으면 근거 부족', () => {
    expect(levelScores([sig('t', { evidence: 1 })])[0].thin).toBe(true)
  })
  it('순위로 5수준: 위 20%가 5수준, 같은 점수는 같은 수준', () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({ studentId: `s${i}`, score: 100 - i * 10 }))
    const lv = assignLevels(scores, 5)
    expect(scores.map((s) => lv.get(s.studentId))).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1])
    const tie = assignLevels([{ studentId: 'a', score: 50 }, { studentId: 'b', score: 50 }, { studentId: 'c', score: 10 }], 3)
    expect([tie.get('a'), tie.get('b'), tie.get('c')]).toEqual([3, 3, 1])
  })
  it('3수준이면 1 · 3 · 5 틀을 쓰고, 지시에 수준 이름은 없음', () => {
    expect([1, 2, 3].map((k) => frameIndex(k, 3))).toEqual([1, 3, 5])
    expect([1, 2, 3, 4, 5].map((k) => frameIndex(k, 5))).toEqual([1, 2, 3, 4, 5])
    const f = frameFor(3, 3)
    expect(f.name).toBe('탁월')
    const ins = frameInstruction(f)
    expect(ins).toContain('1,300~1,500바이트')
    expect(ins).not.toContain('탁월')
  })
})

import { checkSeteuk } from '../src/lib/seteukCheck'
describe('형식 오류 검사', () => {
  it('낱자 · 문장부호 앞 띄어쓰기 · 겹친 마침표 · 줄바꿈', () => {
    const h = checkSeteuk('수업에 적극 참여함 .ㅋㅋ 잘함..\n성실함.').find((x) => x.id === 'typo')
    expect(h?.words).toEqual(["낱자 'ㅋㅋ'", '문장부호 앞 띄어쓰기', "'..' 겹친 문장부호", '줄바꿈 (나이스 2바이트 · 한 문단 권장)'])
    expect(checkSeteuk('수업에 적극 참여함.').find((x) => x.id === 'typo')).toBeUndefined()
  })
})
