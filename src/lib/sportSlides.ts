import type { Figure, GuideItem, GuideSource, Spec, SportGuide } from '../data/sports'
import { SPORT_GROUPS } from '../data/sports'
import { SPORT_KEYS, type KeyRule, type Quiz } from '../data/sportKeys'
import { PHOTOS, type SportPhoto } from '../data/sportPhotos'

/**
 * 종목 자료 → 슬라이드 (2026-10-30 다시 짬: 교사가 준 강의 사이트처럼 검은 화면 · 큰 사진 · 큰 제목 · 누를 때마다 하나씩).
 * 순서: 표지 → 핵심 규칙 한눈에 → 핵심 규칙 한 장씩(그림) → 절마다(장 번호) → O/X 퀴즈 → 출처.
 * 앱 안 슬라이드와 PPT 받기가 같은 목록을 쓴다. 한 장에 글이 많으면 읽히지 않으니 줄이 많은 절은 나눈다.
 */
export type Slide =
  | { kind: 'cover'; title: string; sub: string; group: string; cover?: SportPhoto; keys: string[] }
  | { kind: 'keys'; title: string; keys: KeyRule[] }
  | { kind: 'key'; no: number; total: number; key: KeyRule }
  | { kind: 'section'; chapter: number; title: string; part?: string; lead?: string; items: GuideItem[]; specs?: Spec[]; figure?: Figure }
  | { kind: 'quiz'; no: number; total: number; quiz: Quiz }
  | { kind: 'sources'; title: string; sources: GuideSource[]; photos: SportPhoto[] }

export const PER_SLIDE = 5
export const PER_SLIDE_WITH_FIGURE = 4

/** 그 장에서 [다음]을 몇 번 눌러야 다 보이는지 (0 = 처음부터 다 보임) */
export function stepsOf(s: Slide): number {
  switch (s.kind) {
    case 'key':
      return s.key.why ? 2 : 1
    case 'section':
      return s.items.length + (s.specs?.length ? 1 : 0)
    case 'quiz':
      return 1
    default:
      return 0
  }
}

export function buildSlides(g: SportGuide): Slide[] {
  const k = SPORT_KEYS[g.id]
  const keys = k?.keys ?? []
  const out: Slide[] = [{ kind: 'cover', title: g.name, sub: g.summary, group: SPORT_GROUPS.find((x) => x.id === g.group)?.name ?? '', cover: g.cover ? PHOTOS[g.cover] : undefined, keys: keys.map((x) => x.title) }]
  if (keys.length) {
    out.push({ kind: 'keys', title: `${g.name.replace(/\s*\(.*\)\s*$/, '')}다운 규칙 ${keys.length}가지`, keys })
    keys.forEach((key, i) => out.push({ kind: 'key', no: i + 1, total: keys.length, key }))
  }
  g.sections.forEach((s, si) => {
    const per = s.figure || s.specs?.length ? PER_SLIDE_WITH_FIGURE : PER_SLIDE
    const chunks: GuideItem[][] = []
    for (let i = 0; i < s.items.length; i += per) chunks.push(s.items.slice(i, i + per))
    if (!chunks.length) chunks.push([])
    chunks.forEach((items, i) =>
      out.push({
        kind: 'section',
        chapter: si + 1,
        title: s.title,
        part: chunks.length > 1 ? `${i + 1}/${chunks.length}` : undefined,
        lead: i === 0 ? s.lead : undefined,
        items,
        // 규격 표 · 그림은 첫 장에만
        specs: i === 0 ? s.specs : undefined,
        figure: i === 0 ? s.figure : undefined,
      }),
    )
  })
  const quiz = k?.quiz ?? []
  quiz.forEach((q, i) => out.push({ kind: 'quiz', no: i + 1, total: quiz.length, quiz: q }))
  const used = new Set<string>([...(g.cover ? [g.cover] : []), ...g.sections.flatMap((s) => (s.figure?.kind === 'photo' ? [s.figure.photo] : []))])
  out.push({ kind: 'sources', title: '출처', sources: g.sources, photos: [...used].map((x) => PHOTOS[x]).filter(Boolean) })
  return out
}
