/**
 * 홈 대시보드 (2026-11-12 교사 요청 '스쿨보드처럼 가독성 · 가시성 좋게'): 시계 · 날씨 그림 · D-day · 학사일정 달력.
 * 구성만 참고(코드 · 문구 · 그림은 가져오지 않음). 순수 함수 — 화면은 src/components/home/.
 */
import type { NeisEvent } from './neisOpenApi'
import { eventsOn, type WorkEvent, WORK_KIND } from './workCal'

/** 기상청 강수형태(PTY) · 하늘상태(SKY) → 날씨 그림 글자. 밤(19~5시)에 맑으면 달 */
export function weatherEmoji(pty: number | undefined, sky: number | undefined, hour: number): string {
  if (pty === 1 || pty === 5) return '🌧️'
  if (pty === 2 || pty === 6) return '🌨️'
  if (pty === 3 || pty === 7) return '❄️'
  const night = hour >= 19 || hour < 6
  if (sky === 1) return night ? '🌙' : '☀️'
  if (sky === 3) return night ? '☁️' : '⛅'
  if (sky === 4) return '☁️'
  return '🌡️'
}

/** 달력 한 칸에 보일 일정 한 줄 */
export interface DayMark {
  label: string
  /** school = 학사일정, off = 쉬는 날(빨강), exam = 고사, work = 업무 일정 */
  kind: 'school' | 'off' | 'exam' | 'work'
  fg: string
  bg: string
}

const OFF = /휴업|공휴일|대체|방학|개교기념|재량|설날|추석|성탄|크리스마스|어린이날|현충일|광복절|개천절|한글날|삼일절|3[.·]1절|석가|부처님|신정|선거/
const EXAM = /고사|지필|시험|수능|모의|학력평가/
const TONE = {
  school: { fg: '#4e5968', bg: '#eef0f3' },
  off: { fg: '#d0342c', bg: '#fdecea' },
  exam: { fg: '#7442d6', bg: '#f0eafd' },
} as const

export function schoolKind(name: string): 'school' | 'off' | 'exam' {
  const n = name.replace(/\s+/g, '')
  return EXAM.test(n) ? 'exam' : OFF.test(n) ? 'off' : 'school'
}

/** 그날의 일정: 업무 일정 먼저(내가 넣은 것), 그다음 학사일정. 같은 이름은 한 번 */
export function marksOn(date: string, school: readonly NeisEvent[], work: readonly WorkEvent[]): DayMark[] {
  const out: DayMark[] = eventsOn(date, work).map((e) => ({ label: e.title, kind: 'work', fg: WORK_KIND[e.kind].fg, bg: WORK_KIND[e.kind].bg }))
  const seen = new Set(out.map((m) => m.label))
  for (const e of school) {
    if (e.date !== date || seen.has(e.name)) continue
    seen.add(e.name)
    const k = schoolKind(e.name)
    out.push({ label: e.name, kind: k, ...TONE[k] })
  }
  return out
}

/** 그 달에 일정이 있는 날 → 일정 목록 (달력 그릴 때 한 번에) */
export function monthMarks(dates: readonly string[], school: readonly NeisEvent[], work: readonly WorkEvent[]): Map<string, DayMark[]> {
  const map = new Map<string, DayMark[]>()
  for (const d of dates) {
    const m = marksOn(d, school, work)
    if (m.length) map.set(d, m)
  }
  return map
}

export interface Dday {
  title: string
  date: string
  /** 남은 날 (오늘 = 0) */
  days: number
  kind: DayMark['kind']
}

const gap = (date: string, today: string) => Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)

/**
 * 크게 보여 줄 D-day 하나와 그 뒤 일정들. 고르는 순서:
 *  ① 내가 넣은 업무 일정 · 학사일정의 고사(시험) 가운데 가장 가까운 것 ② 없으면 가장 가까운 학사일정(쉬는 날 포함).
 * 오늘부터 limit일 안. 같은 이름이 여러 날이면 첫날만.
 */
export function pickDdays(school: readonly NeisEvent[], work: readonly WorkEvent[], today: string, limit = 120): Dday[] {
  const seen = new Set<string>()
  const all: Dday[] = []
  for (const e of [...work].sort((a, b) => a.date.localeCompare(b.date))) {
    const end = e.end && e.end >= e.date ? e.end : e.date
    if (end < today || seen.has(e.title)) continue
    seen.add(e.title)
    all.push({ title: e.title, date: e.date, days: Math.max(0, gap(e.date, today)), kind: 'work' })
  }
  for (const e of [...school].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.date < today || seen.has(e.name)) continue
    seen.add(e.name)
    all.push({ title: e.name, date: e.date, days: gap(e.date, today), kind: schoolKind(e.name) })
  }
  const near = all.filter((d) => d.days <= limit).sort((a, b) => a.days - b.days || rank(a) - rank(b))
  const main = near.find((d) => d.kind === 'work' || d.kind === 'exam') ?? near[0]
  if (!main) return []
  return [main, ...near.filter((d) => d !== main)]
}
const rank = (d: Dday) => (d.kind === 'work' ? 0 : d.kind === 'exam' ? 1 : d.kind === 'school' ? 2 : 3)

export function ddayText(days: number): string {
  return days === 0 ? 'D-Day' : `D-${days}`
}

/** 교시 시작 '08:40' + 수업 시간(분) → '08:40~09:30' */
export function periodRange(start: string | undefined, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(start ?? '')
  if (!m) return ''
  const s = Number(m[1]) * 60 + Number(m[2])
  const e = s + minutes
  const f = (v: number) => `${String(Math.floor(v / 60) % 24).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
  return `${f(s)}~${f(e)}`
}

/** 남은 초 → '12분' · '1시간 5분' · '40초' */
export function leftText(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}초`
  const min = Math.ceil(seconds / 60)
  return min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`
}

/** 이번 주 월~금 날짜 (오늘이 주말이면 지난 월~금) */
export function weekDates(today: string): string[] {
  const d = new Date(`${today}T00:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
}
