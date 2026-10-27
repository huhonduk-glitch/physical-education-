import type { Figure, GuideItem, GuideSource, Spec, SportGuide } from '../data/sports'
import { SPORT_GROUPS } from '../data/sports'
import { PHOTOS, type SportPhoto } from '../data/sportPhotos'

/**
 * 종목 자료 → 슬라이드 (2026-10-27 교사 요청: 글만 말고 PPT처럼). 앱 안 슬라이드 보기와 PPT 받기가 같은 목록을 쓴다.
 * 한 장에 글이 너무 많으면 읽히지 않으니, 줄이 많은 절은 여러 장으로 나눈다(그림이 있으면 더 적게).
 */
export type Slide =
  | { kind: 'title'; title: string; sub: string; group: string; cover?: SportPhoto }
  | { kind: 'content'; title: string; part?: string; lead?: string; items: GuideItem[]; specs?: Spec[]; figure?: Figure }
  | { kind: 'sources'; title: string; sources: GuideSource[]; photos: SportPhoto[] }

export const PER_SLIDE = 5
export const PER_SLIDE_WITH_FIGURE = 4

export function buildSlides(g: SportGuide): Slide[] {
  const out: Slide[] = [{ kind: 'title', title: g.name, sub: g.summary, group: SPORT_GROUPS.find((x) => x.id === g.group)?.name ?? '', cover: g.cover ? PHOTOS[g.cover] : undefined }]
  for (const s of g.sections) {
    const per = s.figure || s.specs?.length ? PER_SLIDE_WITH_FIGURE : PER_SLIDE
    const chunks: GuideItem[][] = []
    for (let i = 0; i < s.items.length; i += per) chunks.push(s.items.slice(i, i + per))
    if (!chunks.length) chunks.push([])
    chunks.forEach((items, i) =>
      out.push({
        kind: 'content',
        title: s.title,
        part: chunks.length > 1 ? `${i + 1}/${chunks.length}` : undefined,
        lead: i === 0 ? s.lead : undefined,
        items,
        // 규격 표 · 그림은 첫 장에만
        specs: i === 0 ? s.specs : undefined,
        figure: i === 0 ? s.figure : undefined,
      }),
    )
  }
  const used = new Set<string>([...(g.cover ? [g.cover] : []), ...g.sections.flatMap((s) => (s.figure?.kind === 'photo' ? [s.figure.photo] : []))])
  out.push({ kind: 'sources', title: '출처', sources: g.sources, photos: [...used].map((k) => PHOTOS[k]).filter(Boolean) })
  return out
}
