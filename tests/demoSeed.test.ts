import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { DEMO_NAME_PARTS, DEMO_SCHOOL, seedDemo } from '../src/db/demoSeed'
import { loadClassPaps, loadRounds } from '../src/db/papsRepo'
import { loadSettings } from '../src/db/settings'
import { dbName, DEMO_DB, MAIN_DB_NAME } from '../src/lib/demo'

let n = 0
const fresh = () => new PeDatabase(`demo-seed-${++n}`)
const PIN = { salt: 'x', hash: 'y', iterations: 1 }
const NOW = new Date('2026-10-22T10:00:00')

describe('시연 모드 저장소', () => {
  it('시연 모드는 실제 앱과 다른 저장소 이름을 쓴다', () => {
    expect(dbName(true)).toBe(DEMO_DB)
    expect(dbName(false)).toBe(MAIN_DB_NAME)
    expect(DEMO_DB).not.toBe(MAIN_DB_NAME)
  })
})

describe('시연용 가상 자료', () => {
  it('가상 학생 60명 · 수업반 4개 · 시간표 · 누가기록 · 일지 · PAPS · 수행평가를 넣는다', async () => {
    const db = fresh()
    expect(await seedDemo(db, { now: NOW, pin: PIN })).toBe(true)
    expect(await db.students.count()).toBe(60)
    const groups = await db.groups.toArray()
    expect(groups.map((g) => g.kind).sort()).toEqual(['elective', 'homeroom', 'homeroom', 'homeroom'])
    expect(await db.records.count()).toBeGreaterThan(40)
    expect(await db.lessons.count()).toBeGreaterThan(5)
    expect(await db.captains.count()).toBe(2)
    expect(await db.assessments.count()).toBe(1)
    expect(await db.assessmentScores.count()).toBe(16)
    const s = await loadSettings(db)
    expect(s.schoolName).toBe(DEMO_SCHOOL)
    expect(s.timetable.length).toBe(12)
    expect(s.termsAgreed).not.toBeNull()
  })

  it('이름은 모두 가명 목록의 조합이고 겹치지 않는다', async () => {
    const db = fresh()
    await seedDemo(db, { now: NOW, pin: PIN })
    const names = (await db.students.toArray()).map((x) => x.name)
    for (const name of names) {
      expect(DEMO_NAME_PARTS.SURNAMES).toContain(name[0])
      expect(DEMO_NAME_PARTS.GIVEN).toContain(name.slice(1))
    }
    expect(new Set(names).size).toBe(names.length)
  })

  it('PAPS: 1-1반은 1·2회차, 1-2반은 1회차 (예전 방식 1회차 = 회차 표시 없음)', async () => {
    const db = fresh()
    await seedDemo(db, { now: NOW, pin: PIN })
    const ids11 = (await db.students.toArray()).filter((x) => x.grade === 1 && x.classNo === 1).map((x) => x.id)
    const rounds = await loadRounds(db, 2026, 1, 1)
    expect(rounds.map((r) => r.round)).toEqual([1, 2])
    const r1 = await loadClassPaps(db, 2026, 1, 1, ids11, null)
    const r2 = await loadClassPaps(db, 2026, 1, 1, ids11, rounds[1].id)
    expect(r1.results.length).toBe(20 * 8)
    expect(r2.results.length).toBe(20 * 8)
    expect(r1.config?.selectedEvents).toMatchObject({ 심폐지구력: 'shuttleRun' })
    expect((await loadRounds(db, 2026, 1, 2)).length).toBe(1)
  })

  it('한 번만 넣는다 (두 번째 열 때는 그대로)', async () => {
    const db = fresh()
    await seedDemo(db, { now: NOW, pin: PIN })
    expect(await seedDemo(db, { now: NOW, pin: PIN })).toBe(false)
    expect(await db.students.count()).toBe(60)
  })

  it('같은 씨앗이면 같은 반이 만들어진다', async () => {
    const a = fresh()
    const b = fresh()
    await seedDemo(a, { now: NOW, pin: PIN })
    await seedDemo(b, { now: NOW, pin: PIN })
    const names = async (db: PeDatabase) => (await db.students.orderBy('studentCode').toArray()).map((x) => x.name)
    expect(await names(a)).toEqual(await names(b))
  })
})
