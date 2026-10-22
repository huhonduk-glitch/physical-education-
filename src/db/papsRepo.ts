import type { MeasureKey } from '../lib/neisHeaderParser'
import type { Values } from '../lib/neisExport'
import { cellId, type CellSpec } from '../lib/papsLayout'
import { bmi, studentPaps, type Cell, type EventId, type Factor, type FlexMode, type PapsStandards, type StudentPaps } from '../lib/paps'
import type { PeDatabase } from './db'
import { newId } from './db'
import { filterRound, groupByStudentRound, nextRoundNo, pickRounds, resultsForPick, roundKeyOf, roundsOf, type RoundInfo, type RoundPick, type RoundScore } from '../lib/papsRounds'
import type { PapsConfig, PapsResult, Student } from './types'

/** 학생 한 명의 측정 제외 여부는 eventId 가 이 값인 행으로 보관한다 */
export const EXCLUDED_KEY = '__excluded__'

export interface ClassPapsData {
  config: PapsConfig | undefined
  results: PapsResult[]
}

/**
 * 한 반의 PAPS 설정·기록.
 * roundId: null = 1회차(회차 없는 예전 기록), 문자열 = 그 회차, 'all' = 모든 회차 (비교·내보내기에서 회차를 고를 때)
 */
export async function loadClassPaps(db: PeDatabase, year: number, grade: number, classNo: number, studentIds: string[], roundId: string | null | 'all' = null): Promise<ClassPapsData> {
  const [config, all] = await Promise.all([
    db.papsConfigs.where('[schoolYear+grade+classNo]').equals([year, grade, classNo]).first(),
    studentIds.length ? db.papsResults.where('studentId').anyOf(studentIds).filter((r) => r.schoolYear === year).toArray() : Promise.resolve([]),
  ])
  return { config, results: roundId === 'all' ? all : filterRound(all, roundId, EXCLUDED_KEY) }
}

/**
 * 학생마다 회차 하나를 골라 그 회차 기록만 (B-5). 리포트·팀 나누기 수준은 'latest', 나이스 내보내기는 교사가 고른다.
 * 'best'는 scoreOf가 필요하다 (studentSummary로 종합점수 계산).
 */
export async function loadClassPapsPicked(
  db: PeDatabase,
  year: number,
  grade: number,
  classNo: number,
  studentIds: string[],
  mode: RoundPick,
  scoreOf: (studentId: string, rows: PapsResult[], config: PapsConfig | undefined) => RoundScore | null = () => null,
): Promise<ClassPapsData & { pick: Map<string, string | null>; rounds: RoundInfo[] }> {
  const [data, rounds] = await Promise.all([loadClassPaps(db, year, grade, classNo, studentIds, 'all'), loadRounds(db, year, grade, classNo)])
  const pick = pickRounds(studentIds, groupByStudentRound(data.results, EXCLUDED_KEY), rounds, mode, (sid, rows) => scoreOf(sid, rows, data.config))
  return { config: data.config, results: resultsForPick(data.results, pick, EXCLUDED_KEY), pick, rounds }
}

/** 반의 측정 회차 목록 (1회차는 늘 있다) */
export async function loadRounds(db: PeDatabase, year: number, grade: number, classNo: number): Promise<RoundInfo[]> {
  return roundsOf(await db.papsRounds.where('[schoolYear+grade+classNo]').equals([year, grade, classNo]).toArray())
}

/** 새 회차 만들기 → 새 회차 id */
export async function addRound(db: PeDatabase, year: number, grade: number, classNo: number, date: string): Promise<string> {
  return db.transaction('rw', db.papsRounds, async () => {
    const rows = await db.papsRounds.where('[schoolYear+grade+classNo]').equals([year, grade, classNo]).toArray()
    const id = newId()
    await db.papsRounds.add({ id, schoolYear: year, grade, classNo, round: nextRoundNo(rows), date, createdAt: Date.now() })
    return id
  })
}

/** 회차 날짜 고치기 (1회차는 날짜 행이 없으면 만든다 — 기록은 건드리지 않는다) */
export async function setRoundDate(db: PeDatabase, year: number, grade: number, classNo: number, r: RoundInfo, date: string): Promise<void> {
  if (r.rowId) await db.papsRounds.update(r.rowId, { date })
  else await db.papsRounds.add({ id: newId(), schoolYear: year, grade, classNo, round: 1, date, createdAt: Date.now() })
}

/** 회차 지우기: 기록이 하나도 없는 2회차 이상만 (잘못 만든 회차 정리용). 지웠으면 true */
export async function deleteRoundIfEmpty(db: PeDatabase, roundId: string): Promise<boolean> {
  return db.transaction('rw', db.papsRounds, db.papsResults, async () => {
    const used = await db.papsResults.filter((r) => r.roundId === roundId).count()
    if (used > 0) return false
    await db.papsRounds.delete(roundId)
    return true
  })
}

/** 결과 행들 → 학생별 칸 값, 제외 명단 */
export function indexResults(results: readonly PapsResult[]): { values: Values; excluded: Map<string, string> } {
  const values: Values = new Map()
  const excluded = new Map<string, string>()
  for (const r of results) {
    if (r.eventId === EXCLUDED_KEY) {
      if (r.excluded) excluded.set(r.studentId, r.excludeReason ?? '')
      continue
    }
    if (r.value === undefined) continue
    let m = values.get(r.studentId)
    if (!m) values.set(r.studentId, (m = new Map()))
    m.set(cellId({ key: r.eventId as MeasureKey, attempt: r.attempt, side: r.side }), r.value)
  }
  return { values, excluded }
}

/**
 * 칸 하나 저장 (값이 undefined면 지움). 칸 단위 원자료로 보관한다.
 * roundId: null = 1회차 (예전처럼 회차 표시 없이 저장), 문자열 = 그 회차
 */
export async function setCell(db: PeDatabase, year: number, studentId: string, c: CellSpec, value: number | undefined, roundId: string | null = null): Promise<void> {
  await db.transaction('rw', db.papsResults, async () => {
    const same = await db.papsResults
      .where('[studentId+eventId]')
      .equals([studentId, c.key])
      .filter((r) => r.schoolYear === year && (r.attempt ?? null) === c.attempt && (r.side ?? null) === c.side && roundKeyOf(r) === roundId)
      .toArray()
    if (value === undefined || !Number.isFinite(value)) {
      await db.papsResults.bulkDelete(same.map((r) => r.id))
      return
    }
    if (same.length) {
      await db.papsResults.update(same[0].id, { value, measuredAt: Date.now() })
      if (same.length > 1) await db.papsResults.bulkDelete(same.slice(1).map((r) => r.id))
    } else {
      await db.papsResults.add({
        id: newId(),
        schoolYear: year,
        studentId,
        eventId: c.key,
        attempt: c.attempt,
        side: c.side,
        value,
        excluded: false,
        measuredAt: Date.now(),
        ...(roundId ? { roundId } : {}),
      })
    }
  })
}

/** 여러 칸 한꺼번에 저장 (붙여넣기·스톱워치·왕복오래달리기 전송) — 지금 고른 회차에 */
export async function setCells(db: PeDatabase, year: number, items: { studentId: string; cell: CellSpec; value: number }[], roundId: string | null = null): Promise<void> {
  for (const it of items) await setCell(db, year, it.studentId, it.cell, it.value, roundId)
}

export async function setExcluded(db: PeDatabase, year: number, studentId: string, excluded: boolean, reason = ''): Promise<void> {
  await db.transaction('rw', db.papsResults, async () => {
    const rows = await db.papsResults.where('[studentId+eventId]').equals([studentId, EXCLUDED_KEY]).filter((r) => r.schoolYear === year).toArray()
    await db.papsResults.bulkDelete(rows.map((r) => r.id))
    if (excluded) {
      await db.papsResults.add({ id: newId(), schoolYear: year, studentId, eventId: EXCLUDED_KEY, attempt: null, side: null, excluded: true, excludeReason: reason, measuredAt: Date.now() })
    }
  })
}

export async function saveConfig(db: PeDatabase, year: number, grade: number, classNo: number, selected: Partial<Record<Factor, EventId>>): Promise<void> {
  const cur = await db.papsConfigs.where('[schoolYear+grade+classNo]').equals([year, grade, classNo]).first()
  if (cur) await db.papsConfigs.update(cur.id, { selectedEvents: selected as Record<string, string> })
  else await db.papsConfigs.add({ id: newId(), schoolYear: year, grade, classNo, selectedEvents: selected as Record<string, string> })
}

/** 학생 한 명의 칸 값 → 종목별 Cell 목록 */
export function cellsByEvent(vals: Map<string, number> | undefined): Partial<Record<EventId, Cell[]>> {
  const out: Partial<Record<EventId, Cell[]>> = {}
  if (!vals) return out
  for (const [id, value] of vals) {
    const [key, a, s] = id.split('|')
    ;(out[key as EventId] ??= []).push({ attempt: a ? Number(a) : null, side: (s || null) as 'R' | 'L' | null, value })
  }
  return out
}

export function bmiOf(vals: Map<string, number> | undefined): number | null {
  const h = vals?.get('height||')
  const w = vals?.get('weight||')
  return h && w ? bmi(h, w) : null
}

/** 학생 한 명의 종합 결과 */
export function studentSummary(
  std: PapsStandards,
  s: Pick<Student, 'grade' | 'gender'>,
  schoolLevel: string,
  selected: Partial<Record<Factor, EventId>>,
  vals: Map<string, number> | undefined,
  flexMode: FlexMode,
): StudentPaps | null {
  if (!s.gender) return null
  return studentPaps(std, {
    lvKey: `${schoolLevel}${s.grade}`,
    gender: s.gender,
    selected,
    cells: cellsByEvent(vals),
    flexMode,
    bmiValue: bmiOf(vals),
  })
}
