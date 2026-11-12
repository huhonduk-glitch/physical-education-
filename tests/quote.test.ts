import { describe, expect, it } from 'vitest'
import {
  QuoteError,
  QuoteScanError,
  cellsToGrid,
  draftText,
  draftTitle,
  headKind,
  itemRows,
  koreanMoney,
  metaOf,
  moneyText,
  num,
  pageLines,
  parseQuoteAnswer,
  parseQuoteGrid,
  parseQuoteLines,
  parseQuotePages,
  parseQuoteText,
  quoteAiPrompt,
  quoteSum,
  recalc,
} from '../src/lib/quote'

// 업체 · 품목 · 금액은 모두 지어낸 값

describe('숫자 · 머리글', () => {
  it('금액 글자 → 숫자', () => {
    expect(num('1,210,000원')).toBe(1210000)
    expect(num('₩ 3,300')).toBe(3300)
    expect(num('12개')).toBeNaN()
    expect(num('')).toBeNaN()
  })
  it('머리글 낱말', () => {
    expect(headKind('품 명')).toBe('name')
    expect(headKind('물품명')).toBe('name')
    expect(headKind('규격/모델')).toBe('spec')
    expect(headKind('수 량')).toBe('qty')
    expect(headKind('단가(원)')).toBe('price')
    expect(headKind('공급가액')).toBe('supply')
    expect(headKind('세 액')).toBe('vat')
    expect(headKind('합계금액')).toBe('amount')
    expect(headKind('비 고')).toBe('note')
    expect(headKind('NO')).toBe('no')
    expect(headKind('담당자')).toBeNull()
  })
})

describe('표 읽기', () => {
  const G = [
    ['견 적 서', '', '', '', '', '', ''],
    ['2026. 11. 3.', '', '', '상호 가나스포츠 대표 홍길동', '', '', ''],
    ['합계금액', '일금 삼십사만오천원정 (₩345,000) 부가세 포함', '', '', '', '', ''],
    ['NO', '품 명', '규 격', '단위', '수량', '단가', '금액', '비고'],
    ['1', '배드민턴 셔틀콕', '12개입', '통', '10', '15,000', '150,000', ''],
    ['2', '농구공', '7호', '개', '5', '35,000', '175,000', '실내용'],
    ['3', '배송비', '', '식', '1', '20,000', '20,000', ''],
    ['', '합 계', '', '', '', '', '345,000', ''],
  ]
  it('품목 · 합계 · 상호 · 날짜', () => {
    const q = parseQuoteGrid(G)
    expect(q.items).toHaveLength(3)
    expect(q.items[0]).toEqual({ name: '배드민턴 셔틀콕', spec: '12개입', unit: '통', qty: 10, price: 15000, amount: 150000, note: '' })
    expect(q.items[1].note).toBe('실내용')
    expect(q.stated).toBe(345000)
    expect(q.vendor).toBe('가나스포츠')
    expect(q.date).toBe('2026-11-03')
    expect(q.vat).toBe('included')
    expect(q.warnings).toEqual([])
  })
  it('공급가액 + 세액 칸: 품목 금액은 공급가액, 합계 줄은 둘을 더한 값, 부가세는 따로 더함', () => {
    const q = parseQuoteGrid([
      ['품명', '수량', '단가', '공급가액', '세액'],
      ['뜀틀', '2', '100,000', '200,000', '20,000'],
      ['합계', '', '', '200,000', '20,000'],
    ])
    expect(q.items[0].amount).toBe(200000)
    expect(q.stated).toBe(220000)
    expect(q.vat).toBe('separate')
    expect(q.warnings).toEqual([])
    expect(quoteSum(q.items, true).total).toBe(220000)
  })
  it('부가세 별도: 합계가 품목 합의 1.1배', () => {
    const q = parseQuoteGrid([
      ['품목', '수량', '단가', '금액'],
      ['콘', '20', '1,000', '20,000'],
      ['조끼', '10', '3,000', '30,000'],
      ['공급가액', '', '', '50,000'],
      ['부가세', '', '', '5,000'],
      ['합계', '', '', '55,000'],
    ])
    expect(q.stated).toBe(55000)
    expect(q.vat).toBe('separate')
    expect(quoteSum(q.items, true)).toEqual({ items: 50000, total: 55000, vatAdded: 5000 })
  })
  it('안 맞는 값은 알림만 (고치지 않는다)', () => {
    const q = parseQuoteGrid([
      ['품명', '수량', '단가', '금액'],
      ['줄넘기', '30', '2,000', '65,000'],
      ['합계', '', '', '90,000'],
    ])
    expect(q.items[0].amount).toBe(65000)
    expect(q.warnings).toHaveLength(2)
  })
  it('머리글이 없으면 오류', () => {
    expect(() => parseQuoteGrid([['이름', '점수']])).toThrow(QuoteError)
  })
})

describe('줄마다 읽기 · 붙여넣기', () => {
  it('순번 · 단위 · 숫자 3개', () => {
    const q = parseQuoteLines(['가나스포츠 견적', '1 배드민턴 셔틀콕 12개입 10 통 15,000 150,000', '2. 농구공 7호 5 35,000 175,000', '합계 325,000'])
    expect(q.items.map((x) => [x.name, x.qty, x.unit, x.price, x.amount])).toEqual([
      ['배드민턴 셔틀콕 12개입', 10, '통', 15000, 150000],
      ['농구공 7호', 5, '', 35000, 175000],
    ])
    expect(q.stated).toBe(325000)
  })
  it('숫자 2개 = 수량 · 단가, 붙은 수량(10개)', () => {
    const q = parseQuoteLines(['콘 20 1,000', '조끼 10개 3,000 30,000'])
    expect(q.items[0]).toMatchObject({ qty: 20, price: 1000, amount: 20000 })
    expect(q.items[1]).toMatchObject({ name: '조끼', qty: 10, unit: '개', price: 3000, amount: 30000 })
  })
  it('공급가액 뒤 세액: 금액은 공급가액, 부가세 별도로 표시', () => {
    const q = parseQuoteLines(['뜀틀 2 100,000 200,000 20,000'])
    expect(q.items[0].amount).toBe(200000)
    expect(q.vat).toBe('separate')
  })
  it('탭 표는 머리글로, 아니면 줄마다', () => {
    expect(parseQuoteText('품명\t수량\t단가\t금액\n콘\t20\t1000\t20000').items[0].name).toBe('콘')
    expect(parseQuoteText('콘 20 1000').items[0].amount).toBe(20000)
    expect(() => parseQuoteText('안녕하세요\n견적 보내 드립니다')).toThrow(QuoteError)
  })
})

describe('PDF', () => {
  const cell = (x0: number, y1: number, text: string) => ({ x0, x1: x0 + 50, y0: y1 - 20, y1, text })
  it('칸 → 표 (왼쪽 위치로 열 맞춤)', () => {
    const g = cellsToGrid([cell(10, 700, '품명'), cell(60, 700, '수량'), cell(110, 700, '금액'), cell(10, 680, '콘'), cell(110, 680, '20,000')])
    expect(g).toEqual([
      ['품명', '수량', '금액'],
      ['콘', '', '20,000'],
    ])
  })
  const t = (x: number, y: number, str: string) => ({ x, y, w: str.length * 6, h: 10, str })
  it('글자 → 줄, 멀리 떨어지면 탭', () => {
    expect(pageLines([t(10, 700, '품명'), t(200, 700, '수량'), t(10, 680, '콘'), t(200, 680, '20')])).toEqual(['품명\t수량', '콘\t20'])
  })
  it('테두리 없는 PDF도 글자 위치로 읽는다', () => {
    const page = {
      width: 600,
      height: 800,
      rects: [],
      texts: [t(10, 760, '상호: 가나스포츠'), t(10, 700, '품명'), t(200, 700, '수량'), t(300, 700, '단가'), t(400, 700, '금액'), t(10, 680, '콘'), t(200, 680, '20'), t(300, 680, '1,000'), t(400, 680, '20,000')],
    }
    const q = parseQuotePages([page], () => ({ cells: [] }))
    expect(q.items[0]).toMatchObject({ name: '콘', qty: 20, price: 1000, amount: 20000 })
    expect(q.vendor).toBe('가나스포츠')
  })
  it('글자가 없으면 스캔본', () => {
    expect(() => parseQuotePages([{ width: 1, height: 1, rects: [], texts: [] }], () => ({ cells: [] }))).toThrow(QuoteScanError)
  })
})

describe('품의 초안', () => {
  const items = [
    { name: '배드민턴 셔틀콕', spec: '12개입', unit: '통', qty: 10, price: 15000, amount: 150000, note: '' },
    { name: '농구공', spec: '7호', unit: '개', qty: 5, price: 39000, amount: 195000, note: '' },
  ]
  it('한글 금액', () => {
    expect(koreanMoney(345000)).toBe('삼십사만오천')
    expect(koreanMoney(1000000)).toBe('일백만')
    expect(koreanMoney(120050010)).toBe('일억이천오만일십')
    expect(moneyText(345000)).toBe('금345,000원(금삼십사만오천원)')
  })
  it('제목 · 내용', () => {
    expect(draftTitle(items)).toBe('배드민턴 셔틀콕 외 1종 구입')
    expect(draftTitle(items.slice(0, 1))).toBe('배드민턴 셔틀콕 구입')
    const text = draftText({ title: '', purpose: '', items, addVat: false, vendor: '가나스포츠', budget: '체육대회 - 교육운영비 (체육대회운영비)' })
    expect(text).toContain('제목: 배드민턴 셔틀콕 외 1종 구입')
    expect(text).toContain('금345,000원(금삼십사만오천원)')
    expect(text).toContain('예산 과목: 체육대회 - 교육운영비 (체육대회운영비)')
    expect(text).toContain('견적 업체: 가나스포츠')
    expect(text).toContain('1. 목적: (')
  })
  it('품목 표: 부가세 별도면 부가세 줄', () => {
    const rows = itemRows(items, true)
    expect(rows[1]).toEqual([1, '배드민턴 셔틀콕', '12개입', 10, '통', 15000, 150000, ''])
    expect(rows.at(-2)).toEqual(['', '부가세', '', '', '', '', 34500, ''])
    expect(rows.at(-1)?.[6]).toBe(379500)
  })
})

describe('다시 계산', () => {
  const x = { name: '콘', spec: '', unit: '개', qty: 10, price: 1000, amount: 10000, note: '' }
  it('수량 × 단가, 부가세를 더한 금액이었으면 그대로 따름', () => {
    expect(recalc(x, { ...x, qty: 12 }).amount).toBe(12000)
    const v = { ...x, amount: 11000 }
    expect(recalc(v, { ...v, qty: 12 }).amount).toBe(13200)
    expect(recalc(x, { ...x, price: 0 }).amount).toBe(10000)
  })
})

describe('AI 답 읽기', () => {
  it('JSON 꺼내기 · 합계 줄 빼기 · 확인 알림', () => {
    const q = parseQuoteAnswer(
      '```json\n{"vendor":"가나스포츠","date":"2026-11-03","vat":"separate","total":55000,"items":[{"name":"콘","spec":"","unit":"개","qty":20,"price":1000,"amount":20000},{"name":"조끼","qty":"10","price":"3,000","amount":0},{"name":"합계","amount":50000}]}\n```',
    )
    expect(q.items).toHaveLength(2)
    expect(q.items[1]).toMatchObject({ qty: 10, price: 3000, amount: 30000 })
    expect(q.vat).toBe('separate')
    expect(q.warnings[0]).toContain('AI가 읽은 값')
  })
  it('품목이 없거나 JSON이 아니면 오류', () => {
    expect(() => parseQuoteAnswer('읽을 수 없습니다')).toThrow(QuoteError)
    expect(() => parseQuoteAnswer('{"items":[]}')).toThrow(QuoteError)
  })
  it('요청문: 연락처 · 계좌를 옮기지 않게, 추측 금지', () => {
    const p = quoteAiPrompt()
    expect(p.system).toContain('전화번호')
    expect(p.system).toContain('추측')
  })
  it('상호 · 날짜를 못 찾으면 빈칸', () => {
    expect(metaOf(['견적서', '아래와 같이 견적합니다'])).toEqual({ vendor: '', date: '' })
  })
})
