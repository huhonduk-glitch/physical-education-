import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error — Worker 코드는 순수 JS (relay/)
import worker from '../relay/comcigan-worker.js'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const store = new Map<string, Response>()
  vi.stubGlobal('caches', {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  })
  const f = vi.fn(async (_url: string) => new Response('{"ok":1}', { status: 200 }))
  vi.stubGlobal('fetch', f)
  const waits: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) }
  return { f, ctx, waits }
}

describe('컴시간 중계', () => {
  it('정해진 컴시간 경로만 전달하고 CORS를 붙인다', async () => {
    const { f, ctx, waits } = setup()
    // 앱은 컴시간 경로를 encodeURIComponent로 한 번 더 싸서 보낸다
    const url = `https://relay.example/?p=${encodeURIComponent('/36179?17384l%bb%ef')}`
    const res = await worker.fetch(new Request(url), {}, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(f.mock.calls[0][0]).toBe('http://comci.net:4082/36179?17384l%bb%ef')
    await Promise.all(waits)
    // 두 번째는 캐시에서 (컴시간에 다시 가지 않음)
    await worker.fetch(new Request(url), {}, ctx)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('다른 경로 · 다른 사이트 · POST는 막는다', async () => {
    const { f, ctx } = setup()
    for (const p of ['https://evil.example/', '/../etc', '/admin', '//evil.example', '/36179?a b']) {
      const res = await worker.fetch(new Request(`https://relay.example/?p=${encodeURIComponent(p)}`), {}, ctx)
      expect(res.status).toBe(400)
    }
    expect((await worker.fetch(new Request('https://relay.example/?p=/st', { method: 'POST' }), {}, ctx)).status).toBe(405)
    expect(f).not.toHaveBeenCalled()
  })
})

describe('나이스 공용 인증키 중계', () => {
  it('정해진 서비스만, 비밀 키를 붙이고 앱이 보낸 KEY는 버린다', async () => {
    const { f, ctx } = setup()
    const res = await worker.fetch(new Request('https://relay.example/?neis=hisTimetable&ATPT_OFCDC_SC_CODE=T10&SD_SCHUL_CODE=1&KEY=leak&pIndex=1'), { NEIS_KEY: 'secret' }, ctx)
    expect(res.status).toBe(200)
    const u = new URL(f.mock.calls[0][0])
    expect(u.origin + u.pathname).toBe('https://open.neis.go.kr/hub/hisTimetable')
    expect(u.searchParams.get('KEY')).toBe('secret')
    expect(u.searchParams.get('SD_SCHUL_CODE')).toBe('1')
    expect((await worker.fetch(new Request('https://relay.example/?neis=mealServiceDietInfo'), { NEIS_KEY: 'secret' }, ctx)).status).toBe(400)
  })
})
