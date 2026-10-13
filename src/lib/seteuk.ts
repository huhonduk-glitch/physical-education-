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

export interface EvidenceItem {
  date: string
  kind: 'record' | 'assess'
  text: string
  keywordIds: string[]
}

/**
 * 세특 모아보기 (재설계 5단계): 학생 한 명의 근거 기록을 날짜순으로. 문장을 만들지 않고 있는 그대로 나열한다.
 * 수업 기록(솔선수범·관찰·부장 활동 중 메모나 키워드가 있는 것) + 수행평가에 적은 메모.
 */
export function studentEvidence(
  records: readonly ClassRecord[],
  keywords: readonly Keyword[],
  assessNotes: readonly { title: string; note: string }[],
  opts: { includeNegative: boolean },
): EvidenceItem[] {
  const kwMap = new Map(keywords.map((k) => [k.id, k]))
  const items: EvidenceItem[] = records
    .filter((r) => (r.type === 'unprepared' ? opts.includeNegative : r.keywordIds.length > 0 || !!r.note || r.type === 'captain'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((r) => ({ date: r.date, kind: 'record', text: evidenceLine(r, kwMap), keywordIds: r.keywordIds }))
  for (const n of assessNotes) if (n.note.trim()) items.push({ date: '', kind: 'assess', text: `수행평가 「${n.title}」 — ${n.note.trim()}`, keywordIds: [] })
  return items
}

/** 복사용 글자: 키워드 줄 + 근거 목록 (문장으로 바꾸지 않는다) */
export function evidenceText(name: string, kw: { label: string; count: number }[], items: readonly EvidenceItem[]): string {
  return [`[${name}]`, kw.length ? `키워드: ${kw.map((k) => `${k.label}(${k.count})`).join(', ')}` : '키워드: 없음', ...items.map((i) => `- ${i.text}`)].join('\n')
}
