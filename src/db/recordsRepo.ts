import { KEYWORD_SEED } from '../data/keywordSeed'
import type { CaptainChange } from '../lib/captains'
import type { PeDatabase } from './db'
import { newId } from './db'
import type { Absence, ClassRecord, Keyword, RecordType } from './types'

/** 키워드 사전이 비어 있으면 기본 키워드를 넣는다 (처음 한 번만). */
export async function ensureKeywordSeed(db: PeDatabase): Promise<void> {
  await db.transaction('rw', db.keywords, async () => {
    if ((await db.keywords.count()) > 0) return
    const rows: Keyword[] = []
    let order = 0
    for (const [category, labels] of Object.entries(KEYWORD_SEED)) {
      for (const label of labels) rows.push({ id: newId(), label, category, isActive: true, sortOrder: order++ })
    }
    await db.keywords.bulkAdd(rows)
  })
}

export interface NewRecordInput {
  schoolYear: number
  studentIds: string[]
  date: string
  period?: number
  type: RecordType
  category: string
  note?: string
  keywordIds?: string[]
  /** 어느 수업반 수업에서 남긴 기록인지 */
  groupId?: string
}

/** 여러 학생에게 같은 기록을 한 번에 저장한다. 되돌리기용으로 만든 id 목록을 돌려준다. */
export async function addRecords(db: PeDatabase, input: NewRecordInput): Promise<string[]> {
  const now = Date.now()
  const rows: ClassRecord[] = input.studentIds.map((studentId) => ({
    id: newId(),
    schoolYear: input.schoolYear,
    studentId,
    date: input.date,
    ...(input.period ? { period: input.period } : {}),
    type: input.type,
    category: input.category,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    keywordIds: input.keywordIds ?? [],
    ...(input.groupId ? { groupId: input.groupId } : {}),
    createdAt: now,
    updatedAt: now,
  }))
  await db.records.bulkAdd(rows)
  return rows.map((r) => r.id)
}

export interface NewAbsenceInput {
  schoolYear: number
  studentIds: string[]
  date: string
  period?: number
  reason: Absence['reason']
  detail?: string
  groupId?: string
}

/** 견학 등록. 같은 날 같은 학생이 이미 견학이면 새로 만들지 않고 사유만 바꾼다. */
export async function addAbsences(db: PeDatabase, input: NewAbsenceInput): Promise<{ added: string[]; updated: Absence[] }> {
  const added: string[] = []
  const updated: Absence[] = []
  await db.transaction('rw', db.absences, async () => {
    for (const studentId of input.studentIds) {
      const same = await db.absences.where('studentId').equals(studentId).filter((a) => a.date === input.date).first()
      if (same) {
        updated.push(same)
        await db.absences.update(same.id, { reason: input.reason, detail: input.detail?.trim() || undefined })
      } else {
        const id = newId()
        await db.absences.add({
          id,
          schoolYear: input.schoolYear,
          studentId,
          date: input.date,
          ...(input.period ? { period: input.period } : {}),
          reason: input.reason,
          ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
          altTaskDone: false,
          ...(input.groupId ? { groupId: input.groupId } : {}),
        })
        added.push(id)
      }
    }
  })
  return { added, updated }
}

export interface UndoToken {
  recordIds: string[]
  absenceIds: string[]
  /** 덮어쓰기 전 견학 기록 (되돌리면 원래대로) */
  absenceBefore: Absence[]
}

/** 방금 한 기록 되돌리기 */
export async function undo(db: PeDatabase, t: UndoToken): Promise<void> {
  await db.transaction('rw', db.records, db.absences, async () => {
    await db.records.bulkDelete(t.recordIds)
    await db.absences.bulkDelete(t.absenceIds)
    if (t.absenceBefore.length) await db.absences.bulkPut(t.absenceBefore)
  })
}

export async function applyCaptainChange(db: PeDatabase, change: CaptainChange): Promise<void> {
  await db.transaction('rw', db.captains, async () => {
    if (change.remove) await db.captains.delete(change.remove)
    if (change.close) await db.captains.update(change.close.id, { to: change.close.to })
    if (change.add) await db.captains.add({ ...change.add, id: newId() })
  })
}
