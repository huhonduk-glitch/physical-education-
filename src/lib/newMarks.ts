import type { ChangeEntry } from './changelog'

/**
 * 메뉴의 '새 기능' 점 (2026-11-12 교사 승인 — 스쿨보드 메뉴의 NEW 표시 참고).
 * 업데이트 소식(public/changelog.json)의 화면 주소(to)를 그대로 쓴다. 따로 관리하는 목록이 없다.
 * 번잡하지 않게: 가장 최근 소식 2개 · 14일 안의 것만, 그 화면을 한 번 열면 사라진다. 순수 함수.
 */

export const NEW_DAYS = 14
export const NEW_ENTRIES = 2
export const NEW_SEEN_KEY = 'pelog.newSeen'

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

/** 새 기능이 있는 화면 주소 → 그 소식 날짜. 홈('/')은 뺀다(점을 붙일 메뉴가 아님) */
export function newRoutes(entries: readonly ChangeEntry[], today: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const e of entries.slice(0, NEW_ENTRIES)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue
    const d = dayDiff(e.date, today)
    if (d < 0 || d > NEW_DAYS) continue
    for (const i of e.items) if (i.to && i.to !== '/' && !out.has(i.to)) out.set(i.to, e.date)
  }
  return out
}

/** 본 표시: '주소@소식 날짜' (나중 소식이 같은 화면을 또 가리키면 다시 뜬다) */
export const seenKey = (to: string, date: string) => `${to}@${date}`

/** 아직 안 열어 본 새 화면 주소 */
export function unseenRoutes(routes: ReadonlyMap<string, string>, seen: readonly string[]): Set<string> {
  const s = new Set(seen)
  return new Set([...routes].filter(([to, date]) => !s.has(seenKey(to, date))).map(([to]) => to))
}

/** 지금 주소를 열었을 때 본 것으로 칠 주소 (주소가 같거나 그 아래 화면) */
export function visitedRoutes(routes: ReadonlyMap<string, string>, pathname: string): string[] {
  return [...routes.keys()].filter((to) => pathname === to || pathname.startsWith(`${to}/`))
}

/** 저장할 본 표시 목록 (지금 살아 있는 주소 것만 남겨 계속 쌓이지 않게) */
export function nextSeen(routes: ReadonlyMap<string, string>, seen: readonly string[], visited: readonly string[]): string[] {
  const alive = new Set([...routes].map(([to, date]) => seenKey(to, date)))
  const out = new Set(seen.filter((k) => alive.has(k)))
  for (const to of visited) {
    const date = routes.get(to)
    if (date) out.add(seenKey(to, date))
  }
  return [...out]
}
