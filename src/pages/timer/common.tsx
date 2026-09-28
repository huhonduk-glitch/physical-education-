import { useEffect, type ReactNode } from 'react'
import Icon from '../../components/Icon'
import { useTimer } from '../../state/TimerContext'

/** 큰 숫자 */
export function BigTime({ children, tone = 'text-ink', size = 'md' }: { children: ReactNode; tone?: string; size?: 'md' | 'lg' }) {
  return (
    <p
      className={`text-center leading-none font-extrabold tracking-tight whitespace-nowrap tabular-nums ${tone} ${
        size === 'lg' ? 'text-[min(24vw,15rem)]' : 'text-[min(15vw,6.5rem)]'
      }`}
      aria-live="off"
    >
      {children}
    </p>
  )
}

/** 시작/멈춤 + 처음부터 (+ 추가 버튼) */
export function Controls({ extra, startLabel = '시작' }: { extra?: ReactNode; startLabel?: string }) {
  const t = useTimer()
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" className="btn btn-soft h-16 w-16 rounded-full p-0" aria-label="처음부터" onClick={t.reset} disabled={t.running}>
        <Icon name="reset" size={26} />
      </button>
      <button
        type="button"
        className={`btn h-24 w-24 rounded-full p-0 text-lg shadow-[var(--shadow-float)] ${t.running ? 'bg-danger text-white' : 'btn-primary'}`}
        aria-label={t.running ? '멈춤' : startLabel}
        onClick={t.running ? t.pause : t.start}
      >
        <Icon name={t.running ? 'pause' : 'play'} size={40} strokeWidth={0} fill="currentColor" />
      </button>
      {extra ?? <span className="h-16 w-16" />}
    </div>
  )
}

/** 전체화면 큰 숫자 (TV·빔 출력). 가로 화면으로 돌리기를 시도한다 */
export function FullscreenOverlay({ label, children, onClose, tone }: { label: ReactNode; children: ReactNode; onClose: () => void; tone?: string }) {
  const t = useTimer()
  useEffect(() => {
    const el = document.documentElement
    el.requestFullscreen?.().catch(() => {})
    ;(screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') {
        e.preventDefault()
        if (t.running) t.pause()
        else t.start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      ;(screen.orientation as unknown as { unlock?: () => void })?.unlock?.()
    }
  }, [onClose, t])
  return (
    <div className={`anim-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 p-6 ${tone ?? 'bg-ink text-white'}`}>
      <p className="text-[min(5vw,2.5rem)] font-extrabold opacity-80">{label}</p>
      <div className="w-full">{children}</div>
      <div className="flex gap-3">
        <button type="button" className="btn min-h-[64px] min-w-[140px] bg-white/15 text-xl text-white" onClick={t.running ? t.pause : t.start}>
          {t.running ? '멈춤' : '시작'}
        </button>
        <button type="button" className="btn min-h-[64px] bg-white/15 px-6 text-xl text-white" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return <section className="card space-y-4">{children}</section>
}

export function NumberField({ label, value, onChange, min = 0, max = 999, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-soft px-3" aria-label={`${label} 줄이기`} onClick={() => onChange(Math.max(min, value - 1))}>
          <Icon name="minus" />
        </button>
        <input
          className="field text-center text-lg font-bold tabular-nums"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ''))
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
        />
        <button type="button" className="btn btn-soft px-3" aria-label={`${label} 늘리기`} onClick={() => onChange(Math.min(max, value + 1))}>
          <Icon name="plus" />
        </button>
        {suffix && <span className="shrink-0 font-bold text-ink-3">{suffix}</span>}
      </div>
    </label>
  )
}
