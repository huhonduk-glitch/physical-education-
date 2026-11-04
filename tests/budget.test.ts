import { describe, expect, it } from 'vitest'
import { BudgetFileError, DEFAULT_LAYOUT, groupItems, isPicked, looksPe, money, nameRange, parseBudgetCard, pasteRange, sheetLabel, sheetRows, toTsv } from '../src/lib/budget'

// 에듀파인 사업관리카드(예산) 모양을 본뜬 가상 표 (금액 · 항목은 지어낸 값)
const G = [
  ['사업관리카드(예산)', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', ''],
  ['세부사업/세부항목/원가통계비목', '산출내역', '예산현액(A)', '집행', '', '', '', '', '예산잔액(A-B)'],
  ['', '', '', '지출품의금액', '원인행위금액(B)', '집행률(B/A)', '지출결의금액', '지급액', ''],
  [' 합 계', '', '9,000,000', '0', '4,000,000', '', '', '', '5,000,000'],
  ['    자율·자치활동', '', '3000000', '', '1500000', '', '', '', '1500000'],
  ['       체육대회', '', '1000000', '', '1000000', '', '', '', '0'],
  ['          교육운영비', '체육대회운영비', '1000000', '', '1000000', '100', '', '', '0'],
  ['       민주적학교운영', '', '2000000', '', '500000', '', '', '', '1500000'],
  ['          교육운영비', '학교문화 운영비', '2000000', '', '500000', '', '', '', '1500000'],
  ['    동아리활동', '', '6000000', '', '2500000', '', '', '', '3500000'],
  ['       (통합)학교스포츠클럽활성화', '', '4000000', '', '2000000', '', '', '', '2000000'],
  ['          운영수당', '클럽 강사비', '1000000', '', '400000', '', '', '', '600000'],
  ['          교육운영비', '학교스포츠클럽 운영비', '3,000,000', '', '1,600,000', '', '', '', '1,400,000'],
  ['       서포터즈동아리운영', '', '2000000', '', '500000', '', '', '', '1500000'],
  ['          교육운영비', '서포터즈 동아리활동 운영비', '2000000', '', '830000', '', '', '', '-330,000'],
]

describe('사업관리카드 읽기', () => {
  const card = parseBudgetCard(G)
  it('단위사업 · 세부사업 · 비목 · 산출내역 · 금액', () => {
    expect(card.items).toHaveLength(5)
    expect(card.items[0]).toMatchObject({ unit: '자율·자치활동', detail: '체육대회', cost: '교육운영비', name: '체육대회운영비', budget: 1000000, spent: 1000000, left: 0 })
    expect(card.items[3]).toMatchObject({ detail: '(통합)학교스포츠클럽활성화', budget: 3000000, spent: 1600000, left: 1400000 })
    expect(card.items[4].left).toBe(-330000)
    expect(card.total).toEqual({ budget: 9000000, spent: 4000000, left: 5000000 })
  })
  it('체육 항목 고르기: 낱말로 + 교사가 고친 것 우선', () => {
    expect(card.items.map(looksPe)).toEqual([true, false, true, true, false])
    const sup = card.items[4]
    expect(isPicked(sup, {})).toBe(false)
    expect(isPicked(sup, { [sup.key]: true })).toBe(true)
    expect(isPicked(card.items[0], { [card.items[0].key]: false })).toBe(false)
  })
  it('시트 세부사업 표기', () => {
    expect(sheetLabel(card.items[0])).toBe('자율자치활동-체육대회-교육운영비')
    expect(sheetLabel(card.items[2])).toBe('동아리활동-학교스포츠클럽활성화-운영수당')
  })
  it('세부사업 묶음 합', () => {
    const gs = groupItems(card.items.filter((x) => looksPe(x)))
    expect(gs.map((g) => [g.detail, g.items.length, g.left])).toEqual([
      ['체육대회', 1, 0],
      ['(통합)학교스포츠클럽활성화', 2, 2000000],
    ])
  })
  it('다른 파일은 알려 줌', () => {
    expect(() => parseBudgetCard([['이름', '번호']])).toThrow(BudgetFileError)
  })
  it('금액 글자', () => {
    expect(money('1,210,000')).toBe(1210000)
    expect(money('-330,000')).toBe(-330000)
    expect(money('')).toBe(0)
    expect(money('(500)')).toBe(-500)
  })
})

describe('시트에 붙일 표', () => {
  const card = parseBudgetCard(G)
  const picked = card.items.filter((x) => isPicked(x, { [card.items[4].key]: true }))
  it('교사 시트와 같은 수식 (N5 머리글, 6행부터)', () => {
    const rows = sheetRows(picked, { ...DEFAULT_LAYOUT, withEdufine: false })
    expect(rows[0]).toEqual(['세부사업', '산출내역', '예산현액', '지출금액', '예산잔액', '지출 예정금액', '예산 항목별 총 잔액'])
    expect(rows[1]).toEqual([
      '자율자치활동-체육대회-교육운영비',
      '체육대회운영비',
      1000000,
      "=SUMIF('물품구입 시트'!$H$4:$H, O6, '물품구입 시트'!$F$4:$F)",
      '=P6-Q6',
      '',
      '=R6',
    ])
    // 두 줄짜리 세부사업: 첫 줄에 합
    expect(rows[2][6]).toBe('=SUM(R7:R8)')
    expect(rows[3][6]).toBe('')
    expect(rows[4][6]).toBe('=R9')
    expect(pasteRange(rows)).toBe('N5:T9')
    expect(nameRange(picked.length)).toBe('O6:O9')
  })
  it('에듀파인 집행액 · 차이 칸', () => {
    const rows = sheetRows(picked)
    expect(rows[0].slice(7)).toEqual(['에듀파인 집행액', '차이(시트-에듀파인)'])
    expect(rows[1].slice(7)).toEqual([1000000, '=Q6-U6'])
    expect(pasteRange(rows)).toBe('N5:V9')
  })
  it('다른 자리 · 시트 이름 없이', () => {
    const rows = sheetRows(picked.slice(0, 1), { ...DEFAULT_LAYOUT, startCell: 'A1', itemSheet: '', withEdufine: false })
    expect(rows[1].slice(3, 5)).toEqual(['=SUMIF($H$4:$H, B2, $F$4:$F)', '=C2-D2'])
  })
  it('탭 글: 칸 안 줄바꿈은 빈칸', () => {
    expect(toTsv([['가\n나', 1], ['다', '=A1']])).toBe('가 나\t1\n다\t=A1')
  })
})
