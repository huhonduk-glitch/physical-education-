import { describe, expect, it } from 'vitest'
import { buildItem, checkedMethods, checklistFrom, parseExpect, titleAndMax } from '../src/lib/assessPlan'
import { itemMax, itemPoints, totalOf } from '../src/lib/assessScore'

// 교사가 준 2026 2학기 스포츠생활2 평가계획서의 채점 기준 (그대로 옮김 — 계획서의 겹치는 구간 포함)
const stroke = [
  { expect: '남자 20회 이상, 여자 15회 이상', points: 40 },
  { expect: '남자 18-19회, 여자 13-14회', points: 37 },
  { expect: '남자 16-17회, 여자 11-12회', points: 34 },
  { expect: '남자 14-15회, 여자 9-12회', points: 31 },
  { expect: '남자 12-13회, 여자 7-8회', points: 28 },
  { expect: '남자 11회 이하, 여자 6회 이하', points: 25 },
  { expect: '자발적 미참여, 장기 미인정 결석', points: 24 },
]
const rally = [
  { expect: '남자 80회 이상, 여자 70회 이상', points: 40 },
  { expect: '남자 70-79회, 여자 60-69회', points: 37 },
  { expect: '남자 60-79회, 여자 50-59회', points: 34 },
  { expect: '남자 50-79회, 여자 40-49회', points: 31 },
  { expect: '남자 40-79회, 여자 30-39회', points: 28 },
  { expect: '남자 39회 이하, 여자 29회 이하', points: 25 },
  { expect: '자발적 미참여, 장기 미인정 결석', points: 24 },
]
const project = [
  { expect: '평가 요소를 모두 만족하는 경우', points: 20 },
  { expect: '평가 요소를 6개 만족하는 경우', points: 18 },
  { expect: '평가 요소를 5개 만족하는 경우', points: 16 },
  { expect: '평가 요소를 4개 만족하는 경우', points: 14 },
  { expect: '평가 요소를 3개 만족하는 경우', points: 12 },
  { expect: '평가 요소를 2개 이하로 만족하는 경우', points: 10 },
  { expect: '자발적 미참여, 장기 미인정 결석', points: 9 },
]

describe('기대 수행 문장', () => {
  it('남녀 범위 · 이상 · 이하 · 미참여 · 개수', () => {
    expect(parseExpect('남자 18-19회, 여자 13-14회')).toEqual({ kind: 'range', m: { min: 18, max: 19 }, f: { min: 13, max: 14 }, unit: '회' })
    expect(parseExpect('남자 20회 이상, 여자 15회 이상')).toMatchObject({ m: { min: 20 }, f: { min: 15 } })
    expect(parseExpect('남자 11회 이하, 여자 6회 이하')).toMatchObject({ m: { max: 11 }, f: { max: 6 } })
    expect(parseExpect('15회 이상')).toMatchObject({ kind: 'range', m: { min: 15 }, f: { min: 15 } })
    expect(parseExpect('자발적 미참여, 장기 미인정 결석')).toEqual({ kind: 'nonpart' })
    expect(parseExpect('평가 요소를 모두 만족하는 경우')).toEqual({ kind: 'count', all: true })
    expect(parseExpect('평가 요소를 2개 이하로 만족하는 경우')).toEqual({ kind: 'count', max: 2 })
    expect(parseExpect('열심히 함').kind).toBe('unknown')
  })
})

describe('채점 기준 → 기록표', () => {
  it('스트로크: 남녀 기준이 따로, 최저 구간은 기본 점수, 미참여 24점', () => {
    const { item, problems } = buildItem('배드민턴 스트로크', stroke, { id: 'x' })
    expect(item).toMatchObject({ method: 'record', better: 'higher', unit: '회', basePoints: 25, basePointsF: 25, nonPartPoints: 24 })
    expect(itemMax(item)).toBe(40)
    expect(itemPoints(item, 20, 'M')).toBe(40)
    expect(itemPoints(item, 19, 'M')).toBe(37)
    expect(itemPoints(item, 15, 'F')).toBe(40)
    expect(itemPoints(item, 15, 'M')).toBe(31)
    expect(itemPoints(item, 3, 'F')).toBe(25)
    expect(itemPoints(item, '미참여', 'F')).toBe(24)
    // 계획서의 오류: 여자 11~12회가 34점과 31점 구간에 겹친다
    expect(problems).toEqual(['여자 11~12회가 34점(11~12회)과 31점(9~12회) 두 구간에 겹쳐요'])
  })
  it('랠리: 남자 구간 세 곳이 37점 구간과 겹친다', () => {
    const { problems } = buildItem('배드민턴 랠리', rally, { id: 'y' })
    expect(problems.filter((p) => p.startsWith('남자'))).toHaveLength(6)
    expect(problems.some((p) => p.includes('70~79회가 37점(70~79회)과 34점(60~79회)'))).toBe(true)
    expect(problems.some((p) => p.startsWith('여자'))).toBe(false)
  })
  it('프로젝트: 평가 요소 7개 체크리스트, 만족 개수로 점수', () => {
    const checks = ['기한내에 보고서를 제출하였는가?', '분량이 적당한가?', '빠짐없이 기재되었는가?', '비교·분석하였는가?', '주제가 창의적인가?', '이유가 타당한가?', '논리적으로 기술하였는가?']
    const { item, problems } = buildItem('스포츠융합 진로탐구 프로젝트', project, { id: 'z', checks })
    expect(problems).toEqual([])
    expect(item).toMatchObject({ unit: '개', basePoints: 10, nonPartPoints: 9, checks })
    expect(itemPoints(item, 7)).toBe(20)
    expect(itemPoints(item, 6)).toBe(18)
    expect(itemPoints(item, 3)).toBe(12)
    expect(itemPoints(item, 1)).toBe(10)
    expect(itemMax(item)).toBe(20)
  })
  it('낮을수록 좋은 기록(달리기 초)도 읽는다', () => {
    const { item } = buildItem('50m', [
      { expect: '8초 이하', points: 10 },
      { expect: '8.1-9초', points: 8 },
      { expect: '9.1초 이상', points: 6 },
    ], { id: 'r' })
    expect(item.better).toBe('lower')
    expect(itemPoints(item, 7.9)).toBe(10)
    expect(itemPoints(item, 8.5)).toBe(8)
    expect(itemPoints(item, 10)).toBe(6)
  })
  it('남녀가 섞인 평가 합계는 학생 성별로', () => {
    const { item } = buildItem('스트로크', stroke, { id: 'x' })
    expect(totalOf([item], { x: 15 }, 'F').total).toBe(40)
    expect(totalOf([item], { x: 15 }, 'M').total).toBe(31)
  })
})

describe('계획서 칸 글', () => {
  it('제목(만점) · ■ 평가방법 · 평가요소 목록', () => {
    expect(titleAndMax('배드민턴 스트로크 수행하기 (40점)')).toEqual({ title: '배드민턴 스트로크 수행하기', max: 40 })
    expect(checkedMethods('□ 서술·논술 □ 구술·발표 ■ 실기·시연 □ 포트폴리오 □ 기타 ( ) ■ 교사 관찰 및 기록 □ 자기평가')).toEqual(['실기·시연', '교사 관찰 및 기록'])
    expect(checklistFrom('• 스포츠 응용과학 연구하기 1) 기한내에 보고서를 제출하였는가? 2) 보고서의 분량이 적당한가?')).toEqual(['기한내에 보고서를 제출하였는가?', '보고서의 분량이 적당한가?'])
  })
})
