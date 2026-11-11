import { useEffect, useSyncExternalStore } from 'react'
import { loadChangelog } from '../lib/changelog'
import { todayStr } from '../lib/dates'
import { NEW_SEEN_KEY, newRoutes, nextSeen, unseenRoutes, visitedRoutes } from '../lib/newMarks'

/** 메뉴의 '새 기능' 점: 업데이트 소식에서 한 번만 읽고, 본 표시는 이 기기에 둔다 */
const BASE = import.meta.env.BASE_URL
const EMPTY: ReadonlySet<string> = new Set()

let routes: Map<string, string> = new Map()
let unseen: ReadonlySet<string> = EMPTY
let started = false
const listeners = new Set<() => void>()

const readSeen = (): string[] => {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(NEW_SEEN_KEY) ?? '[]')
    return Array.isArray(x) ? x.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}
const recompute = () => {
  const next = unseenRoutes(routes, readSeen())
  unseen = next.size ? next : EMPTY
  for (const l of listeners) l()
}
const start = () => {
  if (started) return
  started = true
  void loadChangelog(BASE, false).then((entries) => {
    routes = newRoutes(entries, todayStr())
    recompute()
  })
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  start()
  return () => listeners.delete(l)
}

/** 아직 안 열어 본 새 화면 주소 모음. pathname을 주면 그 화면은 본 것으로 표시한다 */
export function useNewMarks(pathname?: string): ReadonlySet<string> {
  const set = useSyncExternalStore(subscribe, () => unseen)
  useEffect(() => {
    if (pathname === undefined || !set.size) return
    const visited = visitedRoutes(routes, pathname)
    if (!visited.some((to) => set.has(to))) return
    try {
      localStorage.setItem(NEW_SEEN_KEY, JSON.stringify(nextSeen(routes, readSeen(), visited)))
    } catch {
      /* 저장 못 하면 점이 남을 뿐 */
    }
    recompute()
  }, [pathname, set])
  return set
}

/** 작은 표시 (메뉴 이름 옆) */
export const NEW_LABEL = 'NEW'
