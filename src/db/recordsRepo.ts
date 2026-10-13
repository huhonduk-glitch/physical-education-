import { KEYWORD_SEED, KEYWORD_SEED_VERSION } from '../data/keywordSeed'
import type { CaptainChange } from '../lib/captains'
import type { PeDatabase } from './db'
import { newId } from './db'
import type { Absence, ClassRecord, Keyword, RecordType } from './types'

const SEED_VERSION_KEY = 'keywordSeedVersion'

/** 기본 사전에 있는데 지금 사전에 없는 키워드 (이름으로 비교. 꺼 둔 키워드는 '있음'으로 본다) */
export function missingSeedKeywords(existing: Pick<Keyword, 'label'>[]): { category: string; label: string }[] {
  const have = new Set(existing.map((k) => k.label.trim()))
  const out: { category: string; label: string }[] = []
  for (const [category, labels] of Object.entries(KEYWORD_SEED)) {
    for (const label of labels) if (!have.has(label)) out.push({ category, label })
  }
  return out
}

/** 기본 사전 중 없는 키워드를 맨 뒤에 더한다. 더한 개수를 돌려준다 */
export async function addMissingSeedKeywords(db: PeDatabase): Promise<number> {
  return db.transaction('rw', db.keywords, async () => {
    const existing = await db.keywords.toArray()
    const missing = missingSeedKeywords(existing)
    let order = Math.max(-1, ...existing.map((k) => k.sortOrder)) + 1
    await db.keywords.bulkAdd(missing.map(({ category, label }) => ({ id: newId(), label, category, isActive: true, sortOrder: order++ })))
    return missing.length
  })
}

/**
 * 키워드 기본 사전 넣기. 처음이면 전부, 이미 쓰던 기기면 기본 사전 판이 올랐을 때 없는 것만 한 번 더한다.
 * 교사가 이름을 바꾸거나 끈 키워드는 건드리지 않는다.
 */
export async function ensureKeywordSeed(db: PeDatabase): Promise<void> {
  await db.transaction('rw', db.keywords, db.settings, async () => {
    const ver = (await db.settings.get(SEED_VERSION_KEY))?.value
    if ((await db.keywords.count()) > 0 && typeof ver === 'number' && ver >= KEYWORD_SEED_VERSION) return
    await addMissingSeedKeywords(db)
    await db.settings.put({ key: SEED_VERSION_KEY, value: KEYWORD_SEED_VERSION })
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
  /** 체크를 풀면서 지운 기록 (되돌리면 다시 넣는다) */
  recordsBefore?: ClassRecord[]
}

/** 방금 한 기록 되돌리기 */
export async function undo(db: PeDatabase, t: UndoToken): Promise<void> {
  await db.transaction('rw', db.records, db.absences, async () => {
    await db.records.bulkDelete(t.recordIds)
    if (t.recordsBefore?.length) await db.records.bulkPut(t.recordsBefore)
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

export interface ToggleCheckInput {
  schoolYear: number
  groupId: string
  studentId: string
  date: string
  period?: number
  type: 'unprepared' | 'exemplary'
  category: string
}

/**
 * 체크표 칸 누르기: 그날 이 수업반에서 같은 항목 기록이 있으면 지우고(체크 풀기), 없으면 하나 만든다.
 * 되돌리기용 토큰을 돌려준다.
 */
export async function toggleCheck(db: PeDatabase, input: ToggleCheckInput): Promise<{ checked: boolean; token: UndoToken }> {
  return db.transaction('rw', db.records, async () => {
    const same = await db.records
      .where('[groupId+date]')
      .equals([input.groupId, input.date])
      .filter((r) => r.studentId === input.studentId && r.type === input.type && r.category === input.category)
      .toArray()
    if (same.length) {
      await db.records.bulkDelete(same.map((r) => r.id))
      return { checked: false, token: { recordIds: [], absenceIds: [], absenceBefore: [], recordsBefore: same } }
    }
    const ids = await addRecords(db, { ...input, studentIds: [input.studentId] })
    return { checked: true, token: { recordIds: ids, absenceIds: [], absenceBefore: [] } }
  })
}
