import { describe, expect, it } from 'vitest'
import type { Cell } from '../src/lib/pdfTable'
import { assessmentsFromCells, planTotals } from '../src/lib/assessPlanCells'
import { itemPoints } from '../src/lib/assessScore'

// 교사가 준 평가계획서(2026 2학기 스포츠생활2)의 '수행평가 세부계획' 표 모양을 본뜬 칸 (좌표는 비슷하게 만든 것)
const c = (x0: number, y0: number, x1: number, y1: number, text: string): Cell => ({ x0, y0, x1, y1, text })

function task(top: number, o: { std: string; elements: string; title: string; max: number; ratio: string; when: string; name: string; rows: [string, number][]; methods: string[] }): Cell[] {
  const y = (d: number) => top - d
  const out: Cell[] = [
    c(60, y(20), 120, y(0), '교육과정 영역'),
    c(120, y(20), 540, y(0), '네트형 스포츠'),
    c(60, y(40), 120, y(20), '성취기준'),
    c(120, y(40), 540, y(20), o.std),
    c(60, y(80), 120, y(40), '평가요소'),
    c(120, y(80), 540, y(40), o.elements),
    c(60, y(130), 120, y(80), '평가방법'),
    c(120, y(97), 540, y(80), o.methods[0]),
    c(120, y(114), 540, y(97), o.methods[1]),
    c(120, y(130), 540, y(114), o.methods[2]),
    c(60, y(150), 120, y(130), '평가시기'),
    c(120, y(150), 220, y(130), o.when),
    c(220, y(150), 300, y(130), '반영비율'),
    c(300, y(150), 380, y(130), o.ratio),
    c(380, y(150), 440, y(130), '만점'),
    c(440, y(150), 540, y(130), `${o.max}점`),
    c(60, y(180), 120, y(155), '평가과제 (배점)'),
    c(120, y(180), 540, y(155), '성취수준별 예상 득점 및 수행 특성'),
    c(60, y(270), 120, y(180), `${o.title} (${o.max}점)`),
    c(120, y(210), 140, y(180), 'A'),
    c(140, y(210), 540, y(180), 'A 수준 설명'),
    c(120, y(240), 140, y(210), 'B'),
    c(140, y(240), 540, y(210), 'B 수준 설명'),
    c(120, y(270), 140, y(240), 'C'),
    c(140, y(270), 540, y(240), 'C 수준 설명'),
    c(60, y(300 + o.rows.length * 20), 80, y(280), '채 점 기 준'),
    c(80, y(300), 150, y(280), '채점요소'),
    c(150, y(300), 500, y(280), '기대 수행'),
    c(500, y(300), 540, y(280), '배점'),
    c(80, y(300 + o.rows.length * 20), 150, y(300), o.name),
  ]
  o.rows.forEach(([e, p], i) => {
    out.push(c(150, y(320 + i * 20), 500, y(300 + i * 20), e), c(500, y(320 + i * 20), 540, y(300 + i * 20), `${p}점`))
  })
  return out
}

const page1 = [
  // 개요 표(5. 평가 영역 및 반영 비율)의 '교육과정 영역'은 평가로 읽지 않는다
  c(60, 790, 140, 805, '교육과정 영역'),
  c(140, 790, 540, 805, '네트형 스포츠'),
  ...task(760, {
    std: '[12스생2-01-01] 네트형 스포츠의 문화를 이해하고 존중하며, 스포츠퍼슨십을 실천한다.',
    elements: '• 포핸드와 백핸드를 번갈아가면서 타격하여 성공한 횟수로 평가한다.',
    title: '배드민턴 스트로크 수행하기',
    max: 40,
    ratio: '40%',
    when: '9월 중',
    name: '배드민턴 스트로크',
    methods: ['□ 서술・논술 □ 구술・발표', '■ 실기·시연 □ 포트폴리오 □ 기타 ( )', '■ 교사 관찰 및 기록 □ 자기평가 □ 동료평가'],
    rows: [
      ['남자 20회 이상, 여자 15회 이상', 40],
      ['남자 18-19회, 여자 13-14회', 37],
      ['남자 16-17회, 여자 11-12회', 34],
      ['남자 14-15회, 여자 9-12회', 31],
      ['남자 12-13회, 여자 7-8회', 28],
      ['남자 11회 이하, 여자 6회 이하', 25],
      ['자발적 미참여, 장기 미인정 결석', 24],
    ],
  }),
]
const page2 = task(780, {
  std: '[12스생2-01-02] 네트형 스포츠에 필요한 체력을 강화하고, 경기 기능을 과학적으로 분석하여 발전시켜 다른 기능에 전이한다.',
  elements: '• 스포츠 응용과학 연구하기 1) 기한내에 보고서를 제출하였는가? 2) 보고서의 분량이 적당한가? 3) 양식의 모든 항목이 빠짐없이 기재되었는가? 4) 비교•분석하였는가? 5) 주제가 창의적인가? 6) 주제선정의 이유가 타당한가? 7) 논리적으로 기술하였는가?',
  title: '스포츠 융합 진로탐구 프로젝트',
  max: 20,
  ratio: '20%',
  when: '10월 중',
  name: '스포츠융합 진로탐구 프로젝트',
  methods: ['□ 서술・논술 ■ 조사·관찰보고서', '□ 실기·시연 ■ 프로젝트', '■ 교사 관찰 및 기록'],
  rows: [
    ['평가 요소를 모두 만족하는 경우', 20],
    ['평가 요소를 6개 만족하는 경우', 18],
    ['평가 요소를 5개 만족하는 경우', 16],
    ['평가 요소를 4개 만족하는 경우', 14],
    ['평가 요소를 3개 만족하는 경우', 12],
    ['평가 요소를 2개 이하로 만족하는 경우', 10],
    ['자발적 미참여, 장기 미인정 결석', 9],
  ],
})

const list = assessmentsFromCells([page1, page2])

describe('평가계획서 → 평가 목록', () => {
  it('세부계획 표마다 평가 하나 (개요 표는 건너뜀)', () => {
    expect(list.map((a) => [a.title, a.max, a.ratio, a.when])).toEqual([
      ['배드민턴 스트로크 수행하기', 40, '40%', '9월 중'],
      ['스포츠 융합 진로탐구 프로젝트', 20, '20%', '10월 중'],
    ])
    expect(planTotals(list)).toEqual({ max: 60, ratio: 60 })
  })
  it('성취기준 · ■ 평가방법 · 성취수준 A/B/C', () => {
    expect(list[0].standards).toEqual(['[12스생2-01-01]'])
    expect(list[0].methods).toEqual(['실기·시연', '교사 관찰 및 기록'])
    expect(list[0].levelDescs.map((l) => l.label)).toEqual(['A', 'B', 'C'])
    expect(list[0].levelDescs[0].desc).toBe('A 수준 설명')
  })
  it('채점 기준 → 남녀 기록표 + 계획서의 겹치는 구간 알림', () => {
    const it0 = list[0].item!
    expect(it0.label).toBe('배드민턴 스트로크')
    expect(itemPoints(it0, 15, 'F')).toBe(40)
    expect(itemPoints(it0, 15, 'M')).toBe(31)
    expect(itemPoints(it0, '미참여', 'M')).toBe(24)
    expect(list[0].problems).toEqual(['여자 11~12회가 34점(11~12회)과 31점(9~12회) 두 구간에 겹쳐요'])
  })
  it('프로젝트 → 평가 요소 7개 체크리스트', () => {
    const it1 = list[1].item!
    expect(it1.checks).toHaveLength(7)
    expect(itemPoints(it1, 6)).toBe(18)
    expect(list[1].problems).toEqual([])
  })
})
