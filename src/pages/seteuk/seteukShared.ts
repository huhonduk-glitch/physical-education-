import type { StudentBasis } from '../../db/seteukLevelRepo'
import { maskNames } from '../../lib/aiPolish'
import { basisKeyOf } from '../../lib/seteukDraft'

/** 근거 모양: 쓰는 근거 id (뺀 것 제외) */
export function basisKeyFor(b: StudentBasis, excluded: readonly string[]): string {
  return basisKeyOf([...b.evidence.map((e) => e.id), ...b.parts.map((p) => p.id)].filter((id) => !excluded.includes(id)))
}

/**
 * AI로 보낼 근거 줄: 틀 초안 문장(칭찬 · 키워드 · 부장 · 수행평가 기준) + 근거 기록, 뺀 것 제외, 중요는 '(중요)'.
 * 이름은 이 반 학생 이름 모두 '학생'으로 가린다 (2026-10-30 교사 결정).
 */
export function aiEvidence(b: StudentBasis, o: { important: readonly string[]; excluded: readonly string[]; names: readonly string[] }): string[] {
  const lines = [
    ...b.parts.filter((p) => p.kind !== 'note').map((p) => ({ id: p.id, text: p.text })),
    ...b.evidence.map((e) => ({ id: e.id, text: e.text })),
  ]
  return lines.filter((l) => !o.excluded.includes(l.id)).map((l) => `${o.important.includes(l.id) ? '(중요) ' : ''}${maskNames(l.text, o.names)}`)
}

/** 수준 글자색: 위쪽 파랑, 가운데 회색, 아래쪽은 차분하게(빨강 쓰지 않음 — 낮은 수준도 문제 학생이 아님) */
export function LEVEL_TONE(level: number, count: number): string {
  if (level >= count) return 'text-brand'
  if (level >= Math.ceil((count + 1) / 2)) return 'text-ink'
  return 'text-ink-2'
}
