import { describe, expect, it } from 'vitest'
import { restoreTeams } from '../src/lib/teams'

const p = (id: string) => ({ id, name: id })

describe('저장한 팀 불러오기 (모둠 · 팀 고정)', () => {
  it('저장한 순서 그대로 · 오늘 명단에 없는 학생은 빠짐 · 새 학생은 인원이 적은 팀에', () => {
    const saved = [
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]
    // c(전출) · e(오늘 견학)는 명단에 없고, g · h는 새로 온 학생
    const r = restoreTeams(saved, [p('a'), p('b'), p('d'), p('f'), p('g'), p('h')])
    expect(r.missing).toBe(2)
    expect(r.added.map((x) => x.id)).toEqual(['g', 'h'])
    // 두 팀 다 2명 → g는 앞 팀, h는 그다음 적은 팀
    expect(r.teams.map((t) => t.map((x) => x.id))).toEqual([
      ['a', 'b', 'g'],
      ['d', 'f', 'h'],
    ])
  })
  it('그대로면 바뀌는 것 없음 · 저장한 팀이 없으면 빈 목록', () => {
    const r = restoreTeams([['a'], ['b']], [p('a'), p('b')])
    expect(r).toEqual({ teams: [[p('a')], [p('b')]], missing: 0, added: [] })
    expect(restoreTeams([], [p('a')]).teams).toEqual([])
  })
})
