import type { TimetableEntry } from '../db/settings'

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

/** 시간표에서 지금 수업하는 반을 찾는다. 주말·쉬는 시간·빈 교시는 null. */
export function classForNow(
  now: Date,
  timetable: readonly TimetableEntry[],
  periodStarts: readonly string[],
  periodMinutes: number,
): { grade: number; classNo: number; period: number } | null {
  const day = now.getDay() // 0=일 … 6=토
  if (day === 0 || day === 6) return null
  const period = currentPeriod(now, periodStarts, periodMinutes)
  if (period === null) return null
  const e = timetable.find((t) => t.day === day && t.period === period)
  return e ? { grade: e.grade, classNo: e.classNo, period } : null
}

/** 시간표 칸 하나를 바꾼 새 목록 (반이 null이면 그 칸을 비운다) */
export function setTimetableCell(
  timetable: readonly TimetableEntry[],
  day: number,
  period: number,
  cls: { grade: number; classNo: number } | null,
): TimetableEntry[] {
  const rest = timetable.filter((t) => !(t.day === day && t.period === period))
  return cls ? [...rest, { day, period, ...cls }] : rest
}
