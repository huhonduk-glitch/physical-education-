import { describe, expect, it } from 'vitest'
import { SENSITIVE_MINUTES, sensitiveFresh } from '../src/components/SensitiveGate'

describe('민감한 화면 다시 잠그기', () => {
  it('푼 지 10분 안이면 그대로 열림, 넘으면 다시 물음, 푼 적 없으면 물음', () => {
    const t = 1_800_000_000_000
    expect(SENSITIVE_MINUTES).toBe(10)
    expect(sensitiveFresh(t, t + 9 * 60_000)).toBe(true)
    expect(sensitiveFresh(t, t + 10 * 60_000)).toBe(false)
    expect(sensitiveFresh(null, t)).toBe(false)
    expect(sensitiveFresh(t + 1000, t)).toBe(false) // 시계가 뒤로 간 경우
  })
})
