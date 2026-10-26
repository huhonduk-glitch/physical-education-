import type { PlanItem, ProgressPlan } from '../db/types'
import type { TimetableEntry } from '../db/settings'
import type { NeisEvent } from './neisOpenApi'
import { addDays } from './dates'

/**
 * 교과 진도표 (6-5). 순수 함수.
 * 진도표는 차시 목록만 저장한다. 차시마다 몇 월 며칠 몇 교시인지는
 * 시간표(이 수업반 칸) · 학기 기간 · 쉬는 날 · 빠진 수업(밀기)으로 그때그때 계산한다 (Planbook의 밀기 방식).
 */

export const WEEKS_DEFAULT = 17
export const HOUR_CHOICES = [1, 2, 3, 4] as const

export function targetFor(weeklyHours: number, weeks: number): number {
  return Math.max(0, Math.round(weeklyHours) * Math.round(weeks))
}

export interface Meeting {
  date: string
  period: number
}

export const meetingKey = (m: Meeting) => `${m.date}|${m.period}`

function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** 학기 기간 안에서 이 수업반이 수업하는 날·교시 (쉬는 날 · 빠진 수업 빼고), 날짜·교시 순 */
export function meetings(groupId: string, timetable: readonly TimetableEntry[], plan: Pick<ProgressPlan, 'startDate' | 'endDate' | 'offDays'>, skips: readonly string[] = []): Meeting[] {
  const slots = timetable.filter((t) => t.groupId === groupId)
  if (!slots.length || !plan.startDate || !plan.endDate || plan.startDate > plan.endDate) return []
  const off = new Set(plan.offDays)
  const skip = new Set(skips)
  const out: Meeting[] = []
  for (let d = plan.startDate; d <= plan.endDate; d = addDays(d, 1)) {
    if (off.has(d)) continue
    const wd = weekday(d)
    for (const s of slots.filter((t) => t.day === wd).sort((a, b) => a.period - b.period)) {
      const m = { date: d, period: s.period }
      if (!skip.has(meetingKey(m))) out.push(m)
    }
    if (out.length > 400) break // 잘못된 기간 방어
  }
  return out
}

export interface Scheduled {
  item: PlanItem
  /** 몇 차시 (1부터) */
  no: number
  meeting: Meeting | null
}

/**
 * 차시를 수업에 차례로 놓는다.
 * 고정한 차시(lockedDate)는 그날 수업에 먼저 놓고, 나머지 차시는 남은 수업을 순서대로 채운다.
 * 수업이 모자라면 meeting = null (학기 안에 못 끝냄).
 */
export function schedule(items: readonly PlanItem[], ms: readonly Meeting[]): Scheduled[] {
  const used = new Set<number>()
  const fixed = new Map<string, number>()
  for (const it of items) {
    if (!it.lockedDate) continue
    const i = ms.findIndex((m, k) => !used.has(k) && m.date === it.lockedDate)
    if (i >= 0) {
      used.add(i)
      fixed.set(it.id, i)
    }
  }
  let k = 0
  return items.map((item, idx) => {
    let at: number | undefined = fixed.get(item.id)
    if (at === undefined && !item.lockedDate) {
      while (k < ms.length && used.has(k)) k++
      if (k < ms.length) {
        at = k
        used.add(k)
        k++
      }
    }
    return { item, no: idx + 1, meeting: at === undefined ? null : ms[at] }
  })
}

/** 빠진 수업(밀기): 그 수업을 빼면 뒤 차시가 모두 한 칸씩 밀린다. 다시 누르면 되돌린다 */
export function toggleSkip(skips: readonly string[], m: Meeting): string[] {
  const k = meetingKey(m)
  return skips.includes(k) ? skips.filter((s) => s !== k) : [...skips, k].sort()
}

export interface GroupProgress {
  /** 오늘까지 계획상 끝냈어야 할 차시 수 */
  planned: number
  /** 끝냈다고 표시한 차시 수 */
  done: number
  /** done − planned (+ 빠름, − 늦음) */
  diff: number
  /** 마지막으로 끝낸 차시 번호 (없으면 0) */
  lastDone: number
  /** 학기 안에 자리가 없는 차시 수 */
  overflow: number
}

export function groupProgress(sched: readonly Scheduled[], doneIds: readonly string[], today: string): GroupProgress {
  const done = new Set(doneIds)
  // 오늘 수업은 끝냄을 눌렀을 때만 계획에 센다 (수업 전·중에 '늦음'으로 보이지 않게)
  const planned = sched.filter((s) => s.meeting && (s.meeting.date < today || (s.meeting.date === today && done.has(s.item.id)))).length
  const doneCount = sched.filter((s) => done.has(s.item.id)).length
  const lastDone = sched.reduce((n, s) => (done.has(s.item.id) ? s.no : n), 0)
  return { planned, done: doneCount, diff: doneCount - planned, lastDone, overflow: sched.filter((s) => !s.meeting).length }
}

/** 그날 이 수업반이 할 차시 (여러 교시면 여러 개) */
export function itemsOn(sched: readonly Scheduled[], date: string): Scheduled[] {
  return sched.filter((s) => s.meeting?.date === date)
}

/** 다음에 할 차시: 끝내지 않은 첫 차시 */
export function nextItem(sched: readonly Scheduled[], doneIds: readonly string[]): Scheduled | undefined {
  const done = new Set(doneIds)
  return sched.find((s) => !done.has(s.item.id))
}

/** 학사일정에서 수업이 없는 날로 볼 이름 (교사가 진도표 화면에서 더하고 뺄 수 있다) */
const OFF_NAME = /휴업|공휴일|대체|방학|개교기념|재량|설날|추석|성탄|크리스마스|어린이날|현충일|광복절|개천절|한글날|삼일절|3[.·]1절|석가|부처님|신정|선거|졸업식|종업식/

export function offDaysFromSchedule(events: readonly NeisEvent[], start: string, end: string, grade?: number): string[] {
  const out = new Set<string>()
  for (const e of events) {
    if (e.date < start || e.date > end) continue
    if (grade && e.grades.length && !e.grades.includes(grade)) continue
    if (OFF_NAME.test(e.name.replace(/\s+/g, ''))) out.add(e.date)
  }
  return [...out].sort()
}

/** 학사일정에서 고사 기간으로 보이는 날 (쉬는 날 후보로만 보여 준다) */
export function examDaysFromSchedule(events: readonly NeisEvent[], start: string, end: string): string[] {
  return [...new Set(events.filter((e) => e.date >= start && e.date <= end && /고사|시험/.test(e.name)).map((e) => e.date))].sort()
}

let seq = 0
export function newItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pi-${Date.now()}-${seq++}`
}

/** 단원별 시수로 빨리 만들기: [{unit:'배드민턴 이해하기', hours:3}, …] → 차시 목록 */
export function itemsFromUnits(units: readonly { unit: string; hours: number; standards?: string[] }[]): PlanItem[] {
  const out: PlanItem[] = []
  for (const u of units) {
    const n = Math.max(0, Math.round(u.hours))
    for (let i = 1; i <= n; i++) out.push({ id: newItemId(), unit: u.unit.trim(), content: n > 1 ? `${u.unit.trim()} (${i}/${n})` : u.unit.trim(), standards: [...(u.standards ?? [])] })
  }
  return out
}

/** 주차 단위 계획 한 줄 (학교 평가계획서의 '교수학습 운영 계획' 표) */
export interface WeekRow {
  month?: number
  week: number
  hours: number
  unit: string
  /** 학습 내용 (없으면 'N주'로 표시) */
  content?: string
  standards: string[]
  method?: string
  evalNote?: string
  /** 중간고사 · 기말고사처럼 차시 없는 주 */
  event?: string
}

/** 주차 계획 → 차시 목록. 주마다 시수만큼 펼치고, 고사·행사 주는 (시수가 적혀 있어도) 차시를 만들지 않는다 */
export function itemsFromWeeks(rows: readonly WeekRow[]): { items: PlanItem[]; events: { week: number; label: string }[] } {
  const items: PlanItem[] = []
  const events: { week: number; label: string }[] = []
  for (const r of rows) {
    if (r.event) {
      events.push({ week: r.week, label: r.event })
      continue
    }
    const n = Math.max(0, Math.round(r.hours))
    for (let i = 0; i < n; i++) {
      items.push({ id: newItemId(), unit: r.unit, content: r.content ?? `${r.week}주 ${n > 1 ? `(${i + 1}/${n})` : ''}`.trim(), standards: [...r.standards], method: r.method, evalNote: r.evalNote })
    }
  }
  return { items, events }
}

/** 목표 차시에 맞추기: 남으면 뒤에서 자르고(잘린 수 반환), 모자라면 빈 차시를 더한다 */
export function fitToTarget(items: readonly PlanItem[], target: number): { items: PlanItem[]; cut: number; added: number } {
  if (items.length > target) return { items: items.slice(0, target), cut: items.length - target, added: 0 }
  const add = target - items.length
  const last = items[items.length - 1]
  return { items: [...items, ...Array.from({ length: add }, () => ({ id: newItemId(), unit: last?.unit ?? '', content: '', standards: [] }))], cut: 0, added: add }
}

/** 차시 순서 바꾸기 */
export function moveItem(items: readonly PlanItem[], from: number, to: number): PlanItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items]
  const a = [...items]
  const [x] = a.splice(from, 1)
  a.splice(to, 0, x)
  return a
}

/** 단원 묶음: 같은 단원이 이어지는 차시를 한 줄로 (화면 · 엑셀용) */
export function unitBlocks(items: readonly PlanItem[]): { unit: string; from: number; to: number; standards: string[] }[] {
  const out: { unit: string; from: number; to: number; standards: string[] }[] = []
  items.forEach((it, i) => {
    const last = out[out.length - 1]
    if (last && last.unit === it.unit) {
      last.to = i + 1
      for (const s of it.standards) if (!last.standards.includes(s)) last.standards.push(s)
    } else out.push({ unit: it.unit, from: i + 1, to: i + 1, standards: [...it.standards] })
  })
  return out
}

/** 성취기준 진도: 과목 성취기준 중 몇 차시에서 다루는지 (0이면 아직 계획에 없음) */
export function standardCoverage(items: readonly PlanItem[], codes: readonly string[]): { code: string; count: number }[] {
  return codes.map((code) => ({ code, count: items.filter((it) => it.standards.includes(code)).length }))
}

/** 엑셀 표: 차시 · 날짜 · 교시 · 단원 · 내용 · 성취기준 · 수업 방법 · 평가 연계 · 끝냄 */
export function planRows(sched: readonly Scheduled[], doneIds: readonly string[] = []): (string | number)[][] {
  const done = new Set(doneIds)
  return [
    ['차시', '날짜', '교시', '단원', '학습 내용', '성취기준', '수업 방법', '평가 연계', '끝냄'],
    ...sched.map((s) => [s.no, s.meeting?.date ?? '', s.meeting?.period ?? '', s.item.unit, s.item.content, s.item.standards.join(' '), s.item.method ?? '', s.item.evalNote ?? '', done.has(s.item.id) ? 'O' : '']),
  ]
}

/** 학기 기본 기간 (학사일정을 불러오기 전 출발점. 교사가 고친다) */
export function defaultTerm(schoolYear: number, semester: 1 | 2): { startDate: string; endDate: string } {
  return semester === 1 ? { startDate: `${schoolYear}-03-02`, endDate: `${schoolYear}-07-18` } : { startDate: `${schoolYear}-08-17`, endDate: `${schoolYear}-12-31` }
}
