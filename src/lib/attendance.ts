import type { Attendance, AttendReason, AttendStatus } from '../db/types'

/**
 * 수업 출결 (2026-10-30 교사 요청). 순수 함수.
 * 출석이 기본이라 저장하지 않고, 결석 · 지각 · 조퇴 · 결과만 저장한다 (나이스 출결 용어).
 * 결과 = 그 시간 수업에 빠짐(교과 시간 결손). 지각 · 조퇴는 수업에 있었던 것으로 센다.
 */

export const ATTEND_ORDER: readonly AttendStatus[] = ['absent', 'late', 'early', 'result']

export const ATTEND_LABEL: Record<AttendStatus, string> = { absent: '결석', late: '지각', early: '조퇴', result: '결과' }

export const ATTEND_REASONS: readonly AttendReason[] = ['질병', '인정', '미인정', '기타']

/** 카드를 누를 때마다: 출석 → 결석 → 지각 → 조퇴 → 결과 → 출석 (null = 출석) */
export function nextStatus(cur: AttendStatus | null | undefined): AttendStatus | null {
  if (!cur) return ATTEND_ORDER[0]
  const i = ATTEND_ORDER.indexOf(cur)
  return i < 0 || i === ATTEND_ORDER.length - 1 ? null : ATTEND_ORDER[i + 1]
}

/** 수업에 없었던 학생 (결석 · 결과). 지각 · 조퇴는 수업에 있었던 것으로 본다 */
export const isMissing = (s: AttendStatus | null | undefined) => s === 'absent' || s === 'result'

/** 그날 · 그 교시 출결: 학생 id → 상태. 교시를 모르면(undefined) 그날 기록을 쓴다 */
export function dayStatus(rows: readonly Attendance[], period?: number): Map<string, Attendance> {
  const m = new Map<string, Attendance>()
  for (const r of rows) if (period === undefined || r.period === undefined || r.period === period) m.set(r.studentId, r)
  return m
}

export type AttendTally = Record<AttendStatus, number>

export const emptyTally = (): AttendTally => ({ absent: 0, late: 0, early: 0, result: 0 })

/** 학생별 출결 횟수 (기간은 부르는 쪽에서 거른다) */
export function attendTally(rows: readonly Attendance[]): Map<string, AttendTally> {
  const m = new Map<string, AttendTally>()
  for (const r of rows) {
    const t = m.get(r.studentId) ?? emptyTally()
    t[r.status]++
    m.set(r.studentId, t)
  }
  return m
}

/** 화면 · 엑셀용 짧은 글: '결석 2 · 지각 1' (없으면 '') */
export function tallyText(t: AttendTally | undefined): string {
  if (!t) return ''
  return ATTEND_ORDER.filter((s) => t[s] > 0)
    .map((s) => `${ATTEND_LABEL[s]} ${t[s]}`)
    .join(' · ')
}

/**
 * 고교학점제 과목 출석률 (2026 기재요령 길라잡이: 수업 횟수의 2/3 이상 출석해야 이수).
 * missing = 결석 + 결과 횟수, held = 이 과목 수업이 열린 횟수.
 * 'danger' = 이미 2/3 미만, 'caution' = 2번만 더 빠지면 미만, 'ok' = 괜찮음.
 */
export function creditRisk(missing: number, held: number): 'ok' | 'caution' | 'danger' {
  if (held <= 0) return 'ok'
  const attended = held - missing
  if (attended * 3 < held * 2) return 'danger'
  if ((attended - 2) * 3 < held * 2) return 'caution'
  return 'ok'
}
