/**
 * 업데이트 소식 (2026-10-27 교사 요청: 업데이트 알림에서 무엇이 바뀌는지 팝업으로).
 * 내용은 public/changelog.json 하나. 옛 버전 앱도 새 소식을 보여 줄 수 있게 서버에서 새로 받아 온다(학생 정보 없음, 같은 사이트 파일).
 */
export interface ChangeItem {
  text: string
  to?: string
}
export interface ChangeEntry {
  id: string
  date: string
  title: string
  items: ChangeItem[]
}

export const SEEN_KEY = 'pelog.changelogSeen'

export function parseChangelog(x: unknown): ChangeEntry[] {
  const list = (x as { entries?: unknown })?.entries
  if (!Array.isArray(list)) return []
  return list.filter((e): e is ChangeEntry => !!e && typeof e.id === 'string' && typeof e.title === 'string' && Array.isArray(e.items))
}

/** 아직 안 본 소식 (맨 위가 최신). 본 적이 없으면 맨 위 하나만 */
export function unseen(list: readonly ChangeEntry[], seenId: string | null): ChangeEntry[] {
  if (!list.length) return []
  if (!seenId) return [list[0]]
  const i = list.findIndex((e) => e.id === seenId)
  return i < 0 ? [list[0]] : list.slice(0, i)
}

/**
 * 받아 오기. fresh면 서버에서 새로(업데이트 전 — 기기에 저장해 둔 옛 파일 말고), 아니면 기기에 저장된 것(오프라인).
 * ?t= 를 붙이면 앱 파일 저장소(service worker 미리 저장)를 거치지 않는다.
 */
export async function loadChangelog(base: string, fresh: boolean): Promise<ChangeEntry[]> {
  try {
    const res = await fetch(`${base}changelog.json${fresh ? `?t=${Date.now()}` : ''}`, { cache: fresh ? 'no-store' : 'default' })
    return res.ok ? parseChangelog(await res.json()) : []
  } catch {
    return []
  }
}

export function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}
export function writeSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id)
  } catch {
    /* 저장 못 해도 앱은 그대로 */
  }
}
