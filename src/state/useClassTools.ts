import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { indexResults, loadClassPaps, studentSummary } from '../db/papsRepo'
import type { Student } from '../db/types'
import { teamLevel, type EventId, type Factor } from '../lib/paps'
import type { Level } from '../lib/teams'
import { useApp } from './AppContext'

/** 오늘(또는 그날) 견학인 학생 id */
export function useAbsentIds(students: readonly Student[], date: string): Set<string> | undefined {
  const ids = students.map((s) => s.id).join(',')
  return useLiveQuery(async () => {
    const want = new Set(ids.split(','))
    const rows = await db.absences.where('date').equals(date).toArray()
    return new Set(rows.filter((a) => want.has(a.studentId)).map((a) => a.studentId))
  }, [date, ids])
}

/**
 * 학생별 실력 수준(상·중·하) = PAPS 종합등급 (없으면 평균 등급). 미측정이면 null.
 * 여러 학적반이 섞인 수강반도 반마다 측정 설정을 따로 읽는다. enabled=false면 읽지 않는다(평가 정보라 기본은 끔).
 */
export function useTeamLevels(students: readonly Student[], enabled: boolean): Map<string, Level | null> | undefined {
  const { settings, standards } = useApp()
  const year = settings.schoolYear
  const ids = students.map((s) => s.id).join(',')
  const data = useLiveQuery(async () => {
    if (!enabled) return null
    const byClass = new Map<string, Student[]>()
    for (const s of students) {
      const k = `${s.grade}-${s.classNo}`
      byClass.set(k, [...(byClass.get(k) ?? []), s])
    }
    return Promise.all(
      [...byClass.values()].map(async (list) => ({ list, paps: await loadClassPaps(db, year, list[0].grade, list[0].classNo, list.map((s) => s.id)) })),
    )
  }, [enabled, year, ids])
  return useMemo(() => {
    if (!enabled) return new Map()
    if (!data) return undefined
    const out = new Map<string, Level | null>()
    for (const { list, paps } of data) {
      const { values } = indexResults(paps.results)
      const selected = (paps.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
      for (const s of list) {
        const p = studentSummary(standards, s, settings.schoolLevel, selected, values.get(s.id), settings.papsFlexMode)
        out.set(s.id, p ? teamLevel(p) : null)
      }
    }
    return out
  }, [enabled, data, standards, settings.schoolLevel, settings.papsFlexMode])
}
