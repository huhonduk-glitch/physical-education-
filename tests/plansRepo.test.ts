import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { exportAll, restoreAll } from '../src/db/backup'
import { copyPlanToYear, createPlan, deletePlan, plansForGroup, setDone, toggleGroupSkip, updatePlan } from '../src/db/plansRepo'

let n = 0
const dbs: PeDatabase[] = []
const fresh = () => {
  const d = new PeDatabase(`plans-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

const base = {
  schoolYear: 2026,
  semester: 2 as const,
  title: '스포츠 생활2',
  subject: '스포츠 생활2',
  grade: 2,
  weeklyHours: 1,
  weeks: 17,
  target: 17,
  startDate: '2026-08-17',
  endDate: '2026-12-31',
  offDays: [],
  groupIds: ['g1', 'g2'],
  items: [{ id: 'i1', unit: '오리엔테이션', content: '', standards: [] }],
}

describe('진도표 저장', () => {
  it('만들기 · 수업반으로 찾기 · 고치기 · 지우기', async () => {
    const db = fresh()
    const id = await createPlan(db, base)
    expect((await plansForGroup(db, 'g2')).map((p) => p.id)).toEqual([id])
    expect(await plansForGroup(db, 'g9')).toEqual([])
    await updatePlan(db, id, { title: '배드민턴' })
    expect((await db.progressPlans.get(id))?.title).toBe('배드민턴')
    await deletePlan(db, id)
    expect(await db.progressPlans.count()).toBe(0)
  })
  it('끝냄 · 밀기는 수업반마다 따로', async () => {
    const db = fresh()
    const id = await createPlan(db, base)
    await setDone(db, id, 'g1', 'i1', true)
    await toggleGroupSkip(db, id, 'g2', { date: '2026-09-07', period: 3 })
    let p = await db.progressPlans.get(id)
    expect(p?.done).toEqual({ g1: ['i1'] })
    expect(p?.skips).toEqual({ g2: ['2026-09-07|3'] })
    await setDone(db, id, 'g1', 'i1', false)
    await toggleGroupSkip(db, id, 'g2', { date: '2026-09-07', period: 3 })
    p = await db.progressPlans.get(id)
    expect(p?.done).toEqual({ g1: [] })
    expect(p?.skips).toEqual({ g2: [] })
  })
  it('올해로 복사: 차시만 새 id로, 수업반 · 끝냄은 비움', async () => {
    const db = fresh()
    const id = await createPlan(db, { ...base, items: [{ id: 'i1', unit: 'U', content: 'c', standards: ['[A]'], lockedDate: '2026-09-07' }] })
    await setDone(db, id, 'g1', 'i1', true)
    const src = (await db.progressPlans.get(id))!
    const nid = await copyPlanToYear(db, src, 2027, { startDate: '2027-08-16', endDate: '2027-12-31' })
    const c = (await db.progressPlans.get(nid))!
    expect(c.schoolYear).toBe(2027)
    expect(c.groupIds).toEqual([])
    expect(c.done).toEqual({})
    expect(c.items[0]).toMatchObject({ unit: 'U', content: 'c', standards: ['[A]'] })
    expect(c.items[0].id).not.toBe('i1')
    expect(c.items[0].lockedDate).toBeUndefined()
  })
  it('백업에 들어가고 복원된다', async () => {
    const db = fresh()
    await createPlan(db, base)
    const file = await exportAll(db)
    expect(file.counts.progressPlans).toBe(1)
    const db2 = fresh()
    await restoreAll(db2, file)
    expect(await db2.progressPlans.count()).toBe(1)
  })
})
