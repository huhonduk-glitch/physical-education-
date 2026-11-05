import type { TimetableEntry } from '../db/settings'
import type { NeisEvent } from './neisOpenApi'
import { meetings, offDaysFromSchedule } from './progressPlan'

/**
 * 고교학점제 출석률 2/3의 '수업 횟수' (2026-11-06, CLAUDE.md 6-13 남은 것). 순수 함수.
 * 고르는 순서: ① 이 반 교과 진도표의 목표 차시 → ② 시간표로 센 이 학기 교시 수(나이스 학사일정의 휴업일 · 방학 빼고)
 *              → ③ 기록 · 출결이 있는 날 수(어림값)
 * 어느 것으로 셌는지(source)를 화면에 같이 보여 준다.
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

/** 시간표에 있는 이 반 교시를 학기 동안 센다 (휴업일 · 방학 · 공휴일 빼고) */
export function termSessions(groupId: string, timetable: readonly TimetableEntry[], term: { start: string; end: string }, events: readonly NeisEvent[], grade?: number): number {
  const offDays = offDaysFromSchedule(events, term.start, term.end, grade)
  return meetings(groupId, timetable, { startDate: term.start, endDate: term.end, offDays }).length
}

export function heldClasses(o: { planTarget: number; sessions: number; recordedDays: number }): { held: number; source: CreditSource } {
  if (o.planTarget > 0) return { held: o.planTarget, source: 'plan' }
  if (o.sessions > 0) return { held: o.sessions, source: 'timetable' }
  return { held: o.recordedDays, source: 'records' }
}
