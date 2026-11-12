import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { changeCount, installSyncHooks, readSyncConf, type SyncConf } from '../db/syncState'
import { IS_DEMO } from '../lib/demo'
import { DriveError, GOOGLE_CLIENT_ID, preloadGis } from '../lib/gdrive'
import { SYNC_EVENT, ensureToken, isAutoUp, resultNote, runSync, sessionToken, syncedCount } from '../state/driveSync'

const DISMISS_KEY = 'pelog.driveBarDismissed'
/** 마지막으로 고친 뒤 이만큼 조용하면 자동으로 올린다 */
const QUIET_MS = 30_000

/**
 * 앱 전체 구글 동기화 도우미 (2026-11-13):
 * - 지운 기록 잡기(Dexie 훅)를 앱을 켤 때 건다
 * - 구글 동기화를 켰고 이 탭에 구글 연결이 살아 있으면: 기록하고 잠시 조용하면 · 앱을 내릴 때 자동으로 올린다(자동 올리기를 끈 경우 빼고)
 * - 연결이 없으면(앱을 새로 연 뒤) 맨 위에 [내려받기] 한 줄 — 다른 기기에서 한 기록을 먼저 받는다. 구글 정책상 선생님이 한 번 눌러야 한다
 */
export default function DriveSyncAgent() {
  const [conf, setConf] = useState<SyncConf | null>(null)
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
  const [done, setDone] = useState('')
  const lastSeen = useRef(0)
  const lastChangeAt = useRef(0)

  useEffect(() => {
    void installSyncHooks(db)
    const load = () =>
      void readSyncConf(db)
        .then(setConf)
        .catch(() => setConf(null))
    load()
    const onSync = () => {
      load()
      setHasToken(!!sessionToken())
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [])

  // 자동 올리기 (연결이 살아 있을 때만, 버튼 없이)
  const auto = isAutoUp(conf) && !IS_DEMO && !!GOOGLE_CLIENT_ID
  useEffect(() => {
    if (!auto) return
    const up = async () => {
      try {
        await runSync(db, 'up', false)
      } catch (e) {
        if (e instanceof DriveError && e.kind === 'auth') setHasToken(false)
      }
    }
    const tick = () => {
      const c = changeCount(db)
      if (c !== lastSeen.current) {
        lastSeen.current = c
        lastChangeAt.current = Date.now()
      }
      if (!sessionToken() || c === syncedCount()) return
      if (Date.now() - lastChangeAt.current >= QUIET_MS) void up()
    }
    lastSeen.current = changeCount(db)
    const id = setInterval(tick, 5_000)
    const onHide = () => {
      if (document.visibilityState === 'hidden' && sessionToken() && changeCount(db) !== syncedCount()) void up()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [auto])

  // 결과 한 줄은 잠깐 보이고 사라진다
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(''), 6_000)
    return () => clearTimeout(t)
  }, [done])

  const showBar = !!conf?.enabled && !!GOOGLE_CLIENT_ID && !IS_DEMO && ((!hasToken && !dismissed) || !!done)
  useEffect(() => {
    if (showBar) preloadGis()
  }, [showBar])
  if (!showBar) return null

  const pull = async () => {
    setBusy(true)
    setMsg('')
    try {
      await ensureToken(true) // 구글 로그인 창을 먼저 (팝업 차단 방지)
      const r = await runSync(db, 'down', true)
      setHasToken(true)
      if (r) setDone(resultNote('down', r))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '내려받지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  const close = () => {
    setDone('')
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 무시 */
    }
  }
  return (
    <div className="flex items-center gap-2 border-b border-line bg-brand-light px-4 py-2 text-sm print:hidden" role="status">
      <span className={`min-w-0 flex-1 font-bold ${msg ? 'text-danger' : 'text-brand-ink'}`}>
        {done || msg || '구글 동기화 · 다른 기기에서 기록했다면 먼저 내려받으세요'}
      </span>
      {!done && (
        <button type="button" className="btn btn-primary h-9 min-h-0 shrink-0 px-3 text-sm" disabled={busy} onClick={() => void pull()}>
          {busy ? '받는 중…' : '내려받기'}
        </button>
      )}
      <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-sm text-ink-3" aria-label="닫기" onClick={close}>
        닫기
      </button>
    </div>
  )
}
