import { useState } from 'react'
import { db } from '../db/db'
import { ensureToken, runSync, type Action, type Asked, type AskReason, type Outcome } from './driveSync'

const DONE_NOTE_KEY = 'pelog.syncDoneNote'

/** 새로고침 뒤 맨 위 줄에 한 번 보여 줄 결과 (내려받기 · 둘 다 살리기는 화면을 새로 연다) */
export function takeDoneNote(): string {
  try {
    const v = sessionStorage.getItem(DONE_NOTE_KEY) ?? ''
    sessionStorage.removeItem(DONE_NOTE_KEY)
    return v
  } catch {
    return ''
  }
}

/** 올리기 · 내려받기 · 동기화 버튼 공통: 로그인 → 실행 → 덮어쓰면 사라질 때 묻기 → (바뀌었으면) 새로고침 */
export function useSyncRunner(onDone?: (o: Extract<Outcome, { kind: 'done' }>) => void) {
  const [busy, setBusy] = useState<Asked | Action | ''>('')
  const [err, setErr] = useState('')
  const [ask, setAsk] = useState<{ reason: AskReason; remoteAt?: string } | null>(null)
  const exec = async (what: Asked | Action, force: boolean) => {
    setErr('')
    setBusy(what)
    try {
      await ensureToken(true) // 구글 로그인 창을 먼저 (팝업 차단 방지)
      const o = await runSync(db, what, { interactive: true, force })
      if (!o) return
      if (o.kind === 'ask') {
        setAsk({ reason: o.reason, remoteAt: o.remoteAt })
        return
      }
      setAsk(null)
      onDone?.(o)
      if (o.reload) {
        try {
          sessionStorage.setItem(DONE_NOTE_KEY, o.note)
        } catch {
          /* 무시 */
        }
        location.reload()
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '구글과 맞추지 못했어요.')
    } finally {
      setBusy('')
    }
  }
  return {
    busy,
    err,
    ask,
    /** 버튼: 묻고 나서 할 수도 있음 */
    run: (a: Asked) => void exec(a, false),
    /** 물음에 답함: 묻지 않고 그대로 */
    choose: (a: Action) => void exec(a, true),
    closeAsk: () => setAsk(null),
    showAsk: (a: { reason: AskReason; remoteAt?: string }) => setAsk(a),
  }
}
