import type { ChangeKind, TimetableChange, TimetableEntry } from '../db/settings'
import type { ClassGroup } from '../db/types'
import { combinedName } from './groups'
import { myPicks, teacherLessons, type ComciData } from './comcigan'
import { addDays } from './dates'
import { changeKindFor } from './timetable'

/**
 * 컴시간에서 이번 주 변경 가져오기 (2026-11-26 교사 결정 — 자동으로 바꾸지 않고 버튼으로).
 * 받아 둔 컴시간 한 주(settings.comciWeek)의 내 수업과 내 요일 시간표를 교시마다 비교해 '바꾼 수업' 후보를 만든다.
 * 컴시간에서 바뀐 수업('>' 표시)이 걸린 칸은 미리 고르고, 표시 없이 다른 칸(내 요일 시간표가 컴시간 기본과 다른 경우)은 고르지 않은 채 보여 준다.
 */

export interface ChangeCandidate {
  date: string
  period: number
  /** 내 요일 시간표의 수업반 (없으면 null) */
  before: string | null
  /** 컴시간 이번 주 내 수업의 수업반 (없으면 null) */
  after: string | null
  kind: ChangeKind
  /** 컴시간에 바뀐 수업 표시가 있음 → 미리 고름 */
  flagged: boolean
  /** 컴시간 수업이 있는데 맞는 수업반을 못 찾음 (예: '체육 1-1·1-2') */
  unmapped?: string
}

/** '26-11-23 ~ 26-11-28' → '2026-11-23' (그 주 월요일) */
export function comciWeekStart(label: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{2})/.exec(label.trim())
  return m ? `20${m[1]}-${m[2]}-${m[3]}` : null
}

type G = Pick<ClassGroup, 'id' | 'kind' | 'name'> & Partial<Pick<ClassGroup, 'grade' | 'classNo' | 'archived'>>

/** 컴시간 수업 한 칸 → 내 수업반 (반 하나 = 그 학적반, 여럿 = '과목 1-1·1-2' 수강반). 새로 만들지 않는다 */
export function groupForPick(groups: readonly G[], pick: { subject: string; classes: { grade: number; classNo: number }[] }): string | null {
  if (pick.classes.length === 1) {
    const c = pick.classes[0]
    return groups.find((g) => g.kind === 'homeroom' && g.grade === c.grade && g.classNo === c.classNo)?.id ?? null
  }
  const name = combinedName(pick.subject, pick.classes)
  return groups.find((g) => g.kind === 'elective' && g.name === name)?.id ?? null
}

export function comciChanges(o: { data: ComciData; myNo: number; label: string; timetable: readonly TimetableEntry[]; groups: readonly G[] }): ChangeCandidate[] {
  const monday = comciWeekStart(o.label)
  if (!monday) return []
  const picks = myPicks(o.data, o.myNo)
  const flagged = new Set(teacherLessons(o.data, o.myNo).filter((l) => l.changed).map((l) => `${l.day}|${l.period}`))
  const periods = new Set([...picks.map((p) => p.period), ...o.timetable.map((t) => t.period)])
  const out: ChangeCandidate[] = []
  for (let day = 1; day <= 5; day++) {
    const date = addDays(monday, day - 1)
    for (const period of [...periods].sort((a, b) => a - b)) {
      const before = o.timetable.find((t) => t.day === day && t.period === period)?.groupId ?? null
      const pick = picks.find((p) => p.day === day && p.period === period)
      const after = pick ? groupForPick(o.groups, pick) : null
      const unmapped = pick && !after ? (pick.classes.length === 1 ? `${pick.classes[0].grade}-${pick.classes[0].classNo}` : combinedName(pick.subject, pick.classes)) : undefined
      if (before === after && !unmapped) continue
      out.push({ date, period, before, after, kind: changeKindFor(before, after ?? (pick ? 'unmapped' : null)), flagged: flagged.has(`${day}|${period}`) || (!pick && hasFlagElsewhere(flagged)), ...(unmapped ? { unmapped } : {}) })
    }
  }
  return out
}

/** 내 수업이 빠진 칸은 컴시간에 표시가 없다 → 그 주에 바뀐 수업 표시가 하나라도 있으면 빠진 칸도 변경으로 본다 */
const hasFlagElsewhere = (flagged: ReadonlySet<string>) => flagged.size > 0

/** 고른 후보 → 바꾼 수업으로 (같은 날짜 · 교시는 새 것으로). 반을 못 찾은 후보는 넣지 않는다 */
export function applyCandidates(list: readonly TimetableChange[], picked: readonly ChangeCandidate[], newId: () => string): TimetableChange[] {
  const keys = new Set(picked.filter((c) => !c.unmapped).map((c) => `${c.date}|${c.period}`))
  const rest = list.filter((x) => !keys.has(`${x.date}|${x.period}`))
  const add = picked.filter((c) => !c.unmapped).map((c) => ({ id: newId(), date: c.date, period: c.period, groupId: c.after, kind: c.kind, note: '컴시간' }))
  return [...rest, ...add].sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)
}
