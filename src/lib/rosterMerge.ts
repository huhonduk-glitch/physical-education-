import type { Student } from '../db/types'
import type { NewStudent } from './rosterValidate'

/**
 * 명렬 저장 계획 세우기 (CLAUDE.md 4-1-C). 순수 함수 — 실제 저장은 db/rosterRepo.ts가 한다.
 *
 * 병합: 기존 학생은 그대로 두고 새 학생만 더한다. 비어 있던 과정·계열·반코드 등은 채운다.
 * 교체: 올린 명단에 들어 있는 반은 그 명단대로 맞춘다. 명단에서 빠진 학생은
 *       기록이 있으면 '전출'로 바꾸고(기록 보존), 기록이 없으면 지운다.
 *
 * 같은 자리(학년·반·번호)에 이름이 다른 학생은 두 모드 모두 '이름 다름'으로 따로 모아
 * 교사가 하나씩 고른다. 오타를 고친 같은 학생일 수도, 전출 후 새로 온 다른 학생일 수도 있어서다.
 *   rename   : 같은 학생 — 이름만 고친다 (기록 유지)
 *   transfer : 다른 학생 — 기존 학생은 전출 처리(기록 보존), 새 학생을 추가
 *   skip     : 이번에는 건드리지 않는다
 * 전출 처리된 학생은 자리를 차지하지 않는다 → 같은 번호의 새 학생은 그냥 추가된다.
 */

export type SaveMode = 'merge' | 'replace'
export type NameDecision = 'rename' | 'transfer' | 'skip'

export interface StudentUpdate {
  student: Student
  changes: Partial<Student>
}

export interface NameConflict {
  student: Student
  incoming: NewStudent
}

export interface SavePlan {
  mode: SaveMode
  add: NewStudent[]
  update: StudentUpdate[]
  nameConflicts: NameConflict[]
  unchanged: Student[]
  /** 교체 모드에서 명단에서 빠진 재학생 */
  missing: Student[]
}

const slotKey = (s: { grade: number; classNo: number; number: number }) => `${s.grade}-${s.classNo}-${s.number}`
const classKey = (s: { grade: number; classNo: number }) => `${s.grade}-${s.classNo}`

const META_FIELDS = ['classCode', 'gender', 'course', 'track', 'dept'] as const

const isEmpty = (v: unknown) => v === undefined || v === null || v === ''

export function defaultNameDecision(mode: SaveMode): NameDecision {
  return mode === 'merge' ? 'skip' : 'transfer'
}

/** 같은 자리의 기존 학생에게 새 명단 값을 어떻게 반영할지 (이름 제외) */
export function metaChanges(cur: Student, inc: NewStudent, mode: SaveMode): Partial<Student> {
  const changes: Partial<Student> = {}
  const set = (f: keyof Student, v: unknown) => ((changes as Record<string, unknown>)[f] = v)
  for (const f of META_FIELDS) {
    const v = inc[f]
    if (isEmpty(v)) continue // 새 명단이 비어 있으면 기존 값을 지우지 않는다
    if (mode === 'merge' ? isEmpty(cur[f]) : cur[f] !== v) set(f, v)
  }
  if (cur.studentCode !== inc.studentCode) set('studentCode', inc.studentCode)
  return changes
}

export function planRosterSave(existing: readonly Student[], incoming: readonly NewStudent[], mode: SaveMode): SavePlan {
  const bySlot = new Map<string, Student>()
  for (const s of existing) {
    if (s.status === '전출') continue
    if (!bySlot.has(slotKey(s))) bySlot.set(slotKey(s), s)
  }

  const plan: SavePlan = { mode, add: [], update: [], nameConflicts: [], unchanged: [], missing: [] }
  const matched = new Set<string>()

  for (const inc of incoming) {
    const cur = bySlot.get(slotKey(inc))
    if (!cur) {
      plan.add.push(inc)
      continue
    }
    matched.add(cur.id)
    if (cur.name !== inc.name) {
      plan.nameConflicts.push({ student: cur, incoming: inc })
      continue
    }
    const changes = metaChanges(cur, inc, mode)
    if (Object.keys(changes).length > 0) plan.update.push({ student: cur, changes })
    else plan.unchanged.push(cur)
  }

  if (mode === 'replace') {
    const classes = new Set(incoming.map(classKey))
    for (const s of existing) {
      if (s.status === '재학' && classes.has(classKey(s)) && !matched.has(s.id)) plan.missing.push(s)
    }
  }
  return plan
}
