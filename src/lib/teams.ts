/**
 * 수업 도구: 뽑기 · 팀 나누기 (재설계 4단계). 순수 함수 — 무작위는 rng로 받아서 테스트에서 고정한다.
 */

export type Rng = () => number

/** 섞기 (Fisher–Yates). 원본은 그대로 둔다 */
export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** n명 뽑기. 후보보다 많이 달라면 있는 만큼만 */
export function pickRandom<T>(pool: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(pool, rng).slice(0, Math.max(0, Math.min(n, pool.length)))
}

export type Level = '상' | '중' | '하'
const LEVEL_POINTS: Record<Level, number> = { 상: 3, 중: 2, 하: 1 }

export interface TeamMember {
  id: string
  gender?: 'M' | 'F' | null
  level?: Level | null
}

export interface TeamOptions {
  /** 팀 수 (2 이상) */
  teams: number
  /** 남녀를 팀마다 고르게 */
  balanceGender?: boolean
  /** 실력(상·중·하)을 팀마다 고르게. 수준이 없는 학생은 '중'으로 본다 */
  balanceLevel?: boolean
  rng?: Rng
}

/** 팀 수 → 몇 명씩인지, 팀당 인원 → 몇 팀인지 */
export function teamsForSize(people: number, size: number): number {
  if (people <= 0 || size <= 0) return 1
  return Math.max(1, Math.round(people / size))
}

/**
 * 팀 나누기. 인원은 팀마다 많아야 1명 차이.
 * 섞은 뒤 (성별 → 실력 높은 순) 줄을 세우고, 한 명씩 '인원이 가장 적은 팀 → 같은 성별이 가장 적은 팀 → 실력 합이 가장 낮은 팀'에 넣는다.
 * 실력 순으로 넣으면 지그재그(뱀) 배분과 같은 효과가 난다.
 */
export function makeTeams<T extends TeamMember>(people: readonly T[], opts: TeamOptions): T[][] {
  const n = Math.max(1, Math.min(Math.floor(opts.teams), Math.max(1, people.length)))
  const rng = opts.rng ?? Math.random
  const lv = (p: T) => LEVEL_POINTS[p.level ?? '중'] ?? 2
  const gk = (p: T) => p.gender ?? '-'
  let order = shuffle(people, rng)
  if (opts.balanceLevel) order = [...order].sort((a, b) => lv(b) - lv(a))
  if (opts.balanceGender) order = [...order].sort((a, b) => gk(a).localeCompare(gk(b)))

  const teams: T[][] = Array.from({ length: n }, () => [])
  const levelSum = new Array<number>(n).fill(0)
  // 같은 조건이면 고르는 팀 순서도 섞어서, 1팀만 늘 먼저 받지 않게
  const tieOrder = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  )
  for (const p of order) {
    let best = -1
    let bestKey: number[] = []
    for (const t of tieOrder) {
      const key = [
        teams[t].length,
        opts.balanceGender ? teams[t].filter((x) => gk(x) === gk(p)).length : 0,
        opts.balanceLevel ? levelSum[t] : 0,
      ]
      if (best < 0 || lexLess(key, bestKey)) {
        best = t
        bestKey = key
      }
    }
    teams[best].push(p)
    levelSum[best] += lv(p)
  }
  return teams
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

export const teamName = (i: number) => `${i + 1}팀`

/** 팀 결과를 글자로 (칠판·메신저에 붙여넣기용) */
export function teamsText(teams: readonly { name: string }[][], label: (p: { name: string }) => string = (p) => p.name): string {
  return teams.map((t, i) => `${teamName(i)} (${t.length}명): ${t.map(label).join(', ')}`).join('\n')
}

/**
 * 저장한 팀 (2026-11-25, 슈퍼스쿨 '자리' 화면을 체육에 맞게 — 모둠 · 팀 고정).
 * 수업반에 한 벌만 둔다(ClassGroup.squads). 단원 동안 같은 팀으로 수업할 때 [불러오기].
 */
export interface SavedTeams {
  /** 선생님이 붙인 이름 (예: 배구 단원) */
  name: string
  savedAt: number
  /** 팀마다 학생 id */
  teams: string[][]
}

/**
 * 저장한 팀 → 지금 명단의 팀. 명단에 없는 학생(전출 · 오늘 견학으로 뺀 학생)은 빠지고(missing),
 * 저장한 팀에 없는 새 학생은 그때 가장 적은 팀에 차례로 넣는다(added).
 */
export function restoreTeams<T extends { id: string }>(saved: readonly (readonly string[])[], people: readonly T[]): { teams: T[][]; missing: number; added: T[] } {
  const byId = new Map(people.map((p) => [p.id, p]))
  let missing = 0
  const teams = saved.map((ids) =>
    ids.flatMap((id) => {
      const p = byId.get(id)
      if (!p) missing++
      return p ? [p] : []
    }),
  )
  const placed = new Set(saved.flat())
  const added = people.filter((p) => !placed.has(p.id))
  if (teams.length)
    for (const p of added) {
      let min = 0
      for (let i = 1; i < teams.length; i++) if (teams[i].length < teams[min].length) min = i
      teams[min].push(p)
    }
  return { teams, missing, added }
}
