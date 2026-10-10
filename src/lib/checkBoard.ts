import type { RecordButtons } from '../db/settings'
import type { Absence, ClassRecord } from '../db/types'

/**
 * 누가기록 체크 (재설계 2단계). 순수 함수.
 * 체크 항목 = 설정의 기록 버튼 중 '지도(준비물 미준비)'와 '칭찬(솔선수범)' 항목. '기타'는 메모가 필요해서 체크표에서 뺀다.
 * 체크 한 번 = records 한 줄 (type + category). 따로 저장 구조를 만들지 않아 카드 기록과 같은 자료를 본다.
 */

export type CheckType = 'unprepared' | 'exemplary'
export interface CheckItem {
  key: string
  type: CheckType
  label: string
}

export const ETC = '기타'
export const checkKey = (type: string, category: string) => `${type}|${category}`

/** 체크 항목 목록: 지도 먼저, 다음 칭찬 */
export function checkItems(buttons: RecordButtons): CheckItem[] {
  const make = (type: CheckType) => buttons[type].filter((l) => l !== ETC).map((label) => ({ key: checkKey(type, label), type, label }))
  return [...make('unprepared'), ...make('exemplary')]
}

/** 학생 id → (항목 key → 개수) */
export function cellCounts(records: readonly ClassRecord[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>()
  for (const r of records) {
    let row = m.get(r.studentId)
    if (!row) m.set(r.studentId, (row = new Map()))
    const k = checkKey(r.type, r.category)
    row.set(k, (row.get(k) ?? 0) + 1)
  }
  return m
}

export interface StudentTally {
  /** 칭찬(솔선수범) 기록 수 */
  plus: number
  /** 지도(미준비) 기록 수 */
  minus: number
  /** 관찰 메모 수 */
  notes: number
  /** 견학 일수 */
  absent: number
  /** 항목별 개수 (기타 포함 · 체크표에 없는 예전 항목도 그대로) */
  byKey: Map<string, number>
}

/** 학생별 누적 (기간은 부르는 쪽이 records·absences를 걸러서 넘긴다) */
export function tallyByStudent(records: readonly ClassRecord[], absences: readonly Absence[]): Map<string, StudentTally> {
  const m = new Map<string, StudentTally>()
  const get = (id: string) => {
    let t = m.get(id)
    if (!t) m.set(id, (t = { plus: 0, minus: 0, notes: 0, absent: 0, byKey: new Map() }))
    return t
  }
  for (const r of records) {
    const t = get(r.studentId)
    if (r.type === 'exemplary') t.plus++
    else if (r.type === 'unprepared') t.minus++
    else if (r.type === 'observation') t.notes++
    const k = checkKey(r.type, r.category)
    t.byKey.set(k, (t.byKey.get(k) ?? 0) + 1)
  }
  const days = new Map<string, Set<string>>()
  for (const a of absences) {
    let s = days.get(a.studentId)
    if (!s) days.set(a.studentId, (s = new Set()))
    s.add(a.date)
  }
  for (const [id, s] of days) get(id).absent = s.size
  return m
}

export type Period = 'month' | 'sem1' | 'sem2' | 'year'
export const PERIOD_LABEL: Record<Period, string> = { month: '이번 달', sem1: '1학기', sem2: '2학기', year: '학년도 전체' }

/**
 * 기간의 시작·끝 날짜 (끝 포함). 학년도는 3월 1일 ~ 다음 해 2월 말.
 * 1학기 3/1 ~ 8/31, 2학기 9/1 ~ 다음 해 2월 말 (학교마다 조금 다르지만 기록 모아보기용으로 충분하다)
 */
export function periodRange(p: Period, schoolYear: number, today: string): [string, string] {
  const y = schoolYear
  const lastFeb = new Date(y + 1, 2, 0).getDate()
  if (p === 'month') {
    const m = today.slice(0, 7)
    const [yy, mm] = m.split('-').map(Number)
    return [`${m}-01`, `${m}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`]
  }
  if (p === 'sem1') return [`${y}-03-01`, `${y}-08-31`]
  if (p === 'sem2') return [`${y}-09-01`, `${y + 1}-02-${lastFeb}`]
  return [`${y}-03-01`, `${y + 1}-02-${lastFeb}`]
}

export const inRange = (date: string, [a, b]: [string, string]) => date >= a && date <= b
