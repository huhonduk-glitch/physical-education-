/**
 * 나이스 PAPS 일괄업로드 파일 만들기 (CLAUDE.md 4-5 "나이스 내보내기").
 * 나이스는 빈칸 하나, 범위 밖 값 하나만 있어도 파일 전체를 거부하므로 먼저 검사하고, 문제가 있으면 파일을 만들지 않는다.
 * 원자료(1차·2차·좌우)를 원래 칸에 그대로 넣는다. 등급은 넣지 않는다.
 */
import { writeNeisCommon, type NeisCommonDefaults, type NeisCommonSource } from './neisCommonColumns'
import { cellLabel, type NeisColumn } from './neisHeaderParser'
import { cellId, type CellSpec } from './papsLayout'
import { fixed } from './paps'

export interface RangeSpec {
  min: number | null
  max: number | null
  decimals: number
}

export type Ranges = Record<string, RangeSpec>

export interface ExportStudent extends NeisCommonSource {
  id: string
}

/** 학생 id → 칸 id → 값 */
export type Values = Map<string, Map<string, number>>

export interface ExportIssue {
  studentId: string
  who: string
  cell: string
  label: string
  kind: 'missing' | 'range' | 'decimals'
  value?: number
  range?: string
}

/** 소수 자릿수 초과인가 (자동 반올림하지 않고 경고만) */
export function exceedsDecimals(v: number, decimals: number): boolean {
  const f = 10 ** decimals
  return Math.abs(v * f - Math.round(v * f)) > 1e-6
}

export function rangeText(r: RangeSpec): string {
  return `${r.min ?? '…'} ~ ${r.max ?? '…'}`
}

/** 값 하나 검사: 범위·자릿수 (입력 화면에서도 같은 함수를 쓴다) */
export function checkValue(v: number, r: RangeSpec | undefined): 'range' | 'decimals' | null {
  if (!r) return null
  if ((r.min !== null && v < r.min - 1e-9) || (r.max !== null && v > r.max + 1e-9)) return 'range'
  if (exceedsDecimals(v, r.decimals)) return 'decimals'
  return null
}

function measureCells(columns: readonly NeisColumn[]): (CellSpec & { header: string })[] {
  return columns.flatMap((c) => (c.kind === 'measure' ? [{ key: c.key, attempt: c.attempt, side: c.side, header: c.header }] : []))
}

export function validateExport(
  columns: readonly NeisColumn[],
  students: readonly ExportStudent[],
  values: Values,
  excludedIds: ReadonlySet<string>,
  ranges: Ranges,
): { issues: ExportIssue[]; included: ExportStudent[]; excluded: ExportStudent[]; unknownColumns: string[] } {
  const included = students.filter((s) => !excludedIds.has(s.id))
  const excluded = students.filter((s) => excludedIds.has(s.id))
  const issues: ExportIssue[] = []
  const cells = measureCells(columns)
  for (const s of included) {
    const who = `${s.number}번 ${s.name}`
    const vals = values.get(s.id)
    for (const c of cells) {
      const id = cellId(c)
      const label = cellLabel(c)
      const v = vals?.get(id)
      if (v === undefined || !Number.isFinite(v)) {
        issues.push({ studentId: s.id, who, cell: id, label, kind: 'missing' })
        continue
      }
      const r = ranges[c.key]
      const bad = checkValue(v, r)
      if (bad) issues.push({ studentId: s.id, who, cell: id, label, kind: bad, value: v, range: r ? rangeText(r) : undefined })
    }
  }
  const unknownColumns = columns.filter((c) => c.kind === 'unknown').map((c) => c.header)
  return { issues, included, excluded, unknownColumns }
}

/** 검사를 통과한 학생들로 표(헤더 + 줄) 만들기. 모든 칸은 글자다(반코드 01, 부동소수점 오차 방지). */
export function buildRows(
  columns: readonly NeisColumn[],
  students: readonly ExportStudent[],
  values: Values,
  defaults: NeisCommonDefaults,
  ranges: Ranges,
): string[][] {
  const header = columns.map((c) => c.header)
  const rows = students.map((s) => {
    const common = writeNeisCommon(s, defaults)
    const vals = values.get(s.id)
    return columns.map((c) => {
      if (c.kind === 'common') {
        // 공통 9열은 writeNeisCommon 순서와 같다 (양식에서 순서가 달라도 필드 이름으로 찾는다)
        const idx = ['schoolYear', 'course', 'track', 'grade', 'dept', 'className', 'classCode', 'number', 'name'].indexOf(c.field)
        return common[idx] ?? ''
      }
      if (c.kind === 'measure') {
        const v = vals?.get(cellId(c))
        return v === undefined ? '' : fixed(v, ranges[c.key]?.decimals ?? 2)
      }
      return ''
    })
  })
  return [header, ...rows]
}

/** 표 → xlsx 파일 (모든 칸을 '텍스트' 서식으로: 반코드 01의 앞 0이 사라지지 않게) */
export async function rowsToXlsx(rows: string[][], sheetName = 'empty0'): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((v) => ({ v, t: 's', z: '@' }))))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
