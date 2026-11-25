import { addDays } from './dates'

/**
 * 수업 역할 (2026-11-25, 슈퍼스쿨 '일인일역' 참고 — 문구 · 코드는 새로 씀). 순수 함수만.
 * 수업반마다 역할(준비운동 리더 · 교구 담당 …)과 맡은 학생 · 기간을 남긴다. 체육부장(captains)과는 따로.
 * 맡은 사람을 바꾸면 앞사람 기간을 닫고 새 기간을 연다 → 누가 언제 맡았는지 남아 세특 근거가 된다.
 * 날짜는 'YYYY-MM-DD'. 저장은 수업반(ClassGroup)의 선택 칸 roles · roleTerms (저장 구조 버전은 그대로).
 */

export interface ClassRole {
  id: string
  name: string
  /** 하는 일 — 세특 초안에 '…역할을 맡아 {duty}'로 들어가므로 '…함 · …음'으로 끝나게 적는다 */
  duty: string
}

export interface RoleTerm {
  id: string
  roleId: string
  studentId: string
  from: string
  /** 비어 있으면 지금도 맡는 중 */
  to?: string
}

/** 많이 쓰는 역할 (선생님이 고쳐 쓴다) */
export const ROLE_PRESETS: readonly { name: string; duty: string }[] = [
  { name: '준비운동 리더', duty: '준비운동을 앞에서 진행함' },
  { name: '교구 담당', duty: '교구를 준비하고 정리함' },
  { name: '기록원', duty: '경기 기록을 정리함' },
  { name: '심판', duty: '경기 판정을 함' },
  { name: '안전 지킴이', duty: '활동 전 안전 점검을 도움' },
  { name: '출석 도우미', duty: '출석 확인을 도움' },
]

const active = (t: RoleTerm, date: string) => t.from <= date && (!t.to || t.to >= date)

/** 그날 그 역할을 맡은 학생 id (기간 시작 순) */
export function holdersOn(terms: readonly RoleTerm[], roleId: string, date: string): string[] {
  return terms
    .filter((t) => t.roleId === roleId && active(t, date))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((t) => t.studentId)
}

/**
 * 역할 맡기기: date부터 studentIds가 맡는다. 계속 맡는 학생은 그대로 두고,
 * 빠지는 학생은 전날로 기간을 닫는다(그날 시작한 기간이면 지운다 — 같은 날 고친 것으로 본다).
 */
export function assignRole(terms: readonly RoleTerm[], roleId: string, studentIds: readonly string[], date: string, newId: () => string): RoleTerm[] {
  const keep = new Set(studentIds)
  const out: RoleTerm[] = []
  const now = new Set<string>()
  for (const t of terms) {
    if (t.roleId !== roleId || !active(t, date)) {
      out.push(t)
      continue
    }
    if (keep.has(t.studentId)) {
      out.push(t)
      now.add(t.studentId)
    } else if (t.from < date) out.push({ ...t, to: addDays(date, -1) })
    // 그날 시작한 기간은 버린다
  }
  for (const id of studentIds) if (!now.has(id)) out.push({ id: newId(), roleId, studentId: id, from: date })
  return out
}

/**
 * 다음 사람으로 돌리기: 역할마다 지금 맡은 사람 수만큼, 맡은 사람 가운데 가장 뒤 번호의 다음 학생들이 date부터 맡는다
 * (명단 끝에서는 처음으로). 맡은 사람이 없는 역할은 그대로.
 */
export function rotateRoles(terms: readonly RoleTerm[], roles: readonly ClassRole[], order: readonly string[], date: string, newId: () => string): RoleTerm[] {
  if (!order.length) return [...terms]
  let out = [...terms]
  for (const r of roles) {
    const now = holdersOn(out, r.id, date).filter((id) => order.includes(id))
    if (!now.length) continue
    const k = Math.min(now.length, order.length)
    const last = Math.max(...now.map((id) => order.indexOf(id)))
    const next = Array.from({ length: k }, (_, i) => order[(last + 1 + i) % order.length])
    out = assignRole(out, r.id, next, date, newId)
  }
  return out
}

/** 역할 지우기: 그 역할의 기간 기록도 함께 */
export function removeRole(roles: readonly ClassRole[], terms: readonly RoleTerm[], roleId: string): { roles: ClassRole[]; terms: RoleTerm[] } {
  return { roles: roles.filter((r) => r.id !== roleId), terms: terms.filter((t) => t.roleId !== roleId) }
}

/** 한 학생이 맡았던 역할 (처음 맡은 순, 같은 역할은 한 번) — 세특 근거 · 학생 화면 */
export function rolesOfStudent(roles: readonly ClassRole[], terms: readonly RoleTerm[], studentId: string): { role: ClassRole; from: string; to?: string; times: number }[] {
  const byRole = new Map<string, { from: string; to?: string; times: number }>()
  for (const t of [...terms].filter((x) => x.studentId === studentId).sort((a, b) => a.from.localeCompare(b.from))) {
    const prev = byRole.get(t.roleId)
    if (!prev) byRole.set(t.roleId, { from: t.from, to: t.to, times: 1 })
    else byRole.set(t.roleId, { from: prev.from, to: !t.to || !prev.to ? undefined : t.to > prev.to ? t.to : prev.to, times: prev.times + 1 })
  }
  const out: { role: ClassRole; from: string; to?: string; times: number }[] = []
  for (const [roleId, v] of byRole) {
    const role = roles.find((r) => r.id === roleId)
    if (role) out.push({ role, ...v })
  }
  return out
}

/** 세특 초안 한 문장: 수업에서 ‘교구 담당’ 역할을 맡아 교구를 준비하고 정리함 */
export function roleSentence(r: { name: string; duty?: string }): string {
  const duty = r.duty?.trim().replace(/[.。]\s*$/, '')
  return duty ? `수업에서 ‘${r.name}’ 역할을 맡아 ${duty}` : `수업에서 ‘${r.name}’ 역할을 맡음`
}
