/**
 * 동작 영상 피드백 계산 (재설계 B-3, 2026-10-22).
 *
 * 각도 정의는 Sports2D(BSD-3-Clause, github.com/davidpagnon/Sports2D)의 설명 방식만 참고했다 — 코드는 가져오지 않았다:
 * - 관절각: 세 점 A–B–C에서 B를 꼭짓점으로 하는 각 (0~180°)
 * - 분절각: 두 점 A→B 선이 수평선과 이루는 각 (반시계 방향이 +, -180~180°)
 * 화면 좌표는 아래로 갈수록 y가 커지므로 분절각은 y를 뒤집어 계산한다.
 * Kinovea(GPL)는 코드·설명 모두 쓰지 않았다(교사 결정: 공개 설명만 참고 가능, 이번에는 참고하지 않음).
 */

export interface Pt {
  x: number
  y: number
}

const round1 = (x: number) => Math.round(x * 10) / 10
const DEG = 180 / Math.PI

/** 세 점 A–B–C의 B 각도 (0~180°, 소수 첫째 자리). 점이 겹치면 null */
export function jointAngle(a: Pt, b: Pt, c: Pt): number | null {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const n1 = Math.hypot(v1.x, v1.y)
  const n2 = Math.hypot(v2.x, v2.y)
  if (n1 === 0 || n2 === 0) return null
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (n1 * n2)))
  return round1(Math.acos(cos) * DEG)
}

/** A→B 선이 수평선과 이루는 각 (화면 좌표 → 위쪽이 +, -180~180°). 두 점이 같으면 null */
export function segmentAngle(a: Pt, b: Pt): number | null {
  const dx = b.x - a.x
  const dy = -(b.y - a.y)
  if (dx === 0 && dy === 0) return null
  const d = round1(Math.atan2(dy, dx) * DEG)
  // -180은 180으로, -0은 0으로 (같은 방향)
  return d === -180 ? 180 : d + 0
}

/** 선이 기울어진 정도만 (0~90°, 수평 0 · 수직 90) — 화면에 "몸통 기울기 12°"처럼 쓰기 좋다 */
export function tilt(a: Pt, b: Pt): number | null {
  const s = segmentAngle(a, b)
  if (s === null) return null
  const t = Math.abs(s) > 90 ? 180 - Math.abs(s) : Math.abs(s)
  return round1(t)
}

/**
 * 고정 크기 고리 버퍼: 카메라 장면을 최근 N개만 기억한다 (지연 재생·슬로모션).
 * push가 밀어낸 옛 장면을 돌려주므로 부르는 쪽에서 메모리를 바로 정리(ImageBitmap.close)할 수 있다.
 */
export class FrameRing<T> {
  private buf: (T | undefined)[]
  private start = 0
  private count = 0
  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error('capacity >= 1')
    this.buf = new Array(capacity)
  }
  get size(): number {
    return this.count
  }
  push(item: T): T | undefined {
    if (this.count < this.capacity) {
      this.buf[(this.start + this.count) % this.capacity] = item
      this.count++
      return undefined
    }
    const evicted = this.buf[this.start]
    this.buf[this.start] = item
    this.start = (this.start + 1) % this.capacity
    return evicted
  }
  /** 가장 최근에서 back개 앞의 장면 (0 = 가장 최근). 아직 그만큼 쌓이지 않았으면 undefined */
  back(back: number): T | undefined {
    if (back < 0 || back >= this.count) return undefined
    return this.buf[(this.start + this.count - 1 - back) % this.capacity]
  }
  /** 오래된 것부터 */
  toArray(): T[] {
    return Array.from({ length: this.count }, (_, i) => this.buf[(this.start + i) % this.capacity] as T)
  }
  /** 모두 비우고 들어 있던 것을 돌려준다 (정리용) */
  clear(): T[] {
    const all = this.toArray()
    this.buf = new Array(this.capacity)
    this.start = 0
    this.count = 0
    return all
  }
}

/** 지연 시간(초) → 몇 장 앞 장면을 보여 줄지 */
export const delayFrames = (delaySec: number, fps: number) => Math.max(0, Math.round(delaySec * fps))

/** 카메라 영상을 버퍼용으로 줄일 크기 (긴 변이 maxSide 이하, 비율 유지) */
export function fitSize(w: number, h: number, maxSide: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const s = Math.min(1, maxSide / Math.max(w, h))
  return { w: Math.round(w * s), h: Math.round(h * s) }
}
