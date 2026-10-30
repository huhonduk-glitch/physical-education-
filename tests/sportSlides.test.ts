import { describe, expect, it } from 'vitest'
import { SPORTS } from '../src/data/sports'
import { PHOTOS } from '../src/data/sportPhotos'
import { buildSlides, PER_SLIDE, stepsOf } from '../src/lib/sportSlides'
import { SPORT_KEYS } from '../src/data/sportKeys'
import { NETBALL_AREAS } from '../src/components/RuleVisual'

describe('종목 슬라이드', () => {
  it('표지 → 절마다(많으면 나눠서) → 출처, 빠지는 줄 없음', () => {
    for (const g of SPORTS) {
      const s = buildSlides(g)
      expect(s[0].kind).toBe('cover')
      expect(s.at(-1)!.kind).toBe('sources')
      const items = s.flatMap((x) => (x.kind === 'section' ? x.items : []))
      expect(items.length).toBe(g.sections.reduce((n, sec) => n + sec.items.length, 0))
      for (const x of s) if (x.kind === 'section') expect(x.items.length).toBeLessThanOrEqual(PER_SLIDE)
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
  it('종목마다 핵심 규칙 3가지 이상 · 퀴즈 2개 이상, 조항이 있고 슬라이드에 들어감', () => {
    for (const g of SPORTS) {
      const k = SPORT_KEYS[g.id]
      expect(k, g.id).toBeTruthy()
      expect(k.keys.length).toBeGreaterThanOrEqual(3)
      expect(k.quiz.length).toBeGreaterThanOrEqual(2)
      for (const x of [...k.keys, ...k.quiz]) expect(x.ref.trim().length, g.id).toBeGreaterThan(0)
      const s = buildSlides(g)
      expect(s[1].kind).toBe('keys')
      expect(s.filter((x) => x.kind === 'key').length).toBe(k.keys.length)
      expect(s.filter((x) => x.kind === 'quiz').length).toBe(k.quiz.length)
    }
  })
  it('넷볼: 몸싸움 없음 · 드리블 없음 · 포지션 구역이 핵심 규칙에 있고, 구역은 규칙서 그림대로', () => {
    const t = SPORT_KEYS.netball.keys.map((k) => k.title).join(' ')
    expect(t).toContain('몸싸움 없음')
    expect(t).toContain('드리블 없음')
    expect(t).toContain('포지션마다 구역')
    // World Netball Rules 2024 규칙 3 그림: 1 공격 골 서클 · 2 공격 서드 · 3 센터 · 4 수비 서드 · 5 수비 골 서클
    expect(Object.fromEntries(Object.entries(NETBALL_AREAS).map(([p, v]) => [p, v.areas.join('')]))).toEqual({ GS: '12', GA: '123', WA: '23', C: '234', WD: '34', GD: '345', GK: '45' })
  })
  it('누를 때마다 한 줄씩: 절은 줄 수(+규격 칸), 퀴즈는 정답 1번', () => {
    const s = buildSlides(SPORTS.find((g) => g.id === 'netball')!)
    for (const x of s) {
      if (x.kind === 'section') expect(stepsOf(x)).toBe(x.items.length + (x.specs?.length ? 1 : 0))
      if (x.kind === 'quiz') expect(stepsOf(x)).toBe(1)
      if (x.kind === 'cover' || x.kind === 'sources') expect(stepsOf(x)).toBe(0)
    }
  })
})
