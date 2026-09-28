import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import ranges from '../src/data/neis-valid-ranges.json'
import { parseNeisHeader, parseNeisHeaders, splitHeaderLine } from '../src/lib/neisHeaderParser'
import { buildRows, checkValue, exceedsDecimals, rowsToXlsx, validateExport, type Ranges, type Values } from '../src/lib/neisExport'
import { DEFAULT_STANDARDS } from '../src/lib/paps'
import { cellId, cellsOf, cellsForKey, selectedFromColumns, standardHeaders } from '../src/lib/papsLayout'
import { parsePapsPaste } from '../src/lib/papsPasteParser'

const R = (ranges as { ranges: Ranges }).ranges
const TEMPLATE = fileURLToPath(new URL('../references/neis-paps-template.xlsx.xlsx', import.meta.url))

function readSheet(buf: ArrayBuffer | Buffer): string[][] {
  const wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? 'array' : 'buffer' })
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' })
}

describe('나이스 헤더 파서', () => {
  it('실제 양식(references) 헤더를 전부 알아본다', () => {
    const [header] = readSheet(readFileSync(TEMPLATE))
    const cols = parseNeisHeaders(header)
    expect(cols.filter((c) => c.kind === 'unknown')).toEqual([])
    expect(cols.filter((c) => c.kind === 'common')).toHaveLength(9)
    expect(cellsOf(cols)).toEqual([
      { key: 'shuttleRun', attempt: null, side: null },
      { key: 'sitAndReach', attempt: 1, side: null },
      { key: 'sitAndReach', attempt: 2, side: null },
      { key: 'gripStrength', attempt: 1, side: 'R' },
      { key: 'gripStrength', attempt: 1, side: 'L' },
      { key: 'gripStrength', attempt: 2, side: 'R' },
      { key: 'gripStrength', attempt: 2, side: 'L' },
      { key: 'standingLongJump', attempt: 1, side: null },
      { key: 'standingLongJump', attempt: 2, side: null },
      { key: 'height', attempt: null, side: null },
      { key: 'weight', attempt: null, side: null },
    ])
  })

  it('변형 ① 공백·괄호 위치가 달라도 같다', () => {
    expect(parseNeisHeader('앉아윗몸앞으로굽히기 1차 (cm)')).toMatchObject({ kind: 'measure', key: 'sitAndReach', attempt: 1, unit: 'cm' })
    expect(parseNeisHeader('악력 (kg) 2차 왼쪽')).toMatchObject({ key: 'gripStrength', attempt: 2, side: 'L' })
    expect(parseNeisHeader(' 학생 성명 ')).toMatchObject({ kind: 'common', field: 'name' })
  })

  it('변형 ② 다른 종목 이름들', () => {
    expect(parseNeisHeader('(무릎대고)팔굽혀펴기(회)')).toMatchObject({ key: 'pushUp', unit: '회' })
    expect(parseNeisHeader('무릎대고 팔굽혀펴기(회)')).toMatchObject({ key: 'pushUp' })
    expect(parseNeisHeader('오래달리기-걷기(초)')).toMatchObject({ key: 'longRunWalk' })
    expect(parseNeisHeader('50m달리기(초)')).toMatchObject({ key: 'sprint50m' })
    expect(parseNeisHeader('스텝검사 심박수1')).toMatchObject({ key: 'heartRate', attempt: 1 })
    expect(parseNeisHeader('종합유연성(점)')).toMatchObject({ key: 'totalFlexibility' })
    expect(parseNeisHeader('윗몸말아올리기(회)')).toMatchObject({ key: 'curlUp' })
    expect(parseNeisHeader('체지방률(%)')).toMatchObject({ key: 'bodyFat' })
  })

  it('변형 ③ 모르는 열은 멈추지 않고 unknown으로 남긴다', () => {
    expect(parseNeisHeader('비고')).toEqual({ kind: 'unknown', header: '비고' })
  })

  it('헤더 한 줄 붙여넣기', () => {
    expect(splitHeaderLine('학년도\t과정명\t왕복오래달리기(회)\n2026\t주간')).toEqual(['학년도', '과정명', '왕복오래달리기(회)'])
  })

  it('양식으로 반별 종목 자동 설정', () => {
    const [header] = readSheet(readFileSync(TEMPLATE))
    expect(selectedFromColumns(parseNeisHeaders(header), DEFAULT_STANDARDS.events)).toEqual({
      심폐지구력: 'shuttleRun',
      유연성: 'sitAndReach',
      '근력·근지구력': 'gripStrength',
      순발력: 'standingLongJump',
    })
  })

  it('양식 없을 때 표준 헤더를 만들면 다시 읽어도 같은 종목', () => {
    const sel = { 심폐지구력: 'shuttleRun', 유연성: 'sitAndReach', '근력·근지구력': 'gripStrength', 순발력: 'standingLongJump' } as const
    const h = standardHeaders(sel)
    expect(parseNeisHeaders(h).filter((c) => c.kind === 'unknown')).toEqual([])
    expect(selectedFromColumns(parseNeisHeaders(h), DEFAULT_STANDARDS.events)).toEqual(sel)
  })
})

describe('나이스 내보내기', () => {
  const [header, sample] = readSheet(readFileSync(TEMPLATE))
  const cols = parseNeisHeaders(header)
  const cells = cellsOf(cols)
  const student = { id: 's1', schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: 1, name: sample[8], course: '주간', track: '일반계', dept: '일반학과' }
  const values: Values = new Map([['s1', new Map(cells.map((c, k) => [cellId(c), Number(sample[9 + k])]))]])
  const defaults = { course: '주간', track: '일반계', dept: '일반학과' }

  it('예시 헤더로 파싱 → 내보내기 → 다시 읽기: 헤더와 값이 완전히 같다', async () => {
    const v = validateExport(cols, [student], values, new Set(), R)
    expect(v.issues).toEqual([])
    const rows = buildRows(cols, v.included, values, defaults, R)
    expect(rows).toEqual([header, sample])
    const back = readSheet(await rowsToXlsx(rows))
    expect(back).toEqual([header, sample])
  })

  it('반코드 01이 파일에서도 텍스트로 남는다', async () => {
    const wb = XLSX.read(await rowsToXlsx(buildRows(cols, [student], values, defaults, R)), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    expect(ws['G2'].v).toBe('01')
    expect(ws['G2'].t).toBe('s')
  })

  it('헤더 순서가 바뀌어도 값이 맞는 칸에 들어간다', () => {
    const shuffled = [header[8], header[7], ...header.slice(0, 7), header[12], header[9]]
    const c2 = parseNeisHeaders(shuffled)
    const rows = buildRows(c2, [student], values, defaults, R)
    expect(rows[1]).toEqual([sample[8], sample[7], ...sample.slice(0, 7), sample[12], sample[9]])
  })

  it('누락·범위 초과·자릿수 초과가 있으면 문제 목록 (파일 만들지 않음)', () => {
    const bad: Values = new Map([['s1', new Map(values.get('s1'))]])
    bad.get('s1')!.delete(cellId(cellsForKey(cells, 'gripStrength')[3])) // 악력 2차 왼쪽 누락
    bad.get('s1')!.set(cellId(cells[0]), 151) // 왕복 범위 초과
    bad.get('s1')!.set(cellId(cells[1]), 6.123) // 앉아윗몸 자릿수 초과
    const v = validateExport(cols, [student], bad, new Set(), R)
    expect(v.issues.map((i) => [i.kind, i.label])).toEqual([
      ['range', '왕복오래달리기'],
      ['decimals', '앉아윗몸앞으로굽히기 1차'],
      ['missing', '악력 2차 왼쪽'],
    ])
  })

  it('측정 제외 학생은 빈칸이 아니라 파일에서 빠진다', () => {
    const v = validateExport(cols, [student], new Map(), new Set(['s1']), R)
    expect(v.issues).toEqual([])
    expect(v.included).toEqual([])
    expect(v.excluded).toHaveLength(1)
  })

  it('부동소수점 오차가 파일에 들어가지 않는다', () => {
    const v: Values = new Map([['s1', new Map(values.get('s1'))]])
    v.get('s1')!.set(cellId(cells[3]), 32.900000001)
    expect(buildRows(cols, [student], v, defaults, R)[1][12]).toBe('32.9')
  })

  it('값 하나 검사', () => {
    expect(checkValue(-2.5, R.sitAndReach)).toBeNull()
    expect(checkValue(-41, R.sitAndReach)).toBe('range')
    expect(checkValue(34.5, R.shuttleRun)).toBe('decimals')
    expect(exceedsDecimals(32.9, 2)).toBe(false)
    expect(exceedsDecimals(32.901, 2)).toBe(true)
    expect(checkValue(170, R.height)).toBeNull() // 범위 근거 없음 → 검사 안 함
  })
})

describe('PAPS 붙여넣기 파서 (CLAUDE.md 4-5 모든 모양)', () => {
  const students = [
    { id: 'a', number: 1, name: '강가나', studentCode: '10101' },
    { id: 'b', number: 2, name: '나다라', studentCode: '10102' },
    { id: 'c', number: 3, name: '동명', studentCode: '10103' },
    { id: 'd', number: 4, name: '동명', studentCode: '10104' },
  ]
  const single = [{ key: 'shuttleRun' as const, attempt: null, side: null }]
  const two = [
    { key: 'sprint50m' as const, attempt: 1, side: null },
    { key: 'sprint50m' as const, attempt: 2, side: null },
  ]
  const grip = [
    { key: 'gripStrength' as const, attempt: 1, side: 'R' as const },
    { key: 'gripStrength' as const, attempt: 1, side: 'L' as const },
    { key: 'gripStrength' as const, attempt: 2, side: 'R' as const },
    { key: 'gripStrength' as const, attempt: 2, side: 'L' as const },
  ]
  const one = (text: string, cells = single) => parsePapsPaste(text, { students, cells }).rows[0]

  it('1\\t34 (번호, 값)', () => {
    expect(one('1\t34')).toMatchObject({ studentId: 'a', values: { 'shuttleRun||': 34 }, errors: [] })
  })
  it('1 강가나 34 (번호, 이름, 값)', () => {
    expect(one('1 강가나 34')).toMatchObject({ studentId: 'a', values: { 'shuttleRun||': 34 }, errors: [] })
  })
  it('강가나 34 (이름, 값)', () => {
    expect(one('나다라 40')).toMatchObject({ studentId: 'b', values: { 'shuttleRun||': 40 } })
  })
  it('10101 34 (학번, 값)', () => {
    expect(one('10102 50')).toMatchObject({ studentId: 'b', values: { 'shuttleRun||': 50 } })
  })
  it('1\\t6.5\\t7.25 (번호, 1차, 2차)', () => {
    expect(one('1\t6.5\t7.25', two).values).toEqual({ 'sprint50m|1|': 6.5, 'sprint50m|2|': 7.25 })
  })
  it('악력: 번호, 1차 오른쪽, 1차 왼쪽, 2차 오른쪽, 2차 왼쪽 (나이스 순서)', () => {
    expect(one('1\t32.9\t27.6\t32\t27', grip).values).toEqual({ 'gripStrength|1|R': 32.9, 'gripStrength|1|L': 27.6, 'gripStrength|2|R': 32, 'gripStrength|2|L': 27 })
  })
  it('34 (값만 한 줄씩 → 번호순, 반드시 경고)', () => {
    const r = parsePapsPaste('34\n40\n28', { students, cells: single })
    expect(r.sequential).toBe(true)
    expect(r.rows.map((x) => x.studentId)).toEqual(['a', 'b', 'c'])
    expect(r.rows.every((x) => x.warnings.length > 0)).toBe(true)
  })
  it('쉼표 구분, 음수, 소수', () => {
    const sit = [{ key: 'sitAndReach' as const, attempt: 1, side: null }, { key: 'sitAndReach' as const, attempt: 2, side: null }]
    expect(one('2, -3.5, -2', sit).values).toEqual({ 'sitAndReach|1|': -3.5, 'sitAndReach|2|': -2 })
  })
  it('이름과 번호가 다르면 오류', () => {
    expect(one('1 나다라 34').errors[0]).toContain('1번은 강가나')
  })
  it('동명이인은 오류 (번호로 고르게)', () => {
    expect(one('동명 34').errors[0]).toContain('2명')
  })
  it('없는 번호, 칸보다 많은 값은 오류', () => {
    expect(one('9 34').errors[0]).toContain('없어요')
    expect(one('1 34 35').errors[0]).toContain('칸은 1개')
  })
  it('헤더가 있는 표 (나이스 양식 전체 붙여넣기, 열 순서·일부 종목만 달라도)', () => {
    const text = ['번호\t학생성명\t악력(kg) 1차 오른쪽\t왕복오래달리기(회)', '1\t강가나\t32.9\t34', '2\t나다라\t\t41'].join('\n')
    const r = parsePapsPaste(text, { students, cells: null })
    expect(r.mode).toBe('table')
    expect(r.rows[0]).toMatchObject({ studentId: 'a', values: { 'gripStrength|1|R': 32.9, 'shuttleRun||': 34 }, errors: [] })
    expect(r.rows[1].values).toEqual({ 'shuttleRun||': 41 })
  })
  it('같은 학생이 두 번 나오면 오류', () => {
    const r = parsePapsPaste('1 34\n1 35', { students, cells: single })
    expect(r.rows.every((x) => x.errors.some((e) => e.includes('두 번')))).toBe(true)
  })
})
