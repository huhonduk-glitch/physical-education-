import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readRosterFile, RosterFileError, decodeText } from '../src/lib/rosterFile'
import { parseRosterGrid } from '../src/lib/rosterGrid'
import { validateRoster, toNewStudent } from '../src/lib/rosterValidate'

// 교사가 준비한 실제 나이스 명렬 샘플 (가명). 이 파일 외에 가짜 나이스 파일은 만들지 않는다.
const SAMPLE = fileURLToPath(new URL('../references/neis-roster-sample.xlsx.xlsx', import.meta.url))

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('실제 나이스 명렬 샘플 (references/neis-roster-sample.xlsx.xlsx)', () => {
  it('헤더를 찾고 학생 1명을 읽는다', async () => {
    const r = await readRosterFile(toArrayBuffer(readFileSync(SAMPLE)), 'neis-roster-sample.xlsx.xlsx')
    expect(r.header?.rowIndex).toBe(0)
    expect(r.rows).toHaveLength(1)
    const row = r.rows[0]
    expect(row).toMatchObject({
      schoolYear: 2026,
      course: '주간',
      track: '일반계',
      grade: 1,
      dept: '일반학과',
      classNo: 1,
      classCode: '01', // 앞의 0이 살아 있어야 한다
      number: 1,
      name: '강다라',
      gender: 'F', // 성별 2 → 여
      problems: [],
    })
  })

  it('생년월일은 읽은 결과 어디에도 남지 않는다', async () => {
    const r = await readRosterFile(toArrayBuffer(readFileSync(SAMPLE)), 'neis-roster-sample.xlsx.xlsx')
    expect(JSON.stringify(r.rows)).not.toContain('20550829')
    expect(r.header?.columns.birth).toBe(10) // 칸은 알아보되 값은 버린다
  })

  it('확인 단계를 통과해 저장할 학생 모양이 된다', async () => {
    const r = await readRosterFile(toArrayBuffer(readFileSync(SAMPLE)), 'x.xlsx')
    const v = validateRoster(r.rows, { schoolYear: 2026, schoolGenderType: '공학' })
    expect(v[0].issues).toEqual([])
    const s = toNewStudent(v[0], 2026)
    expect(s).toEqual({
      schoolYear: 2026,
      grade: 1,
      classNo: 1,
      classCode: '01',
      number: 1,
      name: '강다라',
      gender: 'F',
      studentCode: '10101',
      course: '주간',
      track: '일반계',
      dept: '일반학과',
      status: '재학',
      memo: '',
    })
    expect(JSON.stringify(s)).not.toContain('2055')
  })
})

describe('다른 형식의 표 — 헤더 자동 찾기', () => {
  it('위쪽에 제목·빈 줄이 있어도 헤더를 찾는다', () => {
    const grid = [
      ['2026학년도 1학년 3반 명렬표'],
      [],
      ['', '담임: ○○○'],
      ['번호', '성 명', '성별'],
      ['1', '가나다', '여'],
      ['2', '라마바', '남'],
    ]
    const r = parseRosterGrid(grid)
    expect(r.header?.rowIndex).toBe(3)
    expect(r.rows.map((x) => [x.number, x.name, x.gender, x.source])).toEqual([
      [1, '가나다', 'F', '5행'],
      [2, '라마바', 'M', '6행'],
    ])
  })

  it('학번 열만 있으면 학년·반·번호로 나눈다', () => {
    const r = parseRosterGrid([
      ['학번', '이름'],
      ['10312', '홍길동'],
      ['21105', '김철수'],
    ])
    expect(r.rows.map((x) => [x.grade, x.classNo, x.number, x.name])).toEqual([
      [1, 3, 12, '홍길동'],
      [2, 11, 5, '김철수'],
    ])
  })

  it('학번과 학년·반·번호가 다르면 문제로 표시한다', () => {
    const r = parseRosterGrid([
      ['학년', '반', '번호', '학번', '이름'],
      ['1', '3', '12', '10313', '홍길동'],
    ])
    expect(r.rows[0].problems[0]).toContain('서로 달라요')
  })

  it("'1학년', '3반' 같은 글자도 숫자로 읽는다", () => {
    const r = parseRosterGrid([
      ['학년', '반', '번호', '이름'],
      ['1학년', '3반', '12번', '홍길동'],
    ])
    expect(r.rows[0]).toMatchObject({ grade: 1, classNo: 3, number: 12, problems: [] })
  })

  it('숫자가 아닌 번호는 문제로 표시한다', () => {
    const r = parseRosterGrid([
      ['번호', '이름'],
      ['열둘', '홍길동'],
    ])
    expect(r.rows[0].problems[0]).toContain('번호')
  })

  it('빈 줄은 건너뛴다', () => {
    const r = parseRosterGrid([['번호', '이름'], ['1', 'ㄱ'], ['', ''], ['2', 'ㄴ']])
    expect(r.rows).toHaveLength(2)
  })

  it('헤더가 없으면 header가 null', () => {
    expect(parseRosterGrid([['1', '홍길동']]).header).toBeNull()
  })

  it('반코드가 숫자 1로 바뀌어 있으면 01로 되돌린다', () => {
    const r = parseRosterGrid([
      ['학년', '반명', '반코드', '번호', '학생성명'],
      ['1', '1', '1', '1', '홍길동'],
    ])
    expect(r.rows[0].classCode).toBe('01')
  })
})

describe('파일 종류', () => {
  it('CSV(UTF-8, BOM 포함)에서 반코드 01을 지킨다', async () => {
    const csv = '﻿학년,반명,반코드,번호,학생성명,성별(남:1 여:2)\n1,3,03,12,홍길동,1\n'
    const buf = new TextEncoder().encode(csv)
    const r = await readRosterFile(buf.buffer as ArrayBuffer, 'a.csv')
    expect(r.rows[0]).toMatchObject({ grade: 1, classNo: 3, classCode: '03', number: 12, name: '홍길동', gender: 'M' })
  })

  it('EUC-KR로 저장된 CSV도 읽는다', () => {
    // '가' (EUC-KR B0A1) — UTF-8로는 깨지는 바이트
    const bytes = new Uint8Array([0xb0, 0xa1])
    expect(decodeText(bytes.buffer)).toBe('가')
  })

  it('xls(옛 엑셀) 형식도 읽는다', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['번호', '이름'], ['1', '가나다']]), 'Sheet1')
    const out = XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as ArrayBuffer
    const r = await readRosterFile(out, 'a.xls')
    expect(r.rows[0]).toMatchObject({ number: 1, name: '가나다' })
  })

  it('헤더가 없는 파일은 알기 쉬운 오류', async () => {
    const buf = new TextEncoder().encode('1,홍길동\n')
    await expect(readRosterFile(buf.buffer as ArrayBuffer, 'a.csv')).rejects.toBeInstanceOf(RosterFileError)
  })

  it('엑셀이 아닌 파일은 알기 쉬운 오류', async () => {
    const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])
    await expect(readRosterFile(buf.buffer, 'a.xlsx')).rejects.toBeInstanceOf(RosterFileError)
  })
})
