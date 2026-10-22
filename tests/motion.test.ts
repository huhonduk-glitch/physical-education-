import { describe, expect, it } from 'vitest'
import { delayFrames, fitSize, FrameRing, jointAngle, segmentAngle, tilt } from '../src/lib/motion'

describe('관절각 (세 점, 꼭짓점 B)', () => {
  it('직각·일자·예각', () => {
    expect(jointAngle({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90)
    expect(jointAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(180)
    expect(jointAngle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(45)
  })
  it('무릎 굽힘 예: 엉덩이(0,0)–무릎(0,10)–발목(10,10) → 90°', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 })).toBe(90)
  })
  it('점이 겹치면 계산하지 않는다', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull()
  })
})

describe('분절각 (수평 기준, 화면 좌표는 y가 아래로)', () => {
  it('오른쪽 0°, 위쪽 +90°, 아래쪽 -90°, 왼쪽 180°', () => {
    expect(segmentAngle({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(0)
    expect(segmentAngle({ x: 0, y: 0 }, { x: 0, y: -5 })).toBe(90)
    expect(segmentAngle({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(-90)
    expect(segmentAngle({ x: 0, y: 0 }, { x: -5, y: 0 })).toBe(180)
  })
  it('기울기는 0~90° (방향과 상관없이)', () => {
    expect(tilt({ x: 0, y: 0 }, { x: 10, y: -10 })).toBe(45)
    expect(tilt({ x: 0, y: 0 }, { x: -10, y: -10 })).toBe(45)
    expect(tilt({ x: 0, y: 0 }, { x: 0, y: 7 })).toBe(90)
    expect(tilt({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull()
  })
})

describe('장면 고리 버퍼 (지연 재생)', () => {
  it('가득 차면 가장 옛 장면을 밀어내고 돌려준다', () => {
    const r = new FrameRing<number>(3)
    expect(r.push(1)).toBeUndefined()
    r.push(2)
    r.push(3)
    expect(r.push(4)).toBe(1)
    expect(r.toArray()).toEqual([2, 3, 4])
    expect(r.size).toBe(3)
  })
  it('back(n): 가장 최근에서 n장 앞', () => {
    const r = new FrameRing<number>(5)
    ;[1, 2, 3, 4, 5, 6, 7].forEach((x) => r.push(x))
    expect(r.back(0)).toBe(7)
    expect(r.back(4)).toBe(3)
    expect(r.back(5)).toBeUndefined() // 그만큼 안 쌓임
  })
  it('비우면 들어 있던 것을 돌려준다 (메모리 정리용)', () => {
    const r = new FrameRing<number>(2)
    r.push(1)
    r.push(2)
    expect(r.clear()).toEqual([1, 2])
    expect(r.size).toBe(0)
    expect(r.back(0)).toBeUndefined()
  })
  it('지연 프레임 수와 줄인 크기', () => {
    expect(delayFrames(3, 15)).toBe(45)
    expect(delayFrames(0, 15)).toBe(0)
    expect(fitSize(1920, 1080, 480)).toEqual({ w: 480, h: 270 })
    expect(fitSize(720, 1280, 480)).toEqual({ w: 270, h: 480 })
    expect(fitSize(320, 240, 480)).toEqual({ w: 320, h: 240 })
  })
})
