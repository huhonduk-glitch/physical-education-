import type { ProgressPlan } from '../db/types'
import type { TimetableEntry } from '../db/settings'
import type { NeisEvent } from './neisOpenApi'
import { meetings, offDaysFromSchedule } from './progressPlan'

/**
 * 고교학점제 출석률 2/3의 '수업 횟수' (2026-11-06, CLAUDE.md 6-13 남은 것). 순수 함수.
 * 고르는 순서: ① 이 반 교과 진도표의 목표 차시 → ② 시간표로 센 이 학기 교시 수(나이스 학사일정의 휴업일 · 방학 빼고)
 *              → ③ 기록 · 출결이 있는 날 수(어림값)
 * 어느 것으로 셌는지(source)를 화면에 같이 보여 준다.
 * (2026-11-14 다듬기) 학기 기간은 나이스 학사일정의 방학 · 방학식에서 찾고(없으면 어림), 진도표가 있으면
 * 진도표 기간 · 쉬는 날 · 빠진 수업으로 시간표를 센 수도 함께 보여 준다(목표 차시와 다를 때 확인용).
 */

export type CreditSource = 'plan' | 'timetable' | 'records'

export const CREDIT_SOURCE_LABEL: Record<CreditSource, string> = {
  plan: '진도표 목표 차시',
  timetable: '시간표로 센 이 학기 수업',
  records: '기록한 날 수(어림값)',
}

/** 학기 기간 어림 (진도표가 없을 때): 1학기 3/2~7/31, 2학기 8/16~12/31, 1년 3/2~12/31 */
export function defaultTerm(schoolYear: number, semester: 0 | 1 | 2): { start: string; end: string } {
  if (semester === 1) return { start: `${schoolYear}-03-02`, end: `${schoolYear}-07-31` }
  if (semester === 2) return { start: `${schoolYear}-08-16`, end: `${schoolYear}-12-31` }
  return { start: `${schoolYear}-03-02`, end: `${schoolYear}-12-31` }
}

const dayAdd = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * 학기 기간: 나이스 학사일정에서 찾는다(학사일정에 방학 날이 하루씩 다 있지 않아도 맞게).
 *  - 1학기 끝 = 방학식 날, 없으면 7~8월 첫 '여름방학' 전날
 *  - 2학기 시작 = 8월 개학(식) 날, 없으면 마지막 '여름방학' 다음 날
 *  - 2학기 · 1년 끝 = 12월~이듬해 2월의 방학식 · 종업식 날, 없으면 첫 '겨울방학' 전날
 * 찾지 못한 쪽은 어림값(defaultTerm) 그대로.
 */
export function termFromSchedule(schoolYear: number, semester: 0 | 1 | 2, events: readonly NeisEvent[], grade?: number): { start: string; end: string } {
  const t = defaultTerm(schoolYear, semester)
  const mine = events.filter((e) => !(grade && e.grades.length && !e.grades.includes(grade))).map((e) => ({ date: e.date, name: e.name.replace(/\s+/g, '') }))
  const inRange = (from: string, to: string, re: RegExp) => mine.filter((e) => e.date >= from && e.date <= to && re.test(e.name)).map((e) => e.date).sort()
  const y = schoolYear
  const summer = inRange(`${y}-07-01`, `${y}-08-31`, /여름방학/).filter((d) => !inRange(d, d, /방학식/).length)
  const summerEnd = inRange(`${y}-07-01`, `${y}-08-10`, /방학식/)[0] ?? (summer[0] ? dayAdd(summer[0], -1) : null)
  const summerBack = inRange(`${y}-08-01`, `${y}-09-10`, /개학/)[0] ?? (summer.length ? dayAdd(summer[summer.length - 1], 1) : null)
  const winter = inRange(`${y}-12-01`, `${y + 1}-02-28`, /방학식|종업식/)[0] ?? (inRange(`${y}-12-01`, `${y + 1}-02-28`, /겨울방학/)[0] ? dayAdd(inRange(`${y}-12-01`, `${y + 1}-02-28`, /겨울방학/)[0], -1) : null)
  if (semester === 1) return { start: t.start, end: summerEnd ?? t.end }
  if (semester === 2) return { start: summerBack ?? t.start, end: winter ?? t.end }
  return { start: t.start, end: winter ?? t.end }
}

/** 진도표로 센 이 반 수업: 진도표 기간 · 쉬는 날을 따르고, 이 반의 빠진 수업(밀기)은 뺀다 */
export function planSessions(groupId: string, timetable: readonly TimetableEntry[], plan: Pick<ProgressPlan, 'startDate' | 'endDate' | 'offDays' | 'skips'>): number {
  return meetings(groupId, timetable, plan, plan.skips?.[groupId] ?? []).length
}

/** 시간표에 있는 이 반 교시를 학기 동안 센다 (휴업일 · 방학 · 공휴일 빼고) */
export function termSessions(groupId: string, timetable: readonly TimetableEntry[], term: { start: string; end: string }, events: readonly NeisEvent[], grade?: number): number {
  const offDays = offDaysFromSchedule(events, term.start, term.end, grade)
  return meetings(groupId, timetable, { startDate: term.start, endDate: term.end, offDays }).length
}

export function heldClasses(o: { planTarget: number; sessions: number; recordedDays: number; planSessions?: number }): { held: number; source: CreditSource; counted?: number } {
  if (o.planTarget > 0) {
    // 진도표 목표 차시가 기준(교사 결정). 시간표로 센 수가 다르면 확인용으로 같이 준다
    const counted = o.planSessions && o.planSessions !== o.planTarget ? o.planSessions : undefined
    return counted ? { held: o.planTarget, source: 'plan', counted } : { held: o.planTarget, source: 'plan' }
  }
  if (o.sessions > 0) return { held: o.sessions, source: 'timetable' }
  return { held: o.recordedDays, source: 'records' }
}

/** 화면에 붙일 설명: '진도표 목표 차시 · 시간표로 세면 30번' */
export function heldNote(h: { source: CreditSource; counted?: number }): string {
  return h.counted ? `${CREDIT_SOURCE_LABEL[h.source]} · 시간표로 세면 ${h.counted}번` : CREDIT_SOURCE_LABEL[h.source]
}
