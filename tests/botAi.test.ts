import { describe, expect, it } from 'vitest'
import { BOT_FAQ } from '../src/data/botFaq'
import { maskNames } from '../src/lib/aiPolish'
import { botDigest, botPrompt, parseBotAnswer } from '../src/lib/botAi'

describe('땅콩이 AI 답', () => {
  it('요청문: 사용법 목록과 질문만, 긴 질문은 자름', () => {
    const p = botPrompt('명렬을 어떻게 올려요?')
    expect(p.user).toContain('[start]')
    expect(p.user).toContain('명렬을 어떻게 올려요?')
    expect(p.system).toContain('지어내지')
    expect(botPrompt('가'.repeat(2000)).user.length).toBeLessThan(botDigest().length + 700)
  })
  it('학생 이름은 보내기 전에 가림', () => {
    const q = maskNames('김가람 학생 견학 기록은 어디서 봐요?', ['김가람'])
    expect(botPrompt(q).user).not.toContain('가람')
  })
  it('답 읽기: 바로가기는 고른 항목에 있는 것만', () => {
    const a = parseBotAnswer('```json\n{"answer":"① 명렬을 올려요.","ids":["[start]","없는것"],"unsure":false}\n```')!
    expect(a.text).toBe('① 명렬을 올려요.')
    const start = BOT_FAQ.find((x) => x.id === 'start')!
    expect(a.links.map((l) => l.to)).toEqual(start.links!.map((l) => l.to).slice(0, 4))
  })
  it('모름이면 바로가기 없음, 못 읽으면 null', () => {
    const a = parseBotAnswer('{"answer":"그건 사용법에 없어서 잘 모르겠어요.","ids":["start"],"unsure":true}')!
    expect(a.unsure).toBe(true)
    expect(a.links).toEqual([])
    expect(parseBotAnswer('죄송해요')).toBeNull()
    expect(parseBotAnswer('{"answer":""}')).toBeNull()
  })
})
