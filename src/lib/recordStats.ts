import type { Absence, ClassRecord, Keyword } from '../db/types'
import { monthOf } from './dates'

/** 월별 개수 (오래된 달부터) */
export function countByMonth<T extends { date: string }>(items: readonly T[]): { month: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of items) m.set(monthOf(r.date), (m.get(monthOf(r.date)) ?? 0) + 1)
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }))
}

/** 항목(카테고리)별 개수 (많은 것부터) */
export function countByCategory(records: readonly ClassRecord[]): { category: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of records) m.set(r.category, (m.get(r.category) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([category, count]) => ({ category, count }))
}

export interface KeywordEvidence {
  keyword: Keyword
  count: number
  /** 근거 기록 (최근 날짜부터) */
  records: ClassRecord[]
}

/**
 * 학생 한 명의 키워드별 빈도와 근거 기록 (CLAUDE.md 4-7).
 * 준비물 미준비 같은 부정 기록은 키워드 집계에서 뺀다.
 */
export function keywordSummary(records: readonly ClassRecord[], keywords: readonly Keyword[]): KeywordEvidence[] {
  const byId = new Map(keywords.map((k) => [k.id, k]))
  const m = new Map<string, ClassRecord[]>()
  for (const r of records) {
    if (r.type === 'unprepared') continue
    for (const id of r.keywordIds) {
      if (!byId.has(id)) continue
      const list = m.get(id) ?? []
      list.push(r)
      m.set(id, list)
    }
  }
  return [...m.entries()]
    .map(([id, rs]) => ({
      keyword: byId.get(id)!,
      count: rs.length,
      records: [...rs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.sortOrder - b.keyword.sortOrder)
}

/** 오늘 기록 요약: 학생 id → 종류별 개수, 견학 여부 */
export interface DaySummary {
  unprepared: number
  exemplary: number
  observation: number
  captain: number
  absent: boolean
}

export function summarizeDay(records: readonly ClassRecord[], absences: readonly Absence[]): Map<string, DaySummary> {
  const m = new Map<string, DaySummary>()
  const get = (id: string) => {
    let s = m.get(id)
    if (!s) {
      s = { unprepared: 0, exemplary: 0, observation: 0, captain: 0, absent: false }
      m.set(id, s)
    }
    return s
  }
  for (const r of records) get(r.studentId)[r.type]++
  for (const a of absences) get(a.studentId).absent = true
  return m
}
