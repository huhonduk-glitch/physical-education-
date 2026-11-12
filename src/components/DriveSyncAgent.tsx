import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { changeCount, installSyncHooks, readSyncConf, type SyncConf } from '../db/syncState'
import { IS_DEMO } from '../lib/demo'
import { DriveError, GOOGLE_CLIENT_ID, preloadGis } from '../lib/gdrive'
import { SYNC_EVENT, isAutoUp, runSync, sessionToken, syncedCount, type AskReason } from '../state/driveSync'
import { takeDoneNote, useSyncRunner } from '../state/useSyncRunner'
import SyncAskSheet from './SyncAskSheet'

const DISMISS_KEY = 'pelog.driveBarDismissed'
/** 마지막으로 고친 뒤 이만큼 조용하면 자동으로 올린다 */
const QUIET_MS = 30_000

/**
 * 앱 전체 구글 동기화 도우미 (2026-11-13, 구글 사본이 기준):
 * - 앱을 연 뒤(구글 연결이 없을 때) 맨 위 한 줄 [동기화]: 바뀐 쪽 → 안 바뀐 쪽(구글이 새로우면 내려받기, 이 기기만 바뀌었으면 올리기),
 *   둘 다 바뀌었으면 묻는다. 구글 정책상 선생님이 한 번 눌러야 한다
 * - 연결이 살아 있으면 기록하고 잠시 조용하면 · 앱을 내릴 때 자동으로 올린다(자동 올리기를 끈 경우 빼고).
 *   구글 사본이 그새 다른 기기에서 바뀌었으면 올리지 않고 맨 위에서 묻는다(덮어써서 사라지지 않게)
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
  const [done, setDone] = useState(() => takeDoneNote())
  const [conflict, setConflict] = useState<{ reason: AskReason; remoteAt?: string } | null>(null)
  const runner = useSyncRunner((o) => {
    setConflict(null)
    setHasToken(true)
    if (!o.reload) setDone(o.note)
  })
  const lastSeen = useRef(0)
  const lastChangeAt = useRef(0)

  useEffect(() => {
    installSyncHooks(db)
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
  const auto = isAutoUp(conf) && !IS_DEMO && !!GOOGLE_CLIENT_ID && !conflict
  useEffect(() => {
    if (!auto) return
    let running = false
    const up = async () => {
      if (running) return
      running = true
      try {
        const o = await runSync(db, 'up', { interactive: false })
        if (o?.kind === 'ask') setConflict({ reason: o.reason, remoteAt: o.remoteAt })
      } catch (e) {
        if (e instanceof DriveError && e.kind === 'auth') setHasToken(false)
      } finally {
        running = false
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
    const t = setTimeout(() => setDone(''), 7_000)
    return () => clearTimeout(t)
  }, [done])

  const on = !!conf?.enabled && !!GOOGLE_CLIENT_ID && !IS_DEMO
  const needTap = on && !hasToken && !dismissed
  const showBar = on && (needTap || !!done || !!conflict)
  useEffect(() => {
    if (needTap) preloadGis()
  }, [needTap])
  if (!showBar && !runner.ask) return null

  const close = () => {
    setDone('')
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 무시 */
    }
  }
  const text = runner.err
    ? runner.err
    : conflict
      ? '구글 사본이 다른 기기에서 바뀌어서 자동으로 올리지 않았어요'
      : done || '구글 동기화 · 앱을 연 뒤 한 번 눌러 주세요'
  return (
    <>
      {showBar && (
        <div className="flex items-center gap-2 border-b border-line bg-brand-light px-4 py-2 text-sm print:hidden" role="status">
          <span className={`min-w-0 flex-1 font-bold ${runner.err || conflict ? 'text-danger' : 'text-brand-ink'}`}>{text}</span>
          {conflict ? (
            <button type="button" className="btn btn-primary h-9 min-h-0 shrink-0 px-3 text-sm" onClick={() => runner.showAsk(conflict)}>
              어떻게 할지 고르기
            </button>
          ) : (
            !done && (
              <button type="button" className="btn btn-primary h-9 min-h-0 shrink-0 px-3 text-sm" disabled={!!runner.busy} onClick={() => runner.run('auto')}>
                {runner.busy ? '맞추는 중…' : '동기화'}
              </button>
            )
          )}
          {!conflict && (
            <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-sm text-ink-3" aria-label="닫기" onClick={close}>
              닫기
            </button>
          )}
        </div>
      )}
      {runner.ask && <SyncAskSheet reason={runner.ask.reason} remoteAt={runner.ask.remoteAt} busy={!!runner.busy} onChoose={runner.choose} onClose={runner.closeAsk} />}
    </>
  )
}
