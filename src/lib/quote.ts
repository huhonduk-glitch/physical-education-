/**
 * 견적서 → 품의 초안 (2026-11-12 교사 요청, CLAUDE.md 6-21)
 *
 * 1단계(기기 안): 엑셀 · 글자가 살아 있는 PDF · 붙여넣기에서 품목 표를 읽는다. 인터넷 없음.
 * 2단계(선택): 사진 · 스캔본은 교사가 버튼을 누를 때만 AI로 읽는다(요청문 · 답 읽기는 여기, 호출은 aiPolish.ts).
 *
 * 견적서 양식은 업체마다 달라서 열을 고정하지 않고 머리글 낱말로 찾는다.
 * 흔한 머리글: 품명(품목 · 물품명 · 상품명 · 내역) | 규격(모델 · 사양) | 단위 | 수량 | 단가 | 공급가액 | 세액 | 금액(합계) | 비고
 * 금액은 읽은 그대로 두고, 수량 × 단가와 다르거나 합계가 안 맞으면 알림만 띄운다(고치는 것은 교사).
 * 품의 초안은 '학교 양식에 맞게 고쳐 쓰는 초안'이다. 에듀파인에 자동으로 넣지 않는다.
 */
import type { PdfPage, PdfText, Cell } from './pdfTable'

export interface QuoteItem {
  name: string
  spec: string
  unit: string
  qty: number
  /** 단가 (견적서에 적힌 그대로) */
  price: number
  /** 이 줄 금액 (세액 칸이 있으면 공급가액 + 세액) */
  amount: number
  note: string
}

export type VatMode = 'included' | 'separate' | 'unknown'

export interface Quote {
  /** 상호 (찾았을 때만) */
  vendor: string
  /** 견적일 YYYY-MM-DD (찾았을 때만) */
  date: string
  items: QuoteItem[]
  /** 견적서에 적힌 합계 (없으면 0) */
  stated: number
  vat: VatMode
  warnings: string[]
}

export class QuoteError extends Error {}

const norm = (s: string) => String(s ?? '').replace(/[\s·.,/()\[\]]/g, '')

/** '1,210,000원' · '₩ 3,300' · '(500)' → 숫자. 숫자가 아니면 NaN */
export function num(v: string): number {
  const t = String(v ?? '')
    .replace(/[,\s원₩￦\\]/g, '')
    .replace(/^\((.*)\)$/, '-$1')
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}
const n0 = (v: string) => {
  const n = num(v)
  return Number.isFinite(n) ? n : 0
}

type Col = 'name' | 'spec' | 'unit' | 'qty' | 'price' | 'supply' | 'vat' | 'amount' | 'note' | 'no'

/** 머리글 한 칸 → 어떤 열인지 */
export function headKind(cell: string): Col | null {
  const h = norm(cell)
  if (!h) return null
  if (/^(순번|번호|no|연번|순)$/i.test(h)) return 'no'
  if (/(품명|품목|물품명|상품명|제품명|품목명|내역|적요)/.test(h)) return 'name'
  if (/(규격|모델|사양|스펙|spec)/i.test(h)) return 'spec'
  if (/^단위$/.test(h)) return 'unit'
  if (/수량/.test(h)) return 'qty'
  if (/단가/.test(h)) return 'price'
  if (/(세액|부가세|vat)/i.test(h)) return 'vat'
  if (/공급가/.test(h)) return 'supply'
  if (/(금액|합계|판매가|견적가|소계)/.test(h)) return 'amount'
  if (/(비고|참고)/.test(h)) return 'note'
  return null
}

const TOTAL_WORD = /^(합계|총계|총액|총합계|합계금액|견적금액|총금액|소계|계|공급가액|부가세|부가가치세|세액|vat|total)/i
const isTotalLabel = (s: string) => TOTAL_WORD.test(norm(s))

function findHeader(grid: string[][]): { row: number; cols: Partial<Record<Col, number>> } | null {
  for (let r = 0; r < grid.length; r++) {
    const cols: Partial<Record<Col, number>> = {}
    grid[r].forEach((c, i) => {
      const k = headKind(c)
      if (k && cols[k] === undefined) cols[k] = i
    })
    const numCols = ['qty', 'price', 'supply', 'amount'].filter((k) => cols[k as Col] !== undefined).length
    if (cols.name !== undefined && numCols >= 1) return { row: r, cols }
  }
  return null
}

/** 견적서 위쪽 글에서 상호 · 날짜 찾기 (못 찾으면 빈칸 — 지어내지 않는다) */
export function metaOf(lines: readonly string[]): { vendor: string; date: string } {
  let vendor = ''
  let date = ''
  for (const raw of lines) {
    const l = raw.replace(/\s+/g, ' ').trim()
    if (!vendor) {
      const m = /상\s*호\s*(?:\(법인명\)|명)?\s*[:：]?\s*([^\s:：][^:：]*?)(?=\s+(?:대\s*표|성\s*명|등록|사업자|주\s*소|업\s*태|전\s*화|TEL)|$)/i.exec(l)
      if (m && m[1].trim().length >= 2) vendor = m[1].trim().slice(0, 30)
    }
    if (!date) {
      const m = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(l)
      if (m) date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    }
  }
  return { vendor, date }
}

/** 표(머리글 있음) → 견적 */
export function parseQuoteGrid(grid: string[][]): Quote {
  const head = findHeader(grid)
  if (!head) throw new QuoteError('품목 표의 머리글(품명 · 수량 · 단가 · 금액)을 찾지 못했어요.')
  const { cols } = head
  const cell = (r: string[], k: Col) => (cols[k] === undefined ? '' : String(r[cols[k]!] ?? '').trim())
  const items: QuoteItem[] = []
  const totals: { label: string; value: number }[] = []
  for (const r of grid.slice(head.row + 1)) {
    const texts = r.map((c) => String(c ?? '').trim())
    const first = texts.find((c) => c) ?? ''
    if (!first) continue
    const name = cell(r, 'name')
    if (isTotalLabel(first) || isTotalLabel(name)) {
      // 합계 줄: 공급가액 + 세액 칸이 있으면 둘을 더한 값, 아니면 금액 칸, 그것도 없으면 가장 큰 숫자
      const sv = num(cell(r, 'supply'))
      const vv = num(cell(r, 'vat'))
      const av = num(cell(r, 'amount'))
      const nums = texts.map(num).filter((n) => Number.isFinite(n) && n > 0)
      const value = Number.isFinite(sv) && Number.isFinite(vv) ? sv + vv : Number.isFinite(av) && av > 0 ? av : nums.length ? Math.max(...nums) : 0
      if (value > 0) totals.push({ label: norm(isTotalLabel(name) ? name : first), value })
      continue
    }
    if (!name) continue
    const qty = n0(cell(r, 'qty'))
    const price = n0(cell(r, 'price'))
    const supply = n0(cell(r, 'supply'))
    const amt = n0(cell(r, 'amount'))
    // 세액 칸이 따로 있으면 품목 금액은 공급가액(세금 전) — 부가세는 [부가세 10% 더하기]로 한 번에
    const amount = supply || amt || qty * price
    if (!qty && !amount) continue // 설명 줄
    items.push({ name, spec: cell(r, 'spec'), unit: cell(r, 'unit'), qty, price, amount, note: cell(r, 'note') })
  }
  if (!items.length) throw new QuoteError('머리글은 찾았는데 품목 줄이 없어요.')
  const above = grid.slice(0, head.row).map((r) => r.join(' '))
  const after = grid.slice(head.row + 1).map((r) => r.join(' '))
  const stated = statedTotal(totals, [...above, ...after])
  const hint = [...above, ...after].join(' ')
  return finish({ ...metaOf(above.concat(after)), items, stated }, hint, cols.vat !== undefined)
}

function statedTotal(totals: { label: string; value: number }[], lines: readonly string[]): number {
  const grand = totals.filter((t) => /^(합계|총계|총액|총합계|합계금액|견적금액|총금액|total)/i.test(t.label))
  if (grand.length) return Math.max(...grand.map((t) => t.value))
  // 표 밖: '합계금액 : 일금 …원정 (₩1,234,000)'
  for (const l of lines) {
    if (!/(합계\s*금액|견적\s*금액|총\s*금액|총\s*액)/.test(l)) continue
    const nums = [...l.matchAll(/\d{1,3}(?:,\d{3})+|\d{4,}/g)].map((m) => Number(m[0].replace(/,/g, '')))
    if (nums.length) return Math.max(...nums)
  }
  return 0
}

/** 합계 · 수량 × 단가 확인, 부가세 포함 여부 어림 */
function finish(q: { vendor: string; date: string; items: QuoteItem[]; stated: number }, hint: string, hasVatCol: boolean): Quote {
  const warnings: string[] = []
  const sum = q.items.reduce((a, x) => a + x.amount, 0)
  // vat: 'separate' = 품목 금액이 세금 전 → 10%를 더해야 함, 'included' = 품목 금액에 이미 들어 있음
  let vat: VatMode = 'unknown'
  const h = hint.replace(/\s+/g, '')
  if (hasVatCol) vat = 'separate'
  else if (/(부가세|VAT|부가가치세)포함/i.test(h)) vat = 'included'
  else if (/(부가세|VAT|부가가치세)별도/i.test(h)) vat = 'separate'
  if (q.stated) {
    if (Math.abs(q.stated - sum) <= 1) {
      if (!hasVatCol && vat === 'unknown') vat = 'included'
    } else if (Math.abs(q.stated - Math.round(sum * 1.1)) <= Math.max(10, q.items.length)) {
      if (!hasVatCol) {
        vat = 'separate'
        warnings.push(`품목 금액은 부가세를 뺀 값이에요. 견적서 합계 ${q.stated.toLocaleString('ko-KR')}원은 부가세 10%를 더한 금액이에요.`)
      }
    } else {
      warnings.push(`품목 금액을 더하면 ${sum.toLocaleString('ko-KR')}원인데 견적서 합계는 ${q.stated.toLocaleString('ko-KR')}원이에요. 빠진 줄(배송비 · 할인)이 있는지 확인해 주세요.`)
    }
  }
  q.items.forEach((x, i) => {
    if (!x.qty || !x.price) return
    const calc = x.qty * x.price
    if (Math.abs(calc - x.amount) > 1 && Math.abs(Math.round(calc * 1.1) - x.amount) > 1) {
      warnings.push(`${i + 1}번 '${x.name}': 수량 × 단가 = ${calc.toLocaleString('ko-KR')}원인데 금액은 ${x.amount.toLocaleString('ko-KR')}원이에요.`)
    }
  })
  return { ...q, vat, warnings }
}

const UNIT = /^(개|ea|EA|Ea|세트|set|SET|Set|박스|box|BOX|Box|켤레|벌|대|조|권|통|팩|롤|매|자루|병|장|타|다스|족|쌍|식|점|본|kg|g|m|L)$/

/**
 * 머리글 없는 글 한 줄씩 읽기 (카톡 · 문자로 받은 견적, 테두리 없는 PDF)
 *   '1 배드민턴 셔틀콕 12개입 10 통 15,000 150,000'
 * 줄 끝의 숫자들에서 (수량, 단가, 금액)을 찾는다. 숫자가 2개 미만인 줄은 품목이 아니다.
 */
export function parseQuoteLines(lines: readonly string[]): Quote {
  const items: QuoteItem[] = []
  const totals: { label: string; value: number }[] = []
  const rest: string[] = []
  let sawVat = false
  for (const raw of lines) {
    const l = raw.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
    if (!l) continue
    const tok = l.split(' ')
    if (isTotalLabel(tok[0]) || isTotalLabel(tok.slice(0, 2).join(''))) {
      const nums = tok.map(num).filter((n) => Number.isFinite(n) && n > 0)
      if (nums.length) totals.push({ label: norm(tok.slice(0, 2).join('')), value: Math.max(...nums) })
      else rest.push(l)
      continue
    }
    // 줄 끝에서 숫자 · 단위를 떼어 낸다
    const tail: number[] = []
    let unit = ''
    let end = tok.length
    while (end > 0) {
      const t = tok[end - 1]
      const n = num(t)
      if (Number.isFinite(n)) tail.unshift(n)
      else if (!unit && UNIT.test(t) && tail.length) unit = t
      else break
      end--
    }
    if (tail.length < 2) {
      rest.push(l)
      continue
    }
    let words = tok.slice(0, end)
    if (words.length > 1 && /^\d{1,3}[.)]?$/.test(words[0])) words = words.slice(1) // 순번
    // 이름 끝이 '10개'처럼 수량+단위로 붙은 경우
    const glued = /^(\d+)(개|ea|EA|세트|박스|켤레|벌|대|조|권|통|팩|롤|매|자루|병|장)$/.exec(words[words.length - 1] ?? '')
    if (glued && tail.length === 2 && words.length > 1) {
      tail.unshift(Number(glued[1]))
      unit = unit || glued[2]
      words = words.slice(0, -1)
    }
    const name = words.join(' ').trim()
    if (!name) {
      rest.push(l)
      continue
    }
    const pick = pickNumbers(tail)
    if (!pick) {
      rest.push(l)
      continue
    }
    if (pick.vat) sawVat = true
    items.push({ name, spec: '', unit, qty: pick.qty, price: pick.price, amount: pick.amount, note: '' })
  }
  if (!items.length) throw new QuoteError('품목 줄을 찾지 못했어요. 줄마다 품명 · 수량 · 단가(또는 금액)가 있어야 해요.')
  return finish({ ...metaOf(rest), items, stated: statedTotal(totals, rest) }, rest.join(' '), sawVat)
}

/** 줄 끝 숫자들 → 수량 · 단가 · 금액. 곱이 맞는 조합을 먼저 찾는다 */
function pickNumbers(t: number[]): { qty: number; price: number; amount: number; vat?: boolean } | null {
  for (let i = 0; i + 2 < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      for (let k = j + 1; k < t.length; k++) {
        if (t[i] > 0 && t[i] * t[j] === t[k]) {
          // 공급가액 뒤에 세액이 따로 있으면 금액은 공급가액 그대로, 부가세는 따로 더한다
          const v = t[k + 1]
          return { qty: t[i], price: t[j], amount: t[k], vat: v !== undefined && v > 0 && Math.abs(Math.round(t[k] * 0.1) - v) <= 1 }
        }
      }
    }
  }
  if (t.length === 2) {
    const [a, b] = t
    if (a <= 0 || b <= 0) return null
    // (수량, 단가)로 본다. 수량이 정수가 아니면 품목 줄이 아님
    if (!Number.isInteger(a) || a > 9999) return null
    return { qty: a, price: b, amount: a * b }
  }
  if (t.length >= 3) {
    const [a, b, c] = t.slice(-3)
    if (a > 0 && Number.isInteger(a)) return { qty: a, price: b, amount: c }
  }
  return null
}

/** 붙여넣은 글: 탭 표면 머리글로, 아니면 줄마다 */
export function parseQuoteText(text: string): Quote {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (!lines.length) throw new QuoteError('붙여넣은 글이 비어 있어요.')
  if (lines.some((l) => l.includes('\t'))) {
    const grid = lines.map((l) => l.split('\t').map((c) => c.trim()))
    try {
      return parseQuoteGrid(grid)
    } catch {
      /* 머리글이 없으면 줄마다 */
    }
  }
  return parseQuoteLines(lines)
}

// ── PDF ──

/** PDF 칸 → 표. 칸의 왼쪽 위치로 열을 맞춘다(합쳐진 칸은 빈칸으로 남는다) */
export function cellsToGrid(cells: readonly Cell[]): string[][] {
  if (!cells.length) return []
  const xs: number[] = []
  for (const c of [...cells].sort((a, b) => a.x0 - b.x0)) if (!xs.length || c.x0 - xs[xs.length - 1] > 3) xs.push(c.x0)
  const colOf = (x: number) => {
    let best = 0
    xs.forEach((v, i) => {
      if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i
    })
    return best
  }
  const rows: { y: number; cells: Cell[] }[] = []
  for (const c of [...cells].sort((a, b) => b.y1 - a.y1)) {
    const row = rows.find((r) => Math.abs(r.y - c.y1) < 3)
    if (row) row.cells.push(c)
    else rows.push({ y: c.y1, cells: [c] })
  }
  return rows.map((r) => {
    const out = Array<string>(xs.length).fill('')
    for (const c of r.cells) {
      const i = colOf(c.x0)
      out[i] = out[i] ? `${out[i]} ${c.text}` : c.text
    }
    return out
  })
}

/** PDF 글자 → 줄(위에서 아래). 같은 줄에서 많이 떨어진 조각은 탭으로 나눈다 */
export function pageLines(texts: readonly PdfText[]): string[] {
  const sorted = texts.filter((t) => t.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfText[][] = []
  for (const t of sorted) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line[0].y - t.y) < Math.max(2, t.h * 0.4)) line.push(t)
    else lines.push([t])
  }
  return lines.map((l) => {
    l.sort((a, b) => a.x - b.x)
    let s = ''
    l.forEach((t, i) => {
      if (i) {
        const prev = l[i - 1]
        const gap = t.x - (prev.x + prev.w)
        s += gap > Math.max(8, t.h * 1.2) ? '\t' : gap > t.h * 0.25 ? ' ' : ''
      }
      s += t.str.trim()
    })
    return s
  })
}

/** PDF 쪽들 → 견적. 글자가 거의 없으면(스캔본) scanned 오류 */
export function parseQuotePages(pages: readonly PdfPage[], build: (p: PdfPage) => { cells: Cell[] }): Quote {
  const chars = pages.reduce((n, p) => n + p.texts.reduce((m, t) => m + t.str.trim().length, 0), 0)
  if (chars < 20) throw new QuoteScanError('글자가 없는 PDF(스캔본)예요.')
  // ① 테두리 있는 표
  const grid = pages.flatMap((p) => cellsToGrid(build(p).cells))
  const lines = pages.flatMap((p) => pageLines(p.texts))
  try {
    const q = parseQuoteGrid(grid)
    const meta = metaOf(lines)
    // 표 밖 글(합계금액 · 부가세 포함)도 본다
    const stated = q.stated || statedTotal([], lines)
    return finish({ vendor: q.vendor || meta.vendor, date: q.date || meta.date, items: q.items, stated }, lines.join(' '), q.vat === 'included')
  } catch {
    /* ② 글자 위치로 */
  }
  try {
    return parseQuoteGrid(lines.map((l) => l.split('\t')))
  } catch {
    /* ③ 줄마다 */
  }
  return parseQuoteLines(lines.map((l) => l.replace(/\t/g, ' ')))
}

export class QuoteScanError extends QuoteError {}

// ── 계산 · 품의 초안 ──

export interface QuoteSum {
  /** 품목 금액 합 (읽은 그대로) */
  items: number
  /** 품의에 쓸 금액 (부가세 별도면 10% 더함) */
  total: number
  vatAdded: number
}

/** addVat = 품목 금액에 부가세 10%를 더할지 (부가세 별도 견적) */
export function quoteSum(items: readonly QuoteItem[], addVat: boolean): QuoteSum {
  const sum = items.reduce((a, x) => a + (Number.isFinite(x.amount) ? x.amount : 0), 0)
  const vatAdded = addVat ? Math.round(sum * 0.1) : 0
  return { items: sum, total: sum + vatAdded, vatAdded }
}

/** 수량 · 단가를 고치면 금액을 다시 */
export function recalc(prev: QuoteItem, next: QuoteItem): QuoteItem {
  if (!next.qty || !next.price) return next
  // 예전 금액이 수량 × 단가에 부가세 10%를 더한 값이었으면 그대로 따른다
  const was = prev.qty * prev.price
  const withVat = was > 0 && Math.abs(was - prev.amount) > 1 && Math.abs(Math.round(was * 1.1) - prev.amount) <= 1
  const calc = next.qty * next.price
  return { ...next, amount: withVat ? Math.round(calc * 1.1) : calc }
}

const DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조']

/** 345000 → '삼십사만오천' (공문 금액 표기 '금삼십사만오천원'용) */
export function koreanMoney(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  n = Math.round(n)
  if (n === 0) return '영'
  let out = ''
  for (let g = 0; n > 0; g++, n = Math.floor(n / 10000)) {
    const part = n % 10000
    if (!part) continue
    let s = ''
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(part / 10 ** i) % 10
      if (d) s += DIGIT[d] + SMALL[i]
    }
    out = s + BIG[g] + out
  }
  return out
}

/** '금345,000원(금삼십사만오천원)' — 행정업무운영 편람의 금액 표기 방식 */
export function moneyText(n: number): string {
  return `금${Math.round(n).toLocaleString('ko-KR')}원(금${koreanMoney(n)}원)`
}

/** 품의 제목 초안: '배드민턴 셔틀콕 외 3종 구입' */
export function draftTitle(items: readonly QuoteItem[]): string {
  if (!items.length) return ''
  const first = items[0].name.trim()
  return items.length === 1 ? `${first} 구입` : `${first} 외 ${items.length - 1}종 구입`
}

export interface DraftInput {
  title: string
  purpose: string
  items: readonly QuoteItem[]
  addVat: boolean
  vendor: string
  /** 예산 과목 표기 (고른 예산 항목) */
  budget: string
}

/** 품의 내용 초안 (복사용 글). 빈칸 ( )은 교사가 채운다 */
export function draftText(d: DraftInput): string {
  const s = quoteSum(d.items, d.addVat)
  const lines = [
    `제목: ${d.title || draftTitle(d.items)}`,
    '',
    `1. 목적: ${d.purpose.trim() || '(                    )'}`,
    `2. 구입 내역: ${d.items[0]?.name ?? ''}${d.items.length > 1 ? ` 외 ${d.items.length - 1}종` : ''} (붙임 견적서 참고)`,
    `3. 소요 예산: ${moneyText(s.total)}${s.vatAdded ? ' ※ 부가세 포함' : ''}`,
    `4. 예산 과목: ${d.budget || '(                    )'}`,
  ]
  if (d.vendor.trim()) lines.push(`5. 견적 업체: ${d.vendor.trim()}`)
  lines.push('', '붙임  견적서 1부.  끝.')
  return lines.join('\n')
}

/** 품목 표 (엑셀 · 한글 표에 붙여 넣기). 부가세 별도면 부가세 줄을 따로 */
export function itemRows(items: readonly QuoteItem[], addVat: boolean): (string | number)[][] {
  const s = quoteSum(items, addVat)
  const rows: (string | number)[][] = [['순번', '품명', '규격', '수량', '단위', '단가', '금액', '비고']]
  items.forEach((x, i) => rows.push([i + 1, x.name, x.spec, x.qty || '', x.unit, x.price || '', x.amount, x.note]))
  if (s.vatAdded) rows.push(['', '부가세', '', '', '', '', s.vatAdded, ''])
  rows.push(['', '합계', '', '', '', '', s.total, ''])
  return rows
}

// ── 2단계: AI로 사진 · 스캔본 읽기 ──

/** AI 요청문. 근거는 그림뿐 — 안 보이는 값은 지어내지 않게 한다 */
export function quoteAiPrompt(): { system: string; user: string } {
  return {
    system: `당신은 한국어 견적서 그림에서 품목 표를 읽어 옮기는 도우미입니다.
지킬 것:
- 그림에 보이는 글자와 숫자만 옮깁니다. 안 보이거나 읽기 어려운 값은 글자는 "" , 숫자는 0으로 둡니다. 추측하거나 계산해서 채우지 않습니다.
- 품목 줄만 items에 넣습니다. 합계 · 소계 · 부가세 줄은 넣지 않습니다. 배송비 · 설치비처럼 돈이 드는 줄은 품목으로 넣습니다.
- 금액은 쉼표 없는 숫자로 씁니다.
- 업체의 전화번호 · 주소 · 계좌번호 · 사업자등록번호 · 대표자 이름은 옮기지 않습니다. 상호만 vendor에 씁니다(안 보이면 "").
- 설명 없이 아래 모양의 JSON 하나만 내보냅니다.
{"vendor":"","date":"YYYY-MM-DD 또는 \\"\\"","vat":"included|separate|unknown","total":0,"items":[{"name":"","spec":"","unit":"","qty":0,"price":0,"amount":0,"note":""}]}
- amount: 그 줄의 금액. 세액(부가세) 칸이 따로 있으면 세액을 더하지 않은 공급가액을 씁니다.
- vat: 세액 칸이 따로 있거나 '부가세 별도'라고 적혀 있으면 separate, 품목 금액에 부가세가 들어 있다고 적혀 있으면 included, 모르면 unknown.
- total: 견적서에 적힌 최종 합계 금액(부가세까지 더한 값, 없으면 0).`,
    user: '붙인 견적서 그림의 품목 표를 읽어 JSON으로 옮겨 주세요.',
  }
}

/** AI 답 → 견적. JSON이 아니거나 품목이 없으면 오류. 숫자 확인(합계 · 수량 × 단가)은 기기에서 다시 한다 */
export function parseQuoteAnswer(text: string): Quote {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b <= a) throw new QuoteError('AI 답에서 표(JSON)를 찾지 못했어요. 다시 해 보거나 직접 넣어 주세요.')
  let o: { vendor?: unknown; date?: unknown; vat?: unknown; total?: unknown; items?: unknown }
  try {
    o = JSON.parse(text.slice(a, b + 1))
  } catch {
    throw new QuoteError('AI 답을 읽지 못했어요. 다시 해 보거나 직접 넣어 주세요.')
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
  const nn = (v: unknown) => {
    const n = typeof v === 'number' ? v : num(str(v))
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const items: QuoteItem[] = (Array.isArray(o.items) ? o.items : [])
    .map((r: Record<string, unknown>) => ({ name: str(r?.name), spec: str(r?.spec), unit: str(r?.unit), qty: nn(r?.qty), price: nn(r?.price), amount: nn(r?.amount), note: str(r?.note) }))
    .filter((x) => x.name && !isTotalLabel(x.name))
    .map((x) => ({ ...x, amount: x.amount || x.qty * x.price }))
  if (!items.length) throw new QuoteError('AI가 품목을 찾지 못했어요. 사진이 흐리면 다시 찍어 주세요.')
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(str(o.date)) ? str(o.date) : ''
  const q = finish({ vendor: str(o.vendor).slice(0, 30), date, items, stated: nn(o.total) }, o.vat === 'separate' ? '부가세 별도' : o.vat === 'included' ? '부가세 포함' : '', false)
  q.warnings.unshift('AI가 읽은 값이에요. 견적서와 한 줄씩 맞는지 꼭 확인해 주세요.')
  return q
}
