import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CueScheduler, type Cue, audioCtx } from '../lib/audio'
import {
  HEART_WINDOWS,
  STEP_DURATION_SEC,
  elapsed as clockElapsed,
  intervalChangeTimes,
  newClock,
  pause as clockPause,
  start as clockStart,
  stepBpm,
  type Clock,
  type IntervalConfig,
} from '../lib/timerMath'
import { useWakeLock } from '../lib/wakeLock'

export type ToolMode = 'stopwatch' | 'countdown' | 'interval' | 'curlUp' | 'step' | 'stepHeart'

export interface Lap {
  id: string
  ms: number
  studentId?: string
}

interface TimerState {
  mode: ToolMode
  clock: Clock
  countdownMs: number
  interval: IntervalConfig
  stepHighMale: boolean
  laps: Lap[]
}

const STORE_KEY = 'pe.timer'

function initial(): TimerState {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as TimerState
  } catch {
    /* 무시 */
  }
  return { mode: 'stopwatch', clock: newClock(), countdownMs: 3 * 60000, interval: { workSec: 30, restSec: 15, rounds: 8 }, stepHighMale: true, laps: [] }
}

/** 이 방식의 끝 시각 (끝이 있는 타이머만). 지나면 자동으로 멈춘다 */
export function endMs(s: Pick<TimerState, 'mode' | 'countdownMs' | 'interval'>): number | null {
  switch (s.mode) {
    case 'countdown':
      return s.countdownMs
    case 'interval':
      return s.interval.rounds * s.interval.workSec * 1000 + (s.interval.rounds - 1) * s.interval.restSec * 1000
    case 'step':
      return STEP_DURATION_SEC * 1000
    case 'stepHeart':
      return HEART_WINDOWS[HEART_WINDOWS.length - 1].endSec * 1000
    default:
      return null
  }
}

function cuesFor(s: TimerState): Cue[] {
  const out: Cue[] = []
  const countIn = (at: number) => [3000, 2000, 1000].forEach((d) => at - d > 0 && out.push({ atMs: at - d, kind: 'tick' }))
  switch (s.mode) {
    case 'countdown':
      countIn(s.countdownMs)
      out.push({ atMs: s.countdownMs, kind: 'long', vibrate: [400, 120, 400] })
      break
    case 'interval':
      out.push({ atMs: 0, kind: 'start', vibrate: 150 })
      for (const c of intervalChangeTimes(s.interval)) {
        countIn(c.at)
        out.push(c.to === 'done' ? { atMs: c.at, kind: 'long', vibrate: [400, 120, 400] } : { atMs: c.at, kind: c.to === 'work' ? 'start' : 'end', vibrate: c.to === 'work' ? [150, 80, 150] : 300 })
      }
      break
    case 'curlUp':
      for (let t = 0; t <= 3600000; t += 3000) out.push({ atMs: t, kind: t === 0 ? 'start' : 'tick' })
      break
    case 'step': {
      const beatMs = 60000 / stepBpm(s.stepHighMale)
      const end = STEP_DURATION_SEC * 1000
      for (let i = 0; i * beatMs < end - 1; i++) out.push({ atMs: i * beatMs, kind: i % 4 === 0 ? 'accent' : 'tick' })
      out.push({ atMs: end, kind: 'long', vibrate: [400, 120, 400] })
      break
    }
    case 'stepHeart':
      for (const w of HEART_WINDOWS) {
        out.push({ atMs: w.startSec * 1000, kind: 'start', vibrate: [120, 80, 120] })
        out.push({ atMs: w.endSec * 1000, kind: w.n === 3 ? 'long' : 'end', vibrate: 300 })
      }
      break
    default:
      break
  }
  return out.sort((a, b) => a.atMs - b.atMs)
}

interface TimerApi extends TimerState {
  now: number
  elapsedMs: number
  running: boolean
  setMode: (m: ToolMode) => void
  start: () => void
  pause: () => void
  reset: () => void
  lap: () => void
  setCountdown: (ms: number) => void
  setIntervalCfg: (c: IntervalConfig) => void
  setStepHighMale: (b: boolean) => void
  assignLap: (id: string, studentId: string | undefined) => void
  removeLap: (id: string) => void
  clearLaps: () => void
}

const Ctx = createContext<TimerApi | null>(null)

/** 앱 전체에 하나만 있는 타이머. 다른 화면으로 가도 계속 돈다 (CLAUDE.md 4-4). */
export function TimerProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<TimerState>(initial)
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef(s)
  ref.current = s

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(s))
    } catch {
      /* 무시 */
    }
  }, [s])

  // 화면 새로 그리기 (돌 때만)
  useEffect(() => {
    if (!s.clock.running) return
    const t = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(t)
  }, [s.clock.running])

  // 소리 예약
  useEffect(() => {
    if (!s.clock.running) return
    const sch = new CueScheduler(cuesFor(s), () => clockElapsed(ref.current.clock, Date.now()))
    sch.start()
    return () => sch.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.clock.running, s.clock.startedAt, s.mode, s.countdownMs, s.interval, s.stepHighMale])

  // 끝이 있는 타이머는 끝에서 자동으로 멈춤
  const el = clockElapsed(s.clock, now)
  const end = endMs(s)
  useEffect(() => {
    if (s.clock.running && end !== null && el >= end) {
      setS((x) => ({ ...x, clock: { running: false, startedAt: 0, accumulated: end } }))
    }
  }, [el, end, s.clock.running])

  useWakeLock(s.clock.running)

  const setMode = useCallback((mode: ToolMode) => setS((x) => (x.clock.running ? x : { ...x, mode, clock: newClock() })), [])
  const startFn = useCallback(() => {
    audioCtx() // 사용자가 누를 때 소리 장치를 깨운다 (아이폰 필수)
    setS((x) => {
      const e = endMs(x)
      const base = e !== null && x.clock.accumulated >= e ? newClock() : x.clock
      return { ...x, clock: clockStart(base, Date.now()) }
    })
    setNow(Date.now())
  }, [])
  const pauseFn = useCallback(() => setS((x) => ({ ...x, clock: clockPause(x.clock, Date.now()) })), [])
  const reset = useCallback(() => setS((x) => ({ ...x, clock: newClock(), laps: x.mode === 'stopwatch' ? [] : x.laps })), [])
  const lap = useCallback(
    () => setS((x) => ({ ...x, laps: [...x.laps, { id: crypto.randomUUID(), ms: clockElapsed(x.clock, Date.now()) }] })),
    [],
  )
  const api = useMemo<TimerApi>(
    () => ({
      ...s,
      now,
      elapsedMs: el,
      running: s.clock.running,
      setMode,
      start: startFn,
      pause: pauseFn,
      reset,
      lap,
      setCountdown: (ms) => setS((x) => (x.clock.running ? x : { ...x, countdownMs: ms, clock: newClock() })),
      setIntervalCfg: (c) => setS((x) => (x.clock.running ? x : { ...x, interval: c, clock: newClock() })),
      setStepHighMale: (b) => setS((x) => (x.clock.running ? x : { ...x, stepHighMale: b, clock: newClock() })),
      assignLap: (id, studentId) => setS((x) => ({ ...x, laps: x.laps.map((l) => (l.id === id ? { ...l, studentId } : l)) })),
      removeLap: (id) => setS((x) => ({ ...x, laps: x.laps.filter((l) => l.id !== id) })),
      clearLaps: () => setS((x) => ({ ...x, laps: [] })),
    }),
    [s, now, el, setMode, startFn, pauseFn, reset, lap],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useTimer(): TimerApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('TimerProvider 밖에서 useTimer를 불렀어요')
  return v
}
