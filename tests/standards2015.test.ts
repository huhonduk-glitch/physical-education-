import { describe, expect, it } from 'vitest'
import pages from './fixtures/samsung-health-pages.json'
import { readAssessPlan } from '../src/lib/assessPlanCells'
import { buildCells, type PdfPage } from '../src/lib/pdfTable'
import { findStandards, guessCurriculum, standardByCode, STANDARDS } from '../src/lib/standards'

describe('2015 개정 성취기준 (2026-11-02, 교육부 고시 제2015-74호 [별책 11] 원문)', () => {
  const s2015 = STANDARDS.subjects.filter((s) => s.curriculum === '2015')
  it('중학교 체육 54개 · 고등 체육 19 · 운동과 건강 10 · 스포츠 생활 11 · 체육 탐구 11', () => {
    expect(s2015.filter((s) => s.school === '중').map((s) => s.subject)).toEqual(['체육 (2015)'])
    const counts = Object.fromEntries(s2015.map((s) => [`${s.school} ${s.subject}`, s.areas.reduce((k, a) => k + a.standards.length, 0)]))
    expect(counts).toEqual({ '중 체육 (2015)': 54, '고 체육 (2015)': 19, '고 운동과 건강 (2015)': 10, '고 스포츠 생활 (2015)': 11, '고 체육 탐구 (2015)': 11 })
  })
  it('문장은 모두 "다."로 끝나고, 쪽이 넘어가 잘렸던 두 문장은 이어 붙였다', () => {
    for (const s of s2015) for (const a of s.areas) for (const x of a.standards) expect(x.text, x.code).toMatch(/다\.$/)
    expect(standardByCode(STANDARDS, '[9체03-04]', '2015')?.text).toBe('영역형 경쟁 스포츠에 참여하면서 경기 규칙을 준수하고, 상대방을 존중하며, 정정당당하게 경기한다.')
    expect(standardByCode(STANDARDS, '[9체02-11]', '2015')?.text).toMatch(/맞게 전략을 진단하여 창의적으로 적용한다\.$/)
  })
  it('같은 번호가 두 판에 있으면 고른 판의 문장', () => {
    const a = standardByCode(STANDARDS, '[9체01-01]', '2015')!
    const b = standardByCode(STANDARDS, '[9체01-01]', '2022')!
    expect(a.curriculum).toBe('2015')
    expect(b.curriculum).toBe('2022')
    expect(a.text).not.toBe(b.text)
    expect(a.text).toMatch(/^건강과 신체활동/)
  })
  it('계획서 번호로 판 가리기: 2015에만 있는 번호가 많으면 2015', () => {
    expect(guessCurriculum(STANDARDS, ['[12운건02-03]', '[12운건02-04]', '[12운건01-01]'])).toBe('2015')
    expect(guessCurriculum(STANDARDS, ['[9체01-01]'])).toBe('2022')
    expect(guessCurriculum(STANDARDS, [])).toBe('2022')
  })
  it('학교급 · 과목으로 찾기', () => {
    expect(findStandards(STANDARDS, { school: '고', subject: '운동과 건강 (2015)' })).toHaveLength(10)
  })
  it('2015 개정 학교의 평가계획서(삼성여고 운동과 건강 공시본): 판을 2015로 가리고 성취기준 문장이 채워진다', () => {
    const cells = (pages as unknown as PdfPage[]).map((p) => buildCells(p).cells)
    const list = readAssessPlan(cells)
    const codes = list.flatMap((a) => a.standards)
    expect(codes).toEqual(['[12운건02-03]', '[12운건02-04]', '[12운건03-03]'])
    const cur = guessCurriculum(STANDARDS, codes)
    expect(cur).toBe('2015')
    for (const c of codes) expect(standardByCode(STANDARDS, c, cur)?.curriculum, c).toBe('2015')
    expect(standardByCode(STANDARDS, '[12운건02-03]', cur)?.text).toMatch(/^건강한 삶을 위한 체력의 중요성/)
  })
})
