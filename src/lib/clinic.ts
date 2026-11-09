/**
 * 건강체력교실 운영 (2026-11-09 교사 승인).
 * 근거: 학교체육 진흥법 제9조 · 시행규칙 제5조(매년 운영계획: ① 운영 시기 및 담당자 ② 프로그램 내용 ③ 참여 학생 지도 및 관리 방안),
 * 제주특별자치도교육청 「2026학년도 학교체육 운영방향」 23~24쪽(대상 4~5등급 · 비만 판정 · 참여 희망자, 연중 운영,
 * "학교별 건강체력교실 참여 학생의 학생건강체력 변화 분석", 4~5등급 학생 수시평가).
 * 저장: settings.clinic[학년도] (이 기기 · 백업에 들어감). 저장 구조(Dexie 표)는 바꾸지 않는다.
 */
import type { StudentPaps } from './paps'

export interface ClinicPlan {
  when: string
  staff: string
  program: string
  manage: string
}
export interface ClinicMember {
  studentId: string
  /** 대상이 된 까닭 ('종합 4등급' · '고도비만' · '참여 희망') */
  why: string
}
export interface ClinicSession {
  id: string
  date: string
  activity: string
  /** 참여한 학생 */
  present: string[]
}
export interface ClinicYear {
  plan: ClinicPlan
  members: ClinicMember[]
  sessions: ClinicSession[]
}
export const EMPTY_CLINIC: ClinicYear = { plan: { when: '', staff: '', program: '', manage: '' }, members: [], sessions: [] }

/** 시행규칙 제5조 항목 (운영계획 칸 이름) */
export const PLAN_FIELDS: { key: keyof ClinicPlan; label: string; hint: string }[] = [
  { key: 'when', label: '운영 시기', hint: '예: 4월 ~ 12월, 매주 화 · 목 점심시간 (연중 운영)' },
  { key: 'staff', label: '담당자', hint: '예: 체육교사 ○○○' },
  { key: 'program', label: '프로그램 내용', hint: '예: 줄넘기 · 순환 운동 · 걷기 (학생 흥미 맞춤형)' },
  { key: 'manage', label: '참여 학생 지도 및 관리 방안', hint: '예: 출석 확인, 2학기 수시 측정으로 변화 확인, 가정통신' },
]

/** 학생마다 참여 횟수 */
export function presentCount(sessions: readonly ClinicSession[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) for (const id of s.present) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

/** 참여 학생 한 명의 변화: 처음(1회차 = 정시) → 가장 최근 회차 */
export interface ClinicChange {
  studentId: string
  first: StudentPaps | null
  latest: StudentPaps | null
  /** 가장 최근 회차 번호 (1이면 아직 다시 측정 안 함) */
  latestRound: number
}

/** 변화 요약: 두 번 다 5개 요인을 측정한 학생만 비교. 4·5등급 → 3등급 이상 = '저체력 벗어남' */
export function changeSummary(list: readonly ClinicChange[]): { compared: number; up: number; same: number; down: number; avgDelta: number | null; leftLow: number; notRemeasured: number } {
  let up = 0
  let same = 0
  let down = 0
  let leftLow = 0
  let notRemeasured = 0
  const deltas: number[] = []
  for (const c of list) {
    if (c.latestRound <= 1) {
      notRemeasured++
      continue
    }
    if (!c.first?.complete || !c.latest?.complete) continue
    const d = c.latest.total! - c.first.total!
    deltas.push(d)
    if (d > 0) up++
    else if (d < 0) down++
    else same++
    if ((c.first.grade ?? 0) >= 4 && (c.latest.grade ?? 5) <= 3) leftLow++
  }
  const avgDelta = deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10 : null
  return { compared: deltas.length, up, same, down, avgDelta, leftLow, notRemeasured }
}

/** 참여 학생 넣기 · 빼기 (같은 학생은 한 번만) */
export function toggleMember(members: readonly ClinicMember[], m: ClinicMember): ClinicMember[] {
  return members.some((x) => x.studentId === m.studentId) ? members.filter((x) => x.studentId !== m.studentId) : [...members, m]
}
