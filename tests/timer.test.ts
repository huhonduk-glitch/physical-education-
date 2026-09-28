import { describe, expect, it } from 'vitest'
import {
  cadenceCount,
  elapsed,
  formatCountdown,
  formatStopwatch,
  heartWindowAt,
  intervalAt,
  intervalChangeTimes,
  lapToValue,
  newClock,
  pause,
  start,
  stepBeatAt,
  stepBpm,
} from '../src/lib/timerMath'

describe('시계 (시작 시각 기준 → 백그라운드에서도 정확)', () => {
  it('시작·멈춤·다시 시작해도 경과 시간이 맞다', () => {
    let c = start(newClock(), 1000)
    expect(elapsed(c, 6000)).toBe(5000)
    c = pause(c, 6000)
    expect(elapsed(c, 60000)).toBe(5000) // 멈춘 동안은 안 늘어남
    c = start(c, 70000)
    expect(elapsed(c, 72500)).toBe(7500)
  })
  it('화면이 꺼졌다 켜져도 (틱을 놓쳐도) 실제 시간대로', () => {
    const c = start(newClock(), 0)
    expect(elapsed(c, 10 * 60 * 1000)).toBe(600000)
  })
  it('표시 형식', () => {
    expect(formatStopwatch(65432)).toBe('01:05.43')
    expect(formatStopwatch(3723000)).toBe('1:02:03')
    expect(formatCountdown(180000)).toBe('03:00')
    expect(formatCountdown(200)).toBe('00:01')
    expect(formatCountdown(-5)).toBe('00:00')
  })
})

describe('인터벌', () => {
  const cfg = { workSec: 30, restSec: 10, rounds: 3 }
  it('운동 → 휴식 → 운동, 마지막 뒤엔 끝', () => {
    expect(intervalAt(cfg, 0)).toMatchObject({ phase: 'work', round: 1, remainingMs: 30000 })
    expect(intervalAt(cfg, 31000)).toMatchObject({ phase: 'rest', round: 1, remainingMs: 9000 })
    expect(intervalAt(cfg, 40000)).toMatchObject({ phase: 'work', round: 2 })
    expect(intervalAt(cfg, 110000)).toMatchObject({ phase: 'done' })
    expect(intervalAt(cfg, 0).totalMs).toBe(110000)
  })
  it('구간이 바뀌는 시각 (소리·진동)', () => {
    expect(intervalChangeTimes(cfg).map((x) => [x.at, x.to])).toEqual([
      [30000, 'rest'],
      [40000, 'work'],
      [70000, 'rest'],
      [80000, 'work'],
      [110000, 'done'],
    ])
  })
})

describe('PAPS 측정 보조', () => {
  it('윗몸말아올리기: 3초마다 1회', () => {
    expect(cadenceCount(2999)).toBe(0)
    expect(cadenceCount(3000)).toBe(1)
    expect(cadenceCount(90000)).toBe(30)
  })
  it('스텝검사: 고등 남 120bpm, 여·중 96bpm, 4박자 = 1스텝', () => {
    expect(stepBpm(true)).toBe(120)
    expect(stepBpm(false)).toBe(96)
    // 120bpm 3분 = 360박 = 90스텝 (분당 30스텝)
    expect(stepBeatAt(180000, 120)).toMatchObject({ beat: 360, step: 91, inStep: 0 })
    expect(stepBeatAt(179999, 120).step).toBe(90)
    // 96bpm 1분 = 96박 = 24스텝
    expect(stepBeatAt(60000, 96)).toMatchObject({ beat: 96, step: 25 })
    expect(stepBeatAt(1000, 120)).toMatchObject({ beat: 2, inStep: 2 })
  })
  it('심박 측정 구간: 1:00~1:30, 2:00~2:30, 3:00~3:30', () => {
    expect(heartWindowAt(30000)).toEqual({ n: 1, state: 'wait' })
    expect(heartWindowAt(60000)).toEqual({ n: 1, state: 'measure' })
    expect(heartWindowAt(95000)).toEqual({ n: 2, state: 'wait' })
    expect(heartWindowAt(125000)).toEqual({ n: 2, state: 'measure' })
    expect(heartWindowAt(185000)).toEqual({ n: 3, state: 'measure' })
    expect(heartWindowAt(211000)).toBe('done')
  })
  it('스톱워치 기록 → PAPS 값 (50m 0.01초, 오래달리기 초 버림)', () => {
    expect(lapToValue(7236, 'sprint50m')).toBe(7.23)
    expect(lapToValue(395900, 'longRunWalk')).toBe(395)
  })
})
