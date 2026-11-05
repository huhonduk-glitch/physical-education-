/**
 * 업무 달력 (같이 쓰기 6-13, 2026-11-05 교사 요청 '업무 달력 · 알림'): PAPS 기간 · 나이스 마감 · 대회 · 체육대회 일정.
 * 각자 기기에 두고(settings.workEvents), 일정 묶음을 링크 · 파일로 다른 선생님께 보내고 받는다(share.ts 'calendar').
 * 나이스 학사일정(neisSchedule)은 함께 보여 주기만 한다. 순수 함수.
 */

export type WorkKind = 'paps' | 'neis' | 'contest' | 'event' | 'etc'

export interface WorkEvent {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** 여러 날이면 끝날 (포함) */
  end?: string
  title: string
  kind: WorkKind
  memo?: string
}

export const WORK_KIND: Record<WorkKind, { label: string; fg: string; bg: string }> = {
  paps: { label: 'PAPS', fg: '#1d5fd6', bg: '#e8f0fe' },
  neis: { label: '나이스 마감', fg: '#d0342c', bg: '#fdecea' },
  contest: { label: '대회', fg: '#7442d6', bg: '#f0eafd' },
  event: { label: '행사', fg: '#0f8a7e', bg: '#e3f5f2' },
  etc: { label: '기타', fg: '#56606e', bg: '#eef0f3' },
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 달력 칸: 그 달을 덮는 주(월요일 시작) × 7일. 다른 달 날짜는 out = true */
export function monthGrid(month: string): { date: string; day: number; out: boolean }[][] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const weeks: { date: string; day: number; out: boolean }[][] = []
  const cur = new Date(start)
  while (weeks.length < 6) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: ymd(cur), day: cur.getDate(), out: cur.getMonth() !== m - 1 })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
    if (cur.getMonth() !== m - 1 && cur > first) break
  }
  return weeks
}

/** 그날 걸린 일정 (여러 날 일정 포함) */
export function eventsOn(date: string, events: readonly WorkEvent[]): WorkEvent[] {
  return events.filter((e) => e.date <= date && date <= (e.end && e.end >= e.date ? e.end : e.date))
}

/** 오늘부터 days일 안에 시작하거나 진행 중인 일정 (가까운 순) */
export function upcoming(events: readonly WorkEvent[], today: string, days = 14): WorkEvent[] {
  const lim = new Date(today)
  lim.setDate(lim.getDate() + days)
  const last = ymd(lim)
  return events.filter((e) => (e.end ?? e.date) >= today && e.date <= last).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

/** 받은 일정 합치기: 같은 날 · 같은 제목은 건너뜀. 새로 더한 수를 돌려준다 */
export function mergeEvents(mine: readonly WorkEvent[], incoming: readonly Omit<WorkEvent, 'id'>[], newId: () => string): { list: WorkEvent[]; added: number } {
  const key = (e: Pick<WorkEvent, 'date' | 'title'>) => `${e.date}|${e.title.trim()}`
  const have = new Set(mine.map(key))
  const list = [...mine]
  let added = 0
  for (const e of incoming) {
    if (!e.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || have.has(key(e))) continue
    list.push({ ...e, id: newId(), title: e.title.trim() })
    have.add(key(e))
    added++
  }
  list.sort((a, b) => a.date.localeCompare(b.date))
  return { list, added }
}

/** D-day 글자 */
export function dday(date: string, today: string): string {
  const d = Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000)
  return d === 0 ? 'D-Day' : d > 0 ? `D-${d}` : `D+${-d}`
}
