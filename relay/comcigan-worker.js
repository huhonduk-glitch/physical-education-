/**
 * PE LOG 컴시간 중계 (Cloudflare Worker, 무료 요금제로 충분).
 * 컴시간알리미(comci.net:4082)는 http만 되고 CORS가 없어 PE LOG(https)에서 바로 부를 수 없다 → 이 중계를 거친다.
 * - 컴시간 주소 중 정해진 꼴(첫 화면 /st, 숫자 경로 + 질의)만 받아 그대로 전달한다. 다른 사이트로는 못 간다.
 * - 오가는 것: 학교 이름 · 학교 코드 · 컴시간 공개 시간표(과목 · 교사 이름 · 강의실). 학생 정보 없음. 아무것도 저장 · 기록하지 않는다(캐시 10분 제외).
 * - 같은 요청은 10분 동안 Cloudflare 캐시로 돌려준다 → 컴시간에 부담을 덜 주고 무료 한도(하루 10만 요청)를 아낀다.
 * 사용: GET https://<worker 주소>/?p=<컴시간 경로>   예) ?p=/st  ·  ?p=/36179?17384l%bb%ef
 */
const ORIGIN = 'http://comci.net:4082'
const ALLOWED = /^\/(st|\d{3,8}(\?[A-Za-z0-9%=+/_l-]{0,400})?)$/
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (request.method !== 'GET') return new Response('GET only', { status: 405, headers: CORS })
    const url = new URL(request.url)
    const p = url.searchParams.get('p') ?? ''
    if (!ALLOWED.test(p)) return new Response('허용하지 않는 경로', { status: 400, headers: CORS })

    const cache = caches.default
    const key = new Request(`https://comci-cache.local${p}`)
    const hit = await cache.match(key)
    if (hit) return hit

    const res = await fetch(ORIGIN + p, { headers: { 'User-Agent': 'Mozilla/5.0 (PE LOG relay)', Referer: `${ORIGIN}/st` } })
    const body = await res.arrayBuffer()
    const out = new Response(body, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=600' },
    })
    if (res.ok) ctx.waitUntil(cache.put(key, out.clone()))
    return out
  },
}
