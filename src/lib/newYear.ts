import { currentSchoolYear, defaultSettings, type AppSettings } from '../db/settings'
import type { Assessment, ProgressPlan } from '../db/types'
import { packAssessment, packPlan, unpackAssessment, unpackPlan } from './share'
import type { WorkEvent } from './workCal'

/**
 * 새 학년도 시작 (CLAUDE.md 4-11 · 6-30). 순수 함수.
 * 학년도마다 쌓이는 표(명렬 · 기록 · PAPS · 수행평가 · 진도표 …)는 schoolYear로 이미 나뉘어 있어서 건드리지 않는다.
 * 여기서는 학년도와 상관없이 한 칸에 있는 설정 가운데 지난해 것이 남으면 안 되는 것만 고른다.
 */

export interface NewYearOptions {
  /** 시작할 학년도 */
  next: number
  /** 다른 학교로 옮겼는지 (3월 전보) */
  moved: boolean
}

/** [새 학년도 시작]이 바꾸는 설정. 여기 없는 칸(키워드 · 기록 버튼 · 세특 문체 · AI 연결 · 선생님 이름 …)은 그대로 이어진다 */
export function newYearPatch(s: AppSettings, o: NewYearOptions): Partial<AppSettings> {
  const prev = String(o.next - 1)
  const archive = { ...(s.budgetArchive ?? {}) }
  const manual = s.budgetManual ?? []
  if (s.budgetCard || manual.length) archive[prev] = { card: s.budgetCard, manual }
  const patch: Partial<AppSettings> = {
    schoolYear: o.next,
    latestYear: o.next,
    // 내 시간표 · 나이스 학사일정(3월 ~ 다음 해 2월) · 받아 둔 한 주 시간표는 그해 것이라 새로 받는다
    timetable: [],
    timetableChanges: [],
    neisSchedule: null,
    neisPeWeek: null,
    comciWeek: null,
    // 학교 회계연도 = 학년도 → 새 학년도는 빈 예산표, 지난해 예산은 그 학년도를 열면 보인다
    budgetCard: null,
    budgetManual: [],
    budgetArchive: archive,
  }
  if (o.moved) {
    const d = defaultSettings()
    Object.assign(patch, {
      schoolName: '',
      neisSchool: null,
      comciSchool: null,
      periodStarts: d.periodStarts,
      periodMinutes: d.periodMinutes,
      weatherLoc: null,
      weatherCache: null,
      space: null,
      budgetPicks: {},
      budgetLayout: d.budgetLayout,
    } satisfies Partial<AppSettings>)
  }
  return patch
}

/** 다른 학교로 옮기면 비우는 것 (화면 안내용) */
export const MOVED_CLEARS = ['학교 이름 · 나이스 · 컴시간 학교', '교시 시각', '날씨 위치', '학교 공유 공간 연결', '예산 시트 자리 · 고른 예산 항목']

/** 보고 있는 학년도의 예산: 가장 최근 학년도면 지금 예산, 지난 학년도면 그때 옮겨 둔 예산 */
export function budgetOf(s: AppSettings): { card: AppSettings['budgetCard']; manual: AppSettings['budgetManual']; archived: boolean } {
  if (!(s.latestYear > s.schoolYear)) return { card: s.budgetCard, manual: s.budgetManual ?? [], archived: false }
  const a = s.budgetArchive?.[String(s.schoolYear)]
  return { card: a?.card ?? null, manual: a?.manual ?? [], archived: true }
}

/** 3월이 되어 새 학년도를 시작할 때인가. 그렇다면 시작할 학년도 */
export function newYearDue(s: AppSettings, now = new Date()): number | null {
  const latest = Math.max(s.latestYear, s.schoolYear)
  return currentSchoolYear(now) > latest ? latest + 1 : null
}

/** 지난해 진도표 → 새 학년도 진도표: 차시는 그대로, 반 · 끝냄 · 빠짐은 빼고, 날짜는 새 학년도 학기로 (보내기 · 받기와 같은 규칙) */
export function carryPlan(p: ProgressPlan, o: { id: string; schoolYear: number; now: number }): ProgressPlan {
  return unpackPlan(packPlan(p), { ...o, groupIds: [] })
}

/** 지난해 수행평가 → 새 학년도 수행평가: 채점 요소 · 기준은 그대로, 반 연결은 빼고 (점수는 다른 표라 따라오지 않음) */
export function carryAssessment(a: Assessment, o: { id: string; schoolYear: number }): Assessment {
  return unpackAssessment(packAssessment(a), { ...o, groupIds: [] })
}

/** YYYY-MM-DD를 n년 옮기기 (2월 29일 → 28일) */
export function shiftYear(d: string, n: number): string {
  const y = Number(d.slice(0, 4)) + n
  const md = d.slice(5)
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return `${y}-${md === '02-29' && !leap ? '02-28' : md}`
}

/** 지난 학년도(fromYear 3월 ~ 다음 해 2월)에 선생님이 직접 넣은 업무 일정 → 1년 뒤로 옮긴 사본 후보. 교육청 제출 일정(pedocs-)은 [제출 일정 넣기]로 해마다 다시 넣으므로 뺀다 */
export function carryEvents(events: readonly WorkEvent[], fromYear: number, newId: () => string = () => crypto.randomUUID()): { from: string; event: WorkEvent }[] {
  const start = `${fromYear}-03-01`
  const end = `${fromYear + 1}-02-29`
  return events
    .filter((e) => !e.id.startsWith('pedocs-') && e.date >= start && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ from: e.id, event: { ...e, id: newId(), date: shiftYear(e.date, 1), ...(e.end ? { end: shiftYear(e.end, 1) } : {}) } }))
}
