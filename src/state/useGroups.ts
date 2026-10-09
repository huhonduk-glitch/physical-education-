import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import type { ClassGroup, Student } from '../db/types'
import { groupMembers, sortGroups } from '../lib/groups'
import { useApp } from './AppContext'

/** 이 학년도의 수업반과 학생. 보관한(숨긴) 수업반은 includeArchived일 때만 */
export function useGroups(includeArchived = false): { groups: ClassGroup[] | undefined; students: Student[] | undefined; membersOf: (g: ClassGroup) => Student[] } {
  const { settings } = useApp()
  const year = settings.schoolYear
  const groups = useLiveQuery(() => db.groups.where('schoolYear').equals(year).toArray(), [year])
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(year).toArray(), [year])
  return useMemo(() => {
    const list = groups ? sortGroups(groups.filter((g) => includeArchived || !g.archived)) : undefined
    return { groups: list, students, membersOf: (g: ClassGroup) => groupMembers(g, students ?? []) }
  }, [groups, students, includeArchived])
}
