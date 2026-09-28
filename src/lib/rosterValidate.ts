import type { Gender, SchoolGenderType, Student } from '../db/types'
import type { RosterRow } from './rosterGrid'
import { normalizeClassCode } from './neisCommonColumns'
import { makeStudentCode, pad2 } from './text'

/**
 * 미리보기 표의 빨간색(오류)·노란색(참고) 판정 (CLAUDE.md 4-1-C). 순수 함수.
 * 오류가 하나라도 있으면 저장할 수 없다.
 */

export type IssueField = 'row' | 'schoolYear' | 'grade' | 'classNo' | 'number' | 'name' | 'gender'

export interface Issue {
  field: IssueField
  message: string
  level: 'error' | 'warn'
}

export interface ValidationContext {
  schoolYear: number
  schoolGenderType: SchoolGenderType
}

export interface ValidatedRow {
  row: RosterRow
  issues: Issue[]
  /** 학교 설정으로 채운 성별 (성별 칸이 비었을 때) */
  effectiveGender: Gender | null
}

export function defaultGenderFor(type: SchoolGenderType): Gender | null {
  return type === '남' ? 'M' : type === '여' ? 'F' : null
}

export function validateRoster(rows: readonly RosterRow[], ctx: ValidationContext): ValidatedRow[] {
  const keyCount = new Map<string, number>()
  for (const r of rows) {
    if (r.grade !== null && r.classNo !== null && r.number !== null) {
      const k = `${r.grade}-${r.classNo}-${r.number}`
      keyCount.set(k, (keyCount.get(k) ?? 0) + 1)
    }
  }

  return rows.map((row) => {
    const issues: Issue[] = []
    const err = (field: IssueField, message: string) => issues.push({ field, message, level: 'error' })
    const warn = (field: IssueField, message: string) => issues.push({ field, message, level: 'warn' })

    for (const p of row.problems) err('row', p)

    if (row.schoolYear !== null && row.schoolYear !== ctx.schoolYear) {
      err('schoolYear', `학년도가 달라요 (파일 ${row.schoolYear} / 설정 ${ctx.schoolYear})`)
    }
    if (row.grade === null) err('grade', '학년이 없어요')
    else if (row.grade < 1 || row.grade > 6) err('grade', `학년이 이상해요: ${row.grade}`)
    if (row.classNo === null) err('classNo', '반이 없어요')
    else if (row.classNo < 1 || row.classNo > 99) err('classNo', `반이 이상해요: ${row.classNo}`)
    if (row.number === null) err('number', '번호가 없어요')
    else if (row.number < 1 || row.number > 99) err('number', `번호가 이상해요: ${row.number}`)
    if (row.name.trim() === '') err('name', '이름이 없어요')

    if (row.grade !== null && row.classNo !== null && row.number !== null) {
      if ((keyCount.get(`${row.grade}-${row.classNo}-${row.number}`) ?? 0) > 1) {
        err('number', `${row.grade}학년 ${row.classNo}반 ${row.number}번이 겹쳐요`)
      }
    }

    let effectiveGender = row.gender
    if (effectiveGender === null) {
      effectiveGender = defaultGenderFor(ctx.schoolGenderType)
      if (effectiveGender === null) err('gender', '성별을 골라 주세요 (공학)')
      else warn('gender', `학교 설정대로 '${effectiveGender === 'M' ? '남' : '여'}'로 넣어요`)
    }

    return { row, issues, effectiveGender }
  })
}

export function hasErrors(v: readonly ValidatedRow[]): boolean {
  return v.some((r) => r.issues.some((i) => i.level === 'error'))
}

export type NewStudent = Omit<Student, 'id'>

/** 오류 없는 줄을 저장할 학생 모양으로. 오류가 있는 줄이면 null. */
export function toNewStudent(v: ValidatedRow, schoolYear: number): NewStudent | null {
  if (v.issues.some((i) => i.level === 'error')) return null
  const r = v.row
  if (r.grade === null || r.classNo === null || r.number === null || !v.effectiveGender) return null
  return {
    schoolYear,
    grade: r.grade,
    classNo: r.classNo,
    classCode: r.classCode ? normalizeClassCode(r.classCode) : pad2(r.classNo),
    number: r.number,
    name: r.name.trim(),
    gender: v.effectiveGender,
    studentCode: makeStudentCode(r.grade, r.classNo, r.number),
    // 명렬표에 값이 있을 때만 저장한다. 비어 있으면 내보낼 때 설정 기본값을 쓴다.
    course: r.course || undefined,
    track: r.track || undefined,
    dept: r.dept || undefined,
    status: '재학',
    memo: '',
  }
}
