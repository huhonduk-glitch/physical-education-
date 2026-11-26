import type { ChangeKind, TimetableChange, TimetableEntry } from '../db/settings'
import { toDateStr } from './dates'

/**
 * 지금 시각에 해당하는 교시를 찾는다. 수업 시작 10분 전부터 그 교시로 본다
 * (체육관으로 이동하며 앱을 여는 경우). 해당 없으면 null.
 */
export function currentPeriod(now: Date, periodStarts: readonly string[], periodMinutes: number, earlyMinutes = 10): number | null {
  const mins = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < periodStarts.length; i++) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(periodStarts[i] ?? '')
    if (!m) continue
    const start = Number(m[1]) * 60 + Number(m[2])
    if (mins >= start - earlyMinutes && mins < start + periodMinutes) return i + 1
  }
  return null
}

/** 시간표에서 지금 수업하는 반을 찾는다. 쉬는 시간·빈 교시는 null. 그날 바뀐 수업(changes)을 따른다 */
export function classForNow(
  now: Date,
  timetable: readonly TimetableEntry[],
  periodStarts: readonly string[],
  periodMinutes: number,
  changes: readonly TimetableChange[] = [],
): { groupId: string; period: number } | null {
  const period = currentPeriod(now, periodStarts, periodMinutes)
  if (period === null) return null
  const e = todaysLessons(now, timetable, changes).find((t) => t.period === period)
  return e ? { groupId: e.groupId, period } : null
}

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * 그 날짜의 내 수업 (교시순) — 이번 주만 바꾸기(2026-11-26): 요일 시간표에서 그날 바뀐 교시를 갈아 끼운다.
 * 바뀐 교시의 수업반이 null이면(결강 · 행사) 그 교시는 빠진다. 요일 시간표에 없는 날(토요일 보강 등)도 바뀐 수업은 들어간다.
 */
export function lessonsOnDate(date: string, timetable: readonly TimetableEntry[], changes: readonly TimetableChange[] = []): TimetableEntry[] {
  const day = weekdayOf(date)
  const ch = changes.filter((c) => c.date === date)
  const changed = new Set(ch.map((c) => c.period))
  const base = timetable.filter((t) => t.day === day && !changed.has(t.period))
  const add = ch.filter((c) => c.groupId).map((c) => ({ day, period: c.period, groupId: c.groupId! }))
  return [...base, ...add].sort((a, b) => a.period - b.period)
}

/** 바꾼 수업의 종류 추천: 내 수업이 없어지면 결강, 빈 교시에 생기면 보강, 다른 반으로 바뀌면 교환 */
export function changeKindFor(before: string | null, after: string | null): ChangeKind {
  if (!after) return '결강'
  if (!before) return '보강'
  return '교환'
}

/** 바뀐 수업 저장: 같은 날짜 · 교시는 하나만(새 것으로). 날짜순 */
export function upsertChange(list: readonly TimetableChange[], c: TimetableChange): TimetableChange[] {
  return [...list.filter((x) => x.id !== c.id && !(x.date === c.date && x.period === c.period)), c].sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)
}

/** 시간표 칸 하나를 바꾼 새 목록 (수업반이 null이면 그 칸을 비운다) */
export function setTimetableCell(timetable: readonly TimetableEntry[], day: number, period: number, groupId: string | null): TimetableEntry[] {
  const rest = timetable.filter((t) => !(t.day === day && t.period === period))
  return groupId ? [...rest, { day, period, groupId }] : rest
}

/** 오늘 시간표: 교시순 (그날 바뀐 수업을 따른다) */
export function todaysLessons(now: Date, timetable: readonly TimetableEntry[], changes: readonly TimetableChange[] = []): TimetableEntry[] {
  return lessonsOnDate(toDateStr(now), timetable, changes)
}

/**
 * 지금 수업이 끝날 때까지 / 다음 수업이 시작할 때까지 남은 초 (2026-11-11 타이머 '수업 시간에 맞추기').
 * 내 시간표 칸이 있는 교시만 본다. 지금 = 그 교시 시작 ≤ 지금 < 시작 + 수업 시간(분) (이동 10분은 넣지 않음).
 * 주말 · 오늘 남은 수업이 없으면 null.
 */
export function lessonClock(
  now: Date,
  timetable: readonly TimetableEntry[],
  periodStarts: readonly string[],
  periodMinutes: number,
  changes: readonly TimetableChange[] = [],
): { kind: 'now' | 'next'; period: number; groupId: string; seconds: number } | null {
  const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  let next: { kind: 'next'; period: number; groupId: string; seconds: number } | null = null
  for (const l of todaysLessons(now, timetable, changes)) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(periodStarts[l.period - 1] ?? '')
    if (!m) continue
    const start = (Number(m[1]) * 60 + Number(m[2])) * 60
    const end = start + periodMinutes * 60
    if (sec >= start && sec < end) return { kind: 'now', period: l.period, groupId: l.groupId, seconds: end - sec }
    if (start > sec && (!next || start - sec < next.seconds)) next = { kind: 'next', period: l.period, groupId: l.groupId, seconds: start - sec }
  }
  return next
}
