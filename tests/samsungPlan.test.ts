import { describe, expect, it } from 'vitest'
import pages from './fixtures/samsung-health-pages.json'
import { buildCells, type PdfPage } from '../src/lib/pdfTable'
import { weeksFromCells } from '../src/lib/planImport'
import { readAssessPlan } from '../src/lib/assessPlanCells'
import { itemsFromWeeks } from '../src/lib/progressPlan'

// 학교알리미 공시: 서귀포 삼성여고 2026 2학기 3학년 운동과 건강 교수·학습 및 평가 계획 (PDF 740~747쪽 칸 좌표, 교사 이름 가림)
// 이 학교 양식은 월 단위 진도표('시수/누계 5/5') + 개요 표 + 성취기준별 상·중·하 평가기준 (세부 채점 기준표 없음)
const cells = (pages as PdfPage[]).map((p) => buildCells(p).cells)

describe('다른 학교 양식 — 월 단위 진도표', () => {
  const p = weeksFromCells(cells.slice(0, 2))
  it('달마다 시수와 단원, 성취기준(범위 포함)', () => {
    expect(p.weeks.map((w) => [w.label, w.hours])).toEqual([
      ['8월', 5],
      ['9월', 9],
      ['10월', 7],
      ['11월', 5],
      ['12월', 8],
    ])
    expect(p.weeks[0].standards).toEqual(['[12운건02-03]', '[12운건02-04]'])
    expect(p.weeks[1]).toMatchObject({ unit: '운동과 안전', standards: ['[12운건03-03]'] })
    expect(p.weeks[0].content).toMatch(/^건강한 삶을 위한/)
    expect(p.weeks[0].method).toContain('강의식수업')
  })
  it('누계 34차시 = 차시로 펼친 수', () => {
    expect(itemsFromWeeks(p.weeks).items).toHaveLength(34)
  })
})

describe('다른 학교 양식 — 개요 표로 평가 만들기', () => {
  const list = readAssessPlan(cells)
  it('평가 2개: 이름 · 배점 · 반영비율 · 시기 · 성취기준', () => {
    expect(list.map((a) => [a.title, a.max, a.ratio, a.when, a.standards])).toEqual([
      ['플레이트야구 기본기능', 100, '50%', '8월', ['[12운건02-03]', '[12운건02-04]']],
      ['학교체육시설 안전탐구활동', 100, '50%', '9월', ['[12운건03-03]']],
    ])
  })
  it('채점은 점수 입력(만점 = 배점), 성취기준별 상·중·하 기준을 붙이고 쪽을 넘어가도 이어 읽는다', () => {
    expect(list[0].item).toMatchObject({ method: 'direct', max: 100 })
    expect(list[0].levelDescs.map((l) => l.label)).toEqual(['[12운건02-03] 상', '[12운건02-03] 중', '[12운건02-03] 하', '[12운건02-04] 상', '[12운건02-04] 중', '[12운건02-04] 하'])
    expect(list[1].levelDescs.map((l) => l.label)).toEqual(['상', '중', '하'])
    expect(list[0].problems[0]).toContain('세부 채점 기준표가 없어요')
  })
})
