import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { IS_DEMO } from '../lib/demo'
import { PIN_SETTING_KEY, verifyPin, type StoredPin } from '../lib/pin'
import { useApp } from '../state/AppContext'
import PageHeader from './PageHeader'
import PinPad from './PinPad'

const KEY = 'pelog.sensitiveOk'
/** 한 번 풀면 이만큼(10분) 다시 묻지 않는다. 앱을 뒤로 내리면 바로 닫힌다 */
export const SENSITIVE_MINUTES = 10

/** 지금 열어도 되는지: 마지막으로 푼 때가 10분 안 */
export function sensitiveFresh(okAt: number | null, now: number, minutes = SENSITIVE_MINUTES): boolean {
  return okAt !== null && now - okAt >= 0 && now - okAt < minutes * 60 * 1000
}
const readOk = (): number | null => {
  try {
    const v = Number(sessionStorage.getItem(KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}

/**
 * 민감한 화면 다시 잠그기 (2026-11-26, 슈퍼스쿨 학생정보 '개인정보 보호 인증' 참고 — 휴대폰 인증 대신 이 앱 PIN).
 * [설정 → PIN]에서 켰을 때만: 견학(건강) · 세특 쓰기 · 건강체력교실을 열 때 PIN을 한 번 더 묻는다. 수업 중 학생이 폰을 볼 때를 대비.
 * 5번 틀리면 앱 전체를 잠근다(잠금 화면의 대기 시간이 무작위 대입을 막음). 시연 모드 · PIN 없음이면 묻지 않는다.
 */
export default function SensitiveGate({ what, children }: { what: string; children: ReactNode }) {
  const { settings, lock } = useApp()
  const pinRow = useLiveQuery(() => db.settings.get(PIN_SETTING_KEY).then((r) => r ?? null), [])
  const [ok, setOk] = useState(() => sensitiveFresh(readOk(), Date.now()))
  const [pin, setPin] = useState('')
  const [fails, setFails] = useState(0)
  const [checking, setChecking] = useState(false)
  const on = settings.sensitiveLock && !IS_DEMO

  // 앱을 뒤로 내리면 바로 닫는다
  useEffect(() => {
    if (!on) return
    const onVis = () => {
      if (document.visibilityState !== 'hidden') return
      try {
        sessionStorage.removeItem(KEY)
      } catch {
        /* 무시 */
      }
      setOk(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [on])

  if (!on || ok || pinRow === null) return <>{children}</>
  if (pinRow === undefined) return null
  const submit = async () => {
    if (checking || pin.length < 4) return
    setChecking(true)
    const good = await verifyPin(pin, pinRow.value as StoredPin)
    setChecking(false)
    if (good) {
      try {
        sessionStorage.setItem(KEY, String(Date.now()))
      } catch {
        /* 무시 — 이번만 연다 */
      }
      setOk(true)
      return
    }
    setPin('')
    if (fails + 1 >= 5) return lock()
    setFails(fails + 1)
  }
  return (
    <>
      <PageHeader title={what} back />
      <div className="page mx-auto max-w-md space-y-3 pb-10 text-center">
        <p className="pt-4 text-xl font-extrabold">PIN을 한 번 더 넣어 주세요</p>
        <p className="hint">이 화면에는 {what === '견학' ? '건강' : '평가 · 건강'} 정보가 있어요. 열고 나면 {SENSITIVE_MINUTES}분 동안은 다시 묻지 않고, 앱을 뒤로 내리면 다시 잠겨요.</p>
        <p className="min-h-[1.5em] font-bold text-danger" role="alert">
          {fails > 0 ? `PIN이 맞지 않아요 (${fails}번 틀림 · 5번 틀리면 앱이 잠겨요)` : ''}
        </p>
        <PinPad value={pin} onChange={setPin} onSubmit={() => void submit()} disabled={checking} submitLabel="열기" />
      </div>
    </>
  )
}
