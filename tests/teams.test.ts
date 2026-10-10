import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { PeDatabase } from '../src/db/db'
import { setItemValues } from '../src/db/assessRepo'
import { describe, expect, it } from 'vitest'
import { makeTeams, pickRandom, shuffle, teamName, teamsForSize, teamsText, type Level } from '../src/lib/teams'

/** 고정된 무작위 (테스트마다 같은 결과) */
function seeded(seed: number) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

const people = (n: number, f?: (i: number) => { gender?: 'M' | 'F'; level?: Level | null }) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, name: `학생${i + 1}`, ...(f?.(i) ?? {}) }))

describe('뽑기', () => {
  it('섞어도 사람은 그대로', () => {
    const p = people(10)
    const s = shuffle(p, seeded(1))
    expect(s).toHaveLength(10)
    expect(new Set(s.map((x) => x.id))).toEqual(new Set(p.map((x) => x.id)))
    expect(p[0].id).toBe('s1')
  })
  it('n명 뽑기, 중복 없음, 후보보다 많으면 있는 만큼', () => {
    const r = pickRandom(people(5), 3, seeded(2))
    expect(r).toHaveLength(3)
    expect(new Set(r.map((x) => x.id)).size).toBe(3)
    expect(pickRandom(people(2), 5, seeded(2))).toHaveLength(2)
    expect(pickRandom([], 1)).toEqual([])
  })
  it('여러 번 뽑으면 모두 한 번씩은 나온다 (치우침 없음)', () => {
    const rng = seeded(3)
    const hit = new Map<string, number>()
    for (let k = 0; k < 3000; k++) {
      const [x] = pickRandom(people(6), 1, rng)
      hit.set(x.id, (hit.get(x.id) ?? 0) + 1)
    }
    expect(hit.size).toBe(6)
    for (const v of hit.values()) expect(v).toBeGreaterThan(350)
  })
})

describe('팀 나누기', () => {
  it('인원 차이는 많아야 1명, 빠지거나 겹치는 사람 없음', () => {
    for (const n of [7, 10, 23, 33]) {
      for (const t of [2, 3, 4, 5]) {
        const teams = makeTeams(people(n), { teams: t, rng: seeded(n * t) })
        expect(teams).toHaveLength(t)
        const sizes = teams.map((x) => x.length)
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
        expect(new Set(teams.flat().map((x) => x.id)).size).toBe(n)
      }
    }
  })
  it('팀 수가 사람보다 많으면 사람 수만큼', () => {
    expect(makeTeams(people(3), { teams: 5 })).toHaveLength(3)
    expect(makeTeams([], { teams: 3 })).toHaveLength(1)
  })
  it('성별 고르게: 팀마다 남녀 수 차이가 1 이하', () => {
    for (let seed = 1; seed < 30; seed++) {
      const p = people(25, (i) => ({ gender: i % 3 === 0 ? 'F' : 'M' }))
      const teams = makeTeams(p, { teams: 4, balanceGender: true, rng: seeded(seed) })
      for (const g of ['M', 'F']) {
        const c = teams.map((t) => t.filter((x) => x.gender === g).length)
        expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1)
      }
      const sizes = teams.map((x) => x.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  })
  it('실력 고르게: 상 학생이 한 팀에 몰리지 않는다', () => {
    const lv: Level[] = ['상', '상', '상', '상', '중', '중', '중', '중', '하', '하', '하', '하']
    for (let seed = 1; seed < 30; seed++) {
      const teams = makeTeams(people(12, (i) => ({ level: lv[i] })), { teams: 4, balanceLevel: true, rng: seeded(seed) })
      for (const t of teams) expect(t.map((x) => x.level).sort()).toEqual(['상', '중', '하'].sort())
    }
  })
  it('성별 + 실력 함께', () => {
    const p = people(16, (i) => ({ gender: i < 8 ? 'M' : 'F', level: (['상', '중', '하', null] as const)[i % 4] }))
    const teams = makeTeams(p, { teams: 4, balanceGender: true, balanceLevel: true, rng: seeded(9) })
    for (const t of teams) {
      expect(t.filter((x) => x.gender === 'M')).toHaveLength(2)
      expect(t.filter((x) => x.gender === 'F')).toHaveLength(2)
    }
  })
  it('팀당 인원 → 팀 수', () => {
    expect(teamsForSize(30, 5)).toBe(6)
    expect(teamsForSize(31, 4)).toBe(8)
    expect(teamsForSize(3, 10)).toBe(1)
    expect(teamsForSize(0, 4)).toBe(1)
  })
  it('글자로 내보내기', () => {
    const teams = [[{ name: '가' }, { name: '나' }], [{ name: '다' }]]
    expect(teamsText(teams)).toBe(`${teamName(0)} (2명): 가, 나\n${teamName(1)} (1명): 다`)
  })
})

describe('스톱워치 → 수행평가 기록 넣기', () => {
  it('다른 요소 점수·메모는 그대로 두고, 덮어쓴 칸 수를 알려 준다', async () => {
    const name = 'test-assess-repo'
    const db = new PeDatabase(name)
    await db.assessmentScores.add({ id: 'x', assessmentId: 'a1', studentId: 's1', scores: { other: 'A', run: 9.5 }, note: '메모' })
    const n = await setItemValues(db, 'a1', 'run', [
      { studentId: 's1', value: 8.21 },
      { studentId: 's2', value: 9.03 },
    ])
    expect(n).toBe(1)
    const rows = await db.assessmentScores.where('assessmentId').equals('a1').sortBy('studentId')
    expect(rows[0]).toMatchObject({ studentId: 's1', scores: { other: 'A', run: 8.21 }, note: '메모' })
    expect(rows[1]).toMatchObject({ studentId: 's2', scores: { run: 9.03 } })
    db.close()
    await Dexie.delete(name)
  })
})
