/**
 * PE LOG 학교 공유 공간 (CLAUDE.md 0-4 예외 · 6-13, 2026-11-05 교사 결정 '학교 공유 공간').
 * 같은 학교 체육 선생님끼리 교구 대여 장부 · 체육관 예약을 함께 본다.
 * - 교사 본인 Cloudflare 계정의 Worker + D1. 컴시간 중계(pelog-comcigan)와 따로 둔다
 * - 학교 공유 코드 + 비밀번호(PBKDF2로 저장)를 아는 사람만 읽고 쓴다
 * - 올리는 것: 교구 이름 · 수량 · 빌린 선생님 이름 · 날짜 · 교시 · 장소 · 짧은 메모. 학생 정보는 받지 않는다
 *   (앱이 학생 칸을 만들지 않고, 여기서도 줄 크기 · 묶음 이름 · 개수를 막는다)
 * API (JSON):
 *   POST /create  { name, pass }            → { code }
 *   POST /check   { code, pass }            → { name }
 *   GET  /items?col=gear|lend|book           (헤더 X-Space-Code · X-Space-Pass) → { items: [{ id, data, updated, by }] }
 *   PUT  /items   { col, id, data, by }      (헤더 같음) → { ok: true, updated }
 *   DELETE /items?col=…&id=…                 (헤더 같음) → { ok: true }
 */

const COLS = new Set(['gear', 'lend', 'book'])
const MAX_ITEM = 2000 // 줄 하나 JSON 글자 수
const MAX_ROWS = 3000 // 공간 하나의 줄 수 (묶음 합)
const ORIGINS = [/^https:\/\/[a-z0-9-]+\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]

function cors(origin) {
  const ok = origin && ORIGINS.some((re) => re.test(origin))
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://github.io',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Space-Code, X-Space-Pass',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } })

const enc = new TextEncoder()
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256)
  return hex(bits)
}

export function newCode() {
  // 헷갈리는 글자(0 O 1 I L) 빼고 8글자
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(8))
  return [...r].map((x) => abc[x % abc.length]).join('')
}

export function validItem(col, id, data) {
  if (!COLS.has(col)) return '알 수 없는 묶음'
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return '잘못된 id'
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '잘못된 자료'
  const s = JSON.stringify(data)
  if (s.length > MAX_ITEM) return '자료가 너무 커요'
  if (/"(studentId|studentIds|students|scores)"\s*:/.test(s)) return '학생 정보는 올릴 수 없어요'
  return null
}

async function auth(env, request) {
  const code = (request.headers.get('X-Space-Code') ?? '').trim().toUpperCase()
  const pass = request.headers.get('X-Space-Pass') ?? ''
  if (!/^[A-Z0-9]{8}$/.test(code) || !pass) return null
  const row = await env.DB.prepare('SELECT code, name, pass_hash, salt FROM spaces WHERE code = ?').bind(code).first()
  if (!row) return null
  return (await hashPass(pass, row.salt)) === row.pass_hash ? row : null
}

export default {
  async fetch(request, env) {
    const h = cors(request.headers.get('Origin'))
    if (request.method === 'OPTIONS') return new Response(null, { headers: h })
    const url = new URL(request.url)
    try {
      if (url.pathname === '/create' && request.method === 'POST') {
        const { name, pass } = await request.json()
        if (typeof name !== 'string' || !name.trim() || name.length > 60) return json({ error: '학교 이름을 적어 주세요' }, 400, h)
        if (typeof pass !== 'string' || pass.length < 6 || pass.length > 64) return json({ error: '비밀번호는 6글자 이상' }, 400, h)
        const salt = newCode() + newCode()
        let code = newCode()
        for (let i = 0; i < 3 && (await env.DB.prepare('SELECT 1 FROM spaces WHERE code = ?').bind(code).first()); i++) code = newCode()
        await env.DB.prepare('INSERT INTO spaces (code, name, pass_hash, salt, created) VALUES (?, ?, ?, ?, ?)').bind(code, name.trim(), await hashPass(pass, salt), salt, Date.now()).run()
        return json({ code }, 200, h)
      }
      if (url.pathname === '/check' && request.method === 'POST') {
        const { code, pass } = await request.json()
        const fake = new Request(request.url, { headers: { 'X-Space-Code': String(code ?? ''), 'X-Space-Pass': String(pass ?? '') } })
        const sp = await auth(env, fake)
        return sp ? json({ name: sp.name }, 200, h) : json({ error: '공유 코드나 비밀번호가 맞지 않아요' }, 401, h)
      }
      if (url.pathname === '/items') {
        const sp = await auth(env, request)
        if (!sp) return json({ error: '공유 코드나 비밀번호가 맞지 않아요' }, 401, h)
        if (request.method === 'GET') {
          const col = url.searchParams.get('col') ?? ''
          if (!COLS.has(col)) return json({ error: '알 수 없는 묶음' }, 400, h)
          const { results } = await env.DB.prepare('SELECT id, data, updated, by FROM items WHERE space = ? AND col = ? ORDER BY updated').bind(sp.code, col).all()
          return json({ name: sp.name, items: results.map((r) => ({ id: r.id, data: JSON.parse(r.data), updated: r.updated, by: r.by })) }, 200, h)
        }
        if (request.method === 'PUT') {
          const { col, id, data, by } = await request.json()
          const bad = validItem(col, id, data)
          if (bad) return json({ error: bad }, 400, h)
          const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE space = ?').bind(sp.code).first()
          if ((count?.n ?? 0) >= MAX_ROWS) return json({ error: '공간이 가득 찼어요. 지난 기록을 지워 주세요' }, 400, h)
          const now = Date.now()
          await env.DB.prepare(
            'INSERT INTO items (space, col, id, data, updated, by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(space, col, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, by = excluded.by',
          )
            .bind(sp.code, col, id, JSON.stringify(data), now, String(by ?? '').slice(0, 30))
            .run()
          return json({ ok: true, updated: now }, 200, h)
        }
        if (request.method === 'DELETE') {
          const col = url.searchParams.get('col') ?? ''
          const id = url.searchParams.get('id') ?? ''
          if (!COLS.has(col)) return json({ error: '알 수 없는 묶음' }, 400, h)
          await env.DB.prepare('DELETE FROM items WHERE space = ? AND col = ? AND id = ?').bind(sp.code, col, id).run()
          return json({ ok: true }, 200, h)
        }
      }
      return json({ error: '없는 주소' }, 404, h)
    } catch (e) {
      return json({ error: '서버 오류' }, 500, h)
    }
  },
}
