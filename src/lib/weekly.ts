/**
 * 주간 수업 요약 (2026-11-09 교사 승인 — 인더스쿨 'AI 주간 학습보고서'에서 착안, AI 없이 기기 안 계산).
 *
 * 이번 주(월요일 ~ 오늘)와 지난주 같은 때(지난 월요일 ~ 지난주 오늘 요일)를 수업반마다 견주고 — 월요일에 '지난주 전체'와 견주면 늘 줄어 보여서, 교사가 이번 주에 챙길 것을 모은다.
 *  - 칭찬 · 지도 · 견학 · 결석 수와 지난주 대비 증감
 *  - 지도가 쌓이는 학생: 최근 14일 지도 3번 이상
 *  - 칭찬을 아직 못 받은 학생: 최근 28일 칭찬 0번 (그 수업반에서 기록을 한 날이 있을 때만)
 * 점수 · 등급으로 바꾸지 않고 횟수만 센다(6-1 A '포인트 = 횟수만'). 학생 이름이 나오므로 홈에는 숫자만, 이름은 요약 화면에서.
 */
import { addDays } from './dates'

export interface WeekRange {
  from: string
  to: string
}

/** 이번 주(월 ~ 오늘)와 지난주 같은 때(지난 월 ~ 7일 전). 날짜 문자열 YYYY-MM-DD */
export function weekRanges(today: string): { thisWeek: WeekRange; lastWeek: WeekRange } {
  const d = new Date(`${today}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // 월 0 … 일 6
  const monday = addDays(today, -dow)
  return { thisWeek: { from: monday, to: today }, lastWeek: { from: addDays(monday, -7), to: addDays(today, -7) } }
}

const inRange = (date: string, r: WeekRange) => date >= r.from && date <= r.to

export interface Counts {
  praise: number
  guide: number
  absence: number
  absent: number
}
const zero = (): Counts => ({ praise: 0, guide: 0, absence: 0, absent: 0 })

export interface WeeklyInput {
  today: string
  groups: readonly { id: string; name: string; memberIds: readonly string[] }[]
  records: readonly { studentId: string; date: string; type: string; groupId?: string }[]
  absences: readonly { studentId: string; date: string; groupId?: string }[]
  attendance: readonly { studentId: string; date: string; status: string; groupId: string }[]
}

export interface GroupWeek {
  groupId: string
  name: string
  thisWeek: Counts
  lastWeek: Counts
  /** 이번 주에 기록 · 출결을 하나라도 남긴 날 수 */
  daysThisWeek: number
  /** 최근 14일 지도 3번 이상 */
  guideRepeat: { studentId: string; count: number }[]
  /** 최근 28일 칭찬 0번 (이 반에서 그동안 기록한 날이 있을 때만) */
  noPraise: string[]
}

export const GUIDE_REPEAT_DAYS = 14
export const GUIDE_REPEAT_MIN = 3
export const NO_PRAISE_DAYS = 28

export function weeklySummary(input: WeeklyInput): { range: { thisWeek: WeekRange; lastWeek: WeekRange }; groups: GroupWeek[] } {
  const range = weekRanges(input.today)
  const recent14: WeekRange = { from: addDays(input.today, -(GUIDE_REPEAT_DAYS - 1)), to: input.today }
  const recent28: WeekRange = { from: addDays(input.today, -(NO_PRAISE_DAYS - 1)), to: input.today }
  const groups = input.groups.map((g) => {
    const tw = zero()
    const lw = zero()
    const days = new Set<string>()
    const recordDays28 = new Set<string>()
    const guide14 = new Map<string, number>()
    const praised28 = new Set<string>()
    const bump = (date: string, key: keyof Counts) => {
      if (inRange(date, range.thisWeek)) {
        tw[key]++
        days.add(date)
      } else if (inRange(date, range.lastWeek)) lw[key]++
    }
    for (const r of input.records) {
      if (r.groupId !== g.id) continue
      if (r.type === 'exemplary') bump(r.date, 'praise')
      else if (r.type === 'unprepared') bump(r.date, 'guide')
      else if (inRange(r.date, range.thisWeek)) days.add(r.date)
      if (inRange(r.date, recent28)) recordDays28.add(r.date)
      if (r.type === 'unprepared' && inRange(r.date, recent14)) guide14.set(r.studentId, (guide14.get(r.studentId) ?? 0) + 1)
      if (r.type === 'exemplary' && inRange(r.date, recent28)) praised28.add(r.studentId)
    }
    for (const a of input.absences) if (a.groupId === g.id) bump(a.date, 'absence')
    for (const a of input.attendance) if (a.groupId === g.id && a.status === 'absent') bump(a.date, 'absent')
    const guideRepeat = [...guide14]
      .filter(([, n]) => n >= GUIDE_REPEAT_MIN)
      .map(([studentId, count]) => ({ studentId, count }))
      .sort((a, b) => b.count - a.count)
    // 칭찬 기록을 쓰는 반(최근 28일에 칭찬이 한 번이라도 있음)에서만 '못 받은 학생'을 말한다
    const noPraise = praised28.size > 0 && recordDays28.size > 0 ? g.memberIds.filter((id) => !praised28.has(id)) : []
    return { groupId: g.id, name: g.name, thisWeek: tw, lastWeek: lw, daysThisWeek: days.size, guideRepeat, noPraise }
  })
  return { range, groups }
}

/** 지난주 대비 증감 글: +3 · −2 · 같음 */
export function deltaLabel(now: number, before: number): string {
  const d = now - before
  return d === 0 ? '같음' : d > 0 ? `+${d}` : `−${-d}`
}

/** 반 전체 합계 */
export function sumCounts(list: readonly Counts[]): Counts {
  return list.reduce((a, c) => ({ praise: a.praise + c.praise, guide: a.guide + c.guide, absence: a.absence + c.absence, absent: a.absent + c.absent }), zero())
}
