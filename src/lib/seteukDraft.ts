import type { AssessItem, Assessment, ClassRecord, Keyword } from '../db/types'

/**
 * 세특 틀 초안 (6-5 ③). 순수 함수. 인터넷 안 씀.
 * 교사가 남긴 기록(칭찬 항목 · 메모 · 키워드 · 체육부장 활동 · 수행평가 등급 기준)만 정해 둔 틀에 넣는다.
 * 기록에 없는 활동 · 성과는 만들지 않는다. 초안은 출발점이고, 교사가 자기 문장으로 고친다.
 */

/** 받침이 있으면 true (마지막 글자가 한글일 때) */
export function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return /[13678lmnr]$/i.test(ch) // 숫자·영문 대충
  return code % 28 !== 0
}
export const iGa = (w: string) => `${w}${hasBatchim(w) ? '이' : '가'}`
export const eulReul = (w: string) => `${w}${hasBatchim(w) ? '을' : '를'}`
export const euroRo = (w: string) => {
  const ch = w.trim().slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  const rieul = code >= 0 && code <= 11171 && code % 28 === 8
  return `${w}${hasBatchim(w) && !rieul ? '으로' : '로'}`
}

/** 문장 끝을 마침표로 */
export function sentence(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return /[.!?。]$/.test(t) ? t : `${t}.`
}

export interface DraftInput {
  records: readonly ClassRecord[]
  keywords: readonly Keyword[]
  /** 이 학생이 받은 평가와 채점값 */
  assessments: readonly { a: Assessment; items: readonly AssessItem[]; scores: Record<string, string | number> | undefined }[]
  captainRoles: readonly string[]
}

export interface DraftPart {
  kind: 'praise' | 'keyword' | 'note' | 'captain' | 'assess'
  text: string
}

export function draftParts(inp: DraftInput, opts: { maxNotes?: number } = {}): DraftPart[] {
  const parts: DraftPart[] = []
  const kw = new Map(inp.keywords.map((k) => [k.id, k.label]))
  // 1) 칭찬(솔선수범) 항목: 두 번 넘게 받은 것
  const praise = new Map<string, number>()
  for (const r of inp.records) if (r.type === 'exemplary' && r.category !== '기타') praise.set(r.category, (praise.get(r.category) ?? 0) + 1)
  const topPraise = [...praise.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)
  if (topPraise.length) parts.push({ kind: 'praise', text: sentence(`수업 중 ${topPraise.join('·')} 면에서 꾸준히 모범을 보임`) })
  // 2) 키워드 (칭찬 · 관찰 · 부장 활동에 붙인 것, 많이 붙은 순 3개)
  const kc = new Map<string, number>()
  for (const r of inp.records) if (r.type !== 'unprepared') for (const id of r.keywordIds) if (kw.has(id)) kc.set(kw.get(id)!, (kc.get(kw.get(id)!) ?? 0) + 1)
  const topKw = [...kc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l)
  if (topKw.length) parts.push({ kind: 'keyword', text: sentence(`${iGa(topKw.join(', '))} 돋보임`) })
  // 3) 체육부장 활동
  const capCats = [...new Set(inp.records.filter((r) => r.type === 'captain' && r.category !== '기타').map((r) => r.category))].slice(0, 3)
  if (inp.captainRoles.length) parts.push({ kind: 'captain', text: sentence(capCats.length ? `${euroRo(inp.captainRoles[0])}서 ${eulReul(capCats.join('·'))} 맡아 수행함` : `${euroRo(inp.captainRoles[0])} 활동함`) })
  // 4) 교사가 적은 메모 (관찰 · 칭찬 · 부장 활동, 최근 순) — 교사 문장 그대로
  const notes = inp.records
    .filter((r) => r.type !== 'unprepared' && r.note?.trim())
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, opts.maxNotes ?? 4)
    .reverse()
  for (const r of notes) parts.push({ kind: 'note', text: sentence(r.note!) })
  // 5) 수행평가: 등급표 요소에서 받은 등급의 판단 기준(루브릭 · 계획서 문장)
  for (const { a, items, scores } of inp.assessments) {
    for (const it of items) {
      if (it.method !== 'level') continue
      const got = scores?.[it.id]
      const lv = it.levels?.find((l) => l.label === String(got))
      if (lv?.desc) parts.push({ kind: 'assess', text: sentence(`「${a.title}」에서 ${lv.desc.replace(/[.]\s*$/, '')}`) })
    }
  }
  return parts
}

export function draftText(parts: readonly DraftPart[]): string {
  return parts.map((p) => p.text).join(' ')
}
