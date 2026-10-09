import type { EntityTable } from 'dexie'
import { currentSchoolYear, type TimetableEntry } from './settings'
import { newHomeroomGroup } from '../lib/groups'
import type { PeDatabase } from './db'
import type { Absence, ClassGroup, ClassRecord, SettingRow, Student } from './types'

// db.ts가 이 파일을 불러오므로 db.ts의 newId 대신 직접 만든다 (서로 불러오는 고리 방지)
const newId = () => crypto.randomUUID()

interface Tables {
  students: EntityTable<Student, 'id'>
  groups: EntityTable<ClassGroup, 'id'>
  records: EntityTable<ClassRecord, 'id'>
  absences: EntityTable<Absence, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

/**
 * 수업반이 없던 시절(v2) 자료를 수업반 구조로 옮긴다. 여러 번 실행해도 결과가 같다.
 * 1) 명렬에 있는 학적반마다 학적반 수업반을 만든다 (예전 화면처럼 모든 반이 보이게)
 * 2) 수업반 표시가 없는 기록·견학은 그 학생의 학적반 수업반에 붙인다
 * 3) 시간표의 '학년·반'을 수업반으로 바꾼다
 * 지우는 자료는 없다.
 */
export async function migrateToGroups(t: Tables): Promise<void> {
  const students = await t.students.toArray()
  const groups = await t.groups.toArray()
  const byKey = new Map<string, ClassGroup>()
  for (const g of groups) if (g.kind === 'homeroom') byKey.set(`${g.schoolYear}-${g.grade}-${g.classNo}`, g)
  const created: ClassGroup[] = []
  const ensure = (year: number, grade: number, classNo: number): ClassGroup => {
    const k = `${year}-${grade}-${classNo}`
    let g = byKey.get(k)
    if (!g) {
      const order = groups.filter((x) => x.schoolYear === year).length + created.filter((x) => x.schoolYear === year).length
      g = { ...newHomeroomGroup(year, grade, classNo, order), id: newId(), createdAt: Date.now() }
      byKey.set(k, g)
      created.push(g)
    }
    return g
  }

  const sorted = [...students].sort((a, b) => a.schoolYear - b.schoolYear || a.grade - b.grade || a.classNo - b.classNo)
  for (const s of sorted) if (s.status !== '전출') ensure(s.schoolYear, s.grade, s.classNo)
  const studentById = new Map(students.map((s) => [s.id, s]))

  const records = (await t.records.toArray()).filter((r) => !r.groupId)
  const absences = (await t.absences.toArray()).filter((a) => !a.groupId)
  const fix = <T extends { studentId: string; groupId?: string }>(rows: T[]): T[] =>
    rows.flatMap((r) => {
      const s = studentById.get(r.studentId)
      return s ? [{ ...r, groupId: ensure(s.schoolYear, s.grade, s.classNo).id }] : []
    })
  const fixedRecords = fix(records)
  const fixedAbsences = fix(absences)

  // 시간표: { grade, classNo } → { groupId }
  const ttRow = await t.settings.get('timetable')
  const yearRow = await t.settings.get('schoolYear')
  const year = typeof yearRow?.value === 'number' ? yearRow.value : currentSchoolYear()
  let newTimetable: TimetableEntry[] | null = null
  if (Array.isArray(ttRow?.value)) {
    const old = ttRow.value as (TimetableEntry & { grade?: number; classNo?: number })[]
    if (old.some((e) => !e.groupId && e.grade && e.classNo)) {
      newTimetable = old.flatMap((e) => {
        if (e.groupId) return [{ day: e.day, period: e.period, groupId: e.groupId }]
        if (e.grade && e.classNo) return [{ day: e.day, period: e.period, groupId: ensure(year, e.grade, e.classNo).id }]
        return []
      })
    }
  }

  if (created.length) await t.groups.bulkAdd(created)
  if (fixedRecords.length) await t.records.bulkPut(fixedRecords)
  if (fixedAbsences.length) await t.absences.bulkPut(fixedAbsences)
  if (newTimetable) await t.settings.put({ key: 'timetable', value: newTimetable })
}

export async function runGroupMigration(db: PeDatabase): Promise<void> {
  await db.transaction('rw', [db.students, db.groups, db.records, db.absences, db.settings], () =>
    migrateToGroups({ students: db.students, groups: db.groups, records: db.records, absences: db.absences, settings: db.settings }),
  )
}

/** 학적반 수업반 여러 개 만들기 (명렬을 올린 뒤 교사가 고른 반) */
export async function addHomeroomGroups(db: PeDatabase, schoolYear: number, classes: { grade: number; classNo: number }[]): Promise<string[]> {
  const existing = await db.groups.where('schoolYear').equals(schoolYear).toArray()
  const have = new Set(existing.filter((g) => g.kind === 'homeroom').map((g) => `${g.grade}-${g.classNo}`))
  let order = existing.length
  const rows: ClassGroup[] = classes
    .filter((c) => !have.has(`${c.grade}-${c.classNo}`))
    .map((c) => ({ ...newHomeroomGroup(schoolYear, c.grade, c.classNo, order++), id: newId(), createdAt: Date.now() }))
  if (rows.length) await db.groups.bulkAdd(rows)
  return rows.map((r) => r.id)
}

export async function createGroup(db: PeDatabase, g: Omit<ClassGroup, 'id' | 'createdAt' | 'sortOrder'>): Promise<string> {
  const id = newId()
  const order = await db.groups.where('schoolYear').equals(g.schoolYear).count()
  await db.groups.add({ ...g, id, sortOrder: order, createdAt: Date.now() })
  return id
}

/**
 * 수업반 지우기. 그 반에서 남긴 기록은 지우지 않는다(학생별 기록으로 남는다).
 * 시간표에서 이 반이 들어 있던 칸만 비운다.
 */
export async function deleteGroup(db: PeDatabase, id: string): Promise<void> {
  await db.transaction('rw', [db.groups, db.settings], async () => {
    await db.groups.delete(id)
    const tt = await db.settings.get('timetable')
    if (Array.isArray(tt?.value)) {
      await db.settings.put({ key: 'timetable', value: (tt.value as TimetableEntry[]).filter((e) => e.groupId !== id) })
    }
  })
}
