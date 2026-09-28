import { matchNeisCommonHeader, readNeisCommon, normalizeClassCode, type NeisCommonField } from './neisCommonColumns'
import { cellText, headerBase, parseGender, parseIntLoose, splitStudentCode } from './text'

/**
 * 명렬 한 줄을 인식한 결과. 엑셀·붙여넣기 모두 이 모양으로 모인다.
 * 여기에는 생년월일 칸이 일부러 없다 (읽기만 하고 저장하지 않는다 · CLAUDE.md 4-1).
 */
export interface RosterRow {
  /** 화면에서 줄을 구분하는 번호 */
  key: string
  /** 사람이 읽는 위치. 예: '3행', '5번째 줄' */
  source: string
  schoolYear: number | null
  grade: number | null
  classNo: number | null
  classCode: string
  number: number | null
  name: string
  gender: 'M' | 'F' | null
  course: string
  track: string
  dept: string
  /** 인식 단계에서 생긴 문제 (예: 학번 형식이 이상함) */
  problems: string[]
}

export function emptyRow(key: string, source: string): RosterRow {
  return {
    key,
    source,
    schoolYear: null,
    grade: null,
    classNo: null,
    classCode: '',
    number: null,
    name: '',
    gender: null,
    course: '',
    track: '',
    dept: '',
    problems: [],
  }
}

export type RosterField = NeisCommonField | 'gender' | 'birth' | 'studentCode'

/** 나이스 외의 다른 엑셀도 읽기 위한 헤더 별칭. 비교는 공백·괄호 설명을 뺀 뒤에 한다. */
const ALIASES: Record<Exclude<RosterField, 'gender'>, string[]> = {
  schoolYear: ['학년도'],
  course: ['과정명', '과정'],
  track: ['계열명', '계열'],
  grade: ['학년'],
  dept: ['학과명', '학과'],
  className: ['반명', '반', '학급', '반번호'],
  classCode: ['반코드'],
  number: ['번호', '출석번호', '번'],
  name: ['학생성명', '성명', '이름', '학생명', '학생이름'],
  birth: ['생년월일', '생일'],
  studentCode: ['학번'],
}

const ALIAS_LOOKUP = new Map<string, RosterField>()
for (const [field, names] of Object.entries(ALIASES)) {
  for (const n of names) ALIAS_LOOKUP.set(n, field as RosterField)
}

export function matchRosterHeader(header: unknown): RosterField | null {
  const common = matchNeisCommonHeader(header)
  if (common) return common
  const base = headerBase(header)
  if (base === '') return null
  if (base.startsWith('성별')) return 'gender'
  return ALIAS_LOOKUP.get(base) ?? null
}

export interface HeaderMatch {
  rowIndex: number
  columns: Partial<Record<RosterField, number>>
  /** 이름이 있지만 무슨 칸인지 모르는 헤더 (정보용) */
  unknownHeaders: string[]
}

/**
 * 표 윗부분(기본 20줄)을 훑어 헤더 줄을 찾는다. 제목·빈 줄이 위에 있어도 된다.
 * 조건: 알아본 칸이 2개 이상이고, 그중에 이름 또는 학번이 있어야 한다.
 */
export function detectHeaderRow(grid: readonly (readonly unknown[])[], maxScan = 20): HeaderMatch | null {
  const limit = Math.min(grid.length, maxScan)
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? []
    const columns: Partial<Record<RosterField, number>> = {}
    const unknownHeaders: string[] = []
    row.forEach((cell, c) => {
      const f = matchRosterHeader(cell)
      if (f) {
        if (columns[f] === undefined) columns[f] = c
      } else if (cellText(cell) !== '') {
        unknownHeaders.push(cellText(cell))
      }
    })
    const found = Object.keys(columns).filter((k) => k !== 'birth').length
    if (found >= 2 && (columns.name !== undefined || columns.studentCode !== undefined)) {
      return { rowIndex: r, columns, unknownHeaders }
    }
  }
  return null
}

export interface GridParseResult {
  header: HeaderMatch | null
  rows: RosterRow[]
}

/**
 * 헤더가 있는 표(엑셀 시트, 헤더까지 복사한 붙여넣기)를 명렬 줄 목록으로.
 * @param rowLabel 위치 표시 방식. 엑셀은 '행', 붙여넣기는 '번째 줄'
 */
export function parseRosterGrid(
  grid: readonly (readonly unknown[])[],
  rowLabel: '행' | '번째 줄' = '행',
  keyPrefix = 'r',
): GridParseResult {
  const header = detectHeaderRow(grid)
  if (!header) return { header: null, rows: [] }
  const cols = header.columns
  const rows: RosterRow[] = []

  for (let r = header.rowIndex + 1; r < grid.length; r++) {
    const cells = grid[r] ?? []
    const get = (f: RosterField) => (cols[f] === undefined ? '' : cellText(cells[cols[f]!]))
    // 생년월일 칸은 일부러 읽지 않는다 → 어디에도 복사되지 않는다.
    const hasContent = (Object.keys(cols) as RosterField[]).some((f) => f !== 'birth' && get(f) !== '')
    if (!hasContent) continue

    const row = emptyRow(`${keyPrefix}${r}`, `${r + 1}${rowLabel}`)
    const common = readNeisCommon(cells, cols)
    Object.assign(row, {
      schoolYear: common.schoolYear,
      course: common.course,
      track: common.track,
      grade: common.grade,
      dept: common.dept,
      classNo: common.classNo,
      classCode: common.classCode,
      number: common.number,
      name: common.name,
    })

    for (const f of ['grade', 'className', 'number'] as const) {
      if (get(f) !== '' && parseIntLoose(get(f)) === null) {
        const label = f === 'grade' ? '학년' : f === 'className' ? '반' : '번호'
        row.problems.push(`${label} 칸을 숫자로 읽지 못했어요: "${get(f)}"`)
      }
    }

    // 반 번호가 없고 반코드만 있으면 반코드로 반을 채운다.
    if (row.classNo === null && /^\d+$/.test(row.classCode)) row.classNo = Number(row.classCode)

    const genderRaw = get('gender')
    row.gender = parseGender(genderRaw)
    if (genderRaw !== '' && row.gender === null) row.problems.push(`성별을 알 수 없어요: "${genderRaw}"`)

    const codeRaw = get('studentCode')
    if (codeRaw !== '') applyStudentCode(row, codeRaw)

    rows.push(row)
  }
  return { header, rows }
}

/** 학번으로 비어 있는 학년·반·번호를 채우고, 이미 있으면 서로 맞는지 확인한다. */
export function applyStudentCode(row: RosterRow, codeRaw: string): void {
  const parts = splitStudentCode(codeRaw)
  if (!parts) {
    row.problems.push(`학번 형식을 알 수 없어요: "${codeRaw}" (학년 1자리+반 2자리+번호 2자리)`)
    return
  }
  const mismatch =
    (row.grade !== null && row.grade !== parts.grade) ||
    (row.classNo !== null && row.classNo !== parts.classNo) ||
    (row.number !== null && row.number !== parts.number)
  if (mismatch) {
    row.problems.push(`학번 ${codeRaw}와 학년·반·번호가 서로 달라요`)
    return
  }
  row.grade ??= parts.grade
  row.classNo ??= parts.classNo
  row.number ??= parts.number
  if (row.classCode === '') row.classCode = normalizeClassCode(String(parts.classNo))
}
