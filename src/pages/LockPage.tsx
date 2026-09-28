import { APP_NAME, APP_SUB, Logo } from '../components/Brand'
import { useEffect, useState } from 'react'
import PinPad from '../components/PinPad'
import { db } from '../db/db'
import { lockoutSeconds, verifyPin, type StoredPin } from '../lib/pin'

const FAIL_KEY = 'pe.pinFailures'
const WAIT_KEY = 'pe.pinWaitUntil'

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function writeNum(key: string, v: number): void {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    /* 저장이 막힌 브라우저면 이번 화면에서만 센다 */
  }
}

/** 앱을 열 때마다 나오는 잠금 화면 */
export default function LockPage({ stored, onUnlock }: { stored: StoredPin; onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  // 새로고침으로 대기 시간을 건너뛰지 못하게 틀린 횟수를 기기에 남겨 둔다 (학생 정보 아님).
  const [failures, setFailures] = useState(() => readNum(FAIL_KEY))
  const [waitUntil, setWaitUntil] = useState(() => readNum(WAIT_KEY))
  const [now, setNow] = useState(() => Date.now())
  const [checking, setChecking] = useState(false)
  const [forgot, setForgot] = useState(false)

  const waiting = waitUntil > now
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [waiting])

  const submit = async () => {
    if (checking || waiting || pin.length < 4) return
    setChecking(true)
    const ok = await verifyPin(pin, stored)
    setChecking(false)
    if (ok) {
      writeNum(FAIL_KEY, 0)
      writeNum(WAIT_KEY, 0)
      onUnlock()
      return
    }
    const f = failures + 1
    setFailures(f)
    writeNum(FAIL_KEY, f)
    setPin('')
    const sec = lockoutSeconds(f)
    if (sec > 0) {
      const until = Date.now() + sec * 1000
      setWaitUntil(until)
      writeNum(WAIT_KEY, until)
      setNow(Date.now())
    }
  }

  if (forgot) return <ForgotPin onCancel={() => setForgot(false)} />

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-5">
      <Logo size={72} className="mx-auto mb-4" />
      <p className="mb-1 text-center text-2xl font-extrabold tracking-tight">PIN을 입력하세요</p>
      <p className="hint mb-6 text-center">
        {APP_NAME} · {APP_SUB}
      </p>
      <p className="mb-4 min-h-[1.5em] text-center font-bold text-danger" role="alert">
        {waiting
          ? `${Math.ceil((waitUntil - now) / 1000)}초 뒤에 다시 입력할 수 있어요`
          : failures > 0
            ? `PIN이 맞지 않아요 (${failures}번 틀림)`
            : ''}
      </p>
      <PinPad value={pin} onChange={setPin} onSubmit={submit} disabled={checking || waiting} />
      <button type="button" className="btn btn-ghost mx-auto mt-8 text-ink-3" onClick={() => setForgot(true)}>
        PIN을 잊었어요
      </button>
    </main>
  )
}

/** PIN을 잊으면 되살릴 방법이 없다. 모든 데이터를 지우고 처음부터 시작하는 것만 가능하다. */
function ForgotPin({ onCancel }: { onCancel: () => void }) {
  const [text, setText] = useState('')
  const WORD = '모두삭제'
  const wipe = async () => {
    await db.delete()
    writeNum(FAIL_KEY, 0)
    writeNum(WAIT_KEY, 0)
    location.reload()
  }
  return (
    <main className="mx-auto min-h-dvh max-w-md p-5">
      <h1 className="mt-6 text-2xl font-extrabold">PIN을 잊었을 때</h1>
      <div className="card mt-4 bg-danger-light shadow-none">
        <p className="font-bold">PIN은 이 기기에만 저장되어 있어서 찾거나 바꿀 방법이 없어요.</p>
        <p className="mt-2">
          처음부터 다시 쓰려면 <b>이 기기의 모든 학생 명렬과 기록을 지워야</b> 해요. 백업 파일이 있다면 나중에 복원할 수 있어요.
        </p>
      </div>
      <label className="label mt-6" htmlFor="wipe">
        정말 지우려면 아래 칸에 <b>{WORD}</b> 라고 적어 주세요
      </label>
      <input id="wipe" className="field" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      <button type="button" className="btn btn-danger mt-4 w-full" disabled={text.trim() !== WORD} onClick={wipe}>
        모든 데이터 지우고 처음부터
      </button>
      <button type="button" className="btn btn-outline mt-3 w-full" onClick={onCancel}>
        돌아가기
      </button>
    </main>
  )
}
