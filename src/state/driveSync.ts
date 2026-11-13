/**
 * 구글 동기화 조종 (백업 화면 · 앱 맨 위 줄이 같이 쓴다).
 * 구글 토큰은 이 탭(sessionStorage)에만, 약 1시간 — 기기에 오래 남기지 않는다.
 */
import { TABLE_LABELS } from '../db/backup'
import type { PeDatabase } from '../db/db'
import { downloadNow, mergeBothNow, syncStatus, uploadNow, type SyncDone } from '../db/driveSync'
import { changeCount, patchSyncConf, readSyncConf, type SyncConf } from '../db/syncState'
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

export const when = (t?: number | string) =>
  t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

/** 선생님이 누른 것: 올리기 · 내려받기 · 동기화(알아서) */
export type Asked = 'up' | 'down' | 'auto'
/** 실제로 하는 것 (merge = 둘 다 살리기) */
export type Action = 'up' | 'down' | 'merge'
/** 덮어쓰면 기록이 사라질 때 묻는 까닭 */
export type AskReason = 'remote' | 'local' | 'both'

/**
 * 무엇을 할지 (순수 함수). 덮어쓰기로 기록이 사라질 수 있으면 묻는다.
 *  - 올리기: 구글 사본이 그 뒤 다른 기기에서 바뀌었으면 묻는다
 *  - 내려받기: 이 기기에 아직 안 올린 기록이 있으면 묻는다. 둘 다 그대로면 할 것 없음
 *  - 동기화(맨 위 줄): 바뀐 쪽에서 안 바뀐 쪽으로. 둘 다 바뀌었으면 묻는다
 */
export function decide(asked: Asked, st: { remote: boolean; remoteChanged: boolean; localChanged: boolean }): Action | 'none' | 'empty' | { ask: AskReason } {
  const both = st.remoteChanged && st.localChanged
  if (asked === 'up') return st.remoteChanged ? { ask: both ? 'both' : 'remote' } : 'up'
  if (asked === 'down') {
    if (!st.remote) return 'empty'
    if (st.localChanged) return { ask: both ? 'both' : 'local' }
    return st.remoteChanged ? 'down' : 'none'
  }
  if (both) return { ask: 'both' }
  if (st.remoteChanged) return 'down'
  return st.localChanged ? 'up' : 'none'
}

export type Outcome = { kind: 'done'; action: Action | 'none' | 'empty'; note: string; reload: boolean } | { kind: 'ask'; reason: AskReason; remoteAt?: string }

const NOTE = {
  none: '이미 같아요 (구글 사본과 이 기기 자료가 같아요)',
  empty: '구글에 아직 올린 자료가 없어요. 자료가 있는 기기에서 먼저 [올리기]를 눌러 주세요.',
}
function doneNote(action: Action, d: SyncDone): string {
  const tail = d.lines.length ? ` · ${d.lines.join(' · ')}` : ''
  if (action === 'up') return `구글에 올렸어요 (구글 사본을 이 기기 자료로 바꿈)${tail}`
  if (action === 'down') return `구글에서 내려받았어요 (${d.device}에서 ${when(d.savedAt)}에 올린 것)${tail}`
  return `둘 다 살려서 올렸어요${tail || ' · 새로 더한 것 없음'}`
}

/**
 * 올리기 · 내려받기 · 동기화 한 번. force면 묻지 않고 그 일(action)을 한다(선생님이 물음에 답한 뒤).
 * interactive면 토큰이 없을 때 구글 로그인 창을 연다(선생님이 누른 버튼 안에서만).
 */
export async function runSync(db: PeDatabase, asked: Asked | Action, opts: { interactive: boolean; force?: boolean }): Promise<Outcome | null> {
  const conf = await readSyncConf(db)
  if (!conf?.enabled) return null
  const tok = await ensureToken(opts.interactive)
  if (!tok) return null
  const api = driveApi(tok.token)
  try {
    let action: Action
    if (opts.force && asked !== 'auto') action = asked
    else {
      const st = await syncStatus(db, api, conf)
      const d = decide(asked === 'merge' ? 'auto' : asked, { remote: !!st.remote, remoteChanged: st.remoteChanged, localChanged: st.localChanged })
      if (typeof d === 'object') return { kind: 'ask', reason: d.ask, remoteAt: st.remote?.modifiedTime }
      if (d === 'none' || d === 'empty') {
        await patchSyncConf(db, { lastNote: NOTE[d] })
        if (d === 'none') syncedAt = changeCount(db)
        window.dispatchEvent(new CustomEvent(SYNC_EVENT))
        return { kind: 'done', action: d, note: NOTE[d], reload: false }
      }
      action = d
    }
    const before = changeCount(db)
    const sOpts = { pass: conf.pass, device: conf.device, labels: TABLE_LABELS, base: conf }
    const d = action === 'up' ? await uploadNow(db, api, sOpts) : action === 'down' ? await downloadNow(db, api, sOpts) : await mergeBothNow(db, api, sOpts)
    if (!d) {
      await patchSyncConf(db, { lastNote: NOTE.empty })
      window.dispatchEvent(new CustomEvent(SYNC_EVENT))
      return { kind: 'done', action: 'empty', note: NOTE.empty, reload: false }
    }
    // 올리기: 올리기 전까지의 바뀜은 구글에 갔다 / 내려받기 · 합치기: 받아서 바뀐 것은 다시 올릴 필요 없다
    syncedAt = action === 'up' ? before : changeCount(db)
    const now = Date.now()
    const note = doneNote(action, d)
    await patchSyncConf(db, {
      ...d.base,
      ...(action === 'down' ? { downAt: now } : { upAt: now }),
      ...(action === 'merge' ? { downAt: now } : {}),
      remoteAt: d.savedAt,
      remoteDevice: d.device,
      lastNote: note,
    })
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    return { kind: 'done', action, note, reload: action !== 'up' }
  } catch (e) {
    if (e instanceof DriveError && e.kind === 'auth') saveSessionToken(null)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
    throw e
  }
}
