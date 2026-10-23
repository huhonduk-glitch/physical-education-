import { describe, expect, it } from 'vitest'
import { linkGrades, makeCode, qrModules, readCode, slipCode } from '../src/lib/linkCode'
import type { Factor, StudentPaps } from '../src/lib/paps'

// PELOG_LINK_FORMAT.md 6장 예시 — 튼튼몬과 같은 코드가 나와야 한다
const EXAMPLES: [number | null, number | null, number | null, number | null, string, string][] = [
  [2, 3, 1, 4, '2026-04-15', 'ABSH-SU4'],
  [1, 1, 1, 1, '2026-09-21', 'A6MG-QSW'],
  [null, 3, 5, 2, '2025-10-01', 'A4H2-HWP'],
  [5, 5, 5, 5, '2027-03-10', 'ARZ9-JYX'],
  [3, null, null, null, '2024-01-01', 'ADHD-QGM'],
  [4, 2, 3, 3, '2068-11-08', 'AJZV-VFQ'],
]

describe('연동 코드 만들기 (문서 예시 6개)', () => {
  for (const [cardio, strength, flex, power, date, code] of EXAMPLES) {
    it(`${cardio ?? '빈칸'}·${strength ?? '빈칸'}·${flex ?? '빈칸'}·${power ?? '빈칸'} ${date} → ${code}`, () => {
      expect(makeCode({ cardio, strength, flex, power, date })).toBe(code)
      expect(readCode(code)).toEqual({ ok: true, version: 1, date, grades: { cardio, strength, flex, power } })
    })
  }
})

describe('연동 코드 읽기에서 막아야 하는 입력 (문서 6장)', () => {
  it('소문자·띄어쓰기·- 없음은 읽힌다', () => {
    expect(readCode('absh su4').ok).toBe(true)
    expect(readCode('ABSHSU4').ok).toBe(true)
  })
  it('한 글자 틀림 · 두 글자 순서 바뀜 → check', () => {
    expect(readCode('ABSH-SU5')).toEqual({ ok: false, reason: 'check' })
    expect(readCode('ABHS-SU4')).toEqual({ ok: false, reason: 'check' })
  })
  it('0 1 I L O → confusable, 길이 → length, 버전 → version', () => {
    expect(readCode('AO2B-34C')).toEqual({ ok: false, reason: 'confusable' })
    expect(readCode('A3K')).toEqual({ ok: false, reason: 'length' })
    expect(readCode('2222-222')).toEqual({ ok: false, reason: 'version' })
  })
})

describe('연동 코드 만들기 거부', () => {
  it('4개 모두 빈칸, 등급 6, 없는 날짜, 범위 밖 날짜', () => {
    expect(() => makeCode({ cardio: null, strength: null, flex: null, power: null, date: '2026-04-15' })).toThrow()
    expect(() => makeCode({ cardio: 6, strength: 1, flex: 1, power: 1, date: '2026-04-15' })).toThrow()
    expect(() => makeCode({ cardio: 1, strength: 1, flex: 1, power: 1, date: '2026-02-30' })).toThrow()
    expect(() => makeCode({ cardio: 1, strength: 1, flex: 1, power: 1, date: '2023-12-31' })).toThrow()
    expect(() => makeCode({ cardio: 1, strength: 1, flex: 1, power: 1, date: '2068-11-09' })).toThrow()
  })
  it('모든 등급 조합 왕복 일치 · 겹치는 코드 없음', () => {
    const seen = new Set<string>()
    const opts = [null, 1, 2, 3, 4, 5]
    for (const a of opts) for (const b of opts) for (const c of opts) for (const d of opts) {
      if (!a && !b && !c && !d) continue
      const code = makeCode({ cardio: a, strength: b, flex: c, power: d, date: '2026-10-23' })
      expect(seen.has(code)).toBe(false)
      seen.add(code)
      const r = readCode(code)
      expect(r.ok && r.grades).toEqual({ cardio: a, strength: b, flex: c, power: d })
    }
    expect(seen.size).toBe(1295)
  })
})

const F: Factor[] = ['심폐지구력', '근력·근지구력', '유연성', '순발력', '비만']
function paps(grades: (number | string | null)[]): StudentPaps {
  const factors = F.map((factor, i) => {
    const g = grades[i]
    if (g === null) return { factor, eventId: null, value: null, band: null, points: null }
    return { factor, eventId: null, value: 1, band: { grade: g, points: 10, min: 0, max: 0 }, points: 10 }
  })
  return { factors, sum: 0, complete: false, total: null, grade: null, avgGrade: null }
}

describe('학생 쪽지 코드', () => {
  it('4개 요인 숫자 등급만 쓴다 (BMI 판정은 넣지 않음)', () => {
    expect(linkGrades(paps([2, 3, 1, 4, '비만']))).toEqual({ cardio: 2, strength: 3, flex: 1, power: 4 })
    expect(slipCode(paps([2, 3, 1, 4, '정상']), false, '2026-04-15')).toEqual({ ok: true, code: 'ABSH-SU4' })
  })
  it('기록 없는 요인은 빈칸', () => {
    expect(slipCode(paps([null, 3, 5, 2, null]), false, '2025-10-01')).toEqual({ ok: true, code: 'A4H2-HWP' })
  })
  it('측정 제외 · 등급 없음 · 측정일 없음 → 코드 없음', () => {
    expect(slipCode(paps([2, 3, 1, 4, '정상']), true, '2026-04-15')).toEqual({ ok: false, reason: 'excluded' })
    expect(slipCode(paps([null, null, null, null, '정상']), false, '2026-04-15')).toEqual({ ok: false, reason: 'noGrades' })
    expect(slipCode(null, false, '2026-04-15')).toEqual({ ok: false, reason: 'noGrades' })
    expect(slipCode(paps([2, 3, 1, 4, null]), false, null)).toEqual({ ok: false, reason: 'noDate' })
    expect(slipCode(paps([2, 3, 1, 4, null]), false, '2023-05-01')).toEqual({ ok: false, reason: 'badDate' })
  })
})

describe('QR', () => {
  it('코드 글자만 담고 가장 작은 QR(21×21)에 들어간다', () => {
    const m = qrModules('ABSH-SU4')
    expect(m.length).toBe(21)
    expect(m.every((row) => row.length === 21)).toBe(true)
    // 위치 표시(왼쪽 위 7×7 테두리)
    expect(m[0].slice(0, 7).every(Boolean)).toBe(true)
  })
})
