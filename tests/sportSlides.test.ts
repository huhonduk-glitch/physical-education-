import { describe, expect, it } from 'vitest'
import { SPORTS } from '../src/data/sports'
import { PHOTOS } from '../src/data/sportPhotos'
import { buildSlides, PER_SLIDE } from '../src/lib/sportSlides'

describe('종목 슬라이드', () => {
  it('표지 → 절마다(많으면 나눠서) → 출처, 빠지는 줄 없음', () => {
    for (const g of SPORTS) {
      const s = buildSlides(g)
      expect(s[0].kind).toBe('title')
      expect(s.at(-1)!.kind).toBe('sources')
      const items = s.flatMap((x) => (x.kind === 'content' ? x.items : []))
      expect(items.length).toBe(g.sections.reduce((n, sec) => n + sec.items.length, 0))
      for (const x of s) if (x.kind === 'content') expect(x.items.length).toBeLessThanOrEqual(PER_SLIDE)
    }
  })
  it('쓰인 사진은 모두 등록돼 있고 출처 장에 저작자 · 라이선스가 나온다', () => {
    for (const g of SPORTS) {
      const keys = [...(g.cover ? [g.cover] : []), ...g.sections.flatMap((x) => (x.figure?.kind === 'photo' ? [x.figure.photo] : []))]
      for (const k of keys) expect(PHOTOS[k], `${g.id}: ${k}`).toBeTruthy()
      const src = buildSlides(g).at(-1)!
      if (src.kind === 'sources') for (const p of src.photos) expect(p.license.length * p.credit.length).toBeGreaterThan(0)
    }
  })
  it('모든 종목: 줄마다 글이 있고, 출처가 하나 이상', () => {
    for (const g of SPORTS) {
      expect(g.sources.length).toBeGreaterThan(0)
      for (const sec of g.sections) for (const it of sec.items) expect(it.t.trim().length).toBeGreaterThan(5)
    }
  })
})
