import { describe, expect, it } from 'vitest'
import { pointTally } from '../src/lib/recordStats'

describe('누가기록 포인트 (칭찬·지도 횟수만 센다)', () => {
  it('학생별로 칭찬과 지도를 따로 센다', () => {
    const m = pointTally([
      { studentId: 'a', type: 'exemplary' },
      { studentId: 'a', type: 'exemplary' },
      { studentId: 'a', type: 'unprepared' },
      { studentId: 'b', type: 'unprepared' },
    ])
    expect(m.get('a')).toEqual({ praise: 2, guide: 1 })
    expect(m.get('b')).toEqual({ praise: 0, guide: 1 })
  })

  it('관찰 메모·체육부장 활동은 세지 않는다', () => {
    const m = pointTally([
      { studentId: 'a', type: 'observation' },
      { studentId: 'a', type: 'captain' },
    ])
    expect(m.has('a')).toBe(false)
  })

  it('기록이 없으면 빈 결과', () => {
    expect(pointTally([]).size).toBe(0)
  })
})
