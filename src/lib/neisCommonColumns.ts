import { cellText, normalizeHeader, pad2, parseIntLoose } from './text'

/**
 * 나이스 학생명렬표와 PAPS 일괄업로드 양식이 똑같이 쓰는 앞 9개 열.
 * references/neis-roster-sample.xlsx.xlsx, neis-paps-template.xlsx.xlsx 에서 확인한 헤더 그대로다.
 * 명렬 올리기(Phase 1)와 PAPS 내보내기(Phase 4)가 이 파일 하나를 같이 쓴다.
 */
export const NEIS_COMMON_COLUMNS = [
  { field: 'schoolYear', header: '학년도' },
  { field: 'course', header: '과정명' },
  { field: 'track', header: '계열명' },
  { field: 'grade', header: '학년' },
  { field: 'dept', header: '학과명' },
  { field: 'className', header: '반명' },
  { field: 'classCode', header: '반코드' },
  { field: 'number', header: '번호' },
  { field: 'name', header: '학생성명' },
] as const

export type NeisCommonField = (typeof NEIS_COMMON_COLUMNS)[number]['field']

export const NEIS_COMMON_HEADERS: readonly string[] = NEIS_COMMON_COLUMNS.map((c) => c.header)

const BY_HEADER = new Map<string, NeisCommonField>(
  NEIS_COMMON_COLUMNS.map((c) => [normalizeHeader(c.header), c.field]),
)

/** 헤더 글자가 나이스 공통 열이면 그 필드 이름을, 아니면 null. 공백 차이는 무시한다. */
export function matchNeisCommonHeader(header: unknown): NeisCommonField | null {
  return BY_HEADER.get(normalizeHeader(header)) ?? null
}

export interface NeisCommonValues {
  schoolYear: number | null
  course: string
  track: string
  grade: number | null
  dept: string
  classNo: number | null
  /** 원문 그대로의 글자. 앞의 0을 지키기 위해 숫자로 바꾸지 않는다. */
  classCode: string
  number: number | null
  name: string
}

export type ColumnIndex<F extends string> = Partial<Record<F, number>>

/** 한 줄(셀 배열)에서 공통 열 값을 읽는다. 열이 없으면 빈 값. */
export function readNeisCommon(cells: readonly unknown[], cols: ColumnIndex<NeisCommonField>): NeisCommonValues {
  const get = (f: NeisCommonField) => (cols[f] === undefined ? '' : cellText(cells[cols[f]!]))
  const classCodeRaw = get('classCode')
  return {
    schoolYear: parseIntLoose(get('schoolYear')),
    course: get('course'),
    track: get('track'),
    grade: parseIntLoose(get('grade')),
    dept: get('dept'),
    classNo: parseIntLoose(get('className')),
    classCode: normalizeClassCode(classCodeRaw),
    number: parseIntLoose(get('number')),
    name: get('name'),
  }
}

/**
 * 반코드는 나이스에서 2자리 글자('01')다. 엑셀이 숫자로 바꿔 '1'이 된 경우만 앞에 0을 붙인다.
 * 숫자가 아닌 반코드는 손대지 않는다.
 */
export function normalizeClassCode(raw: string): string {
  const s = cellText(raw)
  if (/^\d$/.test(s)) return pad2(Number(s))
  return s
}

export interface NeisCommonDefaults {
  course: string
  track: string
  dept: string
}

export interface NeisCommonSource {
  schoolYear: number
  grade: number
  classNo: number
  classCode?: string
  number: number
  name: string
  course?: string
  track?: string
  dept?: string
}

/**
 * 학생 한 명을 공통 9열의 글자 배열로 (내보내기용).
 * 과정·계열·학과·반코드는 명렬표에서 가져온 값을 쓰고, 비었을 때만 설정 기본값을 쓴다.
 */
export function writeNeisCommon(s: NeisCommonSource, d: NeisCommonDefaults): string[] {
  const values: Record<NeisCommonField, string> = {
    schoolYear: String(s.schoolYear),
    course: s.course || d.course,
    track: s.track || d.track,
    grade: String(s.grade),
    dept: s.dept || d.dept,
    className: String(s.classNo),
    classCode: s.classCode ? normalizeClassCode(s.classCode) : pad2(s.classNo),
    number: String(s.number),
    name: s.name,
  }
  return NEIS_COMMON_COLUMNS.map((c) => values[c.field])
}
