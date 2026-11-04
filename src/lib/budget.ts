/**
 * 체육 예산 현황 (2026-11-04 교사 요청, CLAUDE.md 6-11 D)
 *
 * 에듀파인 '사업관리카드(예산)' 엑셀을 읽어 체육 · 건강체력 · 스포츠 항목만 고르고,
 * 선생님들이 함께 쓰는 구글 시트(물품구입 시트)의 예산 요약 표 모양으로 만든다.
 * 서버 없음: 파일은 이 기기에서만 읽고, 표는 [복사]해서 교사가 시트에 붙여 넣는다.
 *
 * 사업관리카드 모양 (교사가 준 파일):
 *   2행 머리글  세부사업/세부항목/원가통계비목 | 산출내역 | 예산현액(A) | 집행 … | 예산잔액(A-B)
 *   3행 머리글  … 지출품의금액 | 원인행위금액(B) | 집행률(B/A) | 지출결의금액 | 지급액
 *   그 아래     ' 합 계' → 단위사업(들여쓰기 얕음) → 세부사업(더 깊음) → 원가통계비목(산출내역 있음)
 *
 * 시트 요약 표 모양 (교사 시트):
 *   세부사업('단위-세부-비목') | 산출내역 | 예산현액 | 지출금액(=SUMIF 품목 금액) | 예산잔액(=현액-지출) | 지출 예정금액(메모) | 예산 항목별 총 잔액(세부사업 첫 줄)
 *   품목 칸의 '예산항목' 드롭다운이 산출내역 글자와 똑같아야 SUMIF가 맞는다.
 */

export interface BudgetItem {
  /** 고르기 기억용 열쇠 */
  key: string
  unit: string
  detail: string
  /** 원가통계비목 (교육운영비 · 운영수당 …) */
  cost: string
  /** 산출내역 (시트의 예산항목 이름) */
  name: string
  /** 예산현액(A) */
  budget: number
  /** 원인행위금액(B) = 에듀파인 집행액 */
  spent: number
  /** 예산잔액(A-B) */
  left: number
}

export interface BudgetCard {
  items: BudgetItem[]
  /** 파일의 합계 줄 (있으면) */
  total: { budget: number; spent: number; left: number } | null
}

export class BudgetFileError extends Error {}

const norm = (s: string) => s.replace(/\s+/g, '')

/** '1,210,000' · '-330000' · '' → 숫자 */
export function money(v: string): number {
  const t = String(v ?? '').replace(/[,\s원]/g, '')
  if (!t) return 0
  const n = Number(t.replace(/^\((.*)\)$/, '-$1'))
  return Number.isFinite(n) ? n : 0
}

function indentOf(s: string): number {
  const m = /^[\s　]*/.exec(s)
  return m ? m[0].length : 0
}

/** 사업관리카드 표 → 항목 목록 */
export function parseBudgetCard(grid: string[][]): BudgetCard {
  const h = grid.findIndex((r) => r.some((c) => norm(c).includes('산출내역')) && r.some((c) => norm(c).includes('예산현액')))
  if (h < 0) throw new BudgetFileError('에듀파인 사업관리카드(예산) 파일이 아닌 것 같아요. 머리글에 산출내역 · 예산현액이 있어야 해요.')
  const heads = [grid[h] ?? [], grid[h + 1] ?? []]
  const col = (word: string) => {
    for (const r of heads) {
      const i = r.findIndex((c) => norm(c).includes(word))
      if (i >= 0) return i
    }
    return -1
  }
  const cName = col('산출내역')
  const cBudget = col('예산현액')
  const cSpent = col('원인행위')
  const cLeft = col('예산잔액')
  if (cSpent < 0 || cLeft < 0) throw new BudgetFileError('원인행위금액(B) · 예산잔액 칸을 찾지 못했어요. 에듀파인에서 받은 그대로 넣어 주세요.')
  const start = norm((grid[h + 1] ?? []).join('')).includes('원인행위') ? h + 2 : h + 1

  const body = grid.slice(start).filter((r) => (r[0] ?? '').trim())
  // 산출내역이 없는 줄(단위사업 · 세부사업)의 들여쓰기 중 가장 얕은 것 = 단위사업
  let total: BudgetCard['total'] = null
  const headIndents = body
    .filter((r) => !(r[cName] ?? '').trim() && !isTotal(r[0]))
    .map((r) => indentOf(r[0]))
  const unitIndent = headIndents.length ? Math.min(...headIndents) : 0
  const twoLevels = new Set(headIndents).size > 1

  const items: BudgetItem[] = []
  let unit = ''
  let detail = ''
  for (const r of body) {
    const label = r[0].trim()
    const nums = { budget: money(r[cBudget]), spent: money(r[cSpent]), left: money(r[cLeft]) }
    if (isTotal(r[0])) {
      total = nums
      continue
    }
    const name = (r[cName] ?? '').trim()
    if (!name) {
      if (twoLevels && indentOf(r[0]) <= unitIndent) {
        unit = label
        detail = ''
      } else detail = label
      continue
    }
    items.push({ key: [unit, detail, label, name].map(norm).join('|'), unit, detail, cost: label, name, ...nums })
  }
  if (!items.length) throw new BudgetFileError('예산 항목(산출내역)을 하나도 찾지 못했어요.')
  return { items, total }
}

function isTotal(s: string): boolean {
  return norm(s ?? '') === '합계'
}

/** 체육 · 건강체력 · 스포츠 항목인지 (세부사업 · 산출내역 낱말로). 교사가 고친 것은 따로 기억한다 */
const PE_WORDS = /체육|스포츠|건강체력|체력|운동부|운동회|육상|수영|팝스|PAPS|넷볼|축구|농구|배구|배드민턴/i
export function looksPe(it: Pick<BudgetItem, 'detail' | 'name'>): boolean {
  return PE_WORDS.test(it.detail) || PE_WORDS.test(it.name)
}

export function isPicked(it: BudgetItem, picks: Record<string, boolean>): boolean {
  return picks[it.key] ?? looksPe(it)
}

/** 시트 '세부사업' 칸 글자: 자율·자치활동 → 자율자치활동, (통합) 빼기 (교사 시트 표기) */
export function sheetLabel(it: BudgetItem): string {
  const clean = (s: string) => s.replace(/·/g, '').replace(/^\(통합\)\s*/, '').trim()
  return [it.unit, it.detail, it.cost].map(clean).filter(Boolean).join('-')
}

export interface BudgetGroup {
  unit: string
  detail: string
  items: BudgetItem[]
  budget: number
  spent: number
  left: number
}

/** 세부사업마다 묶기 (파일 순서 그대로) */
export function groupItems(items: BudgetItem[]): BudgetGroup[] {
  const out: BudgetGroup[] = []
  for (const it of items) {
    let g = out[out.length - 1]
    if (!g || g.unit !== it.unit || g.detail !== it.detail) {
      g = { unit: it.unit, detail: it.detail, items: [], budget: 0, spent: 0, left: 0 }
      out.push(g)
    }
    g.items.push(it)
    g.budget += it.budget
    g.spent += it.spent
    g.left += it.left
  }
  return out
}

export interface SheetLayout {
  /** 요약 표 머리글을 둘 칸 (예: N5) — 교사 시트 그대로가 기본 */
  startCell: string
  /** 품목을 적는 시트 이름 (다른 탭에 붙여도 수식이 맞게) */
  itemSheet: string
  /** 품목 칸: 예산항목 열 · 금액 열 · 첫 줄 */
  itemCol: string
  amountCol: string
  firstRow: number
  /** 에듀파인 집행액(B) 칸을 오른쪽에 더할지 */
  withEdufine: boolean
}

export const DEFAULT_LAYOUT: SheetLayout = { startCell: 'N5', itemSheet: '물품구입 시트', itemCol: 'H', amountCol: 'F', firstRow: 4, withEdufine: true }

function colNum(letters: string): number {
  return letters
    .toUpperCase()
    .split('')
    .reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)
}
function colName(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function parseCell(cell: string): { col: number; row: number } | null {
  const m = /^\s*([A-Za-z]{1,3})(\d{1,5})\s*$/.exec(cell)
  return m ? { col: colNum(m[1]), row: Number(m[2]) } : null
}

const quoteSheet = (name: string) => (name.trim() ? `'${name.trim().replace(/'/g, "''")}'!` : '')

/**
 * 시트에 붙여 넣을 표 (머리글 + 항목 줄). 값이 '='로 시작하면 구글 시트가 수식으로 받는다.
 * 지출금액 = SUMIF(품목 예산항목, 산출내역, 품목 금액), 예산잔액 = 현액 − 지출, 총 잔액 = 세부사업 줄 잔액 합.
 */
export function sheetRows(items: BudgetItem[], layout: SheetLayout = DEFAULT_LAYOUT): (string | number)[][] {
  const at = parseCell(layout.startCell) ?? parseCell(DEFAULT_LAYOUT.startCell)!
  const c = (k: number) => colName(at.col + k)
  const sh = quoteSheet(layout.itemSheet)
  const it = layout.itemCol.toUpperCase()
  const am = layout.amountCol.toUpperCase()
  const head = ['세부사업', '산출내역', '예산현액', '지출금액', '예산잔액', '지출 예정금액', '예산 항목별 총 잔액']
  if (layout.withEdufine) head.push('에듀파인 집행액', '차이(시트-에듀파인)')
  const rows: (string | number)[][] = [head]
  let r = at.row + 1
  for (const g of groupItems(items)) {
    const first = r
    const last = r + g.items.length - 1
    g.items.forEach((x, i) => {
      const row: (string | number)[] = [
        sheetLabel(x),
        x.name,
        x.budget,
        `=SUMIF(${sh}$${it}$${layout.firstRow}:$${it}, ${c(1)}${r}, ${sh}$${am}$${layout.firstRow}:$${am})`,
        `=${c(2)}${r}-${c(3)}${r}`,
        '',
        i === 0 ? (first === last ? `=${c(4)}${first}` : `=SUM(${c(4)}${first}:${c(4)}${last})`) : '',
      ]
      if (layout.withEdufine) row.push(x.spent, `=${c(3)}${r}-${c(7)}${r}`)
      rows.push(row)
      r++
    })
  }
  return rows
}

/** 탭으로 나눈 글 (구글 시트 · 엑셀 붙여넣기용). 칸 안 줄바꿈 · 탭은 빈칸으로 */
export function toTsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')
}

/** 드롭다운에 넣을 산출내역 목록 (한 줄에 하나) */
export function dropdownList(items: BudgetItem[]): string {
  return [...new Set(items.map((x) => x.name))].join('\n')
}

/** 시트 붙여넣기 범위 안내 (예: N5:V20) */
export function pasteRange(rows: (string | number)[][], layout: SheetLayout = DEFAULT_LAYOUT): string {
  const at = parseCell(layout.startCell) ?? parseCell(DEFAULT_LAYOUT.startCell)!
  return `${colName(at.col)}${at.row}:${colName(at.col + (rows[0]?.length ?? 1) - 1)}${at.row + rows.length - 1}`
}

/** 산출내역 칸 범위 (드롭다운 '범위에서' 지정용, 예: O6:O20) */
export function nameRange(itemCount: number, layout: SheetLayout = DEFAULT_LAYOUT): string {
  const at = parseCell(layout.startCell) ?? parseCell(DEFAULT_LAYOUT.startCell)!
  const c = colName(at.col + 1)
  return `${c}${at.row + 1}:${c}${at.row + itemCount}`
}
