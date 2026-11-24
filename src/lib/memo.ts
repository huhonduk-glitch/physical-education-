import type { HomeMemo } from '../db/settings'

/**
 * 홈 메모 (2026-11-25, 슈퍼스쿨 홈 메모 참고 — 코드는 새로 씀). 순수 함수만.
 * 첫 줄 = 제목, 나머지 = 내용. 새 메모가 앞에 온다.
 */

/** 메모 색: 노랑 · 보라 · 청록 · 파랑 (글자색 fg · 바탕 bg) */
export const MEMO_TONES = [
  { name: '노랑', fg: '#8a5a00', bg: '#fff4d6' },
  { name: '보라', fg: '#6b3fc4', bg: '#f0eafd' },
  { name: '청록', fg: '#0d7a70', bg: '#e3f5f2' },
  { name: '파랑', fg: '#1d5fd6', bg: '#e8f0fe' },
] as const

export const memoTone = (t: number) => MEMO_TONES[((t % MEMO_TONES.length) + MEMO_TONES.length) % MEMO_TONES.length]

/** 첫 줄(빈 줄 건너뜀) = 제목, 그 뒤 = 내용 */
export function splitMemo(text: string): { title: string; body: string } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const i = lines.findIndex((l) => l.trim())
  if (i < 0) return { title: '', body: '' }
  return { title: lines[i].trim(), body: lines.slice(i + 1).join('\n').trim() }
}

/** 메모 저장: 글이 비면 지운다. 있던 메모면 그 자리에서 고치고, 새 메모면 맨 앞에 */
export function saveMemo(list: readonly HomeMemo[], m: { id: string; text: string; tone: number }, now: number): HomeMemo[] {
  const text = m.text.trim()
  const at = list.findIndex((x) => x.id === m.id)
  if (!text) return at < 0 ? [...list] : list.filter((x) => x.id !== m.id)
  if (at < 0) return [{ id: m.id, text, tone: m.tone, createdAt: now, updatedAt: now }, ...list]
  return list.map((x) => (x.id === m.id ? { ...x, text, tone: m.tone, updatedAt: now } : x))
}

export function removeMemo(list: readonly HomeMemo[], id: string): HomeMemo[] {
  return list.filter((x) => x.id !== id)
}
