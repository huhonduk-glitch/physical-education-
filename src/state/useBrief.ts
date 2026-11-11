import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import type { Student } from '../db/types'
import { areaTotal } from '../lib/assessScore'
import { BRIEF_LINK_LABELS, briefLines, briefLinks, briefText } from '../lib/brief'
import { todayStr } from '../lib/dates'
import { pendingCount } from '../lib/neisCarry'
import { groupProgress, meetings, schedule } from '../lib/progressPlan'
import { todaysLessons } from '../lib/timetable'
import { dday, upcoming } from '../lib/workCal'
import { useApp } from './AppContext'
import { useGroups } from './useGroups'

/** 땅콩이 오늘 브리핑에 넣을 자료를 기기 안에서 센다. on=false면 읽지 않는다 */
export function useBrief(on: boolean) {
  const { settings } = useApp()
  const { groups, students, membersOf } = useGroups()
  const today = todayStr()
  const data = useLiveQuery(async () => {
    if (!on) return null
    const [attendance, plans, assessments] = await Promise.all([
      db.attendance.where('schoolYear').equals(settings.schoolYear).toArray(),
      db.progressPlans.where('schoolYear').equals(settings.schoolYear).toArray(),
      db.assessments.where('schoolYear').equals(settings.schoolYear).toArray(),
    ])
    const list = assessments.filter((a) => (a.groupIds?.length ?? 0) > 0)
    const scores = await db.assessmentScores
      .where('assessmentId')
      .anyOf(list.map((a) => a.id))
      .toArray()
    return { attendance, plans, list, scores }
  }, [on, settings.schoolYear])

  return useMemo(() => {
    if (!on || !data || !groups) return null
    const now = new Date()
    const nameOf = new Map(groups.map((g) => [g.id, g.name]))
    const lessons = todaysLessons(now, settings.timetable)
      .filter((l) => nameOf.has(l.groupId))
      .map((l) => ({ period: l.period, start: settings.periodStarts[l.period - 1], group: nameOf.get(l.groupId)! }))
    const behind: { group: string; late: number }[] = []
    for (const p of data.plans)
      for (const g of groups) {
        if (!p.groupIds.includes(g.id)) continue
        const pr = groupProgress(schedule(p.items, meetings(g.id, settings.timetable, p, p.skips[g.id])), p.done[g.id] ?? [], today)
        if (pr.diff < 0) behind.push({ group: g.name, late: -pr.diff })
      }
    behind.sort((a, b) => b.late - a.late)
    const grading = data.list
      .map((a) => {
        const members = new Map<string, Student>()
        for (const g of groups) if (a.groupIds!.includes(g.id)) for (const s of membersOf(g)) members.set(s.id, s)
        const byStudent = new Map(data.scores.filter((s) => s.assessmentId === a.id).map((s) => [s.studentId, s]))
        const done = [...members.values()].filter((s) => areaTotal(a, byStudent.get(s.id), s.gender).complete).length
        return { title: a.title, left: members.size - done, done }
      })
      .filter((x) => x.done > 0 && x.left > 0)
    const groupIds = new Set(groups.map((g) => g.id))
    const lines = briefLines({
      lessons,
      nowHHMM: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      pendingNeis: pendingCount(data.attendance.filter((a) => groupIds.has(a.groupId))),
      behind,
      grading,
      events: upcoming(settings.workEvents ?? [], today, 7).map((e) => ({ title: e.title, dday: dday(e.date, today) })),
      backupDays: settings.lastBackupAt ? Math.floor((now.getTime() - settings.lastBackupAt) / 86400000) : null,
      hasStudents: (students?.length ?? 0) > 0,
    })
    return { count: lines.length, text: briefText(lines), links: briefLinks(lines, BRIEF_LINK_LABELS) }
  }, [on, data, groups, students, membersOf, settings.timetable, settings.periodStarts, settings.workEvents, settings.lastBackupAt, today])
}
