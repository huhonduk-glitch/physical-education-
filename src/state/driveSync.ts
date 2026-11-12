/**
 * 드라이브 맞추기 조종 (백업 화면 · 앱 전체 도우미가 같이 쓴다).
 * 구글 토큰은 이 탭(sessionStorage)에만, 약 1시간 — 기기에 오래 남기지 않는다.
 */
import { TABLE_LABELS } from '../db/backup'
import type { PeDatabase } from '../db/db'
import { syncNow, type SyncResult } from '../db/driveSync'
import { readSyncConf, writeSyncConf } from '../db/syncState'
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
  return fresh
}

/** 이 기기 이름 (드라이브 파일에 '마지막으로 올린 기기'로) */
export function deviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const kind = /iPad|Tablet/i.test(ua) ? '태블릿' : /Mobi|Android|iPhone/i.test(ua) ? '휴대폰' : 'PC'
  return `${kind}-${Math.random().toString(36).slice(2, 6)}`
}

/** 한 번 맞추고 결과를 설정에 적는다. interactive면 토큰이 없을 때 구글 로그인 창을 연다(버튼 안에서만) */
export async function runSync(db: PeDatabase, interactive: boolean): Promise<SyncResult | null> {
  const conf = await readSyncConf(db)
  if (!conf?.enabled) return null
  const tok = await ensureToken(interactive)
  if (!tok) return null
  try {
    const r = await syncNow(db, driveApi(tok.token), { pass: conf.pass, device: conf.device, labels: TABLE_LABELS })
    await writeSyncConf(db, { ...conf, lastAt: Date.now(), lastNote: r.lines.length ? r.lines.join(' · ') : r.first ? '드라이브에 처음 올렸어요' : '바뀐 것 없이 맞췄어요' })
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    return r
  } catch (e) {
    if (e instanceof DriveError && e.kind === 'auth') saveSessionToken(null)
    throw e
  }
}
