import { describe, expect, it } from 'vitest'
import { ASSESS_TEMPLATES } from '../src/data/assessTemplates'
import type { Assessment, AssessmentScore } from '../src/db/types'
import { areaTotal, checklistBands, itemPoints, levelOf, toggleCheck } from '../src/lib/assessScore'
import { criteriaLines, recordSheet } from '../src/lib/assessSheet'

let n = 0
const newId = () => `id${++n}`
const make = (tid: string): Assessment => ({ id: 'a', schoolYear: 2026, grade: 3, rubric: [], altTaskEnabled: false, groupIds: ['g'], ...ASSESS_TEMPLATES.find((t) => t.id === tid)!.build(newId) })
const score = (p: Partial<AssessmentScore>): AssessmentScore => ({ id: 's', assessmentId: 'a', studentId: 'x', scores: {}, ...p })

describe('체크리스트형 (교사 안전탐구 기록지: 30 + 만족 수 × 10)', () => {
  const a = make('checklist')
  const it0 = a.items![0]
  it('개수별 점수', () => {
    expect(checklistBands(7, 30, 10)[0]).toEqual({ limit: 7, points: 100 })
    for (const [cnt, pts] of [[7, 100], [6, 90], [5, 80], [3, 60], [1, 40], [0, 30]]) expect(itemPoints(it0, cnt)).toBe(pts)
  })
  it('항목 체크 → 개수', () => {
    let r = toggleCheck(undefined, 2)
    r = toggleCheck(r.list, 0)
    expect(r).toEqual({ list: [0, 2], count: 2 })
    expect(toggleCheck(r.list, 2)).toEqual({ list: [0], count: 1 })
  })
  it('제출 구분이 요소 점수보다 먼저', () => {
    expect(areaTotal(a, score({ scores: { [it0.id]: 5 } })).total).toBe(80)
    const t = areaTotal(a, score({ scores: { [it0.id]: 5 }, status: '백지 제출' }))
    expect(t).toMatchObject({ total: 20, complete: true, status: '백지 제출' })
    expect(areaTotal(a, score({ status: '미응시(미인정)' })).total).toBe(15)
    expect(areaTotal(a, score({ status: '없는 구분' })).done).toBe(0)
  })
  it('기록표: 탐구주제 · 항목 칸 · 만족 수 · 점수 · 제출 구분 · 합계', () => {
    const rows = recordSheet(a, a.items!, [{ no: '1', name: '학생A', gender: 'F', score: score({ scores: { [it0.id]: 2 }, checks: { [it0.id]: [0, 3] }, texts: { 탐구주제: '계단 단차' } }) }])
    expect(rows[0].slice(0, 3)).toEqual(['번호', '이름', '탐구주제'])
    expect(rows[1].slice(3, 11)).toEqual(['①', '②', '③', '④', '⑤', '⑥', '⑦', '만족 수'])
    expect(rows[0]).toContain('제출 구분')
    expect(rows[0]).not.toContain('수준')
    expect(rows[2]).toEqual(['1', '학생A', '계단 단차', 'O', '', '', 'O', '', '', '', 2, 50, '', '50', ''])
  })
  it('빈 기록지는 번호 · 이름만', () => {
    const rows = recordSheet(a, a.items!, [{ no: '1', name: '학생A', gender: 'F', score: score({ scores: { [it0.id]: 7 } }) }], true)
    expect(rows[2].slice(2).every((c) => c === '')).toBe(true)
  })
})

describe('루브릭형 (교사 탐구보고서: 융합성 40 · 전문성 30 · 결론 30, 상 90 · 중 60)', () => {
  const a = make('rubric')
  const [i1, i2, i3] = a.items!
  it('합계와 수준', () => {
    const t = areaTotal(a, score({ scores: { [i1.id]: '40', [i2.id]: '30', [i3.id]: '24' } }))
    expect(t).toMatchObject({ total: 94, max: 100, complete: true })
    expect(levelOf(a.levelCuts, 94, 100)).toBe('상')
    expect(levelOf(a.levelCuts, 90, 100)).toBe('상')
    expect(levelOf(a.levelCuts, 89, 100)).toBe('중')
    expect(levelOf(a.levelCuts, 59, 100)).toBe('하')
    expect(levelOf(undefined, 90, 100)).toBe('')
  })
  it('등급 이름 = 점수면 점수 칸 하나, 수준 칸 있음', () => {
    const rows = recordSheet(a, a.items!, [{ no: '2', name: '학생B', gender: 'F', score: score({ status: '미응시' }) }])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['번호', '이름', '융합성(40)', '전문성(30)', '결론/제언(30)', '제출 구분', '합계(100)', '수준', '비고'])
    expect(rows[1]).toEqual(['2', '학생B', '', '', '', '미응시', '25', '하', ''])
  })
  it('채점 기준', () => {
    const c = criteriaLines(a, a.items!)
    expect(c[0].title).toBe('융합성 (40점)')
    expect(c[0].lines[0]).toBe('40점 메가 이벤트 요소와 진로 희망 분야를 연계한 구체적 키워드 3개 이상 포함')
    expect(c.at(-1)!.lines).toEqual(['상: 만점의 90% 이상', '중: 만점의 60% 이상', '하: 그 밖'])
  })
})
