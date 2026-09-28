import { describe, expect, it } from 'vitest'
import { cellText, headerBase, makeStudentCode, parseGender, parseIntLoose, splitStudentCode } from '../src/lib/text'

describe('글자 도구', () => {
  it('맥에서 만든 한글(자모 분리)도 같은 글자로 본다', () => {
    expect(cellText('학생성명'.normalize('NFD'))).toBe('학생성명')
  })
  it('괄호 설명을 뺀 헤더', () => {
    expect(headerBase('성별(남:1 여:2)')).toBe('성별')
    expect(headerBase(' 성 명 ')).toBe('성명')
  })
  it('정수 읽기', () => {
    expect(['1', '01', '1학년', '3 반', '12번'].map(parseIntLoose)).toEqual([1, 1, 1, 3, 12])
    expect(['', '1-2', 'a', '1.5'].map(parseIntLoose)).toEqual([null, null, null, null])
  })
  it('학번 만들기·나누기', () => {
    expect(makeStudentCode(1, 3, 12)).toBe('10312')
    expect(splitStudentCode('10312')).toEqual({ grade: 1, classNo: 3, number: 12 })
    expect(splitStudentCode('1031')).toBeNull()
    expect(splitStudentCode('10300')).toBeNull()
  })
  it('성별: 나이스 1=남, 2=여', () => {
    expect(['1', '남', 'M', '2', '여', 'f', '3', ''].map(parseGender)).toEqual(['M', 'M', 'M', 'F', 'F', 'F', null, null])
  })
})
