import { applyStudentCode, detectHeaderRow, emptyRow, parseRosterGrid, type RosterRow } from './rosterGrid'
import { cellText, parseGender } from './text'

/**
 * 복사-붙여넣기 명렬 인식 (CLAUDE.md 4-1-B). 화면과 분리된 순수 함수다.
 *
 * 인식하는 모양:
 *   1\t3\t12\t홍길동\t여     엑셀에서 복사한 탭 구분
 *   1학년 3반 12번 홍길동
 *   1-3-12 홍길동
 *   10312 홍길동 / 10312홍길동
 *   12 홍길동 / 12. 홍길동   (반을 먼저 고른 상태)
 *   홍길동                  (반을 먼저 고른 상태 · 줄 순서대로 번호)
 * 첫 줄이 헤더(번호, 이름 …)면 엑셀 표와 똑같이 헤더 기준으로 읽는다.
 */

export interface PasteContext {
  /** 화면에서 먼저 고른 학년 (없으면 null) */
  grade: number | null
  /** 화면에서 먼저 고른 반 (없으면 null) */
  classNo: number | null
}

export interface PasteParseResult {
  mode: 'table' | 'lines'
  rows: RosterRow[]
  /** 반을 먼저 골라야 하는 줄이 있었는지 (화면 안내용) */
  needsClass: boolean
}

const GENDER_WORD = /^(남|여|남자|여자|남성|여성|M|F|m|f)$/

export function parsePastedRoster(text: string, ctx: PasteContext): PasteParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // 첫 줄에 헤더가 있으면 표로 읽는다 (엑셀에서 헤더까지 복사한 경우).
  const grid = lines.map((l) => l.split('\t'))
  const header = detectHeaderRow(grid, 3)
  if (header) {
    const { rows } = parseRosterGrid(grid, '번째 줄', 'p')
    for (const row of rows) {
      row.grade ??= ctx.grade
      row.classNo ??= ctx.classNo
    }
    return { mode: 'table', rows, needsClass: false }
  }

  const rows: RosterRow[] = []
  let needsClass = false
  let order = 0
  lines.forEach((line, i) => {
    if (cellText(line) === '') return
    order += 1
    const row = parseLine(line, `p${i}`, `${i + 1}번째 줄`, order, ctx)
    if (row.problems.some((p) => p.startsWith(NEED_CLASS))) needsClass = true
    rows.push(row)
  })
  return { mode: 'lines', rows, needsClass }
}

const NEED_CLASS = '반을 먼저 골라'

function parseLine(line: string, key: string, source: string, order: number, ctx: PasteContext): RosterRow {
  const row = emptyRow(key, source)
  let s = cellText(line)

  // ① '1학년 3반 12번'처럼 이름표가 붙은 숫자를 먼저 꺼낸다.
  const labeled: { grade?: number; classNo?: number; number?: number } = {}
  s = s.replace(/(\d+)\s*학년/g, (_, d) => ((labeled.grade = Number(d)), ' '))
  s = s.replace(/(\d+)\s*반/g, (_, d) => ((labeled.classNo = Number(d)), ' '))
  s = s.replace(/(\d+)\s*번(?!호)/g, (_, d) => ((labeled.number = Number(d)), ' '))

  // ② '1-3-12', '1.3.12', '12.', '12)' 의 기호를 띄어쓰기로, '10312홍길동'은 숫자와 글자 사이를 띄운다.
  s = s
    .replace(/(\d)\s*[-./]\s*(?=\d)/g, '$1 ')
    .replace(/(\d)\s*[.)]/g, '$1 ')
    .replace(/(\d)(?=[^\d\s,])/g, '$1 ')
    .replace(/([^\d\s,])(?=\d)/g, '$1 ')

  const tokens = s.split(/[\s,]+/).filter(Boolean)
  const numbers: string[] = []
  const nameParts: string[] = []
  let gender: 'M' | 'F' | null = null
  let sawName = false
  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      // 이름 뒤에 오는 1/2는 나이스식 성별 코드로 본다 (예: '1 3 12 홍길동 2').
      if (sawName && gender === null && (t === '1' || t === '2') && numbers.length > 0) {
        gender = parseGender(t)
      } else {
        numbers.push(t)
      }
    } else if (GENDER_WORD.test(t) && sawName) {
      gender = parseGender(t)
    } else if (/^[-.()·,]+$/.test(t)) {
      continue
    } else {
      nameParts.push(t)
      sawName = true
    }
  }
  row.name = nameParts.join(' ')
  row.gender = gender

  // ③ 숫자 개수로 뜻을 정한다.
  const nums = numbers.map(Number)
  if (numbers.length === 1 && numbers[0].length === 5 && labeled.grade === undefined) {
    applyStudentCode(row, numbers[0]) // 10312 → 1학년 3반 12번
  } else if (numbers.length === 3) {
    ;[row.grade, row.classNo, row.number] = nums
  } else if (numbers.length === 2) {
    ;[row.classNo, row.number] = nums // '3 12 홍길동' → 3반 12번
  } else if (numbers.length === 1) {
    if (numbers[0].length > 2) row.problems.push(`번호를 알 수 없어요: "${numbers[0]}"`)
    else row.number = nums[0]
  } else if (numbers.length === 0) {
    if (labeled.number === undefined) row.number = order // 이름만 → 줄 순서대로 번호
  } else {
    row.problems.push(`숫자가 너무 많아서 알아보지 못했어요`)
  }

  if (labeled.grade !== undefined) row.grade = labeled.grade
  if (labeled.classNo !== undefined) row.classNo = labeled.classNo
  if (labeled.number !== undefined) row.number = labeled.number

  // ④ 줄에 없는 학년·반은 화면에서 먼저 고른 값으로 채운다.
  row.grade ??= ctx.grade
  row.classNo ??= ctx.classNo
  if ((row.grade === null || row.classNo === null) && row.problems.length === 0) {
    row.problems.push(`${NEED_CLASS} 주세요 (이 줄에는 학년·반이 없어요)`)
  }
  return row
}
