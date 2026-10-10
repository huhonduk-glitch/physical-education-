import { useLocation, useNavigate } from 'react-router-dom'
import { formatCountdown, formatStopwatch, intervalAt } from '../lib/timerMath'
import { endMs, useTimer } from '../state/TimerContext'
import Icon from './Icon'

const NAMES = { stopwatch: '스톱워치', countdown: '카운트다운', interval: '인터벌', curlUp: '윗몸 신호', step: '스텝 메트로놈', stepHeart: '심박 측정' }

/** 타이머가 도는 중에 다른 화면에 있으면 위쪽에 작게 띄운다 (누르면 타이머로) */
export default function MiniTimer() {
  const t = useTimer()
  const loc = useLocation()
  const nav = useNavigate()
  if (!t.running || loc.pathname === '/timer') return null
  const end = endMs(t)
  const text =
    t.mode === 'stopwatch'
      ? formatStopwatch(t.elapsedMs)
      : t.mode === 'interval'
        ? `${intervalAt(t.interval, t.elapsedMs).phase === 'work' ? '운동' : '휴식'} ${formatCountdown(intervalAt(t.interval, t.elapsedMs).remainingMs)}`
        : end !== null
          ? formatCountdown(end - t.elapsedMs)
          : formatCountdown(t.elapsedMs)
  return (
    <button
      type="button"
      onClick={() => nav('/timer')}
      className="print:hidden anim-pop fixed top-[calc(env(safe-area-inset-top)+8px)] left-1/2 z-50 flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 text-white shadow-[var(--shadow-float)] lg:left-[calc(50%+7.5rem)]"
      aria-label={`${NAMES[t.mode]} ${text} · 타이머로 가기`}
    >
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
      <Icon name="timer" size={18} />
      <span className="text-sm font-bold">{NAMES[t.mode]}</span>
      <span className="font-extrabold tabular-nums">{text}</span>
    </button>
  )
}
