/**
 * 타이머 계산 (CLAUDE.md 4-4). 모두 "시작 시각 기준 경과 시간"으로 계산한다 —
 * 백그라운드로 갔다 와도 시간이 틀어지지 않게, 1초마다 더하는 방식을 쓰지 않는다.
 */

/** 경과 시간 계산: 멈춘 동안은 더하지 않는다 */
export interface Clock {
  running: boolean
  /** 마지막으로 시작한 시각 (ms, Date.now) */
  startedAt: number
  /** 그 전까지 쌓인 시간 (ms) */
  accumulated: number
}

export const newClock = (): Clock => ({ running: false, startedAt: 0, accumulated: 0 })

export function elapsed(c: Clock, now: number): number {
  return c.accumulated + (c.running ? Math.max(0, now - c.startedAt) : 0)
}

export function start(c: Clock, now: number): Clock {
  return c.running ? c : { running: true, startedAt: now, accumulated: c.accumulated }
}

export function pause(c: Clock, now: number): Clock {
  return c.running ? { running: false, startedAt: 0, accumulated: elapsed(c, now) } : c
}

/** mm:ss.cc (1시간 넘으면 h:mm:ss) */
export function formatStopwatch(ms: number): string {
  const cs = Math.floor(ms / 10) % 100
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000) % 60
  const h = Math.floor(ms / 3600000)
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}.${p(cs)}`
}

/** 남은 시간 표시 mm:ss (올림: 0.2초 남으면 00:01) */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface IntervalConfig {
  workSec: number
  restSec: number
  rounds: number
}

export interface IntervalState {
  phase: 'work' | 'rest' | 'done'
  round: number
  /** 이 구간 남은 시간 */
  remainingMs: number
  totalMs: number
}

/** 인터벌: 운동 → 휴식 → … 마지막 라운드 뒤에는 휴식 없이 끝 */
export function intervalAt(cfg: IntervalConfig, elapsedMs: number): IntervalState {
  const work = cfg.workSec * 1000
  const rest = cfg.restSec * 1000
  const totalMs = cfg.rounds * work + (cfg.rounds - 1) * rest
  if (elapsedMs >= totalMs) return { phase: 'done', round: cfg.rounds, remainingMs: 0, totalMs }
  const cycle = work + rest
  const round = Math.floor(elapsedMs / cycle) + 1
  const inCycle = elapsedMs - (round - 1) * cycle
  if (inCycle < work) return { phase: 'work', round, remainingMs: work - inCycle, totalMs }
  return { phase: 'rest', round, remainingMs: cycle - inCycle, totalMs }
}

/** 인터벌 구간이 바뀌는 시각들 (소리·진동 예약용, ms) */
export function intervalChangeTimes(cfg: IntervalConfig): { at: number; to: 'work' | 'rest' | 'done'; round: number }[] {
  const out: { at: number; to: 'work' | 'rest' | 'done'; round: number }[] = []
  let t = 0
  for (let r = 1; r <= cfg.rounds; r++) {
    t += cfg.workSec * 1000
    if (r < cfg.rounds) {
      out.push({ at: t, to: 'rest', round: r })
      t += cfg.restSec * 1000
      out.push({ at: t, to: 'work', round: r + 1 })
    } else out.push({ at: t, to: 'done', round: r })
  }
  return out
}

/** 윗몸말아올리기: 3초마다 신호음. 지금까지 울린 신호 수 */
export function cadenceCount(elapsedMs: number, cadenceSec = 3): number {
  return Math.floor(elapsedMs / (cadenceSec * 1000))
}

/** 스텝검사 메트로놈 박자 빠르기: 고등 남 분당 30스텝(120bpm), 여·중학생 분당 24스텝(96bpm). 한 스텝 = 4박자 */
export function stepBpm(highMale: boolean): number {
  return highMale ? 120 : 96
}

export const STEP_DURATION_SEC = 180

export interface StepBeat {
  beat: number
  /** 한 스텝 안에서 몇 번째 박자 (0~3: 올라-올라-내려-내려) */
  inStep: number
  step: number
}

export function stepBeatAt(elapsedMs: number, bpm: number): StepBeat {
  const beat = Math.floor((elapsedMs / 60000) * bpm)
  return { beat, inStep: beat % 4, step: Math.floor(beat / 4) + 1 }
}

export const STEP_WORDS = ['올라', '올라', '내려', '내려']

/**
 * 스텝검사 회복기 심박 측정 구간 (촉진법): 운동 끝난 뒤 1:00~1:30, 2:00~2:30, 3:00~3:30.
 * 구간 시작·끝에 소리로 알린다.
 */
export const HEART_WINDOWS = [
  { n: 1, startSec: 60, endSec: 90 },
  { n: 2, startSec: 120, endSec: 150 },
  { n: 3, startSec: 180, endSec: 210 },
]

export function heartWindowAt(elapsedMs: number): { n: number; state: 'wait' | 'measure' } | 'done' {
  const s = elapsedMs / 1000
  for (const w of HEART_WINDOWS) {
    if (s < w.startSec) return { n: w.n, state: 'wait' }
    if (s < w.endSec) return { n: w.n, state: 'measure' }
  }
  return 'done'
}

/** 스톱워치 기록 → 50m달리기(0.01초) / 오래달리기(1초, 버림) 값 */
export function lapToValue(ms: number, eventId: 'sprint50m' | 'longRunWalk'): number {
  if (eventId === 'longRunWalk') return Math.floor(ms / 1000 + 1e-9)
  return Math.floor(ms / 10 + 1e-9) / 100
}
