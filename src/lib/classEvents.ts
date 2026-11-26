import type { ClassGroup, PapsRound, ProgressPlan } from '../db/types'
import type { TimetableChange, TimetableEntry } from '../db/settings'
import { meetings, schedule } from './progressPlan'

/**
 * 달력에 저절로 들어가는 수업 일정 (2026-11-25, 슈퍼스쿨 캘린더가 수업활동 마감을 저절로 보여 주는 것 참고).
 * 새로 저장하지 않고, 이미 있는 자료에서 그때그때 계산한다:
 *  ① 교과 진도표에서 '평가 연계'를 적은 차시 — 시간표 · 학기 · 쉬는 날로 계산한 날짜 (반마다)
 *  ② PAPS 회차 측정일 — 같은 날 같은 회차는 반을 모아 한 줄
 * 수행평가에는 날짜 칸이 없어서(평가 시기는 글) ①로만 들어온다.
 */
export interface ClassEvent {
  date: string
  label: string
  kind: 'eval' | 'paps'
}

export function classEvents(input: {
  plans: readonly ProgressPlan[]
  groups: readonly Pick<ClassGroup, 'id' | 'name'>[]
  timetable: readonly TimetableEntry[]
  changes?: readonly TimetableChange[]
  rounds: readonly PapsRound[]
}): ClassEvent[] {
  const out: ClassEvent[] = []
  const nameOf = new Map(input.groups.map((g) => [g.id, g.name]))
  for (const p of input.plans) {
    for (const gid of p.groupIds) {
      const name = nameOf.get(gid)
      if (!name) continue
      for (const s of schedule(p.items, meetings(gid, input.timetable, p, p.skips[gid], input.changes))) {
        const note = s.item.evalNote?.trim()
        if (!note || !s.meeting) continue
        out.push({ date: s.meeting.date, label: `${name} ${s.meeting.period}교시 평가: ${note}`, kind: 'eval' })
      }
    }
  }
  const paps = new Map<string, string[]>()
  for (const r of input.rounds) {
    if (!r.date) continue
    const k = `${r.date}|${r.round}`
    paps.set(k, [...(paps.get(k) ?? []), `${r.grade}-${r.classNo}`])
  }
  for (const [k, classes] of paps) {
    const [date, round] = k.split('|')
    out.push({ date, label: `PAPS ${round}회차 측정 (${[...new Set(classes)].sort().join(' · ')})`, kind: 'paps' })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}
