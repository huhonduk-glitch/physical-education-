import type { PeDatabase } from './db'
import { indexResults, loadClassPaps, loadClassPapsPicked, studentSummary } from './papsRepo'
import type { Student } from './types'
import type { EventId, Factor, FlexMode, PapsStandards } from '../lib/paps'
import { buildReport, type StudentReport } from '../lib/report'
import type { StudentPaps } from '../lib/paps'
import { applyOverrides, linkAcrossYears, type YearLink, type YearLinkOverrides } from '../lib/yearLink'
import type { SchoolPapsRow } from '../lib/schoolPaps'
import type { ClinicChange } from '../lib/clinic'
import type { KingStudent } from '../lib/fitKing'
import { FACTORS, representative, type Cell } from '../lib/paps'
import { EXCLUDED_KEY } from './papsRepo'

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
  ov?: YearLinkOverrides,
): Promise<{ years: { schoolYear: number; grade: number; classNo: number; studentId: string; paps: StudentPaps | null }[]; ambiguous: number[]; links: YearLink<Student>[] }> {
  const name = me.name.replace(/\s+/g, '')
  const all = await db.students.toArray()
  const others = all.filter((s) => s.name.replace(/\s+/g, '') === name)
  // 교사가 고친 연결(이름이 달라도) — settings.yearLinks
  const links = applyOverrides(me, linkAcrossYears(me, others), all, ov)
  const people = [me, ...links.map((l) => l.student).filter((s): s is Student => !!s)].sort((a, b) => a.schoolYear - b.schoolYear)
  const years = []
  for (const s of people) {
    const d = await loadClassPapsPicked(db, s.schoolYear, s.grade, s.classNo, [s.id], 'latest')
    const { values, excluded } = indexResults(d.results)
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    const paps = excluded.has(s.id) ? null : studentSummary(ctx.standards, s, ctx.schoolLevel, selected, values.get(s.id), ctx.flexMode)
    years.push({ schoolYear: s.schoolYear, grade: s.grade, classNo: s.classNo, studentId: s.id, paps })
  }
  return { years, ambiguous: links.filter((l) => !l.student && !l.manual).map((l) => l.schoolYear), links }
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
        ...(excluded.get(s.id) ? { excludeReason: excluded.get(s.id) } : {}),
      })
  }
  return out
}

/**
 * 건강체력교실 참여 학생의 변화 (2026-11-09): 1회차(정시) → 학생마다 가장 최근 회차.
 */
export async function loadClinicChanges(
  db: PeDatabase,
  schoolYear: number,
  students: readonly Student[],
  ctx: { standards: PapsStandards; schoolLevel: string; flexMode: FlexMode },
): Promise<ClinicChange[]> {
  const byClass = new Map<string, Student[]>()
  for (const s of students) byClass.set(`${s.grade}-${s.classNo}`, [...(byClass.get(`${s.grade}-${s.classNo}`) ?? []), s])
  const out: ClinicChange[] = []
  for (const list of byClass.values()) {
    const { grade, classNo } = list[0]
    const ids = list.map((s) => s.id)
    const [first, latest] = await Promise.all([loadClassPaps(db, schoolYear, grade, classNo, ids, null), loadClassPapsPicked(db, schoolYear, grade, classNo, ids, 'latest')])
    const f = indexResults(first.results).values
    const l = indexResults(latest.results).values
    const roundNo = new Map(latest.rounds.map((r) => [r.id, r.round]))
    const sel = (cfg: typeof first.config) => (cfg?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    for (const s of list) {
      const rid = latest.pick.get(s.id) ?? null
      out.push({
        studentId: s.id,
        first: studentSummary(ctx.standards, s, ctx.schoolLevel, sel(first.config), f.get(s.id), ctx.flexMode),
        latest: studentSummary(ctx.standards, s, ctx.schoolLevel, sel(latest.config), l.get(s.id), ctx.flexMode),
        latestRound: rid ? (roundNo.get(rid) ?? 1) : 1,
      })
    }
  }
  return out
}

/**
 * 체력왕 선발 (2026-11-13): 한 학년 재학생의 종목별 **가장 좋은 기록** — 모든 회차 · 차수 · 좌우 가운데 대표 기록 규칙대로
 * (높을수록 좋은 종목은 최고값, 낮을수록 좋은 종목은 최저값). BMI는 쓰지 않는다. 종목은 그 반의 측정 종목 설정.
 */
export async function loadKingStudents(db: PeDatabase, schoolYear: number, grade: number, std: PapsStandards): Promise<KingStudent[]> {
  const students = (await db.students.where('schoolYear').equals(schoolYear).toArray()).filter((s) => s.status === '재학' && s.grade === grade)
  const byClass = new Map<number, Student[]>()
  for (const s of students) byClass.set(s.classNo, [...(byClass.get(s.classNo) ?? []), s])
  const out: KingStudent[] = []
  for (const [classNo, list] of [...byClass].sort((a, b) => a[0] - b[0])) {
    const d = await loadClassPaps(db, schoolYear, grade, classNo, list.map((s) => s.id), 'all')
    const selected = (d.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    const events: Partial<Record<Factor, EventId>> = {}
    for (const f of FACTORS) if (f !== '비만' && selected[f]) events[f] = selected[f]
    const used = new Set<string>(Object.values(events))
    const cells = new Map<string, Map<string, Cell[]>>()
    const excluded = new Set<string>()
    for (const r of d.results) {
      if (r.eventId === EXCLUDED_KEY) {
        if (r.excluded) excluded.add(r.studentId)
        continue
      }
      if (r.value === undefined || !used.has(r.eventId)) continue
      let m = cells.get(r.studentId)
      if (!m) cells.set(r.studentId, (m = new Map()))
      m.set(r.eventId, [...(m.get(r.eventId) ?? []), { attempt: r.attempt, side: r.side, value: r.value }])
    }
    for (const s of [...list].sort((a, b) => a.number - b.number)) {
      const best: Partial<Record<EventId, number>> = {}
      for (const [e, cs] of cells.get(s.id) ?? []) {
        const rep = representative(std, e as EventId, cs)
        if (rep) best[e as EventId] = rep.value
      }
      out.push({ studentId: s.id, grade, classNo, number: s.number, name: s.name, gender: s.gender ?? null, excluded: excluded.has(s.id), events, best })
    }
  }
  return out
}
