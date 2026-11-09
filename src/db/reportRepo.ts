import type { PeDatabase } from './db'
import { indexResults, loadClassPapsPicked, studentSummary } from './papsRepo'
import type { Student } from './types'
import type { EventId, Factor, FlexMode, PapsStandards } from '../lib/paps'
import { buildReport, type StudentReport } from '../lib/report'
import type { StudentPaps } from '../lib/paps'
import { linkAcrossYears } from '../lib/yearLink'
import type { SchoolPapsRow } from '../lib/schoolPaps'

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
    // 여러 번 측정했으면 학생마다 가장 최근 회차 (B-5)
    const d = await loadClassPapsPicked(db, ctx.schoolYear, list[0].grade, list[0].classNo, list.map((s) => s.id), 'latest')
    const { values, excluded } = indexResults(d.results)
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    for (const s of list) papsOf.set(s.id, { paps: studentSummary(ctx.standards, s, ctx.schoolLevel, selected, values.get(s.id), ctx.flexMode), excluded: excluded.has(s.id) })
  }
  return students.map((s) =>
    buildReport(s, { records, absences, captains, keywords, assessments, scores, groups, paps: papsOf.get(s.id)?.paps ?? null, papsExcluded: papsOf.get(s.id)?.excluded ?? false }),
  )
}

/**
 * 학년도를 넘는 PAPS (2026-11-09): 이 학생과 다른 학년도의 같은 학생(이름 · 성별 · 학년, src/lib/yearLink.ts)마다
 * 그 학년도 가장 최근 회차 결과. 학년도 순, 이 학년도 포함.
 */
export async function loadYearPaps(
  db: PeDatabase,
  me: Student,
  ctx: { standards: PapsStandards; schoolLevel: string; flexMode: FlexMode },
): Promise<{ years: { schoolYear: number; grade: number; classNo: number; studentId: string; paps: StudentPaps | null }[]; ambiguous: number[] }> {
  const name = me.name.replace(/\s+/g, '')
  const others = (await db.students.toArray()).filter((s) => s.name.replace(/\s+/g, '') === name)
  const links = linkAcrossYears(me, others)
  const people = [me, ...links.map((l) => l.student).filter((s): s is Student => !!s)].sort((a, b) => a.schoolYear - b.schoolYear)
  const years = []
  for (const s of people) {
    const d = await loadClassPapsPicked(db, s.schoolYear, s.grade, s.classNo, [s.id], 'latest')
    const { values, excluded } = indexResults(d.results)
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    const paps = excluded.has(s.id) ? null : studentSummary(ctx.standards, s, ctx.schoolLevel, selected, values.get(s.id), ctx.flexMode)
    years.push({ schoolYear: s.schoolYear, grade: s.grade, classNo: s.classNo, studentId: s.id, paps })
  }
  return { years, ambiguous: links.filter((l) => !l.student).map((l) => l.schoolYear) }
}

/**
 * 학교 전체 PAPS (2026-11-09): 이 학년도 재학생 모두, 반마다 가장 최근 회차. 학교 PAPS 결과 보고 · 건강체력교실 대상 화면이 쓴다.
 */
export async function loadSchoolPaps(
  db: PeDatabase,
  schoolYear: number,
  ctx: { standards: PapsStandards; schoolLevel: string; flexMode: FlexMode },
): Promise<SchoolPapsRow[]> {
  const students = (await db.students.where('schoolYear').equals(schoolYear).toArray()).filter((s) => s.status === '재학')
  const byClass = new Map<string, Student[]>()
  for (const s of students) byClass.set(`${s.grade}-${s.classNo}`, [...(byClass.get(`${s.grade}-${s.classNo}`) ?? []), s])
  const out: SchoolPapsRow[] = []
  for (const list of byClass.values()) {
    const d = await loadClassPapsPicked(db, schoolYear, list[0].grade, list[0].classNo, list.map((s) => s.id), 'latest')
    const { values, excluded } = indexResults(d.results)
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    for (const s of list)
      out.push({
        studentId: s.id,
        grade: s.grade,
        classNo: s.classNo,
        number: s.number,
        name: s.name,
        gender: s.gender ?? null,
        paps: studentSummary(ctx.standards, s, ctx.schoolLevel, selected, values.get(s.id), ctx.flexMode),
        excluded: excluded.has(s.id),
      })
  }
  return out
}
