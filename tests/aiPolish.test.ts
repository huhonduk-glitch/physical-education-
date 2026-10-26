import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, draftPrompt, loadRouterModels, manualPromptText, OPENROUTER_URL, polishPrompt, runAi, type AiSettings } from '../src/lib/aiPolish'

const base: AiSettings = { provider: 'openrouter', claudeApiKey: '', openrouterApiKey: 'sk-or-x', openrouterModel: 'test/model:free', styleExamples: '' }
afterEach(() => vi.unstubAllGlobals())

describe('세특 AI 요청문', () => {
  it('다듬기: 규칙 · 문체 예시(내용은 가져오지 말 것) · 초안', () => {
    const p = polishPrompt({ text: '랠리를 주도함.', studentName: '김가명', subject: '체육', styleExamples: '예시 문장임.' })
    expect(p.system).toContain('다듬기만 하고 새로 쓰지 않습니다')
    expect(p.system).toContain('500자')
    expect(p.system).toContain('<예시>\n예시 문장임.\n</예시>')
    expect(p.system).toContain('내용(다른 학생의 활동')
    expect(p.user).toBe('학생: 김가명\n과목: 체육\n교사 초안:\n랠리를 주도함.')
  })
  it('초안: 근거 기록만, 예시가 없으면 예시 칸도 없음', () => {
    const p = draftPrompt({ evidence: ['9/1 관찰 — 하이클리어 자세 교정'], subject: '체육' })
    expect(p.system).toContain('근거 기록만으로')
    expect(p.system).not.toContain('<예시>')
    expect(p.user).toContain('- 9/1 관찰 — 하이클리어 자세 교정')
    expect(manualPromptText(p)).toContain('---')
  })
})

describe('OpenRouter 연결', () => {
  it('요청 모양 · 답 꺼내기', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ model: 'test/model:free', choices: [{ message: { content: '"다듬은 글임."' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await runAi(base, { system: 'S', user: 'U' })
    expect(r).toEqual({ text: '다듬은 글임.', model: 'test/model:free' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(OPENROUTER_URL)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-x')
    expect(JSON.parse(init.body as string)).toEqual({ model: 'test/model:free', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] })
  })
  it('오류를 쉬운 말로: 키 · 잔액 · 사용량', async () => {
    for (const [status, word] of [
      [401, '키가 맞지 않아요'],
      [402, '크레딧'],
      [429, '요청이 많아요'],
    ] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
      await expect(runAi(base, { system: 'S', user: 'U' })).rejects.toThrow(word)
    }
  })
  it('키 · 모델이 없거나 키 없이 쓰기면 보내지 않음', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    await expect(runAi({ ...base, openrouterApiKey: '' }, { system: '', user: '' })).rejects.toBeInstanceOf(AiError)
    await expect(runAi({ ...base, openrouterModel: '' }, { system: '', user: '' })).rejects.toThrow('모델')
    await expect(runAi({ ...base, provider: 'manual' }, { system: '', user: '' })).rejects.toThrow('요청문 복사')
    expect(f).not.toHaveBeenCalled()
  })
  it('모델 목록: 무료 먼저, 값은 100만 토큰당 달러', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: 'a/paid', name: 'Paid', pricing: { prompt: '0.000002', completion: '0.00001' } },
              { id: 'b/free:free', name: 'Free', pricing: { prompt: '0', completion: '0' } },
              { id: 'a/paid:batch', name: 'Batch', pricing: { prompt: '0.000001', completion: '0.000005' } },
            ],
          }),
        ),
      ),
    )
    const list = await loadRouterModels()
    expect(list.map((m) => [m.id, m.free])).toEqual([
      ['b/free:free', true],
      ['a/paid', false],
    ])
    expect(list[1].inPrice).toBeCloseTo(2)
    expect(list[1].outPrice).toBeCloseTo(10)
  })
})
