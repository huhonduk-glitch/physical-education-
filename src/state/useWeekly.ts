import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { addDays, todayStr } from '../lib/dates'
import { praiseSince, weeklySummary } from '../lib/weekly'
import { useApp } from './AppContext'
import { useGroups } from './useGroups'

/** 이번 주 · 지난주 기록을 읽어 주간 요약을 낸다 (홈 카드 · 요약 화면이 같이 씀) */
export function useWeekly() {
  const { settings } = useApp()
  const { groups, students, membersOf } = useGroups()
  const today = todayStr()
  const praiseFrom = praiseSince(today)
  const lastMonday = addDays(today, -13)
  const from = praiseFrom < lastMonday ? praiseFrom : lastMonday
  const data = useLiveQuery(async () => {
    const [records, absences, attendance] = await Promise.all([
      db.records.where('date').between(from, today, true, true).toArray(),
      db.absences.where('date').between(from, today, true, true).toArray(),
      db.attendance.where('schoolYear').equals(settings.schoolYear).toArray(),
    ])
    return { records, absences, attendance }
  }, [from, today, settings.schoolYear])
  const summary = useMemo(() => {
    if (!data || !groups) return null
    return weeklySummary({
      today,
      praiseFrom,
      groups: groups.map((g) => ({ id: g.id, name: g.name, memberIds: membersOf(g).map((s) => s.id) })),
      ...data,
    })
  }, [data, groups, membersOf, today, praiseFrom])
  return { summary, groups, students, membersOf, today }
}

