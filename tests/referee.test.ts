import { describe, expect, it } from 'vitest'
import { REF_BOARDS, searchCalls } from '../src/data/refCalls'
import { SPORTS } from '../src/data/sports'
import { knownRefs, parseRefAnswer, refPrompt, refTokens, ruleDigest } from '../src/lib/refAi'

const netball = SPORTS.find((g) => g.id === 'netball')!

describe('빠른 판정판', () => {
  it('경기 종목(기술형 빼고)마다 판정 버튼 6개 이상, 칸이 다 차 있고 id가 겹치지 않음', () => {
    for (const g of SPORTS.filter((x) => x.group !== 'skill')) {
      const b = REF_BOARDS[g.id]
      expect(b, g.id).toBeTruthy()
      expect(b.calls.length).toBeGreaterThanOrEqual(6)
      expect(new Set(b.calls.map((c) => c.id)).size).toBe(b.calls.length)
      for (const c of b.calls) for (const k of ['name', 'verdict', 'restart', 'ref'] as const) expect(c[k].trim().length, `${g.id} ${c.id} ${k}`).toBeGreaterThan(0)
    }
  })
  it('넷볼: 접촉 · 방해는 페널티 패스, 재소유(드리블) · 풋워크 · 3초 · 오프사이드는 프리 패스 (World Netball 2024)', () => {
    const v = Object.fromEntries(REF_BOARDS.netball.calls.map((c) => [c.id, c.verdict]))
    expect(v.contact).toContain('페널티 패스')
    expect(v.obstruction).toContain('페널티 패스')
    for (const id of ['repossession', 'footwork', 'held', 'offside', 'overthird', 'shortpass']) expect(v[id]).toContain('프리 패스')
  })
  it('찾기: 학생들이 하는 말로', () => {
    expect(searchCalls(REF_BOARDS.netball, '드리블').map((c) => c.id)).toEqual(['repossession'])
    expect(searchCalls(REF_BOARDS.basketball, '공 들고 걸음').map((c) => c.id)).toContain('travel')
    expect(searchCalls(REF_BOARDS.football, '').length).toBe(REF_BOARDS.football.calls.length)
  })
})

describe('AI 보조심판', () => {
  it('조항 낱말 나누기', () => {
    expect(refTokens('규칙 11.6 · 13')).toEqual(['11.6', '13'])
    expect(refTokens('Law 12 · 13')).toEqual(['law12', 'law13'])
    expect(refTokens('제25 · 22조')).toEqual(['25', '22'])
    expect(refTokens('Law 12 (2025/26)')).toEqual(['law12'])
  })
  it('요청문: 규칙 요약 · 우리 반 규칙 · 상황, 요약 안에 넷볼 핵심 규칙과 판정판이 있음', () => {
    const p = refPrompt({ sportName: '넷볼', digest: ruleDigest(netball), situation: '공을 한 번 튕기고 다시 잡았어요', houseRules: '쿼터 7분' })
    expect(p.system).toContain('[규칙 11.6]')
    expect(p.system).toContain('재소유 (드리블)')
    expect(p.system).toContain('unsure')
    expect(p.user).toBe('우리 반 규칙:\n쿼터 7분\n\n상황: 공을 한 번 튕기고 다시 잡았어요')
  })
  it('답 읽기: JSON만 꺼내고, 앱 자료에 없는 조항은 확인 필요', () => {
    const known = knownRefs(netball)
    const a = parseRefAnswer('네, 판정은\n```json\n{"verdict":"재소유 — 프리 패스","reason":"공을 놓은 뒤 다시 잡았어요.","restart":"상대가 그 자리에서 패스","refs":["규칙 11.6","규칙 99"],"confidence":"높음","unsure":false}\n```', known)
    expect(a?.verdict).toBe('재소유 — 프리 패스')
    expect(a?.unknownRefs).toEqual(['규칙 99'])
    expect(a?.confidence).toBe('높음')
    expect(parseRefAnswer('모르겠어요', known)).toBeNull()
    expect(parseRefAnswer('{"verdict":"","refs":[]}', known)).toBeNull()
  })
})
