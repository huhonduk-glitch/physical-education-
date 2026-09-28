/**
 * PAPS 기록 붙여넣기 (CLAUDE.md 4-5 "기록 붙여넣기 입력"). 순수 함수.
 *
 * 1) 헤더가 있는 표: 헤더를 neisHeaderParser로 해석해 열을 맞춘다 (나이스 양식 전체도 됨)
 * 2) 헤더 없이 값만 (반·종목을 먼저 고름):
 *    1\t34 · 1 강OO 34 · 강OO 34 · 10101 34 · 1\t6.5\t7.25 · 1\t32.9\t27.6\t32\t27 · 34(값만 → 번호순, 경고)
 * 탭·공백·쉼표 구분, 소수점·음수 인식. 학생 매칭: 번호 → 학번 → 이름.
 */
import { parseNeisHeaders, type NeisColumn } from './neisHeaderParser'
import { cellId, type CellSpec } from './papsLayout'
import { cellText, parseIntLoose } from './text'

export interface PasteStudent {
  id: string
  number: number
  name: string
  studentCode: string
}

export interface PasteRow {
  line: number
  raw: string
  studentId: string | null
  /** 이 줄에 적힌 학생 표시 (번호/이름/학번) */
  who: string
  /** 칸 id → 값 */
  values: Record<string, number>
  errors: string[]
  warnings: string[]
}

export interface PasteResult {
  mode: 'table' | 'values'
  rows: PasteRow[]
  /** 표 모드에서 알아보지 못한 열 */
  unknownColumns: string[]
  /** 값만 한 줄씩 넣어 번호순으로 채운 경우 (반드시 확인) */
  sequential: boolean
}

const NUM = /^-?\d+(\.\d+)?$/
const HANGUL_OR_ALPHA = /[가-힣A-Za-z]/

function tokens(line: string): string[] {
  const sep = line.includes('\t') ? /\t/ : /[\s,]+/
  return line.split(sep).map((t) => t.trim()).filter((t) => t !== '')
}

function matchStudent(
  students: readonly PasteStudent[],
  by: { number?: number | null; code?: string | null; name?: string | null },
): { id: string | null; error?: string } {
  const byNum = by.number != null ? students.filter((s) => s.number === by.number) : []
  const byCode = by.code ? students.filter((s) => s.studentCode === by.code) : []
  const byName = by.name ? students.filter((s) => s.name === by.name) : []
  if (by.number != null) {
    if (byNum.length === 0) return { id: null, error: `${by.number}번 학생이 이 반에 없어요` }
    const s = byNum[0]
    if (by.name && s.name !== by.name) return { id: null, error: `${by.number}번은 ${s.name}인데 ${by.name}(으)로 적혀 있어요` }
    return { id: s.id }
  }
  if (by.code) {
    if (byCode.length === 0) return { id: null, error: `학번 ${by.code} 학생이 없어요` }
    if (by.name && byCode[0].name !== by.name) return { id: null, error: `학번 ${by.code}은 ${byCode[0].name}인데 ${by.name}(으)로 적혀 있어요` }
    return { id: byCode[0].id }
  }
  if (by.name) {
    if (byName.length === 0) return { id: null, error: `${by.name} 학생이 이 반에 없어요` }
    if (byName.length > 1) return { id: null, error: `${by.name} 이름이 ${byName.length}명이에요 — 번호로 골라 주세요` }
    return { id: byName[0].id }
  }
  return { id: null, error: '학생을 알아볼 수 없어요' }
}

export function parsePapsPaste(
  text: string,
  ctx: { students: readonly PasteStudent[]; /** 헤더 없이 붙여넣을 때 채울 칸 (종목 선택) */ cells: readonly CellSpec[] | null },
): PasteResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const firstIdx = lines.findIndex((l) => cellText(l) !== '')
  if (firstIdx < 0) return { mode: 'values', rows: [], unknownColumns: [], sequential: false }

  // ── 1) 헤더가 있는 표
  const headerCols = parseNeisHeaders(tokensForHeader(lines[firstIdx]))
  const isHeader = headerCols.some((c) => c.kind === 'measure') && headerCols.some((c) => c.kind === 'common' || c.kind === 'measure')
  if (isHeader && !headerCols.every((c) => c.kind === 'unknown') && !NUM.test(tokens(lines[firstIdx])[0] ?? '')) {
    return parseTable(lines, firstIdx, headerCols, ctx.students)
  }

  // ── 2) 값만
  const cells = ctx.cells ?? []
  const rows: PasteRow[] = []
  const content = lines.map((l, i) => ({ l, i })).filter((x) => cellText(x.l) !== '')
  const allSingle = content.every((x) => {
    const t = tokens(x.l)
    return t.length === 1 && NUM.test(t[0])
  })
  const sorted = [...ctx.students].sort((a, b) => a.number - b.number)

  content.forEach(({ l, i }, order) => {
    const t = tokens(l)
    const row: PasteRow = { line: i + 1, raw: l, studentId: null, who: '', values: {}, errors: [], warnings: [] }
    let nums: number[] = []
    let m: { id: string | null; error?: string }
    if (allSingle) {
      const s = sorted[order]
      m = s ? { id: s.id } : { id: null, error: '반 학생 수보다 줄이 많아요' }
      row.who = s ? `${s.number}번 ${s.name}` : '?'
      nums = [Number(t[0])]
      row.warnings.push('값만 있어 번호순으로 채웠어요 — 순서가 맞는지 꼭 확인하세요')
    } else {
      const nameIdx = t.findIndex((x) => HANGUL_OR_ALPHA.test(x) && !NUM.test(x))
      const name = nameIdx >= 0 ? t[nameIdx] : null
      const before = nameIdx >= 0 ? t.slice(0, nameIdx) : []
      const after = nameIdx >= 0 ? t.slice(nameIdx + 1) : t
      let number: number | null = null
      let code: string | null = null
      if (nameIdx >= 0) {
        if (before.length === 1) {
          if (/^\d{5}$/.test(before[0])) code = before[0]
          else number = parseIntLoose(before[0])
        }
        nums = after.filter((x) => NUM.test(x)).map(Number)
      } else {
        const lead = t[0]
        if (/^\d{5}$/.test(lead)) code = lead
        else number = parseIntLoose(lead)
        nums = t.slice(1).filter((x) => NUM.test(x)).map(Number)
      }
      if (t.some((x) => !NUM.test(x) && x !== name && !/^\d+$/.test(x))) row.errors.push('숫자가 아닌 값이 있어요')
      m = matchStudent(ctx.students, { number, code, name })
      row.who = [number != null ? `${number}번` : code ? `학번 ${code}` : '', name ?? ''].filter(Boolean).join(' ')
    }
    if (m.error) row.errors.push(m.error)
    row.studentId = m.id
    if (cells.length === 0) row.errors.push('먼저 종목을 골라 주세요')
    else if (nums.length === 0) row.errors.push('기록 값이 없어요')
    else if (nums.length > cells.length) row.errors.push(`값이 ${nums.length}개인데 칸은 ${cells.length}개예요`)
    else {
      nums.forEach((v, k) => (row.values[cellId(cells[k])] = v))
      if (nums.length < cells.length) row.warnings.push(`${cells.length}칸 중 ${nums.length}칸만 채웠어요`)
    }
    rows.push(row)
  })
  markDuplicates(rows)
  return { mode: 'values', rows, unknownColumns: [], sequential: allSingle }
}

function tokensForHeader(line: string): string[] {
  return line.includes('\t') ? line.split('\t').map((x) => x.trim()) : line.split(/\s*[|,]\s*/)
}

function parseTable(lines: string[], headerIdx: number, cols: NeisColumn[], students: readonly PasteStudent[]): PasteResult {
  const rows: PasteRow[] = []
  const idx = (f: string) => cols.findIndex((c) => c.kind === 'common' && c.field === f)
  const iNum = idx('number')
  const iName = idx('name')
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    if (cellText(l) === '') continue
    const cells = l.includes('\t') ? l.split('\t') : l.split(',')
    const number = iNum >= 0 ? parseIntLoose(cells[iNum]) : null
    const name = iName >= 0 ? cellText(cells[iName]) || null : null
    const row: PasteRow = { line: i + 1, raw: l, studentId: null, who: [number != null ? `${number}번` : '', name ?? ''].filter(Boolean).join(' '), values: {}, errors: [], warnings: [] }
    const m = matchStudent(students, { number, name })
    if (m.error) row.errors.push(m.error)
    row.studentId = m.id
    cols.forEach((c, k) => {
      if (c.kind !== 'measure') return
      const raw = cellText(cells[k])
      if (raw === '') return
      if (!NUM.test(raw)) {
        row.errors.push(`${c.header}: 숫자가 아니에요 ("${raw}")`)
        return
      }
      row.values[cellId(c)] = Number(raw)
    })
    rows.push(row)
  }
  markDuplicates(rows)
  return { mode: 'table', rows, unknownColumns: cols.filter((c) => c.kind === 'unknown').map((c) => c.header), sequential: false }
}

function markDuplicates(rows: PasteRow[]): void {
  const seen = new Map<string, number>()
  for (const r of rows) if (r.studentId) seen.set(r.studentId, (seen.get(r.studentId) ?? 0) + 1)
  for (const r of rows) if (r.studentId && (seen.get(r.studentId) ?? 0) > 1) r.errors.push('같은 학생이 두 번 나와요')
}
