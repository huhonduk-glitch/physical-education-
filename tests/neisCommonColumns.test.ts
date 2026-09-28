import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  NEIS_COMMON_HEADERS,
  matchNeisCommonHeader,
  readNeisCommon,
  writeNeisCommon,
} from '../src/lib/neisCommonColumns'

const refs = (name: string) => fileURLToPath(new URL(`../references/${name}`, import.meta.url))

function headerRow(file: string): string[] {
  const wb = XLSX.read(readFileSync(refs(file)), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false })
  return rows[0].map(String)
}

describe('나이스 공통 9열', () => {
  it('명렬 샘플과 PAPS 양식 둘 다 앞 9열이 공통 열과 똑같다', () => {
    expect(headerRow('neis-roster-sample.xlsx.xlsx').slice(0, 9)).toEqual(NEIS_COMMON_HEADERS)
    expect(headerRow('neis-paps-template.xlsx.xlsx').slice(0, 9)).toEqual(NEIS_COMMON_HEADERS)
  })

  it('공백 차이를 무시하고 알아본다', () => {
    expect(matchNeisCommonHeader(' 학생 성명 ')).toBe('name')
    expect(matchNeisCommonHeader('반 코드')).toBe('classCode')
    expect(matchNeisCommonHeader('성별')).toBeNull()
  })

  it('읽기 → 쓰기를 하면 같은 글자가 나온다 (반코드 01 유지)', () => {
    const cells = ['2026', '주간', '일반계', '1', '일반학과', '1', '01', '1', '가나다']
    const cols = { schoolYear: 0, course: 1, track: 2, grade: 3, dept: 4, className: 5, classCode: 6, number: 7, name: 8 }
    const v = readNeisCommon(cells, cols)
    expect(v).toEqual({
      schoolYear: 2026, course: '주간', track: '일반계', grade: 1, dept: '일반학과',
      classNo: 1, classCode: '01', number: 1, name: '가나다',
    })
    const out = writeNeisCommon(
      { schoolYear: 2026, grade: 1, classNo: 1, classCode: v.classCode, number: 1, name: v.name, course: v.course, track: v.track, dept: v.dept },
      { course: 'X', track: 'X', dept: 'X' },
    )
    expect(out).toEqual(cells)
  })

  it('과정·계열·학과·반코드가 비었을 때만 기본값을 쓴다', () => {
    const out = writeNeisCommon(
      { schoolYear: 2026, grade: 2, classNo: 7, number: 3, name: '가' },
      { course: '주간', track: '일반계', dept: '일반학과' },
    )
    expect(out).toEqual(['2026', '주간', '일반계', '2', '일반학과', '7', '07', '3', '가'])
  })
})
