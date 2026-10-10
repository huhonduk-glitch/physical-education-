import { cellText } from './text'

/**
 * 나이스 수행평가 일괄입력 양식 (references/neis-assessment-template.xlsx 기준).
 *
 *   1행: 과목 | 반 | 번호 | 성명 | 영역 이름 … (과목~성명은 1~3행 세로 병합)
 *   2행:                       | 만점(100) …
 *   3행:                       | 점수 …
 *   4행~: 학생 한 명씩. 모든 칸은 글자(@) 형식, 시트 이름 empty0
 *
 * 영역 수·이름·만점은 평가마다 바뀌므로 열을 코드에 고정하지 않고 머리글을 읽어서 맞춘다.
 */

export interface AssessTemplateRow {
  /** 시트의 행 번호(0부터) */
  row: number
  subject: string
  cls: string
  number: string
  name: string
}
export interface AssessTemplateArea {
  col: number
  title: string
  /** '만점(100)'에서 읽은 만점. 없으면 null */
  max: number | null
}
export interface AssessTemplate {
  headerRow: number
  dataStart: number
  cols: { subject: number; cls: number; number: number; name: number }
  areas: AssessTemplateArea[]
  rows: AssessTemplateRow[]
}

const norm = (v: unknown) => cellText(v).replace(/\s+/g, '')
const FIXED: Record<keyof AssessTemplate['cols'], string[]> = {
  subject: ['과목', '과목명'],
  cls: ['반', '반명'],
  number: ['번호'],
  name: ['성명', '학생성명', '이름'],
}

/** 양식 읽기. 머리글(번호·성명)을 못 찾으면 null */
export function parseAssessTemplate(grid: readonly (readonly unknown[])[]): AssessTemplate | null {
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const row = grid[r] ?? []
    const find = (names: string[]) => row.findIndex((c) => names.includes(norm(c)))
    const cols = { subject: find(FIXED.subject), cls: find(FIXED.cls), number: find(FIXED.number), name: find(FIXED.name) }
    if (cols.number < 0 || cols.name < 0) continue
    const fixed = new Set(Object.values(cols).filter((c) => c >= 0))
    const areas: AssessTemplateArea[] = []
    let dataStart = r + 1
    row.forEach((c, i) => {
      if (fixed.has(i) || !cellText(c)) return
      areas.push({ col: i, title: cellText(c), max: null })
    })
    // 아래 머리글 줄: '만점(100)' · '점수'
    for (let k = r + 1; k < Math.min(grid.length, r + 4); k++) {
      const sub = grid[k] ?? []
      const texts = areas.map((a) => norm(sub[a.col]))
      const isHeader = texts.some((t) => /^만점/.test(t) || t === '점수') && !cellText(sub[cols.name])
      if (!isHeader) break
      areas.forEach((a, i) => {
        const m = /^만점\(?([\d.]+)\)?/.exec(texts[i])
        if (m) a.max = Number(m[1])
      })
      dataStart = k + 1
    }
    const rows: AssessTemplateRow[] = []
    for (let k = dataStart; k < grid.length; k++) {
      const g = grid[k] ?? []
      const name = cellText(g[cols.name])
      if (!name) continue
      rows.push({
        row: k,
        subject: cols.subject >= 0 ? cellText(g[cols.subject]) : '',
        cls: cols.cls >= 0 ? cellText(g[cols.cls]) : '',
        number: cellText(g[cols.number]),
        name,
      })
    }
    return { headerRow: r, dataStart, cols, areas, rows }
  }
  return null
}

/** 영역 이름 → 평가 찾기 (띄어쓰기 차이는 같은 것으로 본다) */
export function matchAreaTitle<T extends { id: string; title: string }>(title: string, list: readonly T[]): T | undefined {
  return list.find((a) => norm(a.title) === norm(title))
}

export interface MemberLike {
  id: string
  name: string
  number: number
}

export interface RowMatch {
  row: AssessTemplateRow
  studentId: string | null
  problem?: string
}

/**
 * 양식의 학생 줄 ↔ 수업반 학생 맞추기. 이름으로 찾고, 같은 이름이 여럿이면 번호로 가린다.
 * homeroomNumbers: 학적반이면 true (양식 번호 = 명렬 번호라 번호가 다르면 문제로 표시)
 */
export function matchTemplateRows(tpl: AssessTemplate, members: readonly MemberLike[], homeroomNumbers: boolean): { matches: RowMatch[]; missing: MemberLike[] } {
  const used = new Set<string>()
  const matches: RowMatch[] = tpl.rows.map((row) => {
    const same = members.filter((m) => m.name === row.name)
    let pick: MemberLike | undefined
    if (same.length === 1) pick = same[0]
    else if (same.length > 1) pick = same.find((m) => String(m.number) === row.number)
    if (!pick) {
      return { row, studentId: null, problem: same.length > 1 ? '같은 이름이 여러 명이에요' : '이 수업반에 없는 학생이에요' }
    }
    if (homeroomNumbers && String(pick.number) !== row.number) {
      return { row, studentId: null, problem: `번호가 달라요 (앱: ${pick.number}번)` }
    }
    if (used.has(pick.id)) return { row, studentId: null, problem: '같은 학생이 두 번 나와요' }
    used.add(pick.id)
    return { row, studentId: pick.id }
  })
  return { matches, missing: members.filter((m) => !used.has(m.id)) }
}

/** 양식 그대로 복사한 표에 점수만 채운다 (모두 글자) */
export function fillTemplateGrid(grid: readonly (readonly unknown[])[], cells: { row: number; col: number; value: string }[]): string[][] {
  const width = Math.max(0, ...grid.map((r) => r.length), ...cells.map((c) => c.col + 1))
  const out = grid.map((r) => Array.from({ length: width }, (_, i) => cellText(r[i])))
  for (const c of cells) out[c.row][c.col] = c.value
  return out
}

/** 양식 없이 같은 모양으로 만들기 */
export function buildAssessGrid(subject: string, rows: { cls: string; number: string; name: string; scores: string[] }[], areas: { title: string; max: number }[]): string[][] {
  return [
    ['과목', '반', '번호', '성명', ...areas.map((a) => a.title)],
    ['', '', '', '', ...areas.map((a) => `만점(${a.max})`)],
    ['', '', '', '', ...areas.map(() => '점수')],
    ...rows.map((r) => [subject, r.cls, r.number, r.name, ...r.scores]),
  ]
}

/** 양식의 세로 병합(과목~성명 1~3행)과 같은 병합 정보 */
export function headerMerges(headerRows: number): { s: { r: number; c: number }; e: { r: number; c: number } }[] {
  if (headerRows <= 1) return []
  return [0, 1, 2, 3].map((c) => ({ s: { r: 0, c }, e: { r: headerRows - 1, c } }))
}

type XlsxLib = typeof import('xlsx')
export interface SheetLayout {
  sheetName: string
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[]
  colWidths: number[]
}

/** 표 → 나이스 양식과 같은 통합문서 (모든 칸 글자 형식 '@') */
export function assessWorkbook(XLSX: XlsxLib, grid: string[][], layout: SheetLayout) {
  const ws: Record<string, unknown> = {}
  let maxC = 0
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      maxC = Math.max(maxC, c)
      ws[XLSX.utils.encode_cell({ r, c })] = { t: 's', v, z: '@' }
    }),
  )
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, grid.length - 1), c: maxC } })
  if (layout.merges.length) ws['!merges'] = layout.merges
  if (layout.colWidths.length) ws['!cols'] = layout.colWidths.map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws as import('xlsx').WorkSheet, layout.sheetName || 'empty0')
  return wb
}

/** 올린 양식의 시트 모양(이름·병합·열 너비)을 그대로 가져온다 */
export function layoutOf(ws: import('xlsx').WorkSheet, sheetName: string): SheetLayout {
  return {
    sheetName,
    merges: (ws['!merges'] ?? []).map((m) => ({ s: { ...m.s }, e: { ...m.e } })),
    colWidths: (ws['!cols'] ?? []).map((c) => c?.wch ?? (c?.wpx ? c.wpx / 7 : 10)),
  }
}
