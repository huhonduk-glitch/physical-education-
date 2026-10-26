import type { PeDatabase } from './db'
import { newId } from './db'
import type { League } from './types'
import { COLOR_KEYS } from '../lib/groups'
import { roundRobin, type LeagueMatch, type LeagueRules, type LeagueTeam, type SportId } from '../lib/league'

export interface NewLeague {
  schoolYear: number
  sport: SportId
  name: string
  groupId?: string
  rules: LeagueRules
  double: boolean
  teams: { name: string; memberIds?: string[] }[]
}

/** 팀 → 대진표 (경기 결과는 비어 있음) */
export function schedule(teams: readonly LeagueTeam[], double: boolean): LeagueMatch[] {
  return roundRobin(teams.map((t) => t.id), double).map((m) => ({ id: newId(), ...m, done: false }))
}

export async function createLeague(db: PeDatabase, n: NewLeague): Promise<string> {
  const teams: LeagueTeam[] = n.teams.map((t, i) => ({ id: newId(), name: t.name.trim() || `${i + 1}팀`, color: COLOR_KEYS[i % COLOR_KEYS.length], memberIds: t.memberIds ?? [] }))
  const now = Date.now()
  const league: League = { id: newId(), schoolYear: n.schoolYear, groupId: n.groupId, sport: n.sport, name: n.name.trim() || '리그전', rules: n.rules, double: n.double, teams, matches: schedule(teams, n.double), createdAt: now, updatedAt: now }
  await db.leagues.add(league)
  return league.id
}

export async function listLeagues(db: PeDatabase, schoolYear: number): Promise<League[]> {
  return (await db.leagues.where('schoolYear').equals(schoolYear).toArray()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveMatch(db: PeDatabase, leagueId: string, match: LeagueMatch): Promise<void> {
  await db.transaction('rw', db.leagues, async () => {
    const l = await db.leagues.get(leagueId)
    if (!l) return
    await db.leagues.update(leagueId, { matches: l.matches.map((m) => (m.id === match.id ? match : m)), updatedAt: Date.now() })
  })
}

/** 이름 · 승점 · 팀 이름 · 팀원 바꾸기. 팀 수가 바뀌면 경기 결과가 하나도 없을 때만 대진을 다시 만든다 */
export async function updateLeague(db: PeDatabase, id: string, patch: Partial<Pick<League, 'name' | 'rules' | 'teams' | 'archived' | 'groupId'>>): Promise<{ ok: boolean; error?: string }> {
  return db.transaction('rw', db.leagues, async () => {
    const l = await db.leagues.get(id)
    if (!l) return { ok: false, error: '리그전을 찾지 못했어요' }
    const next: Partial<League> = { ...patch, updatedAt: Date.now() }
    if (patch.teams) {
      const same = patch.teams.length === l.teams.length && patch.teams.every((t) => l.teams.some((o) => o.id === t.id))
      if (!same) {
        if (l.matches.some((m) => m.done)) return { ok: false, error: '결과를 넣은 경기가 있어 팀을 더하거나 뺄 수 없어요' }
        next.matches = schedule(patch.teams, l.double)
      }
    }
    await db.leagues.update(id, next)
    return { ok: true }
  })
}

export async function deleteLeague(db: PeDatabase, id: string): Promise<void> {
  await db.leagues.delete(id)
}
