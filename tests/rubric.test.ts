import { describe, expect, it } from 'vitest'
import { buildRubric, levelPoints, METHOD_ORDER, METHODS, pickSteps, recommendMethods, rubricTable, rubricToItems, splitMax } from '../src/lib/rubric'
import { findStandards, type StandardsData } from '../src/lib/standards'
import { assessmentProblems, itemMax } from '../src/lib/assessScore'

describe('루브릭 만들기', () => {
  it('성취기준 낱말로 평가 방법 추천', () => {
    expect(recommendMethods('경기 상황에서 전략을 적용하여 팀과 협력한다')[0].method).toBe('game')
    expect(recommendMethods('자신의 체력을 분석하여 운동 계획을 세운다')[0].method).toBe('report')
    expect(recommendMethods('움직임 요소를 활용하여 작품을 창작하고 표현한다')[0].method).toBe('expression')
    expect(recommendMethods('아무 관련 없는 글')).toEqual([{ method: 'skill', words: [] }])
  })
  it('단계 고르기 · 만점 나누기 · 등급 점수', () => {
    expect(pickSteps(3)).toEqual([0, 2, 4])
    expect(pickSteps(5)).toEqual([0, 1, 2, 3, 4])
    expect(splitMax(100, [0.4, 0.3, 0.3])).toEqual([40, 30, 30])
    expect(splitMax(25, [0.35, 0.35, 0.3]).reduce((a, b) => a + b)).toBe(25)
    expect(levelPoints(40, 5)).toEqual([40, 34, 28, 22, 16])
    expect(levelPoints(30, 3)).toEqual([30, 21, 12])
  })
  it('모든 방법·단계에서 요소 만점 합 = 만점, 내용이 문장에 들어감, 빈 기준 없음', () => {
    for (const m of METHOD_ORDER)
      for (const lv of [['상', '중', '하'], ['A', 'B', 'C', 'D'], ['A', 'B', 'C', 'D', 'E']])
        for (const max of [100, 30, 25]) {
          const rows = buildRubric({ method: m, content: '농구 레이업 슛', levels: lv, max })
          expect(rows.reduce((a, r) => a + r.max, 0)).toBe(max)
          for (const r of rows) {
            if (r.record) continue
            expect(r.levels.map((l) => l.label)).toEqual(lv)
            expect(r.levels[0].points).toBe(r.max)
            for (const l of r.levels) {
              expect(l.desc).not.toBe('')
              expect(l.desc).not.toContain('{c}')
            }
          }
        }
    const rows = buildRubric({ method: 'skill', content: '농구 레이업 슛', levels: ['A', 'B', 'C'], max: 100 })
    expect(rows[0].levels[0].desc).toBe('농구 레이업 슛의 동작을 정확하고 안정적으로 수행한다')
  })
  it('수행평가 요소로 바꾸면 만점이 같고, 기록 요소는 구간을 넣으라고 막는다', () => {
    let n = 0
    const id = () => `i${n++}`
    const rows = buildRubric({ method: 'skill', content: '배구 언더핸드 패스', levels: ['A', 'B', 'C', 'D', 'E'], max: 100 })
    const items = rubricToItems(rows, id)
    expect(items.reduce((a, it) => a + itemMax(it), 0)).toBe(100)
    expect(items[0].levels?.[0].desc).toContain('배구 언더핸드 패스')
    expect(assessmentProblems('배구', items)).toEqual([])
    const rec = rubricToItems(buildRubric({ method: 'record', content: '줄넘기', levels: ['상', '중', '하'], max: 50 }), id)
    expect(rec[0]).toMatchObject({ label: '줄넘기 기록', method: 'record', bands: [] })
    expect(assessmentProblems('줄넘기', rec).join()).toContain('기록 구간')
  })
  it('표로 내보내기', () => {
    const t = rubricTable(buildRubric({ method: 'practice', content: '배드민턴', levels: ['상', '중', '하'], max: 30 }), ['상', '중', '하'])
    expect(t[0]).toEqual(['평가 요소', '배점', '상', '중', '하'])
    expect(t).toHaveLength(1 + METHODS.practice.elements.length)
  })
})

describe('성취기준 목록 찾기', () => {
  const data: StandardsData = {
    source: '테스트',
    subjects: [{ school: '고', curriculum: '2022', subject: '과목가', areas: [{ area: '영역1', standards: [{ code: '[가01-01]', text: '경기 전략을 적용한다' }] }] }],
  }
  it('학교급·과목·낱말 (띄어쓰기 무시)', () => {
    expect(findStandards(data, { school: '고', text: '경기전략' })).toHaveLength(1)
    expect(findStandards(data, { school: '중' })).toHaveLength(0)
    expect(findStandards(data, { subject: '과목가', text: '가01' })[0]).toMatchObject({ area: '영역1', subject: '과목가' })
  })
})
