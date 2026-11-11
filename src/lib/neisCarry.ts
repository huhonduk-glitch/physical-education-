import type { Attendance } from '../db/types'
import { ATTEND_LABEL, ATTEND_ORDER } from './attendance'

/**
 * 나이스에 옮길 출결 (2026-11-11 교사 승인 — 스쿨보드 참고: 출결마다 '나이스 입력 완료' 체크).
 * 앱은 나이스에 자동으로 넣지 않는다(0-5). 교사가 과목별 출결을 손으로 옮길 때
 * 어디까지 옮겼는지 표시하고, 안 옮긴 것만 날짜 · 수업반별로 모아 준다. 순수 함수.
 */

export interface CarryRow {
  id: string
  /** 카드 번호 (학적반 번호 · 수강반 학번) */
  no: string
  name: string
  status: Attendance['status']
  period?: number
  reason?: Attendance['reason']
  done: boolean
}

export interface CarryDay {
  groupId: string
  groupName: string
  date: string
  rows: CarryRow[]
}

export type CarryWho = (studentId: string, groupId: string) => { no: string; name: string } | undefined

/** 옮겼는지 */
export const isCarried = (a: Pick<Attendance, 'neisAt'>) => typeof a.neisAt === 'number' && a.neisAt > 0

/** 아직 안 옮긴 줄 수 */
export const pendingCount = (rows: readonly Attendance[]) => rows.filter((r) => !isCarried(r)).length

const numOr = (s: string) => {
  const n = Number(s)
  return s !== '' && Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/**
 * 날짜 · 수업반별로 묶는다. done=false면 안 옮긴 줄만, true면 옮긴 줄만.
 * 날짜 오름차순(오래된 것부터 옮기도록) → 수업반 이름 → 교시 → 번호.
 * 명렬에 없는 학생(전출 등으로 수업반에서 빠짐)은 이름 '(명단에 없음)'으로 남긴다 — 빠뜨리지 않게.
 */
export function carryDays(rows: readonly Attendance[], groups: readonly { id: string; name: string }[], who: CarryWho, done = false): CarryDay[] {
  const nameOf = new Map(groups.map((g) => [g.id, g.name]))
  const days = new Map<string, CarryDay>()
  for (const r of rows) {
    if (isCarried(r) !== done) continue
    const groupName = nameOf.get(r.groupId)
    if (groupName === undefined) continue // 지운 수업반
    const key = `${r.date}|${r.groupId}`
    const day = days.get(key) ?? { groupId: r.groupId, groupName, date: r.date, rows: [] }
    const w = who(r.studentId, r.groupId)
    day.rows.push({ id: r.id, no: w?.no ?? '', name: w?.name ?? '(명단에 없음)', status: r.status, period: r.period, reason: r.reason, done })
    days.set(key, day)
  }
  const out = [...days.values()]
  for (const d of out) d.rows.sort((a, b) => (a.period ?? 0) - (b.period ?? 0) || numOr(a.no) - numOr(b.no) || a.name.localeCompare(b.name, 'ko'))
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.groupName.localeCompare(b.groupName, 'ko', { numeric: true }))
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** '11/11(수)' */
export function carryDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`
}

/**
 * 붙여 넣거나 옆에 두고 볼 글. 사유는 건강 정보일 수 있어 withReason일 때만 넣는다.
 * 예) 11/11(수) 1학년 2반
 *     3교시 5번 김가람 결석(질병)
 */
export function carryText(day: CarryDay, withReason = false): string {
  const lines = day.rows.map((r) => {
    const period = r.period ? `${r.period}교시 ` : ''
    const no = r.no ? `${r.no}번 ` : ''
    const reason = withReason && r.reason ? `(${r.reason})` : ''
    return `${period}${no}${r.name} ${ATTEND_LABEL[r.status]}${reason}`
  })
  return [`${carryDateLabel(day.date)} ${day.groupName}`, ...lines].join('\n')
}

/** 묶음 요약: '결석 2 · 지각 1' */
export function carrySummary(day: CarryDay): string {
  return ATTEND_ORDER.map((s) => [s, day.rows.filter((r) => r.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${ATTEND_LABEL[s]} ${n}`)
    .join(' · ')
}
