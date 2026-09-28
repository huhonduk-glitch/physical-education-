import type { Captain } from '../db/types'

/** 그 날짜에 맡고 있는 부장/부부장 (from ≤ date ≤ to). 없으면 undefined */
export function captainOn(captains: readonly Captain[], role: Captain['role'], date: string): Captain | undefined {
  return captains
    .filter((c) => c.role === role && c.from <= date && (c.to === undefined || date <= c.to))
    .sort((a, b) => b.from.localeCompare(a.from))[0]
}

export interface CaptainChange {
  /** 끝낼 기존 임기 (to를 채운다) */
  close?: { id: string; to: string }
  /** 오늘 막 지정했다가 바로 바꾼 경우: 그 기록을 지운다 */
  remove?: string
  /** 새로 추가할 임기 */
  add?: Omit<Captain, 'id'>
}

/**
 * 부장/부부장 지정·교체. 기존 사람은 지우지 않고 임기를 전날로 끝내 이력을 남긴다.
 * 같은 날 다시 바꾸면 그날 시작한 기록만 바꿔 끼운다(이력이 하루짜리로 쌓이지 않게).
 */
export function planCaptainChange(
  current: readonly Captain[],
  args: { schoolYear: number; grade: number; classNo: number; role: Captain['role']; studentId: string | null; date: string },
  dayBefore: (d: string) => string,
): CaptainChange {
  const now = captainOn(current, args.role, args.date)
  if (now && now.studentId === args.studentId) return {}
  const change: CaptainChange = {}
  if (now) {
    if (now.from === args.date) change.remove = now.id
    else change.close = { id: now.id, to: dayBefore(args.date) }
  }
  if (args.studentId) {
    change.add = {
      schoolYear: args.schoolYear,
      grade: args.grade,
      classNo: args.classNo,
      role: args.role,
      studentId: args.studentId,
      from: args.date,
    }
  }
  return change
}
