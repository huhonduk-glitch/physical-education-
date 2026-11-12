/**
 * 구글 동기화 조종 (백업 화면 · 앱 맨 위 줄이 같이 쓴다).
 * 구글 토큰은 이 탭(sessionStorage)에만, 약 1시간 — 기기에 오래 남기지 않는다.
 */
import { TABLE_LABELS } from '../db/backup'
import type { PeDatabase } from '../db/db'
import { pullNow, pushNow, type SyncResult } from '../db/driveSync'
import { changeCount, readSyncConf, writeSyncConf, type SyncConf } from '../db/syncState'
import { DriveError, driveApi, requestDriveToken, type DriveToken } from '../lib/gdrive'

const TOKEN_KEY = 'pelog.driveToken'
export const SYNC_EVENT = 'pelog-drive-sync'

export function sessionToken(): DriveToken | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as DriveToken | null
    return t && t.expiresAt > Date.now() ? t : null
  } catch {
    return null
  }
}
export function saveSessionToken(t: DriveToken | null): void {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t))
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 무시 */
  }
}

/** 토큰: 이 탭에 살아 있으면 그것, 아니면 (버튼 안에서만) 구글 로그인 창 */
export async function ensureToken(interactive: boolean): Promise<DriveToken | null> {
  const t = sessionToken()
  if (t) return t
  if (!interactive) return null
  const fresh = await requestDriveToken()
  saveSessionToken(fresh)
  window.dispatchEvent(new CustomEvent(SYNC_EVENT))
  return fresh
}

/** 이 기기 이름 (구글 사본에 '마지막으로 올린 기기'로) */
export function deviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const kind = /iPad|Tablet/i.test(ua) ? '태블릿' : /Mobi|Android|iPhone/i.test(ua) ? '휴대폰' : 'PC'
  return `${kind}-${Math.random().toString(36).slice(2, 6)}`
}

/** 마지막으로 구글과 같아진 때의 바뀜 수 — 자동 올리기는 이것과 다를 때만 */
let syncedAt = 0
export const syncedCount = () => syncedAt

export const isAutoUp = (c: SyncConf | null) => !!c?.enabled && c.autoUp !== false

/** 결과 한 줄 (사람이 읽는 말) */
export function resultNote(kind: 'up' | 'down', r: SyncResult): string {
  if (kind === 'up') return r.empty ? '구글에 처음 올렸어요' : r.lines.length ? `구글에 올렸어요 · ${r.lines.join(' · ')}` : '구글에 올렸어요 · 새로 더한 것 없음'
  if (r.empty) return '구글에 아직 올린 자료가 없어요. 자료가 있는 기기에서 먼저 [올리기]를 눌러 주세요.'
  return r.lines.length ? `내려받았어요 · ${r.lines.join(' · ')}` : '내려받았어요 · 이미 같아요(새로 받은 것 없음)'
}

/**
 * 올리기 · 내려받기 한 번 하고 결과를 설정에 적는다.
 * interactive면 토큰이 없을 때 구글 로그인 창을 연다(선생님이 누른 버튼 안에서만).
 */
export async function runSync(db: PeDatabase, kind: 'up' | 'down', interactive: boolean): Promise<SyncResult | null> {
  const conf = await readSyncConf(db)
  if (!conf?.enabled) return null
  const tok = await ensureToken(interactive)
  if (!tok) return null
  const before = changeCount(db)
  try {
    const opts = { pass: conf.pass, device: conf.device, labels: TABLE_LABELS }
    const r = kind === 'up' ? await pushNow(db, driveApi(tok.token), opts) : await pullNow(db, driveApi(tok.token), opts)
    // 올리기: 올리기 전까지의 바뀜은 구글에 갔다 / 내려받기: 받아서 바뀐 것은 다시 올릴 필요 없다
    syncedAt = kind === 'up' ? before : changeCount(db)
    const now = Date.now()
    await writeSyncConf(db, {
      ...((await readSyncConf(db)) ?? conf),
      ...(kind === 'up' ? { upAt: now } : { downAt: now }),
      ...(r.remote ? { remoteAt: r.remote.savedAt, remoteDevice: r.remote.device } : {}),
      lastNote: resultNote(kind, r),
    })
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    return r
  } catch (e) {
    if (e instanceof DriveError && e.kind === 'auth') saveSessionToken(null)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    throw e
  }
}
