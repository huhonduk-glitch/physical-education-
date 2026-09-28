/**
 * 세특 키워드 내보내기 (CLAUDE.md 4-7). 순수 함수.
 * 학생 1명당 1행: 학번 / 이름 / 키워드(빈도순) / 근거 기록 요약(날짜+메모).
 * 문장을 만들지 않는다 — 키워드와 근거만 나열한다. 준비물 미준비 같은 부정 기록은 기본으로 뺀다.
 */
import type { ClassRecord, Keyword, Student } from '../db/types'
import { shortDateLabel } from './dates'
import { keywordSummary } from './recordStats'

const TYPE_SHORT: Record<ClassRecord['type'], string> = {
  unprepared: '미준비',
  exemplary: '솔선수범',
  observation: '관찰',
  captain: '체육부장',
}

export function evidenceLine(r: ClassRecord, keywords: Map<string, Keyword>): string {
  const kw = r.keywordIds.map((id) => keywords.get(id)?.label).filter(Boolean)
  const what = r.type === 'observation' ? (r.category === '관찰' ? '관찰' : r.category) : `${TYPE_SHORT[r.type]}(${r.category})`
  return `${shortDateLabel(r.date)} ${what}${r.note ? ` — ${r.note}` : ''}${kw.length ? ` [${kw.join(', ')}]` : ''}`
}

export interface SeteukRow {
  studentCode: string
  name: string
  keywords: string
  evidence: string
}

export function seteukRows(
  students: readonly Student[],
  records: readonly ClassRecord[],
  keywords: readonly Keyword[],
  opts: { includeNegative: boolean },
): SeteukRow[] {
  const kwMap = new Map(keywords.map((k) => [k.id, k]))
  const byStudent = new Map<string, ClassRecord[]>()
  for (const r of records) (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r)
  return [...students]
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo || a.number - b.number)
    .map((s) => {
      const rs = byStudent.get(s.id) ?? []
      const summary = keywordSummary(rs, keywords)
      const evidenceRecords = rs
        .filter((r) => (r.type === 'unprepared' ? opts.includeNegative : r.keywordIds.length > 0 || !!r.note))
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      return {
        studentCode: s.studentCode,
        name: s.name,
        keywords: summary.map((k) => `${k.keyword.label}(${k.count})`).join(', '),
        evidence: evidenceRecords.map((r) => evidenceLine(r, kwMap)).join('\n'),
      }
    })
}

/** 수행평가 점수 합계 (점수형 요소만). 비어 있으면 null */
export function scoreTotal(items: readonly { id: string; scale: 'AE' | 'score' }[], scores: Record<string, string | number>): number | null {
  const nums = items.filter((i) => i.scale === 'score').map((i) => scores[i.id]).filter((v) => v !== undefined && v !== '' && Number.isFinite(Number(v)))
  return nums.length ? nums.reduce((a: number, v) => a + Number(v), 0) : null
}
