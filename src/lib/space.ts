/**
 * 학교 공유 공간 (CLAUDE.md 0-4 예외 · 6-13, 2026-11-05 교사 결정): 같은 학교 체육 선생님끼리 교구 대여 장부 · 체육관 예약.
 * 교사 Cloudflare 계정의 Worker(relay/space) + D1. 공유 코드 + 비밀번호를 아는 사람만.
 * 올리는 것: 교구 이름 · 수량 · 선생님 이름 · 날짜 · 교시 · 장소 · 짧은 메모. **학생 정보는 올리지 않는다.**
 */

export const SPACE_URL_DEFAULT = 'https://pelog-space.huhonduk.workers.dev'

export interface SpaceConn {
  url: string
  code: string
  pass: string
  /** 학교 이름 (공간 이름) */
  name: string
  /** 기록에 남길 내 이름 */
  me: string
}

export type SpaceCol = 'gear' | 'lend' | 'book'

export interface SpaceRow<T> {
  id: string
  data: T
  updated: number
  by: string
}

export interface Gear {
  name: string
  qty: number
  /** 보관 장소 (체육창고 등) */
  place?: string
}
export interface Lend {
  gearId: string
  gearName: string
  qty: number
  teacher: string
  /** 빌린 날 · 반납 예정 (YYYY-MM-DD) */
  from: string
  due: string
  returned?: string
  memo?: string
}
export interface Booking {
  place: string
  date: string
  period: number
  teacher: string
  purpose?: string
}

export class SpaceError extends Error {}

async function call<T>(c: Pick<SpaceConn, 'url' | 'code' | 'pass'> | { url: string }, method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if ('code' in c) {
    headers['X-Space-Code'] = c.code
    headers['X-Space-Pass'] = c.pass
  }
  let res: Response
  try {
    res = await fetch(`${c.url.replace(/\/$/, '')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new SpaceError('공유 공간에 연결하지 못했어요. 인터넷을 확인해 주세요.')
  }
  const j = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new SpaceError(j.error ?? `공유 공간 오류 (${res.status})`)
  return j
}

export const createSpace = (url: string, name: string, pass: string) => call<{ code: string }>({ url }, 'POST', '/create', { name, pass })
export const checkSpace = (url: string, code: string, pass: string) => call<{ name: string }>({ url }, 'POST', '/check', { code: code.trim().toUpperCase(), pass })
export const listItems = <T>(c: SpaceConn, col: SpaceCol) => call<{ items: SpaceRow<T>[] }>(c, 'GET', `/items?col=${col}`).then((r) => r.items)
export const putItem = <T>(c: SpaceConn, col: SpaceCol, id: string, data: T) => call<{ updated: number }>(c, 'PUT', '/items', { col, id, data, by: c.me })
export const deleteItem = (c: SpaceConn, col: SpaceCol, id: string) => call<{ ok: true }>(c, 'DELETE', `/items?col=${col}&id=${encodeURIComponent(id)}`)

export const rowId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** 선생님께 보낼 초대 글 (코드만. 비밀번호는 따로 말로 전하게) */
export function inviteText(c: Pick<SpaceConn, 'name' | 'code'>): string {
  return `PE LOG 학교 공유 공간 '${c.name}'에 들어와 주세요.\n[업무 → 공유 공간 연결 → 코드로 들어가기]에서 공유 코드 ${c.code} 와 비밀번호(따로 알려 드려요)를 넣으면 교구 대여 장부 · 체육관 예약을 같이 봐요.`
}

// ── 순수 계산 ──

/** 대여 상태: 반납함 · 늦음(반납 예정일 지남) · 빌림 */
export function lendStatus(l: Lend, today: string): 'returned' | 'overdue' | 'out' {
  if (l.returned) return 'returned'
  return l.due < today ? 'overdue' : 'out'
}

/** 교구마다 지금 남은 수량 = 전체 − 반납 안 한 대여 수량 */
export function gearLeft(gear: readonly SpaceRow<Gear>[], lends: readonly SpaceRow<Lend>[]): Map<string, number> {
  const m = new Map(gear.map((g) => [g.id, g.data.qty]))
  for (const l of lends) if (!l.data.returned && m.has(l.data.gearId)) m.set(l.data.gearId, (m.get(l.data.gearId) ?? 0) - l.data.qty)
  return m
}

/** 예약 칸 찾기: 장소 · 날짜 · 교시가 같은 예약 */
export function bookingAt(list: readonly SpaceRow<Booking>[], place: string, date: string, period: number): SpaceRow<Booking> | undefined {
  return list.find((b) => b.data.place === place && b.data.date === date && b.data.period === period)
}

/** 같은 장소 · 날짜 · 교시에 두 개 이상(동시에 눌러 생긴 겹침) */
export function bookingClashes(list: readonly SpaceRow<Booking>[]): string[] {
  const seen = new Map<string, number>()
  for (const b of list) {
    const k = `${b.data.place}|${b.data.date}|${b.data.period}`
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k)
}

/** 그 주 월~금 날짜 */
export function weekDates(anyDate: string): string[] {
  const d = new Date(anyDate)
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(mon)
    x.setDate(mon.getDate() + i)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
}
