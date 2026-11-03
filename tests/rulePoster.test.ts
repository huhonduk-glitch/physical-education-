import { describe, expect, it } from 'vitest'
import { SPORTS } from '../src/data/sports'
import { SPORT_KEYS } from '../src/data/sportKeys'
import { SPORT_POSTERS } from '../src/data/sportPosters'
import { existsSync } from 'fs'
import { fitText, POSTER_H, POSTER_W, posterLayout, posterRows, textWidth, wrapText } from '../src/lib/rulePoster'
import { rulePosterSvg } from '../src/components/RulePoster'
import { buildSlides } from '../src/lib/sportSlides'

describe('핵심 규칙 한 장 그림', () => {
  it('카드 배치: 3 · 5 한 줄, 4 = 2 × 2, 7 = 4 + 3 · 카드가 그림 안에, 겹치지 않음', () => {
    expect(posterRows(3)).toEqual([3])
    expect(posterRows(4)).toEqual([2, 2])
    expect(posterRows(5)).toEqual([5])
    expect(posterRows(7)).toEqual([4, 3])
    for (const n of [3, 4, 5, 6, 7]) {
      const cards = posterLayout(n)
      expect(cards.length).toBe(n)
      for (const c of cards) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(POSTER_W)
        expect(c.y + c.h).toBeLessThanOrEqual(POSTER_H)
        expect(c.vis.x + c.vis.w).toBeLessThanOrEqual(c.x + c.w)
        expect(c.text.w).toBeGreaterThan(100)
      }
    }
  })
  it('줄바꿈: 띄어쓰기 단위, 줄마다 폭 안 · 상자에 맞는 글자 크기', () => {
    const lines = wrapText('공을 잡은 선수는 3초 안에 패스하거나 슛해야 해요.', 200, 24)
    expect(lines.join(' ')).toBe('공을 잡은 선수는 3초 안에 패스하거나 슛해야 해요.')
    for (const l of lines) expect(textWidth(l, 24)).toBeLessThanOrEqual(200)
    const t = fitText('가'.repeat(80), undefined, 300, 120)
    expect(t.lines.length * t.size * 1.38).toBeLessThanOrEqual(120 + 1)
  })
  it('모든 종목: 그림이 만들어지고 핵심 규칙 제목 · 조항이 들어감, 슬라이드 2번째 장', () => {
    for (const g of SPORTS) {
      const svg = rulePosterSvg(g)
      expect(svg.startsWith('<svg')).toBe(true)
      for (const k of SPORT_KEYS[g.id].keys) {
        expect(svg, g.id).toContain(k.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;'))
        expect(svg, g.id).toContain(`[${k.ref}]`)
      }
      expect(buildSlides(g)[1].kind).toBe('poster')
    }
  })
  it('선생님 그림 파일이 있고 슬라이드 · 출처에 들어감', () => {
    for (const [id, ps] of Object.entries(SPORT_POSTERS)) {
      const g = SPORTS.find((s) => s.id === id)!
      const s = buildSlides(g)
      for (const p of ps) {
        expect(existsSync(`public/${p.src}`), p.src).toBe(true)
        expect(s.some((x) => x.kind === 'poster' && x.poster?.src === p.src)).toBe(true)
      }
      const src = s[s.length - 1]
      expect(src.kind === 'sources' && src.posters.length).toBe(ps.length)
    }
  })
})
