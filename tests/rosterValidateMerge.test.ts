import { describe, expect, it } from 'vitest'
import type { Student } from '../src/db/types'
import { emptyRow, type RosterRow } from '../src/lib/rosterGrid'
import { planRosterSave } from '../src/lib/rosterMerge'
import { hasErrors, toNewStudent, validateRoster, type NewStudent } from '../src/lib/rosterValidate'

function row(p: Partial<RosterRow>, i = 0): RosterRow {
  return { ...emptyRow(`k${i}`, `${i + 1}번째 줄`), ...p }
}
const ctx = { schoolYear: 2026, schoolGenderType: '공학' as const }
const errs = (v: ReturnType<typeof validateRoster>[number]) =>
  v.issues.filter((i) => i.level === 'error').map((i) => i.field)

describe('확인 단계 (빨간색 판정)', () => {
  it('정상 줄은 문제 없음', () => {
    const v = validateRoster([row({ grade: 1, classNo: 3, number: 12, name: '홍길동', gender: 'M' })], ctx)
    expect(v[0].issues).toEqual([])
    expect(hasErrors(v)).toBe(false)
  })

  it('이름 누락', () => {
    const v = validateRoster([row({ grade: 1, classNo: 3, number: 12, name: '  ', gender: 'M' })], ctx)
    expect(errs(v[0])).toEqual(['name'])
  })

  it('번호 중복은 두 줄 모두 빨간색', () => {
    const v = validateRoster(
      [
        row({ grade: 1, classNo: 3, number: 12, name: '가', gender: 'M' }, 0),
        row({ grade: 1, classNo: 3, number: 12, name: '나', gender: 'M' }, 1),
        row({ grade: 1, classNo: 3, number: 13, name: '다', gender: 'M' }, 2),
      ],
      ctx,
    )
    expect(v.map(errs)).toEqual([['number'], ['number'], []])
  })

  it('인식 실패(문제 메모)가 있으면 빨간색', () => {
    const v = validateRoster([row({ grade: 1, classNo: 3, number: 1, name: '가', gender: 'M', problems: ['x'] })], ctx)
    expect(errs(v[0])).toEqual(['row'])
  })

  it('학년·반·번호가 없으면 각각 빨간색', () => {
    const v = validateRoster([row({ name: '가', gender: 'F' })], ctx)
    expect(errs(v[0])).toEqual(['grade', 'classNo', 'number'])
  })

  it('학년도가 설정과 다르면 빨간색', () => {
    const v = validateRoster([row({ schoolYear: 2025, grade: 1, classNo: 1, number: 1, name: '가', gender: 'F' })], ctx)
    expect(errs(v[0])).toEqual(['schoolYear'])
  })

  it('성별이 없을 때: 공학은 입력 요구, 여고는 전부 여, 남고는 전부 남', () => {
    const r = row({ grade: 1, classNo: 1, number: 1, name: '가' })
    expect(errs(validateRoster([r], ctx)[0])).toEqual(['gender'])
    const girls = validateRoster([r], { ...ctx, schoolGenderType: '여' })[0]
    expect(girls.effectiveGender).toBe('F')
    expect(girls.issues.map((i) => i.level)).toEqual(['warn'])
    expect(validateRoster([r], { ...ctx, schoolGenderType: '남' })[0].effectiveGender).toBe('M')
  })

  it('저장 모양: 학번 자동 생성, 반코드 2자리', () => {
    const v = validateRoster([row({ grade: 1, classNo: 3, number: 12, name: ' 홍길동 ', gender: 'M' })], ctx)
    expect(toNewStudent(v[0], 2026)).toMatchObject({ studentCode: '10312', classCode: '03', name: '홍길동', status: '재학' })
  })

  it('오류가 있는 줄은 저장 모양으로 바꾸지 않는다', () => {
    const v = validateRoster([row({ grade: 1, classNo: 3, number: 12, name: '' , gender: 'M'})], ctx)
    expect(toNewStudent(v[0], 2026)).toBeNull()
  })
})

let seq = 0
function student(p: Partial<Student>): Student {
  const grade = p.grade ?? 1
  const classNo = p.classNo ?? 3
  const number = p.number ?? 1
  return {
    id: `s${++seq}`,
    schoolYear: 2026,
    grade,
    classNo,
    classCode: '03',
    number,
    name: '이름',
    gender: 'M',
    studentCode: `${grade}${String(classNo).padStart(2, '0')}${String(number).padStart(2, '0')}`,
    status: '재학',
    memo: '',
    ...p,
  }
}
function incoming(p: Partial<NewStudent>): NewStudent {
  const { id: _id, ...rest } = student(p)
  return rest
}

describe('저장 계획 — 병합', () => {
  it('새 학생만 추가하고 기존은 유지', () => {
    const a = student({ number: 1, name: '가' })
    const plan = planRosterSave([a], [incoming({ number: 1, name: '가' }), incoming({ number: 2, name: '나' })], 'merge')
    expect(plan.add.map((s) => s.name)).toEqual(['나'])
    expect(plan.unchanged).toEqual([a])
    expect(plan.update).toEqual([])
  })

  it('같은 자리에 이름이 다르면 따로 모은다 (확인 후 반영)', () => {
    const a = student({ number: 1, name: '가' })
    const plan = planRosterSave([a], [incoming({ number: 1, name: '가나' })], 'merge')
    expect(plan.nameConflicts).toHaveLength(1)
    expect(plan.nameConflicts[0].student).toBe(a)
    expect(plan.add).toEqual([])
  })

  it('비어 있던 과정·계열·학과만 채운다 (있는 값은 안 바꿈)', () => {
    const a = student({ number: 1, name: '가', course: '주간', track: undefined })
    const plan = planRosterSave([a], [incoming({ number: 1, name: '가', course: '야간', track: '일반계' })], 'merge')
    expect(plan.update[0].changes).toEqual({ track: '일반계' })
  })

  it('전출생 자리에는 새 학생이 그냥 추가된다', () => {
    const a = student({ number: 1, name: '가', status: '전출' })
    const plan = planRosterSave([a], [incoming({ number: 1, name: '나' })], 'merge')
    expect(plan.add.map((s) => s.name)).toEqual(['나'])
    expect(plan.nameConflicts).toEqual([])
  })

  it('병합은 빠진 학생을 건드리지 않는다', () => {
    const plan = planRosterSave([student({ number: 5, name: '가' })], [incoming({ number: 1, name: '나' })], 'merge')
    expect(plan.missing).toEqual([])
  })
})

describe('저장 계획 — 교체', () => {
  it('올린 반에서 빠진 재학생만 missing', () => {
    const inClass = student({ classNo: 3, number: 5, name: '빠짐' })
    const otherClass = student({ classNo: 4, number: 5, name: '다른반' })
    const gone = student({ classNo: 3, number: 6, name: '이미전출', status: '전출' })
    const plan = planRosterSave([inClass, otherClass, gone], [incoming({ classNo: 3, number: 1, name: '새' })], 'replace')
    expect(plan.missing).toEqual([inClass])
    expect(plan.add.map((s) => s.name)).toEqual(['새'])
  })

  it('교체는 과정 등 값이 다르면 새 명단 값으로 바꾼다 (빈 값으로 지우지는 않음)', () => {
    const a = student({ number: 1, name: '가', course: '주간', dept: '일반학과' })
    const plan = planRosterSave([a], [incoming({ number: 1, name: '가', course: '야간', dept: undefined })], 'replace')
    expect(plan.update[0].changes).toEqual({ course: '야간' })
  })
})
