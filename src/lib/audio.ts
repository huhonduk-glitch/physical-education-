/**
 * 신호음 (외부 음원 없이 브라우저가 직접 만든다 → 오프라인 OK).
 * 정확한 박자를 위해 소리를 미리 "예약"한다(AudioContext 시각). 백그라운드에서 타이머가 느려져도 박자가 밀리지 않는다.
 */
let ctx: AudioContext | null = null

export function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export type CueKind = 'tick' | 'accent' | 'start' | 'end' | 'long'

const TONES: Record<CueKind, { freq: number; dur: number; vol: number }> = {
  tick: { freq: 880, dur: 0.07, vol: 0.5 },
  accent: { freq: 1320, dur: 0.09, vol: 0.7 },
  start: { freq: 1047, dur: 0.18, vol: 0.8 },
  end: { freq: 660, dur: 0.35, vol: 0.8 },
  long: { freq: 988, dur: 0.8, vol: 0.9 },
}

/** 소리 하나 예약. whenSec는 AudioContext 시각 (없으면 지금). 멈출 수 있게 노드를 돌려준다. */
export function playCue(kind: CueKind, whenSec?: number): OscillatorNode | null {
  const c = audioCtx()
  if (!c) return null
  const t = TONES[kind]
  const at = Math.max(c.currentTime, whenSec ?? c.currentTime)
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.value = t.freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(t.vol * 0.25, at + 0.005)
  gain.gain.setValueAtTime(t.vol * 0.25, at + t.dur - 0.02)
  gain.gain.linearRampToValueAtTime(0, at + t.dur)
  osc.connect(gain).connect(c.destination)
  osc.start(at)
  osc.stop(at + t.dur + 0.02)
  return osc
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* 진동 없는 기기 */
  }
}

export interface Cue {
  atMs: number
  kind: CueKind
  vibrate?: number | number[]
}

/**
 * 신호 목록을 경과 시간에 맞춰 조금씩 미리 예약한다.
 * elapsedNow(): 지금 경과 시간(ms). 멈추면 stop()으로 예약한 소리를 모두 취소한다.
 */
export class CueScheduler {
  private nodes: OscillatorNode[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private vibes: ReturnType<typeof setTimeout>[] = []
  private next = 0
  private readonly cues: Cue[]
  private readonly elapsedNow: () => number

  constructor(cues: Cue[], elapsedNow: () => number) {
    this.cues = cues
    this.elapsedNow = elapsedNow
  }

  start(): void {
    this.stop()
    const now = this.elapsedNow()
    this.next = this.cues.findIndex((c) => c.atMs >= now - 30)
    if (this.next < 0) this.next = this.cues.length
    this.tick()
    this.timer = setInterval(() => this.tick(), 150)
  }

  private tick(): void {
    const c = audioCtx()
    const el = this.elapsedNow()
    const ahead = 1500
    while (this.next < this.cues.length && this.cues[this.next].atMs <= el + ahead) {
      const cue = this.cues[this.next++]
      const delayMs = cue.atMs - el
      if (delayMs < -300) continue // 너무 지난 신호는 건너뛴다 (화면이 오래 꺼졌다 켜진 경우)
      if (c) {
        const n = playCue(cue.kind, c.currentTime + Math.max(0, delayMs) / 1000)
        if (n) this.nodes.push(n)
      }
      if (cue.vibrate) this.vibes.push(setTimeout(() => vibrate(cue.vibrate!), Math.max(0, delayMs)))
    }
    if (this.nodes.length > 64) this.nodes = this.nodes.slice(-32)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const n of this.nodes) {
      try {
        n.stop()
      } catch {
        /* 이미 끝남 */
      }
    }
    this.nodes = []
    this.vibes.forEach(clearTimeout)
    this.vibes = []
  }
}
