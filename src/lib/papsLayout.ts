/**
 * PAPS 입력 칸 구성. 나이스 양식을 등록했으면 양식에 있는 칸만, 없으면 반별 선택 종목으로 표준 칸을 만든다.
 * 표준 칸은 나이스 양식 예시(references/neis-paps-template)의 이름 짓는 방식을 따른다 — 교사에게 "나이스 양식과 비교해 보세요"라고 안내한다.
 */
import { NEIS_COMMON_HEADERS } from './neisCommonColumns'
import type { MeasureKey, NeisColumn } from './neisHeaderParser'
import { parseNeisHeaders } from './neisHeaderParser'
import type { EventId, Factor } from './paps'

export interface CellSpec {
  key: MeasureKey
  attempt: number | null
  side: 'R' | 'L' | null
}

export const cellId = (c: CellSpec) => `${c.key}|${c.attempt ?? ''}|${c.side ?? ''}`

/** 표준 헤더 (양식 등록 전) — 종목별 칸 모양 */
const STANDARD: Record<Exclude<MeasureKey, 'heartRate' | 'bodyFat'>, string[]> = {
  shuttleRun: ['왕복오래달리기(회)'],
  longRunWalk: ['오래달리기-걷기(초)'],
  stepTest: ['스텝검사(점)'],
  gripStrength: ['악력(kg) 1차 오른쪽', '악력(kg) 1차 왼쪽', '악력(kg) 2차 오른쪽', '악력(kg) 2차 왼쪽'],
  curlUp: ['윗몸말아올리기(회)'],
  pushUp: ['팔굽혀펴기(회)'],
  sitAndReach: ['앉아윗몸 앞으로 굽히기(cm) 1차', '앉아윗몸 앞으로 굽히기(cm) 2차'],
  totalFlexibility: ['종합유연성(점)'],
  sprint50m: ['50m달리기(초)'],
  standingLongJump: ['제자리멀리뛰기(cm) 1차', '제자리멀리뛰기(cm) 2차'],
  height: ['신장(cm)'],
  weight: ['체중(kg)'],
}

/** 반별 선택 종목으로 표준 헤더 만들기 (공통 9열 + 종목 칸 + 신장·체중) */
export function standardHeaders(selected: Partial<Record<Factor, EventId>>): string[] {
  const out = [...NEIS_COMMON_HEADERS]
  for (const f of ['심폐지구력', '유연성', '근력·근지구력', '순발력'] as Factor[]) {
    const id = selected[f]
    if (id && id !== 'bmi') out.push(...STANDARD[id])
  }
  out.push(...STANDARD.height, ...STANDARD.weight)
  return out
}

/** 헤더 목록 → 측정 칸 목록 (양식 순서 그대로) */
export function cellsOf(columns: readonly NeisColumn[]): CellSpec[] {
  return columns.filter((c) => c.kind === 'measure').map((c) => ({ key: c.key, attempt: c.attempt, side: c.side }))
}

export function columnsFor(template: string[] | null, selected: Partial<Record<Factor, EventId>>): NeisColumn[] {
  return parseNeisHeaders(template ?? standardHeaders(selected))
}

/** 종목 하나의 칸들 (입력 화면·붙여넣기 순서) */
export function cellsForKey(cells: readonly CellSpec[], key: MeasureKey): CellSpec[] {
  return cells.filter((c) => c.key === key)
}

/** 양식 칸으로 반별 선택 종목 자동 설정 (CLAUDE.md 4-5 "측정 종목 자동 설정") */
export function selectedFromColumns(columns: readonly NeisColumn[], events: Record<string, { factor: string }>): Partial<Record<Factor, EventId>> {
  const out: Partial<Record<Factor, EventId>> = {}
  for (const c of columns) {
    if (c.kind !== 'measure') continue
    const f = events[c.key]?.factor as Factor | undefined
    if (f && f !== '비만' && !out[f]) out[f] = c.key as EventId
  }
  return out
}
