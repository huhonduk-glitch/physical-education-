// 엑셀·붙여넣기 글자를 다룰 때 공통으로 쓰는 작은 도구들 (순수 함수)

/** 셀 값을 글자로. 맥에서 만든 파일의 한글(자모 분리)도 합쳐서 비교가 되도록 NFC로 맞춘다. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .trim()
}

/** 헤더 비교용: 공백을 모두 없앤다. '학생 성명' = '학생성명' */
export function normalizeHeader(v: unknown): string {
  return cellText(v).replace(/\s+/g, '')
}

/** 헤더에서 괄호 안 설명을 뺀 핵심 이름. '성별(남:1 여:2)' → '성별' */
export function headerBase(v: unknown): string {
  return normalizeHeader(v).replace(/[(（[][^)）\]]*[)）\]]/g, '')
}

/**
 * '1', '01', '1학년', '3반', '12번' 같은 글자에서 정수 하나를 꺼낸다.
 * 숫자가 없거나 숫자가 두 덩어리 이상이면 null.
 */
export function parseIntLoose(v: unknown): number | null {
  const s = cellText(v)
  if (s === '') return null
  const m = s.match(/^0*(\d+)\s*(학년|반|번)?$/)
  if (!m) return null
  const n = Number(m[1] === '' ? '0' : m[1])
  return Number.isSafeInteger(n) ? n : null
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function makeStudentCode(grade: number, classNo: number, number: number): string {
  return `${grade}${pad2(classNo)}${pad2(number)}`
}

/** 학번 5자리(학년 1 + 반 2 + 번호 2)를 나눈다. 형식이 다르면 null. */
export function splitStudentCode(code: string): { grade: number; classNo: number; number: number } | null {
  const m = cellText(code).match(/^(\d)(\d{2})(\d{2})$/)
  if (!m) return null
  const grade = Number(m[1])
  const classNo = Number(m[2])
  const number = Number(m[3])
  if (grade < 1 || classNo < 1 || number < 1) return null
  return { grade, classNo, number }
}

/** 성별 글자 → 'M' | 'F'. 나이스는 남 1, 여 2. 모르면 null. */
export function parseGender(v: unknown): 'M' | 'F' | null {
  const s = cellText(v).toUpperCase()
  if (['1', '남', '남자', '남성', 'M', 'MALE'].includes(s)) return 'M'
  if (['2', '여', '여자', '여성', 'F', 'FEMALE'].includes(s)) return 'F'
  return null
}

export function genderLabel(g: 'M' | 'F' | null | undefined): string {
  return g === 'M' ? '남' : g === 'F' ? '여' : ''
}
