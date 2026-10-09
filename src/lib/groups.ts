import type { ClassGroup, Student } from '../db/types'
import type { RosterRow } from './rosterGrid'
import { cellText } from './text'

/**
 * 수업반 계산 (순수 함수). 저장은 db/groupsRepo.ts가 한다.
 *
 * 학적반 수업반은 학년·반으로 학생을 그때그때 찾는다 → 명렬을 다시 올리면 저절로 반영된다.
 * 수강반은 학생 id 목록을 들고 있고, 학번 순으로 보여 준다.
 */

/** 카드 색 (index.css 토큰과 무관한 순수 색. 글자 대비가 충분한 진한 색만) */
export const GROUP_COLORS: Record<string, { bg: string; fg: string }> = {
  blue: { bg: '#e8f3ff', fg: '#1b64da' },
  green: { bg: '#e5f8ef', fg: '#0a7d50' },
  orange: { bg: '#fff1e0', fg: '#b45309' },
  purple: { bg: '#f1ebff', fg: '#6d3fd6' },
  pink: { bg: '#ffe9f0', fg: '#c0265e' },
  teal: { bg: '#e2f6f6', fg: '#0f766e' },
}
export const COLOR_KEYS = Object.keys(GROUP_COLORS)

export const homeroomName = (grade: number, classNo: number) => `${grade}학년 ${classNo}반`

export const SEMESTER_LABEL: Record<ClassGroup['semester'], string> = { 0: '1년', 1: '1학기', 2: '2학기' }

/** 수업반에 속한 학생 (전출생 제외). 학적반은 번호순, 수강반은 학번순. */
export function groupMembers(group: ClassGroup, students: readonly Student[]): Student[] {
  if (group.kind === 'homeroom') {
    return students
      .filter((s) => s.schoolYear === group.schoolYear && s.grade === group.grade && s.classNo === group.classNo && s.status !== '전출')
      .sort((a, b) => a.number - b.number)
  }
  const ids = new Set(group.memberIds)
  return students.filter((s) => ids.has(s.id) && s.status !== '전출').sort((a, b) => a.studentCode.localeCompare(b.studentCode))
}

/** 카드에 크게 쓰는 번호. 학적반은 번호, 수강반은 학번(여러 반이 섞이므로) */
export function memberNo(group: ClassGroup, s: Student): string {
  return group.kind === 'homeroom' ? String(s.number) : s.studentCode
}

/** 명렬에는 있지만 아직 수업반이 없는 학적반 */
export function missingHomerooms(students: readonly Student[], groups: readonly ClassGroup[], schoolYear: number): { grade: number; classNo: number }[] {
  const have = new Set(groups.filter((g) => g.kind === 'homeroom' && g.schoolYear === schoolYear).map((g) => `${g.grade}-${g.classNo}`))
  const out = new Map<string, { grade: number; classNo: number }>()
  for (const s of students) {
    if (s.schoolYear !== schoolYear || s.status === '전출') continue
    const k = `${s.grade}-${s.classNo}`
    if (!have.has(k)) out.set(k, { grade: s.grade, classNo: s.classNo })
  }
  return [...out.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
}

export function newHomeroomGroup(schoolYear: number, grade: number, classNo: number, sortOrder: number): Omit<ClassGroup, 'id' | 'createdAt'> {
  return {
    schoolYear,
    semester: 0,
    kind: 'homeroom',
    name: homeroomName(grade, classNo),
    subject: '체육',
    grade,
    classNo,
    memberIds: [],
    color: COLOR_KEYS[(grade - 1 + COLOR_KEYS.length) % COLOR_KEYS.length],
    sortOrder,
    archived: false,
  }
}

/** 수업반 목록 정렬: 학기 → 순서 → 이름 */
export function sortGroups(groups: readonly ClassGroup[]): ClassGroup[] {
  return [...groups].sort((a, b) => a.semester - b.semester || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
}

export interface MemberMatch {
  /** 명렬에 이미 있는 학생 */
  found: Student[]
  /** 명렬에 없어 새로 만들 학생 (학년·반·번호·이름을 다 알 때만) */
  create: { grade: number; classNo: number; number: number; name: string; gender: Student['gender'] }[]
  /** 알아보지 못한 줄 */
  problems: { source: string; text: string }[]
}

/**
 * 붙여넣은 수강반 명단을 명렬과 맞춘다.
 * 학년·반·번호가 있으면 그 자리 학생을 찾고(이름이 다르면 문제로 표시), 없으면 이름으로 찾는다.
 * 명렬에 없는 학생은 학년·반·번호·이름이 다 있을 때만 새로 만든다 → 명렬을 먼저 올리지 않아도 된다.
 */
export function matchMembers(rows: readonly RosterRow[], students: readonly Student[], schoolYear: number): MemberMatch {
  const live = students.filter((s) => s.schoolYear === schoolYear && s.status !== '전출')
  const found: Student[] = []
  const create: MemberMatch['create'] = []
  const problems: MemberMatch['problems'] = []
  const seen = new Set<string>()
  const pushFound = (s: Student) => {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      found.push(s)
    }
  }
  for (const r of rows) {
    const name = cellText(r.name)
    const text = [r.grade && r.classNo && r.number ? `${r.grade}-${r.classNo}-${r.number}` : '', name].filter(Boolean).join(' ')
    if (r.grade && r.classNo && r.number) {
      const s = live.find((x) => x.grade === r.grade && x.classNo === r.classNo && x.number === r.number)
      if (s) {
        if (name && s.name !== name) problems.push({ source: r.source, text: `${text} — 명렬에는 ${s.name}(으)로 되어 있어요` })
        else pushFound(s)
      } else if (name) {
        const key = `${r.grade}-${r.classNo}-${r.number}`
        if (!seen.has(key)) {
          seen.add(key)
          create.push({ grade: r.grade, classNo: r.classNo, number: r.number, name, gender: r.gender })
        }
      } else problems.push({ source: r.source, text: `${text} — 이름이 없어요` })
      continue
    }
    if (name) {
      const same = live.filter((x) => x.name === name)
      if (same.length === 1) pushFound(same[0])
      else if (same.length > 1) problems.push({ source: r.source, text: `${name} — 같은 이름이 ${same.length}명이에요. 학번을 같이 적어 주세요` })
      else problems.push({ source: r.source, text: `${name} — 명렬에 없어요. 학번(예: 10312)을 같이 적으면 새로 만들어요` })
      continue
    }
    problems.push({ source: r.source, text: '알아보지 못한 줄' })
  }
  return { found, create, problems }
}
