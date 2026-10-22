import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { indexResults, loadClassPaps, studentSummary } from '../db/papsRepo'
import type { Student } from '../db/types'
import type { ClassKey } from '../components/ClassPicker'
import type { NeisColumn } from '../lib/neisHeaderParser'
import type { Values } from '../lib/neisExport'
import { cellsOf, columnsFor, selectedFromColumns, type CellSpec } from '../lib/papsLayout'
import type { EventId, Factor, StudentPaps } from '../lib/paps'
import type { RoundInfo } from '../lib/papsRounds'
import { useApp } from './AppContext'
import { usePapsRound, type PapsRoundState } from './usePapsRound'

export interface PapsClassView {
  loading: boolean
  students: Student[]
  /** 반별 선택 종목 (저장된 설정 → 없으면 양식에서 자동) */
  selected: Partial<Record<Factor, EventId>>
  /** 나이스 양식(등록했으면 그 양식, 아니면 표준 헤더) */
  columns: NeisColumn[]
  cells: CellSpec[]
  usingTemplate: boolean
  values: Values
  excluded: Map<string, string>
  summaries: Map<string, StudentPaps | null>
  /** 지금 보고·기록하는 회차 (B-5). 저장할 때 setCell/setCells에 roundId를 넘긴다 */
  round: RoundInfo
  roundId: string | null
  rounds: PapsRoundState
}

/** 한 반의 PAPS 자료 한 번에 (학생·설정·양식·기록·등급) — 지금 고른 회차의 기록만 */
export function usePapsClass(cls: ClassKey | null): PapsClassView {
  const { settings, standards } = useApp()
  const year = settings.schoolYear
  const rounds = usePapsRound(cls)
  const roundId = rounds.current.id
  const data = useLiveQuery(async () => {
    if (!cls) return null
    const students = (await db.students.where('[schoolYear+grade+classNo]').equals([year, cls.grade, cls.classNo]).toArray())
      .filter((s) => s.status === '재학')
      .sort((a, b) => a.number - b.number)
    const paps = await loadClassPaps(db, year, cls.grade, cls.classNo, students.map((s) => s.id), roundId)
    return { students, ...paps }
  }, [year, cls?.grade, cls?.classNo, roundId])

  const template = settings.neisTemplates[String(year)] ?? null

  return useMemo(() => {
    const students = data?.students ?? []
    const templateCols = template ? columnsFor(template, {}) : null
    const saved = (data?.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    const selected = Object.keys(saved).length ? saved : templateCols ? selectedFromColumns(templateCols, standards.events) : {}
    const columns = templateCols ?? columnsFor(null, selected)
    const { values, excluded } = indexResults(data?.results ?? [])
    const summaries = new Map(students.map((s) => [s.id, studentSummary(standards, s, settings.schoolLevel, selected, values.get(s.id), settings.papsFlexMode)]))
    return {
      loading: data === undefined,
      students,
      selected,
      columns,
      cells: cellsOf(columns),
      usingTemplate: !!template,
      values,
      excluded,
      summaries,
      round: rounds.current,
      roundId,
      rounds,
    }
  }, [data, template, standards, settings.schoolLevel, settings.papsFlexMode, rounds, roundId])
}
