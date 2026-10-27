import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { exportAll, restoreAll } from '../src/db/backup'
import { createLeague, saveMatch, updateLeague } from '../src/db/leaguesRepo'
import { standings } from '../src/lib/league'
import { sportOf } from '../src/data/sports'

let n = 0
const dbs: PeDatabase[] = []
const fresh = () => {
  const d = new PeDatabase(`league-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

describe('리그전 저장', () => {
  it('만들기 → 결과 넣기 → 순위 → 백업 · 복원', async () => {
    const db = fresh()
    const rules = sportOf('football')!.league!
    const id = await createLeague(db, { schoolYear: 2026, sport: 'football', name: '1-1 축구', rules, double: false, teams: [{ name: '청' }, { name: '백' }, { name: '' }] })
    const l = (await db.leagues.get(id))!
    expect(l.teams.map((t) => t.name)).toEqual(['청', '백', '3팀'])
    expect(l.matches).toHaveLength(3)
    const m = l.matches[0]
    await saveMatch(db, id, { ...m, homeScore: 2, awayScore: 0, done: true })
    const l2 = (await db.leagues.get(id))!
    const top = standings(l2.teams.map((t) => t.id), l2.matches, l2.rules)[0]
    expect(top).toMatchObject({ teamId: m.home, points: 3 })

    const file = await exportAll(db)
    expect(file.counts.leagues).toBe(1)
    const other = fresh()
    await restoreAll(other, file)
    expect((await other.leagues.get(id))!.matches.filter((x) => x.done)).toHaveLength(1)
  })
  it('결과가 있으면 팀 수를 못 바꾸고, 없으면 대진을 다시 만든다', async () => {
    const db = fresh()
    const id = await createLeague(db, { schoolYear: 2026, sport: 'basketball', name: '', rules: sportOf('basketball')!.league!, double: false, teams: [{ name: 'A' }, { name: 'B' }] })
    const l = (await db.leagues.get(id))!
    const more = [...l.teams, { id: 'c', name: 'C', color: 'blue', memberIds: [] }]
    expect((await updateLeague(db, id, { teams: more })).ok).toBe(true)
    expect((await db.leagues.get(id))!.matches).toHaveLength(3)
    const l2 = (await db.leagues.get(id))!
    await saveMatch(db, id, { ...l2.matches[0], homeScore: 50, awayScore: 40, done: true })
    expect((await updateLeague(db, id, { teams: l2.teams.slice(0, 2) })).ok).toBe(false)
    expect((await updateLeague(db, id, { teams: l2.teams.map((t) => ({ ...t, name: t.name + '팀' })) })).ok).toBe(true)
  })
})
