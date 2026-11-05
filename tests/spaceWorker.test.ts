import { describe, expect, it } from 'vitest'
// @ts-expect-error 순수 JS (Cloudflare Worker)
import worker, { hashPass, newCode, validItem } from '../relay/space/space-worker.js'

/** Worker가 쓰는 SQL만 흉내 내는 아주 작은 D1 */
function fakeD1() {
  const spaces = new Map<string, { code: string; name: string; pass_hash: string; salt: string; created: number }>()
  const items = new Map<string, { space: string; col: string; id: string; data: string; updated: number; by: string }>()
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const stmt = {
      bind: (...a: unknown[]) => ((args = a), stmt),
      first: async () => {
        if (sql.startsWith('SELECT 1 FROM spaces')) return spaces.has(args[0] as string) ? { 1: 1 } : null
        if (sql.startsWith('SELECT code, name')) return spaces.get(args[0] as string) ?? null
        if (sql.startsWith('SELECT COUNT')) return { n: [...items.values()].filter((r) => r.space === args[0]).length }
        throw new Error(sql)
      },
      all: async () => ({ results: [...items.values()].filter((r) => r.space === args[0] && r.col === args[1]).sort((a, b) => a.updated - b.updated) }),
      run: async () => {
        if (sql.startsWith('INSERT INTO spaces')) {
          const [code, name, pass_hash, salt, created] = args as [string, string, string, string, number]
          spaces.set(code, { code, name, pass_hash, salt, created })
        } else if (sql.startsWith('INSERT INTO items')) {
          const [space, col, id, data, updated, by] = args as [string, string, string, string, number, string]
          items.set(`${space}|${col}|${id}`, { space, col, id, data, updated, by })
        } else if (sql.startsWith('DELETE FROM items')) items.delete(`${args[0]}|${args[1]}|${args[2]}`)
        else throw new Error(sql)
        return {}
      },
    }
    return stmt
  }
  return { prepare }
}

const ORIGIN = 'https://huhonduk-glitch.github.io'
const call = (env: unknown, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://pelog-space.example${path}`, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }), env)

describe('학교 공유 공간 Worker', () => {
  it('비밀번호는 PBKDF2로 · 코드는 헷갈리는 글자 없이 8글자', async () => {
    expect(await hashPass('abc123', 's')).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashPass('abc123', 's')).not.toBe(await hashPass('abc124', 's'))
    expect(newCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/)
  })
  it('올릴 줄 검사: 묶음 · id · 크기 · 학생 정보', () => {
    expect(validItem('lend', 'abcd1', { gear: '농구공' })).toBeNull()
    expect(validItem('scores', 'abcd1', {})).not.toBeNull()
    expect(validItem('lend', 'x', {})).not.toBeNull()
    expect(validItem('lend', 'abcd1', { studentId: 's1' })).toBe('학생 정보는 올릴 수 없어요')
    expect(validItem('lend', 'abcd1', { memo: 'x'.repeat(3000) })).toBe('자료가 너무 커요')
  })
  it('만들기 → 확인 → 올리기 → 읽기 → 지우기, 비밀번호 틀리면 막음', async () => {
    const env = { DB: fakeD1() }
    const made = await (await call(env, 'POST', '/create', { name: '시연고', pass: 'secret1' })).json()
    expect(made.code).toMatch(/^[A-Z0-9]{8}$/)
    expect((await call(env, 'POST', '/check', { code: made.code, pass: 'wrong12' })).status).toBe(401)
    expect((await (await call(env, 'POST', '/check', { code: made.code, pass: 'secret1' })).json()).name).toBe('시연고')
    const H = { 'X-Space-Code': made.code, 'X-Space-Pass': 'secret1' }
    expect((await call(env, 'PUT', '/items', { col: 'gear', id: 'gear01', data: { name: '농구공', qty: 20 }, by: '김선생' }, H)).status).toBe(200)
    const list = await (await call(env, 'GET', '/items?col=gear', undefined, H)).json()
    expect(list.items).toEqual([expect.objectContaining({ id: 'gear01', data: { name: '농구공', qty: 20 }, by: '김선생' })])
    expect((await call(env, 'GET', '/items?col=gear', undefined, { ...H, 'X-Space-Pass': 'nope' })).status).toBe(401)
    await call(env, 'DELETE', '/items?col=gear&id=gear01', undefined, H)
    expect((await (await call(env, 'GET', '/items?col=gear', undefined, H)).json()).items).toEqual([])
  })
  it('앱 주소에서 온 요청만 CORS 허락', async () => {
    const env = { DB: fakeD1() }
    const r = await call(env, 'OPTIONS', '/items')
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const bad = await worker.fetch(new Request('https://x/items', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env)
    expect(bad.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.example')
  })
})
