import type { AttendStatus } from '../db/types'
import { ATTEND_LABEL, ATTEND_ORDER } from './attendance'

/**
 * 빠른 입력 (2026-11-11 교사 승인 — 스쿨보드 '말로 심부름' 참고).
 * "3 7 체육복" · "12 견학 부상" · "5번 지각" · "가람 결석"처럼 적은 글을 정해진 규칙으로만 읽는다.
 * AI · 인터넷을 쓰지 않는다(학생 정보가 기기 밖으로 나가지 않음, 0-4). 순수 함수.
 * 읽은 결과는 화면에서 확인한 뒤에만 저장한다.
 */

export const ABSENCE_REASONS = ['부상', '생리', '질병', '기타'] as const
export type AbsenceReason = (typeof ABSENCE_REASONS)[number]

export type SayAction =
  | { kind: 'check'; type: 'exemplary' | 'unprepared'; label: string }
  | { kind: 'attend'; status: AttendStatus }
  | { kind: 'absence'; reason: AbsenceReason }

export interface SayMember {
  id: string
  /** 카드 번호 (학적반 번호 · 수강반 학번) */
  no: string
  name: string
}

export type SayResult = { ok: true; students: SayMember[]; action: SayAction } | { ok: false; error: string }

const TYPE_WORD: Record<string, 'exemplary' | 'unprepared'> = { 칭찬: 'exemplary', 지도: 'unprepared' }
const squash = (s: string) => s.replace(/\s+/g, '')

/** 무엇을 기록할지 화면에 보여 줄 글 */
export function actionLabel(a: SayAction): string {
  if (a.kind === 'attend') return `출결 · ${ATTEND_LABEL[a.status]}`
  if (a.kind === 'absence') return `견학 · ${a.reason}`
  return `${a.type === 'exemplary' ? '칭찬' : '지도'} · ${a.label}`
}

function findMember(token: string, members: readonly SayMember[]): SayMember[] | string {
  const exact = members.filter((m) => m.name === token)
  if (exact.length === 1) return exact
  if (exact.length > 1) return `'${token}' 학생이 ${exact.length}명이에요. 번호로 적어 주세요.`
  // 성을 뺀 이름 (두 글자 이상일 때만)
  if (token.length >= 2) {
    const given = members.filter((m) => m.name.length > token.length && m.name.slice(-token.length) === token)
    if (given.length === 1) return given
    if (given.length > 1) return `'${token}' 학생이 ${given.length}명이에요. 번호로 적어 주세요.`
  }
  return []
}

/**
 * 글 읽기. members = 이 수업반 학생, items = 칭찬 · 지도 항목(기록 버튼).
 * 규칙: 학생(번호 · 번호 범위 3~7 · 이름) 여러 개 + 할 일 하나.
 *  - 출결: 결석 · 지각 · 조퇴 · 결과
 *  - 견학: '견학' (+ 부상 · 생리 · 질병 · 기타, 없으면 기타)
 *  - 칭찬 · 지도 항목 이름(띄어쓰기 무시, 앞부분만 적어도 하나로 정해지면 됨). 같은 이름이 양쪽에 있으면 '칭찬' · '지도'를 같이 적는다
 */
export function parseSay(text: string, members: readonly SayMember[], items: readonly { type: 'exemplary' | 'unprepared'; label: string }[]): SayResult {
  const tokens = text
    .replace(/[,·、]/g, ' ')
    .replace(/(\d)\s*번/g, '$1 ')
    .replace(/(\d)\s*[~\-–]\s*(\d)/g, '$1~$2')
    .split(/\s+/)
    .filter(Boolean)
  if (!tokens.length) return { ok: false, error: '예: 3 7 체육복 · 12 견학 부상 · 5 지각' }

  const picked = new Map<string, SayMember>()
  const byNo = new Map(members.map((m) => [m.no, m]))
  const words: string[] = []
  for (const t of tokens) {
    const range = /^(\d+)~(\d+)$/.exec(t)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (a > b || b - a > 60) return { ok: false, error: `'${t}' 범위를 읽지 못했어요.` }
      for (let n = a; n <= b; n++) {
        const m = byNo.get(String(n))
        if (m) picked.set(m.id, m) // 범위 안의 빈 번호(전출 등)는 건너뛴다
      }
      continue
    }
    if (/^\d+$/.test(t)) {
      const m = byNo.get(String(Number(t))) ?? byNo.get(t)
      if (!m) return { ok: false, error: `${t}번 학생이 이 반에 없어요.` }
      picked.set(m.id, m)
      continue
    }
    words.push(t)
  }

  // 낱말: 출결 · 견학 · 항목을 먼저 찾고, 남는 낱말은 학생 이름으로 본다
  let action: SayAction | null = null
  let typeHint: 'exemplary' | 'unprepared' | null = null
  let absence = false
  let reason: AbsenceReason | null = null
  const rest: string[] = []
  const setAction = (a: SayAction): string | null => {
    if (action) return `할 일은 하나만 적어 주세요 (${actionLabel(action)} / ${actionLabel(a)}).`
    action = a
    return null
  }
  for (const w of words) {
    const status = ATTEND_ORDER.find((s) => ATTEND_LABEL[s] === w)
    if (status) {
      const err = setAction({ kind: 'attend', status })
      if (err) return { ok: false, error: err }
    } else if (w === '견학') absence = true
    else if (TYPE_WORD[w]) typeHint = TYPE_WORD[w]
    else rest.push(w)
  }
  const unknown: string[] = []
  for (const w of rest) {
    if (absence && (ABSENCE_REASONS as readonly string[]).includes(w)) {
      reason = w as AbsenceReason
      continue
    }
    const key = squash(w)
    let hit = items.filter((i) => squash(i.label) === key)
    if (!hit.length && key.length >= 2) hit = items.filter((i) => squash(i.label).startsWith(key))
    if (typeHint) hit = hit.filter((i) => i.type === typeHint)
    if (hit.length === 1) {
      const err = setAction({ kind: 'check', type: hit[0].type, label: hit[0].label })
      if (err) return { ok: false, error: err }
      continue
    }
    if (hit.length > 1) {
      const types = new Set(hit.map((i) => i.type))
      return { ok: false, error: types.size > 1 ? `'${w}'는 칭찬 · 지도 양쪽에 있어요. '칭찬 ${w}'처럼 적어 주세요.` : `'${w}'로 시작하는 항목이 여러 개예요: ${hit.map((i) => i.label).join(', ')}` }
    }
    const who = findMember(w, members)
    if (typeof who === 'string') return { ok: false, error: who }
    if (who.length) picked.set(who[0].id, who[0])
    else unknown.push(w)
  }
  if (unknown.length) return { ok: false, error: `'${unknown.join("', '")}'을(를) 모르겠어요. 학생 번호 · 이름이나 항목 이름을 확인해 주세요.` }
  if (absence) {
    const err = setAction({ kind: 'absence', reason: reason ?? '기타' })
    if (err) return { ok: false, error: err }
  }
  if (!picked.size) return { ok: false, error: '학생 번호나 이름을 적어 주세요.' }
  if (!action) return { ok: false, error: '무엇을 기록할지 적어 주세요 (항목 이름 · 견학 · 결석 · 지각 · 조퇴 · 결과).' }
  const students = [...picked.values()].sort((a, b) => Number(a.no) - Number(b.no) || a.no.localeCompare(b.no))
  return { ok: true, students, action }
}
