import { describe, expect, it } from 'vitest'
import pages from './fixtures/plan-pdf-pages.json'
import { buildCells, cleanRects, joinTexts, type PdfPage } from '../src/lib/pdfTable'
import { cleanUnit, standardCodes, summarize, textToGrid, weeksFromCells, weeksFromGrid } from '../src/lib/planImport'
import { itemsFromWeeks } from '../src/lib/progressPlan'

// 서울 한 고등학교 2026 2학기 스포츠생활2 평가계획서의 '교수학습 운영 계획' 두 쪽 (학교·교사 이름이 없는 쪽만 칸 좌표로 저장)
const parsed = weeksFromCells((pages as PdfPage[]).map((p) => buildCells(p).cells))

describe('PDF 표 → 칸', () => {
  it('글자를 가장 작은 칸에 넣고, 줄은 띄어 잇는다', () => {
    const page: PdfPage = {
      width: 600,
      height: 800,
      rects: [
        { x0: 0, y0: 0, x1: 600, y1: 800 },
        { x0: 10, y0: 100, x1: 200, y1: 200 },
        { x0: 10, y0: 100, x1: 100, y1: 200 },
      ],
      texts: [
        { x: 20, y: 150, w: 30, h: 10, str: '1. 배드민턴' },
        { x: 20, y: 138, w: 30, h: 10, str: '이해하기' },
        { x: 300, y: 500, w: 30, h: 10, str: '표 밖' },
      ],
    }
    const { cells, outside } = buildCells(page)
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ x1: 100, text: '1. 배드민턴 이해하기' })
    expect(outside.map((t) => t.str)).toEqual(['표 밖'])
    expect(cleanRects(page.rects, page)).toHaveLength(2)
    expect(joinTexts([{ x: 50, y: 10, w: 5, h: 10, str: 'B' }, { x: 10, y: 10, w: 5, h: 10, str: 'A' }])).toBe('A B')
  })
})

describe('평가계획서 PDF → 주차 계획', () => {
  it('22주를 모두 찾고 시수를 읽는다', () => {
    expect(parsed.weeks.map((w) => w.week)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
    expect(parsed.weeks.map((w) => w.hours)).toEqual([1, 2, 2, 2, 2, 2, 1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 1, 2])
    expect(parsed.warnings).toEqual([])
  })
  it('합쳐진 단원 칸을 여러 주에 나눠 넣는다', () => {
    const w = (n: number) => parsed.weeks.find((x) => x.week === n)!
    expect(w(1)).toMatchObject({ unit: '오렌테이션 및 안전교육', standards: [], month: 8 })
    expect(w(2)).toMatchObject({ unit: '배드민턴 이해하기', standards: ['[12스생2-01-01]'] })
    expect(w(3).unit).toBe('배드민턴 이해하기')
    expect(w(4)).toMatchObject({ unit: '배드민턴 실천하기', month: 9 })
    for (const n of [5, 6, 7, 8]) expect(w(n)).toMatchObject({ unit: '클리어, 스매시, 드롭샷을 활용한 간이 경기', standards: ['[12스생2-01-02]'] })
    for (const n of [13, 14, 15, 16]) expect(w(n)).toMatchObject({ unit: '단식경기전술', standards: ['[12스생2-01-03]'], month: 11 })
    expect(w(22)).toMatchObject({ unit: '배드민턴 생활화하기', month: 1 })
  })
  it('중간·기말고사 주는 차시 없이 표시만', () => {
    expect(parsed.weeks.filter((w) => w.event).map((w) => [w.week, w.event])).toEqual([
      [9, '중간고사'],
      [18, '기말고사'],
    ])
  })
  it('수업 방법 · 평가 연계도 읽는다', () => {
    const w6 = parsed.weeks.find((x) => x.week === 6)!
    expect(w6.method).toContain('탐구학습')
    expect(w6.evalNote).toContain('빈칸채우기')
  })
  it('범교과 연계 계획 (시기 + 주제)', () => {
    expect(parsed.extras.map((e) => e.when)).toEqual(expect.arrayContaining(['9월 6주차', '8월 2주차', '10월 12주차', '8월 3주차', '10월 11주차']))
    expect(parsed.extras.find((e) => e.when === '8월 2주차')?.label).toContain('응급처치')
    expect(parsed.extras.find((e) => e.when === '8월 2주차')?.label).toContain('안전교육')
  })
  it('차시로 펼치면 고사 주를 뺀 시수 합계', () => {
    const s = summarize(parsed)
    const { items, events } = itemsFromWeeks(parsed.weeks)
    expect(items).toHaveLength(s.lessons)
    expect(s.lessons).toBe(35)
    expect(events).toHaveLength(2)
  })
})

describe('엑셀 · 붙여넣기 → 주차 계획', () => {
  it('머리글을 찾고, 비어 있는(합친) 칸은 위 단원을 이어 쓴다', () => {
    const p = weeksFromGrid([
      ['2026 2학기 진도표'],
      ['월', '주(학점)', '단원명', '교육과정 성취기준', '수업방법', '평가방법'],
      ['8', '1(1)', '1. 오리엔테이션', '', '강의식', ''],
      ['', '2(2)', '2. 배드민턴 이해하기', '[12스생2-01-01] 네트형…', '', ''],
      ['', '3(2)', '', '', '', ''],
      ['10', '9(0)', '', '중간고사', '', ''],
    ])
    expect(p.weeks).toEqual([
      { month: 8, week: 1, hours: 1, unit: '오리엔테이션', standards: [], method: '강의식' },
      { month: 8, week: 2, hours: 2, unit: '배드민턴 이해하기', standards: ['[12스생2-01-01]'] },
      { month: 8, week: 3, hours: 2, unit: '배드민턴 이해하기', standards: ['[12스생2-01-01]'] },
      { month: 10, week: 9, hours: 0, unit: '', standards: [], event: '중간고사' },
    ])
  })
  it('차시 열이 있으면 한 줄 = 한 차시, 내용 열은 학습 내용', () => {
    const p = weeksFromGrid(textToGrid('차시\t단원\t학습 내용\n1\t농구\t드리블\n2\t\t패스'))
    expect(p.weeks.map((w) => [w.hours, w.unit, w.content])).toEqual([
      [1, '농구', '드리블'],
      [1, '농구', '패스'],
    ])
  })
  it('머리글이 없으면 알려 준다', () => {
    expect(weeksFromGrid([['a', 'b']]).warnings[0]).toContain('머리글')
  })
})

describe('코드 · 단원 이름', () => {
  it('괄호가 빠진 성취기준 코드도 찾는다', () => {
    expect(standardCodes('〔12스생2-01-01네트형 … [12체육1-02-01]')).toEqual(['[12스생2-01-01]', '[12체육1-02-01]'])
    expect(cleanUnit('1. 배드민턴  이해하기')).toBe('배드민턴 이해하기')
    expect(cleanUnit('가) 농구')).toBe('농구')
  })
})
