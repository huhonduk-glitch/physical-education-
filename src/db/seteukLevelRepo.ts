import type { PeDatabase } from './db'
import { loadReports } from './reportRepo'
import type { Assessment, AssessmentScore, ClassGroup, ClassRecord, Keyword, Student } from './types'
import { appliesTo, itemsOf, totalOf } from '../lib/assessScore'
import type { FlexMode, PapsStandards } from '../lib/paps'
import { studentEvidence, type EvidenceItem } from '../lib/seteuk'
import { draftParts, type DraftPart } from '../lib/seteukDraft'
import type { LevelSignals } from '../lib/seteukLevel'

/** 세특 쓰기에 필요한 학생 한 명 몫: 수준 근거(신호) · 틀 초안 문장 · 근거 목록 (6-7) */
export interface StudentBasis {
  student: Student
  signals: LevelSignals
  parts: DraftPart[]
  evidence: EvidenceItem[]
}

export interface BasisCtx {
  schoolYear: number
  standards: PapsStandards
  schoolLevel: string
  flexMode: FlexMode
}

/** 이 수업반 수업 기록인지 (수업반 표시가 없는 예전 기록도 넣는다 — 세특 쓰기와 같은 기준) */
const inGroup = (r: ClassRecord, g: ClassGroup, year: number) => r.schoolYear === year && (!r.groupId || r.groupId === g.id)

export async function loadGroupBasis(db: PeDatabase, group: ClassGroup, members: readonly Student[], ctx: BasisCtx): Promise<StudentBasis[]> {
  if (!members.length) return []
  const ids = members.map((s) => s.id)
  const [records, keywords, assessments, scores, captains, groups, reports] = await Promise.all([
    db.records.where('studentId').anyOf(ids).toArray(),
    db.keywords.toArray(),
    db.assessments.where('schoolYear').equals(ctx.schoolYear).toArray(),
    db.assessmentScores.where('studentId').anyOf(ids).toArray(),
    db.captains.where('studentId').anyOf(ids).toArray(),
    db.groups.where('schoolYear').equals(ctx.schoolYear).toArray(),
    loadReports(db, members, ctx),
  ])
  const papsGrade = new Map(reports.map((r) => [r.student.id, !r.papsExcluded && typeof r.paps?.grade === 'number' ? r.paps.grade : null]))
  return members.map((s) => basisOf(s, { group, year: ctx.schoolYear, records, keywords, assessments, scores, captains: captains.filter((c) => c.schoolYear === ctx.schoolYear && c.studentId === s.id).map((c) => c.role), groups, paps: papsGrade.get(s.id) ?? null }))
}

/** 순수 계산 (시험하기 쉽게 따로) */
export function basisOf(
  s: Student,
  d: { group: ClassGroup; year: number; records: readonly ClassRecord[]; keywords: readonly Keyword[]; assessments: readonly Assessment[]; scores: readonly AssessmentScore[]; captains: readonly string[]; groups: readonly ClassGroup[]; paps: number | null },
): StudentBasis {
  const recs = d.records.filter((r) => r.studentId === s.id && inGroup(r, d.group, d.year))
  const mine = d.assessments.filter((a) => appliesTo(a, s, d.groups) && (!a.groupIds?.length || a.groupIds.includes(d.group.id)))
  const myScores = d.scores.filter((x) => x.studentId === s.id)
  let got = 0
  let max = 0
  for (const a of mine) {
    const t = totalOf(itemsOf(a), myScores.find((x) => x.assessmentId === a.id)?.scores, s.gender)
    if (t.done === 0 || t.max <= 0) continue
    got += t.total
    max += t.max
  }
  const parts = draftParts({ records: recs, keywords: d.keywords, captainRoles: d.captains, assessments: mine.map((a) => ({ a, items: itemsOf(a), scores: myScores.find((x) => x.assessmentId === a.id)?.scores })) })
  const notes = myScores.filter((x) => x.note).map((x) => ({ id: x.assessmentId, title: mine.find((a) => a.id === x.assessmentId)?.title ?? '수행평가', note: x.note! }))
  const evidence = studentEvidence(recs, d.keywords, notes, { includeNegative: false })
  const signals: LevelSignals = {
    studentId: s.id,
    assess: max > 0 ? got / max : null,
    praise: recs.filter((r) => r.type === 'exemplary').length,
    notes: recs.filter((r) => r.type !== 'unprepared' && !!r.note?.trim()).length,
    keywords: new Set(recs.filter((r) => r.type !== 'unprepared').flatMap((r) => r.keywordIds)).size,
    captain: d.captains.length > 0,
    paps: d.paps,
    guide: recs.filter((r) => r.type === 'unprepared').length,
    evidence: evidence.length + parts.filter((p) => p.kind === 'assess').length,
  }
  return { student: s, signals, parts, evidence }
}
