import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { classEvents, type ClassEvent } from '../lib/classEvents'
import { useApp } from './AppContext'
import { useGroups } from './useGroups'

/** 달력에 넣을 수업 일정 (진도표 평가 차시 · PAPS 측정일). 이 학년도 자료만 읽는다 */
export function useClassEvents(): ClassEvent[] {
  const { settings } = useApp()
  const { groups } = useGroups()
  const data = useLiveQuery(async () => {
    const [plans, rounds] = await Promise.all([
      db.progressPlans.where('schoolYear').equals(settings.schoolYear).toArray(),
      db.papsRounds.where('schoolYear').equals(settings.schoolYear).toArray(),
    ])
    return { plans, rounds }
  }, [settings.schoolYear])
  return useMemo(() => (data && groups ? classEvents({ plans: data.plans, groups, timetable: settings.timetable, rounds: data.rounds }) : []), [data, groups, settings.timetable])
}
