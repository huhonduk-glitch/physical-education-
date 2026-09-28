import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STANDARDS as std,
  EVENT_IDS,
  bmi,
  ceil1,
  eventPoints,
  factorChoices,
  fixed,
  longRunSeconds,
  lookup,
  officialSuggestion,
  pei,
  representative,
  studentPaps,
  teamLevel,
  totalGrade,
  validateStandards,
  type EventId,
  type Gender,
} from '../src/lib/paps'

describe('PAPS 필수 샘플 (CLAUDE.md 4-5)', () => {
  it('고1남 왕복오래달리기 34회 → 4등급 6점', () => {
    expect(lookup(std, 'shuttleRun', '고1', 'M', 34)).toMatchObject({ grade: 4, points: 6 })
  })
  it('고2남 BMI 22.0 → 정상 20점', () => {
    expect(lookup(std, 'bmi', '고2', 'M', 22.0)).toMatchObject({ grade: '정상', points: 20 })
  })
  it('고1남 50m 6.83초 → 1등급 19점', () => {
    expect(lookup(std, 'sprint50m', '고1', 'M', 6.83)).toMatchObject({ grade: 1, points: 19 })
  })
  it('고1남 앉아윗몸앞으로굽히기 -2.95cm → 5등급 1점', () => {
    expect(lookup(std, 'sitAndReach', '고1', 'M', -2.95)).toMatchObject({ grade: 5, points: 1 })
  })
  it('고3여 악력 40.7kg → 1등급 20점', () => {
    expect(lookup(std, 'gripStrength', '고3', 'F', 40.7)).toMatchObject({ grade: 1, points: 20 })
  })
  it('5개 요인 합 80 → 종합 1등급, 79 → 2등급', () => {
    expect(totalGrade(std, 80)).toBe(1)
    expect(totalGrade(std, 79)).toBe(2)
    expect(totalGrade(std, 100)).toBe(1)
    expect(totalGrade(std, 0)).toBe(5)
  })
  it('종합유연성 7점 → 2등급, 16점(법령) / 15점(표)', () => {
    const b = lookup(std, 'totalFlexibility', '고1', 'M', 7)!
    expect(b.grade).toBe(2)
    expect(eventPoints(std, 'totalFlexibility', b, 'regulation')).toBe(16)
    expect(eventPoints(std, 'totalFlexibility', b, 'table')).toBe(15)
  })
  it('BMI 21.43 → 21.5로 올림 후 조회 (반올림 아님)', () => {
    expect(ceil1(21.43)).toBe(21.5)
    expect(ceil1(21.41)).toBe(21.5)
    expect(ceil1(21.4)).toBe(21.4) // 이미 0.1 단위면 그대로 (부동소수점 오차에 안 흔들림)
    expect(bmi(170, 61.93)).toBe(21.5) // 61.93 / 1.7² = 21.429…
    expect(lookup(std, 'bmi', '고1', 'M', bmi(170, 61.93)!)?.grade).toBe('정상')
  })
  it('고1남 스텝검사 PEI: D=180, 촉진법 p=60 → 80.945… → 81.0 → 1등급', () => {
    const v = pei('palpation', true, 180, [60])
    expect(v).toBe(81)
    expect(lookup(std, 'stepTest', '고1', 'M', v!)?.grade).toBe(1)
  })
})

describe('PAPS 계산 도구', () => {
  it('PEI 공식 4가지', () => {
    expect(pei('palpation', false, 180, [50, 45, 40])).toBe(ceil1((180 / (2 * 135)) * 100)) // 66.66… → 66.7
    expect(pei('monitor', false, 180, [100, 90, 80])).toBe(ceil1((180 / 270) * 100))
    expect(pei('monitor', true, 180, [120])).toBe(ceil1((180 * 100) / ((5.5 * 120) / 2) + 0.22 * 120))
    expect(pei('palpation', false, 180, [50, undefined, 40])).toBeNull()
  })
  it('오래달리기: 분·초 → 초, 0.1초 버림, 파울 1회 +5초', () => {
    expect(longRunSeconds(6, 35.9)).toBe(395)
    expect(longRunSeconds(6, 35.9, 2)).toBe(405)
  })
  it('공식 단위 제안: 악력 32.94 → 33.0 (자동 변경 아님)', () => {
    expect(officialSuggestion(std, 'gripStrength', 32.94)).toBe(33)
    expect(officialSuggestion(std, 'gripStrength', 33)).toBeNull()
    expect(officialSuggestion(std, 'sprint50m', 7.123)).toBeNull() // 규칙에 올림/버림이 없는 종목
  })
  it('대표 기록: 악력은 전체 최고, 50m는 최소, 그 외 최대', () => {
    const grip = [
      { attempt: 1 as const, side: 'R' as const, value: 32.9 },
      { attempt: 1 as const, side: 'L' as const, value: 27.6 },
      { attempt: 2 as const, side: 'R' as const, value: 32 },
      { attempt: 2 as const, side: 'L' as const, value: 33.1 },
    ]
    expect(representative(std, 'gripStrength', grip)?.value).toBe(33.1)
    expect(representative(std, 'sprint50m', [{ attempt: 1, side: null, value: 7.4 }, { attempt: 2, side: null, value: 7.2 }])?.value).toBe(7.2)
    expect(representative(std, 'standingLongJump', [{ attempt: 1, side: null, value: 180 }, { attempt: 2, side: null, value: 175 }])?.value).toBe(180)
    expect(representative(std, 'sitAndReach', [])).toBeNull()
  })
  it('자릿수 맞춤: 부동소수점 오차가 글자에 안 들어감', () => {
    expect(fixed(32.900000001, 2)).toBe('32.9')
    expect(fixed(0.1 + 0.2, 2)).toBe('0.3')
    expect(fixed(34, 0)).toBe('34')
    expect(fixed(-2.5, 2)).toBe('-2.5')
  })
  it('학생 종합: 5요인 다 있으면 총점·등급, 모자라면 미완료', () => {
    const base = {
      lvKey: '고1',
      gender: 'M' as Gender,
      selected: { 심폐지구력: 'shuttleRun', '근력·근지구력': 'gripStrength', 유연성: 'sitAndReach', 순발력: 'standingLongJump' } as const,
      flexMode: 'regulation' as const,
    }
    const cells = {
      shuttleRun: [{ attempt: null, side: null, value: 34 }],
      gripStrength: [{ attempt: 1 as const, side: 'R' as const, value: 40 }],
      sitAndReach: [{ attempt: 1 as const, side: null, value: 10 }],
    }
    const partial = studentPaps(std, { ...base, cells, bmiValue: 22 })
    expect(partial.complete).toBe(false)
    expect(partial.total).toBeNull()
    expect(partial.sum).toBeGreaterThan(0)
    const full = studentPaps(std, { ...base, cells: { ...cells, standingLongJump: [{ attempt: 1, side: null, value: 230 }] }, bmiValue: 22 })
    expect(full.complete).toBe(true)
    expect(full.total).toBe(full.factors.reduce((a, f) => a + (f.points ?? 0), 0))
    expect(full.grade).toBe(totalGrade(std, full.total!))
  })
  it('학교급별 선택지: 중1~고3은 심폐 3 · 근력 3 · 유연 2 · 순발 2', () => {
    const c = factorChoices(std, '고', 1)
    expect(c['심폐지구력']).toEqual(['shuttleRun', 'longRunWalk', 'stepTest'])
    expect(c['근력·근지구력']).toEqual(['gripStrength', 'curlUp', 'pushUp'])
    expect(c['유연성']).toEqual(['sitAndReach', 'totalFlexibility'])
    expect(c['순발력']).toEqual(['sprint50m', 'standingLongJump'])
  })
  it('팀 편성 수준 변환', () => {
    expect(teamLevel({ grade: 2, avgGrade: null })).toBe('상')
    expect(teamLevel({ grade: 3, avgGrade: null })).toBe('중')
    expect(teamLevel({ grade: 4, avgGrade: null })).toBe('하')
    expect(teamLevel({ grade: null, avgGrade: 2.0 })).toBe('상')
    expect(teamLevel({ grade: null, avgGrade: 2.6 })).toBe('중')
    expect(teamLevel({ grade: null, avgGrade: 3.2 })).toBe('하')
    expect(teamLevel({ grade: null, avgGrade: null })).toBeNull()
  })
  it('기준표 형식 검사: 공식 JSON은 통과, 망가진 것은 거부', () => {
    expect(validateStandards(std)).toEqual([])
    expect(validateStandards({})).not.toEqual([])
    const broken = structuredClone(std)
    delete (broken.table as Record<string, unknown>).bmi
    expect(validateStandards(broken).join()).toContain('bmi')
  })
})

describe('PAPS 기준표 전 구간 자동 검사 (모든 종목·학년·성별)', () => {
  const overlaps: string[] = []
  let checked = 0
  for (const id of EVENT_IDS as EventId[]) {
    for (const [lv, byG] of Object.entries(std.table[id])) {
      for (const g of ['M', 'F'] as Gender[]) {
        const bands = byG[g]
        it(`${id} ${lv} ${g}`, () => {
          bands.forEach((b, i) => {
            // ① 구간의 min → 그 구간 (같은 min이 뒤에 또 있으면 마지막 것)
            const lastSameMin = bands.map((x, k) => [x, k] as const).filter(([x]) => x.min === b.min).pop()![1]
            const atMin = lookup(std, id, lv, g, b.min)!
            expect(atMin).toBe(bands[lastSameMin])
            // ② 구간의 max → 그 구간 (다음 구간과 겹치지 않으면)
            const next = bands[i + 1]
            if (!next || b.max < next.min) {
              expect(lookup(std, id, lv, g, b.max)).toBe(b)
            } else {
              overlaps.push(`${id} ${lv} ${g}`)
            }
            // ③ 구간 사이 틈(소수) → 앞 구간
            if (next && next.min - b.max > 1e-6) {
              const gap = (b.max + next.min) / 2
              const got = lookup(std, id, lv, g, gap)!
              expect(got.grade).toBe(b.grade)
              expect(got.points).toBe(b.points)
            }
            checked++
          })
          // 점수는 0~20
          expect(bands.every((b) => b.points >= 0 && b.points <= 20)).toBe(true)
        })
      }
    }
  }
  it('구간 겹침은 공식표에 있는 2건뿐 (초5남 BMI, 중1여 BMI)', () => {
    expect(checked).toBeGreaterThan(3000)
    expect([...new Set(overlaps)].sort()).toEqual(['bmi 중1 F', 'bmi 초5 M'])
  })
})
