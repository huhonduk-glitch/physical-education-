import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { applyRosterPlan, studentsOfYear } from '../src/db/rosterRepo'
import { defaultSettings, loadSettings, saveSettings, currentSchoolYear } from '../src/db/settings'
import { hashPin, isValidPin, lockoutSeconds, verifyPin } from '../src/lib/pin'
import { planRosterSave } from '../src/lib/rosterMerge'
import type { NewStudent } from '../src/lib/rosterValidate'

describe('PIN', () => {
  it('4~6자리 숫자만 허용', () => {
    expect(['1234', '123456'].every(isValidPin)).toBe(true)
    expect(['123', '1234567', '12a4', ''].some(isValidPin)).toBe(false)
  })

  it('맞는 PIN만 통과하고, PIN 숫자 자체는 저장 값에 없다', async () => {
    const stored = await hashPin('482915', 1000)
    expect(JSON.stringify(stored)).not.toContain('482915')
    expect(await verifyPin('482915', stored)).toBe(true)
    expect(await verifyPin('482916', stored)).toBe(false)
    expect(await verifyPin('abc', stored)).toBe(false)
  })

  it('같은 PIN이라도 저장 값은 매번 다르다 (소금값)', async () => {
    const a = await hashPin('1234', 1000)
    const b = await hashPin('1234', 1000)
    expect(a.hash).not.toBe(b.hash)
  })

  it('5번 틀리면 기다려야 한다', () => {
    expect(lockoutSeconds(4)).toBe(0)
    expect(lockoutSeconds(5)).toBe(30)
    expect(lockoutSeconds(6)).toBe(60)
    expect(lockoutSeconds(50)).toBe(900)
  })
})

describe('설정', () => {
  let db: PeDatabase
  beforeEach(() => {
    db = new PeDatabase(`t-${Math.random()}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('저장 안 한 값은 기본값', async () => {
    expect(await loadSettings(db)).toEqual(defaultSettings())
  })

  it('바꾼 값만 저장된다', async () => {
    await saveSettings(db, { schoolGenderType: '여', schoolYear: 2027 })
    const s = await loadSettings(db)
    expect(s.schoolGenderType).toBe('여')
    expect(s.schoolYear).toBe(2027)
    expect(s.defaultCourse).toBe('주간')
  })

  it('학년도는 3월에 바뀐다', () => {
    expect(currentSchoolYear(new Date(2027, 1, 28))).toBe(2026)
    expect(currentSchoolYear(new Date(2027, 2, 1))).toBe(2027)
  })
})

function ns(number: number, name: string, classNo = 3): NewStudent {
  return {
    schoolYear: 2026, grade: 1, classNo, classCode: `0${classNo}`, number, name, gender: 'F',
    studentCode: `10${classNo}${String(number).padStart(2, '0')}`, status: '재학', memo: '',
  }
}

describe('명렬 저장 (기기 안 저장소)', () => {
  let db: PeDatabase
  beforeEach(() => {
    db = new PeDatabase(`t-${Math.random()}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('처음 저장 → 병합으로 1명 추가', async () => {
    await applyRosterPlan(db, planRosterSave([], [ns(1, '가'), ns(2, '나')], 'merge'), {})
    const cur = await studentsOfYear(db, 2026)
    const s = await applyRosterPlan(db, planRosterSave(cur, [ns(1, '가'), ns(2, '나'), ns(3, '다')], 'merge'), {})
    expect(s.added).toBe(1)
    expect((await studentsOfYear(db, 2026)).map((x) => x.name).sort()).toEqual(['가', '나', '다'])
  })

  it('이름 다름: 같은 학생이면 이름만 고치고 id(기록 연결)는 그대로', async () => {
    await applyRosterPlan(db, planRosterSave([], [ns(1, '가')], 'merge'), {})
    const [before] = await studentsOfYear(db, 2026)
    const plan = planRosterSave([before], [ns(1, '가가')], 'merge')
    await applyRosterPlan(db, plan, { [before.id]: 'rename' })
    const after = await studentsOfYear(db, 2026)
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: before.id, name: '가가' })
  })

  it('이름 다름: 다른 학생이면 기존은 전출, 새 학생 추가', async () => {
    await applyRosterPlan(db, planRosterSave([], [ns(1, '가')], 'merge'), {})
    const [before] = await studentsOfYear(db, 2026)
    await applyRosterPlan(db, planRosterSave([before], [ns(1, '나')], 'merge'), { [before.id]: 'transfer' })
    const after = await studentsOfYear(db, 2026)
    expect(after.map((x) => [x.name, x.status]).sort()).toEqual([['가', '전출'], ['나', '재학']])
  })

  it('이름 다름: 고르지 않으면 건드리지 않는다', async () => {
    await applyRosterPlan(db, planRosterSave([], [ns(1, '가')], 'merge'), {})
    const cur = await studentsOfYear(db, 2026)
    const s = await applyRosterPlan(db, planRosterSave(cur, [ns(1, '나')], 'merge'), {})
    expect(s.skipped).toBe(1)
    expect((await studentsOfYear(db, 2026)).map((x) => x.name)).toEqual(['가'])
  })

  it('교체: 빠진 학생은 기록이 있으면 전출, 없으면 삭제', async () => {
    await applyRosterPlan(db, planRosterSave([], [ns(1, '기록있음'), ns(2, '기록없음'), ns(3, '남음')], 'merge'), {})
    const cur = await studentsOfYear(db, 2026)
    const withRecord = cur.find((x) => x.name === '기록있음')!
    await db.records.add({
      id: 'r1', schoolYear: 2026, studentId: withRecord.id, date: '2026-04-01', type: 'exemplary',
      category: '정리정돈', keywordIds: [], createdAt: 0, updatedAt: 0,
    })
    const s = await applyRosterPlan(db, planRosterSave(cur, [ns(3, '남음')], 'replace'), {})
    expect(s).toMatchObject({ transferred: 1, deleted: 1 })
    const after = await studentsOfYear(db, 2026)
    expect(after.map((x) => [x.name, x.status]).sort()).toEqual([['기록있음', '전출'], ['남음', '재학']])
    expect(await db.records.count()).toBe(1) // 기록은 보존
  })
})
