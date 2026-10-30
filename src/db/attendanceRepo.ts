import type { PeDatabase } from './db'
import { newId } from './db'
import type { Attendance, AttendReason, AttendStatus } from './types'
import { nextStatus } from '../lib/attendance'

export interface AttendKey {
  schoolYear: number
  groupId: string
  studentId: string
  date: string
  period?: number
}

const same = (a: Attendance, k: AttendKey) => a.studentId === k.studentId && (a.period ?? null) === (k.period ?? null)

/** 그날 이 반 출결 줄 */
export async function attendanceOn(db: PeDatabase, groupId: string, date: string): Promise<Attendance[]> {
  return db.attendance.where('[groupId+date]').equals([groupId, date]).toArray()
}

/** 상태 정하기. null = 출석(줄을 지운다). 같은 학생 · 같은 교시는 한 줄만 */
export async function setAttendance(db: PeDatabase, k: AttendKey, status: AttendStatus | null): Promise<void> {
  await db.transaction('rw', db.attendance, async () => {
    const rows = (await attendanceOn(db, k.groupId, k.date)).filter((a) => same(a, k))
    if (status === null) {
      await db.attendance.bulkDelete(rows.map((r) => r.id))
      return
    }
    const now = Date.now()
    if (rows[0]) {
      await db.attendance.update(rows[0].id, { status, updatedAt: now })
      if (rows.length > 1) await db.attendance.bulkDelete(rows.slice(1).map((r) => r.id))
    } else {
      await db.attendance.add({ id: newId(), schoolYear: k.schoolYear, groupId: k.groupId, studentId: k.studentId, date: k.date, period: k.period, status, createdAt: now, updatedAt: now })
    }
  })
}

/** 카드 한 번 누름: 출석 → 결석 → 지각 → 조퇴 → 결과 → 출석. 바뀐 상태를 돌려준다 */
export async function cycleAttendance(db: PeDatabase, k: AttendKey): Promise<AttendStatus | null> {
  const cur = (await attendanceOn(db, k.groupId, k.date)).find((a) => same(a, k))
  const next = nextStatus(cur?.status)
  await setAttendance(db, k, next)
  return next
}

export async function setAttendReason(db: PeDatabase, id: string, reason: AttendReason | undefined): Promise<void> {
  await db.attendance.update(id, { reason, updatedAt: Date.now() })
}
