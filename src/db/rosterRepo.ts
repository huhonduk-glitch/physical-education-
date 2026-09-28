import type { NameDecision, SavePlan } from '../lib/rosterMerge'
import type { PeDatabase } from './db'
import { newId } from './db'
import type { Student } from './types'

export interface SaveSummary {
  added: number
  updated: number
  renamed: number
  transferred: number
  deleted: number
  skipped: number
}

/** 이 학생에게 연결된 기록이 하나라도 있는지 */
async function hasAnyRecord(db: PeDatabase, studentId: string): Promise<boolean> {
  const counts = await Promise.all([
    db.records.where('studentId').equals(studentId).count(),
    db.captains.where('studentId').equals(studentId).count(),
    db.absences.where('studentId').equals(studentId).count(),
    db.papsResults.where('studentId').equals(studentId).count(),
    db.assessmentScores.where('studentId').equals(studentId).count(),
  ])
  return counts.some((c) => c > 0)
}

/**
 * 저장 계획을 실제로 저장한다. 전부 한 번에 저장되거나, 중간에 실패하면 하나도 저장되지 않는다.
 * @param decisions 이름이 다른 학생마다 교사가 고른 처리 (학생 id → 선택)
 */
export async function applyRosterPlan(
  db: PeDatabase,
  plan: SavePlan,
  decisions: Record<string, NameDecision>,
): Promise<SaveSummary> {
  const summary: SaveSummary = { added: 0, updated: 0, renamed: 0, transferred: 0, deleted: 0, skipped: 0 }
  const tables = [db.students, db.records, db.captains, db.absences, db.papsResults, db.assessmentScores]

  await db.transaction('rw', tables, async () => {
    const toAdd: Student[] = plan.add.map((s) => ({ ...s, id: newId() }))

    for (const u of plan.update) {
      await db.students.update(u.student.id, u.changes)
      summary.updated++
    }

    for (const c of plan.nameConflicts) {
      const decision = decisions[c.student.id] ?? 'skip'
      if (decision === 'rename') {
        await db.students.update(c.student.id, {
          name: c.incoming.name,
          gender: c.incoming.gender,
          classCode: c.incoming.classCode,
          studentCode: c.incoming.studentCode,
          ...(c.incoming.course ? { course: c.incoming.course } : {}),
          ...(c.incoming.track ? { track: c.incoming.track } : {}),
          ...(c.incoming.dept ? { dept: c.incoming.dept } : {}),
        })
        summary.renamed++
      } else if (decision === 'transfer') {
        await db.students.update(c.student.id, { status: '전출' })
        summary.transferred++
        toAdd.push({ ...c.incoming, id: newId() })
      } else {
        summary.skipped++
      }
    }

    for (const s of plan.missing) {
      if (await hasAnyRecord(db, s.id)) {
        await db.students.update(s.id, { status: '전출' })
        summary.transferred++
      } else {
        await db.students.delete(s.id)
        summary.deleted++
      }
    }

    if (toAdd.length > 0) await db.students.bulkAdd(toAdd)
    summary.added = toAdd.length
  })
  return summary
}

export async function studentsOfYear(db: PeDatabase, schoolYear: number): Promise<Student[]> {
  return db.students.where('schoolYear').equals(schoolYear).toArray()
}
