import type { Absence, Assessment, AssessmentScore, Captain, ClassGroup, ClassRecord, Keyword, Student } from '../db/types'
import { appliesTo, fmtNum, itemPoints, itemsOf, totalOf } from './assessScore'
import { countByCategory, keywordSummary } from './recordStats'
import type { StudentPaps } from './paps'

/**
 * 학생별 리포트 (재설계 5단계) — 상담·학생 피드백용 한 장 요약. 순수 함수.
 * 견학 사유(건강 정보)는 넣지 않고 횟수만. 지도 기록은 선택(학생·학부모에게 줄 때 뺄 수 있게).
 */
export interface ReportOptions {
  includeGuidance: boolean
  includeAbsence: boolean
}

export interface StudentReport {
  student: Student
  exemplary: number
  unprepared: number
  absent: number
  exemplaryTop: { category: string; count: number }[]
  unpreparedTop: { category: string; count: number }[]
  captain: string[]
  keywords: { label: string; count: number }[]
  paps: StudentPaps | null
  papsExcluded: boolean
  assessments: { title: string; score: string; detail: string; complete: boolean }[]
}

export function buildReport(
  student: Student,
  data: {
    records: readonly ClassRecord[]
    absences: readonly Absence[]
    captains: readonly Captain[]
    keywords: readonly Keyword[]
    assessments: readonly Assessment[]
    scores: readonly AssessmentScore[]
    groups: readonly ClassGroup[]
    paps: StudentPaps | null
    papsExcluded: boolean
  },
): StudentReport {
  const mine = data.records.filter((r) => r.studentId === student.id)
  const ex = mine.filter((r) => r.type === 'exemplary')
  const un = mine.filter((r) => r.type === 'unprepared')
  const absentDays = new Set(data.absences.filter((a) => a.studentId === student.id).map((a) => a.date)).size
  const scoreBy = new Map(data.scores.filter((s) => s.studentId === student.id).map((s) => [s.assessmentId, s]))
  return {
    student,
    exemplary: ex.length,
    unprepared: un.length,
    absent: absentDays,
    exemplaryTop: countByCategory(ex).slice(0, 4),
    unpreparedTop: countByCategory(un).slice(0, 4),
    captain: data.captains.filter((c) => c.studentId === student.id).map((c) => c.role),
    keywords: keywordSummary(mine, data.keywords)
      .slice(0, 6)
      .map((k) => ({ label: k.keyword.label, count: k.count })),
    paps: data.paps,
    papsExcluded: data.papsExcluded,
    assessments: data.assessments
      .filter((a) => appliesTo(a, student, data.groups))
      .map((a) => {
        const items = itemsOf(a)
        const sc = scoreBy.get(a.id)
        const t = totalOf(items, sc?.scores)
        return {
          title: a.title,
          score: t.done ? `${fmtNum(t.total)} / ${t.max}점` : '미채점',
          complete: t.complete,
          detail: items
            .map((it) => {
              const raw = sc?.scores[it.id]
              const p = itemPoints(it, raw)
              return `${it.label} ${p === null ? '—' : it.method === 'level' ? `${raw}` : fmtNum(p)}`
            })
            .join(' · '),
        }
      }),
  }
}
