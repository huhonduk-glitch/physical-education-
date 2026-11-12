import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { changeCount, installSyncHooks, readSyncConf } from '../db/syncState'
import { IS_DEMO } from '../lib/demo'
import { DriveError, GOOGLE_CLIENT_ID, preloadGis } from '../lib/gdrive'
import { SYNC_EVENT, ensureToken, runSync, sessionToken } from '../state/driveSync'

const DISMISS_KEY = 'pelog.driveBarDismissed'
const QUIET_MS = 45_000

/**
 * 앱 전체 드라이브 맞추기 도우미 (2026-11-13):
 * - 지운 기록 잡기(Dexie 훅)를 앱을 켤 때 건다
 * - 맞추기를 켰고 이 탭에 구글 토큰이 살아 있으면: 기록이 바뀐 뒤 잠시 조용하면 · 앱을 내릴 때 자동으로 맞춘다
 * - 토큰이 없으면(앱을 새로 연 뒤) 맨 위에 [맞추기] 한 줄 — 구글 정책상 선생님이 한 번 눌러야 한다
 */
export default function DriveSyncAgent() {
  const [enabled, setEnabled] = useState(false)
  const [hasToken, setHasToken] = useState(() => !!sessionToken())
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const seen = useRef(0)
  const lastRun = useRef(0)

  useEffect(() => {
    void installSyncHooks(db)
    const load = () =>
      void readSyncConf(db)
        .then((c) => setEnabled(!!c?.enabled))
        .catch(() => setEnabled(false))
    load()
    const onSync = () => {
      load()
      setHasToken(!!sessionToken())
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [])

  // 자동 맞추기 (토큰이 있을 때만, 버튼 없이)
  useEffect(() => {
    if (!enabled || IS_DEMO) return
    const tick = async (force = false) => {
      if (!sessionToken()) return setHasToken(false)
      const c = changeCount(db)
      if (c === seen.current) return
      if (!force && Date.now() - lastRun.current < QUIET_MS) return
      seen.current = c
      lastRun.current = Date.now()
      try {
        await runSync(db, false)
      } catch (e) {
        if (e instanceof DriveError && e.kind === 'auth') setHasToken(false)
      }
    }
    seen.current = changeCount(db)
    const id = setInterval(() => void tick(), 15_000)
    const onHide = () => document.visibilityState === 'hidden' && void tick(true)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [enabled])

  const showBar = enabled && !!GOOGLE_CLIENT_ID && !IS_DEMO && !hasToken && !dismissed
  useEffect(() => {
    if (showBar) preloadGis()
  }, [showBar])
  if (!showBar) return null

  const go = async () => {
    setBusy(true)
    setMsg('')
    try {
      await ensureToken(true) // 구글 로그인 창을 먼저 (팝업 차단 방지)
      await runSync(db, true)
      seen.current = changeCount(db)
      lastRun.current = Date.now()
      setHasToken(true)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '맞추지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 무시 */
    }
  }
  return (
    <div className="flex items-center gap-2 border-b border-line bg-brand-light px-4 py-2 text-sm print:hidden" role="status">
      <span className="min-w-0 flex-1 font-bold text-brand-ink">{msg || '구글 드라이브와 맞추기 — 앱을 연 뒤 한 번 눌러 주세요'}</span>
      <button type="button" className="btn btn-primary h-9 min-h-0 shrink-0 px-3 text-sm" disabled={busy} onClick={() => void go()}>
        {busy ? '맞추는 중…' : '맞추기'}
      </button>
      <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-sm text-ink-3" aria-label="이번에는 닫기" onClick={close}>
        닫기
      </button>
    </div>
  )
}
