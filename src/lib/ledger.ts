/**
 * 누가 기록표 (2026-11-05 교사 요청: "나이스처럼 학생 명렬이 세로, 주차별로 기록") — 순수 함수.
 * 세로 = 학생, 가로 = 그 달의 수업일(시간표에 이 반이 있는 요일 + 기록이 있는 날), 주차로 묶음.
 * 칸 = 그날 기록 수(칭찬 · 지도) · 견학 · 출결(결석 · 지각 · 조퇴 · 결과). 점수 · 등급으로 바꾸지 않는다.
 */

export type AttendMark = 'absent' | 'late' | 'early' | 'result'

export interface LedgerCell {
  praise: number
  guide: number
  observe: number
  absence: boolean
  attend?: AttendMark
}

export interface LedgerColumn {
  date: string
  day: number
  /** 0 = 일 … 6 = 토 */
  weekday: number
  /** 그 달의 몇째 주 (월요일 기준, 1부터) */
  week: number
}

const pad = (n: number) => String(n).padStart(2, '0')

function parse(d: string): Date {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd)
}

/** 그 달 1일이 있는 주를 1주로, 월요일마다 다음 주 */
export function weekOfMonth(date: string): number {
  const d = parse(date)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // 월요일 = 0
  return Math.floor((d.getDate() - 1 + offset) / 7) + 1
}

/** month = 'YYYY-MM'. 수업 요일(1=월…5=금)의 날짜 + 기록이 있는 날짜(주말이라도) */
export function ledgerColumns(month: string, classWeekdays: ReadonlySet<number>, extraDates: Iterable<string> = []): LedgerColumn[] {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const set = new Set<string>()
  for (let d = 1; d <= last; d++) {
    const wd = new Date(y, m - 1, d).getDay()
    if (classWeekdays.has(wd)) set.add(`${month}-${pad(d)}`)
  }
  for (const d of extraDates) if (d.startsWith(`${month}-`)) set.add(d)
  return [...set].sort().map((date) => {
    const dt = parse(date)
    return { date, day: dt.getDate(), weekday: dt.getDay(), week: weekOfMonth(date) }
  })
}

/** 주차 머리글: 같은 주의 칸 수 */
export function weekSpans(cols: readonly LedgerColumn[]): { week: number; span: number }[] {
  const out: { week: number; span: number }[] = []
  for (const c of cols) {
    const lastW = out[out.length - 1]
    if (lastW && lastW.week === c.week) lastW.span++
    else out.push({ week: c.week, span: 1 })
  }
  return out
}

/** 출결이 여러 개면 무거운 것 하나만 칸에 (결석 > 결과 > 조퇴 > 지각) */
const ATTEND_RANK: Record<AttendMark, number> = { absent: 4, result: 3, early: 2, late: 1 }

export function ledgerCells(
  records: readonly { studentId: string; date: string; type: string }[],
  absences: readonly { studentId: string; date: string }[],
  attendance: readonly { studentId: string; date: string; status: AttendMark }[],
): Map<string, LedgerCell> {
  const m = new Map<string, LedgerCell>()
  const get = (s: string, d: string) => {
    const k = `${s}|${d}`
    let c = m.get(k)
    if (!c) m.set(k, (c = { praise: 0, guide: 0, observe: 0, absence: false }))
    return c
  }
  for (const r of records) {
    const c = get(r.studentId, r.date)
    if (r.type === 'exemplary') c.praise++
    else if (r.type === 'unprepared') c.guide++
    else if (r.type === 'observation') c.observe++
  }
  for (const a of absences) get(a.studentId, a.date).absence = true
  for (const a of attendance) {
    const c = get(a.studentId, a.date)
    if (!c.attend || ATTEND_RANK[a.status] > ATTEND_RANK[c.attend]) c.attend = a.status
  }
  return m
}

/** 학생 한 명의 그 달 합계 */
export function ledgerTotals(cells: ReadonlyMap<string, LedgerCell>, studentId: string, cols: readonly LedgerColumn[]): { praise: number; guide: number; absence: number; absent: number } {
  const t = { praise: 0, guide: 0, absence: 0, absent: 0 }
  for (const c of cols) {
    const x = cells.get(`${studentId}|${c.date}`)
    if (!x) continue
    t.praise += x.praise
    t.guide += x.guide
    if (x.absence) t.absence++
    if (x.attend === 'absent') t.absent++
  }
  return t
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
