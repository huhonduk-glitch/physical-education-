import type { PeDatabase } from './db'
import { indexResults, loadClassPaps, studentSummary } from './papsRepo'
import type { Student } from './types'
import type { EventId, Factor, FlexMode, PapsStandards } from '../lib/paps'
import { buildReport, type StudentReport } from '../lib/report'

/** 학생 여러 명의 리포트를 한 번에 (반마다 PAPS 설정을 따로 읽는다) */
export async function loadReports(
  db: PeDatabase,
  students: readonly Student[],
  ctx: { schoolYear: number; standards: PapsStandards; schoolLevel: string; flexMode: FlexMode },
): Promise<StudentReport[]> {
  if (students.length === 0) return []
  const ids = students.map((s) => s.id)
  const [records, absences, captains, keywords, assessments, scores, groups] = await Promise.all([
    db.records.where('studentId').anyOf(ids).toArray(),
    db.absences.where('studentId').anyOf(ids).toArray(),
    db.captains.where('studentId').anyOf(ids).toArray(),
    db.keywords.toArray(),
    db.assessments.where('schoolYear').equals(ctx.schoolYear).toArray(),
    db.assessmentScores.where('studentId').anyOf(ids).toArray(),
    db.groups.where('schoolYear').equals(ctx.schoolYear).toArray(),
  ])
  const byClass = new Map<string, Student[]>()
  for (const s of students) byClass.set(`${s.grade}-${s.classNo}`, [...(byClass.get(`${s.grade}-${s.classNo}`) ?? []), s])
  const papsOf = new Map<string, { paps: ReturnType<typeof studentSummary>; excluded: boolean }>()
  for (const list of byClass.values()) {
    const d = await loadClassPaps(db, ctx.schoolYear, list[0].grade, list[0].classNo, list.map((s) => s.id))
    const { values, excluded } = indexResults(d.results)
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    for (const s of list) papsOf.set(s.id, { paps: studentSummary(ctx.standards, s, ctx.schoolLevel, selected, values.get(s.id), ctx.flexMode), excluded: excluded.has(s.id) })
  }
  return students.map((s) =>
    buildReport(s, { records, absences, captains, keywords, assessments, scores, groups, paps: papsOf.get(s.id)?.paps ?? null, papsExcluded: papsOf.get(s.id)?.excluded ?? false }),
  )
}
