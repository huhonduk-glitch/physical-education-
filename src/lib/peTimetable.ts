import type { SlotGroup } from './neisOpenApi'
import type { TimetableEntry } from '../db/settings'

/**
 * 전체 체육 시간표 (6-5, 2026-10-26 교사 요청: 다른 체육 선생님과 시간 겹침 확인).
 * 나이스 공개 자료의 학교 전체 주간 시간표에서 체육 과목 칸만 모아 요일 × 교시 표로 만든다. 순수 함수.
 * 나이스 공개 자료에는 담당 교사 이름이 없다 → '같은 시각에 따로 진행되는 체육 수업 묶음 수'로 겹침(시설 · 교사)을 본다.
 * 합반 · 선택과목처럼 같은 시각 같은 과목을 여러 반이 함께 들으면 묶음 하나(slotGroups)로 센다.
 */

export interface PeCell {
  day: number
  period: number
  groups: SlotGroup[]
  /** 같은 시각에 따로 진행되는 체육 수업 묶음 수 */
  count: number
  /** 내 시간표(수업반)에 있는 칸 */
  mine: boolean
}

export function peCells(groups: readonly SlotGroup[], mine: readonly Pick<TimetableEntry, 'day' | 'period'>[] = []): Map<string, PeCell> {
  const out = new Map<string, PeCell>()
  const key = (d: number, p: number) => `${d}|${p}`
  for (const g of groups) {
    const k = key(g.day, g.period)
    const c = out.get(k) ?? out.set(k, { day: g.day, period: g.period, groups: [], count: 0, mine: false }).get(k)!
    c.groups.push(g)
    c.count = c.groups.length
  }
  for (const m of mine) {
    const k = key(m.day, m.period)
    const c = out.get(k) ?? out.set(k, { day: m.day, period: m.period, groups: [], count: 0, mine: true }).get(k)!
    c.mine = true
  }
  return out
}

/** 표 크기: 가장 늦은 교시 (최소 6) */
export function maxPeriod(cells: Map<string, PeCell>): number {
  return Math.max(6, ...[...cells.values()].map((c) => c.period))
}

export interface PeSummary {
  /** 체육 수업 묶음 수 (한 주) */
  lessons: number
  /** 2개 이상 겹치는 칸 수 */
  overlaps: number
  /** 가장 많이 겹치는 칸의 묶음 수 */
  peak: number
  /** 내 수업과 다른 체육 수업이 같은 시각인 칸 수 */
  mineOverlaps: number
}

export function peSummary(cells: Map<string, PeCell>): PeSummary {
  const list = [...cells.values()]
  return {
    lessons: list.reduce((n, c) => n + c.count, 0),
    overlaps: list.filter((c) => c.count >= 2).length,
    peak: Math.max(0, ...list.map((c) => c.count)),
    mineOverlaps: list.filter((c) => c.mine && c.count >= 2).length,
  }
}

/** 칸 안 글: '2-3 스포츠 생활2' (여러 반이면 '2-1·2-2') */
export function groupLabel(g: SlotGroup): string {
  const cls = g.classes.map((c) => `${c.grade}-${c.className || c.classNo}`).join('·')
  return `${cls} ${g.subject}`
}
