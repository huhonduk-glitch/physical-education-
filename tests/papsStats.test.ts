import { describe, expect, it } from 'vitest'
import type { Factor, StudentPaps } from '../src/lib/paps'
import { classStat, factorGradeDist, factorValues, gradeZones, improvement, needsSupport, type StatInput } from '../src/lib/papsStats'

const F: Factor[] = ['심폐지구력', '근력·근지구력', '유연성', '순발력', '비만']
/** 요인 점수 5개(null = 미측정)로 학생 결과 만들기. 등급은 점수로 대충 (테스트용) */
function paps(points: (number | null)[], bmiLabel = '정상'): StudentPaps {
  const factors = F.map((factor, i) => {
    const p = points[i]
    if (p === null) return { factor, eventId: null, value: null, band: null, points: null }
    const grade = factor === '비만' ? bmiLabel : p >= 16 ? 1 : p >= 12 ? 2 : p >= 8 ? 3 : p >= 4 ? 4 : 5
    return { factor, eventId: null, value: p * 2, band: { grade, points: p, min: 0, max: 0 }, points: p }
  })
  const got = factors.filter((f) => f.points !== null)
  const sum = got.reduce((a, f) => a + f.points!, 0)
  const complete = got.length === 5
  const total = complete ? sum : null
  const grade = total === null ? null : total >= 80 ? 1 : total >= 60 ? 2 : total >= 40 ? 3 : total >= 20 ? 4 : 5
  return { factors: factors as StudentPaps['factors'], sum, complete, total, grade, avgGrade: null }
}
const s = (id: string, p: StudentPaps | null, excluded = false, gender: 'M' | 'F' = 'M'): StatInput => ({ id, gender, paps: p, excluded })

describe('PAPS 반 통계 (공식 점수를 세고 평균만 낸다)', () => {
  const list = [
    s('a', paps([20, 18, 16, 16, 20])), // 90 → 1등급
    s('b', paps([10, 12, 8, 10, 20])), // 60 → 2등급
    s('c', paps([4, 6, 2, 8, 12], '과체중')), // 32 → 4등급
    s('d', paps([12, null, null, null, null])), // 미완료
    s('e', null), // 미측정
    s('f', paps([20, 20, 20, 20, 20]), true), // 측정 제외 → 통계에서 뺀다
  ]
  const st = classStat(list)

  it('측정·완료·제외 수', () => {
    expect(st).toMatchObject({ students: 6, excluded: 1, measured: 4, complete: 3 })
  })
  it('종합점수 평균과 등급 분포, 1·2등급 비율', () => {
    expect(st.avgTotal).toBe(60.7) // (90+60+32)/3
    expect(st.gradeDist).toEqual([1, 1, 0, 1, 0])
    expect(st.topRate).toBeCloseTo(2 / 3)
  })
  it('요인별 평균 점수는 그 요인을 측정한 학생만', () => {
    const cardio = st.factors.find((f) => f.factor === '심폐지구력')!
    expect(cardio).toMatchObject({ avg: 11.5, n: 4 }) // (20+10+4+12)/4
    expect(cardio.topRate).toBe(0.5) // 20(1)·12(2) / 4명
    expect(st.factors.find((f) => f.factor === '비만')!.topRate).toBeNull()
  })
  it('약한 요인: 학생마다 가장 낮은 요인(동점은 모두), 하나만 측정한 학생은 빼기', () => {
    // a: 유연성·순발력 16 / b: 유연성 8 / c: 유연성 2 / d: 하나만 측정 → 제외
    expect(st.weakest[0]).toEqual({ factor: '유연성', count: 3 })
    expect(st.weakest.find((w) => w.factor === '순발력')?.count).toBe(1)
  })
  it('BMI 판정별 수 (공식표 순서)', () => {
    expect(st.bmi).toEqual([
      { label: '정상', count: 2 },
      { label: '과체중', count: 1 },
    ])
  })
  it('학생이 없거나 다 미측정이면 평균은 없음', () => {
    const e = classStat([s('x', null)])
    expect(e.avgTotal).toBeNull()
    expect(e.topRate).toBeNull()
    expect(e.factors.every((f) => f.avg === null)).toBe(true)
  })
})

describe('회차 사이 향상', () => {
  it('두 회차 모두 다 측정한 학생만 비교', () => {
    const prev = [paps([10, 10, 10, 10, 10]), paps([20, 20, 20, 20, 20]), paps([10, null, null, null, null]), paps([8, 8, 8, 8, 8])]
    const next = [paps([12, 12, 12, 12, 12]), paps([18, 18, 18, 18, 18]), paps([16, 16, 16, 16, 16]), paps([8, 8, 8, 8, 8])]
    expect(improvement(prev, next)).toEqual({ n: 3, up: 1, same: 1, down: 1, avgDelta: 0 }) // +10, -10, 0
  })
})

describe('분포·지도 필요 학생', () => {
  const list = [s('a', paps([20, 4, 16, 16, 20])), s('b', paps([2, null, null, null, null]), false, 'F'), s('c', null), s('d', paps([1, 1, 1, 1, 1]), true)]
  it('요인 기록 분포: 기록 있는 학생만, 제외 학생 빼기', () => {
    expect(factorValues(list, '심폐지구력').map((v) => [v.id, v.value, v.gender])).toEqual([
      ['a', 40, 'M'],
      ['b', 4, 'F'],
    ])
  })
  it('4·5등급 요인이 있는 학생과 이유', () => {
    expect(needsSupport(list)).toEqual([
      { id: 'a', reasons: ['근력·근지구력 4등급'] },
      { id: 'b', reasons: ['심폐지구력 5등급'] },
    ])
  })
})

describe('분포 그림의 등급 경계', () => {
  it('점수마다 나뉜 공식표 구간에서 등급이 바뀌는 곳만 남긴다 (고1남 왕복오래달리기)', async () => {
    const { gradeEdges } = await import('../src/lib/papsStats')
    const { DEFAULT_STANDARDS } = await import('../src/lib/paps')
    const bands = DEFAULT_STANDARDS.table.shuttleRun['고1'].M
    const edges = gradeEdges(bands)
    expect(edges.map((e) => e.label)).toEqual(['4등급', '3등급', '2등급', '1등급'])
    // 경계값은 공식표의 그 등급 첫 구간 min 그대로
    for (const e of edges) expect(bands.find((b) => `${b.grade}등급` === e.label)!.min).toBe(e.min)
    expect(gradeEdges([])).toEqual([])
  })
})

describe('그래프 개선 (2026-11-09)', () => {
  it('요인별 등급 분포: 숫자 등급 4요인만, 제외 학생 빼기', () => {
    const d = factorGradeDist([s('a', paps([20, 18, 16, 2, 20])), s('b', paps([10, null, 8, 10, 20])), s('c', paps([20, 20, 20, 20, 20]), true), s('d', null)])
    expect(d.map((x) => x.factor)).toEqual(['심폐지구력', '근력·근지구력', '유연성', '순발력'])
    expect(d[0].dist).toEqual([1, 0, 1, 0, 0]) // 20 → 1등급, 10 → 3등급
    expect(d[1].dist).toEqual([1, 0, 0, 0, 0])
    expect(d[3].dist).toEqual([0, 0, 1, 0, 1]) // 2 → 5등급, 10 → 3등급
  })
  it('등급 구역: 첫 구역은 끝없이, 그다음은 등급이 바뀌는 곳 (고1남 왕복오래달리기 5→1등급)', async () => {
    const { DEFAULT_STANDARDS } = await import('../src/lib/paps')
    const z = gradeZones(DEFAULT_STANDARDS.table.shuttleRun['고1'].M)
    expect(z.map((x) => x.grade)).toEqual([5, 4, 3, 2, 1])
    expect(z[0].min).toBeNull()
    expect(gradeZones([])).toEqual([])
  })
})
