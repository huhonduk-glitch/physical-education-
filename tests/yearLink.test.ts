import { describe, expect, it } from 'vitest'
import { applyOverrides, linkAcrossYears, type YearStudent } from '../src/lib/yearLink'

const st = (id: string, schoolYear: number, grade: number, name: string, gender: 'M' | 'F' | null = 'F', classNo = 1): YearStudent => ({ id, schoolYear, grade, classNo, name, gender })

describe('학년도를 넘어 같은 학생 찾기', () => {
  const me = st('now', 2026, 3, '김하늘')
  it('이름 · 성별이 같고 학년이 학년도 차이만큼 다른 학생 (학년도 순, 반은 달라도 됨)', () => {
    const all = [st('a', 2025, 2, '김하늘', 'F', 4), st('b', 2024, 1, '김 하늘', 'F', 2), me, st('c', 2025, 3, '김하늘'), st('d', 2025, 2, '김하늘', 'M')]
    const links = linkAcrossYears(me, all)
    expect(links.map((l) => [l.schoolYear, l.student?.id])).toEqual([
      [2024, 'b'],
      [2025, 'a'],
    ])
  })
  it('같은 학년도에 후보가 둘이면 이어 붙이지 않는다', () => {
    const links = linkAcrossYears(me, [st('a', 2025, 2, '김하늘', 'F', 1), st('b', 2025, 2, '김하늘', 'F', 5)])
    expect(links.map((l) => [l.schoolYear, l.student, l.candidates, l.options.length])).toEqual([[2025, null, 2, 2]])
  })
  it('성별이 비어 있으면 이름 · 학년으로만, 뒤 학년도(지난 학년도를 볼 때)도 찾는다', () => {
    const old = st('old', 2025, 1, '박나래', null)
    expect(linkAcrossYears(old, [st('x', 2026, 2, '박나래', 'M')]).map((l) => l.student?.id)).toEqual(['x'])
    expect(linkAcrossYears(old, [st('y', 2026, 1, '박나래', 'M')])).toEqual([]) // 학년이 그대로면 다른 사람
  })
})

describe('교사가 직접 잇고 끊기', () => {
  const me = st('now', 2026, 3, '김하늘')
  const all = [st('a', 2025, 2, '김하늘', 'F', 1), st('b', 2025, 2, '김하늘', 'F', 5), st('c', 2024, 1, '김하늘'), st('z', 2024, 1, '김하늘옛이름')]
  const auto = linkAcrossYears(me, all)
  it('같은 이름이 둘인 학년도는 고른 학생으로, 끊은 학년도는 비움', () => {
    const l = applyOverrides(me, auto, all, { 'now|2025': 'b', 'now|2024': 'none' })
    expect(l.map((x) => [x.schoolYear, x.student?.id ?? null, !!x.manual])).toEqual([
      [2024, null, true],
      [2025, 'b', true],
    ])
  })
  it('이름이 달라 못 찾은 학생(개명 등)도 이을 수 있음', () => {
    const l = applyOverrides(me, auto.filter((x) => x.schoolYear !== 2024), all, { 'now|2024': 'z' })
    expect(l.map((x) => [x.schoolYear, x.student?.id ?? null])).toEqual([
      [2024, 'z'],
      [2025, null],
    ])
  })
})
