import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { exportAll, restoreAll } from '../src/db/backup'
import { attendanceOn, cycleAttendance, setAttendReason, setAttendance } from '../src/db/attendanceRepo'
import { attendByDay, attendTally, dayStatus, isMissing, nextStatus, tallyText } from '../src/lib/attendance'
import type { Attendance } from '../src/db/types'

let n = 0
const dbs: PeDatabase[] = []
const fresh = () => {
  const d = new PeDatabase(`attend-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

const row = (studentId: string, status: Attendance['status'], period?: number): Attendance => ({ id: `${studentId}-${period}`, schoolYear: 2026, groupId: 'g', studentId, date: '2026-10-30', period, status, createdAt: 0, updatedAt: 0 })

describe('출결 계산', () => {
  it('누를 때마다 출석 → 결석 → 지각 → 조퇴 → 결과 → 출석', () => {
    const seen: (string | null)[] = []
    let s = nextStatus(null)
    for (let i = 0; i < 5; i++) {
      seen.push(s)
      s = nextStatus(s)
    }
    expect(seen).toEqual(['absent', 'late', 'early', 'result', null])
  })
  it('결석 · 결과만 수업에 없었던 것으로 센다', () => {
    expect(['absent', 'late', 'early', 'result'].map((s) => isMissing(s as Attendance['status']))).toEqual([true, false, false, true])
    expect(isMissing(null)).toBe(false)
  })
  it('교시가 있으면 그 교시 줄만, 교시 없는 줄은 어느 교시에나', () => {
    const rows = [row('a', 'absent', 1), row('b', 'late', 2), row('c', 'early')]
    expect([...dayStatus(rows, 1).keys()].sort()).toEqual(['a', 'c'])
    expect([...dayStatus(rows).keys()].sort()).toEqual(['a', 'b', 'c'])
  })
  it('학생별 횟수와 짧은 글', () => {
    const t = attendTally([row('a', 'absent', 1), row('a', 'absent', 2), row('a', 'late', 3), row('b', 'result')])
    expect(tallyText(t.get('a'))).toBe('결석 2 · 지각 1')
    expect(tallyText(t.get('b'))).toBe('결과 1')
    expect(tallyText(t.get('z'))).toBe('')
  })
})

describe('출결 저장', () => {
  it('카드 누르기 순환 · 교시마다 따로 · 출석이면 줄이 없음', async () => {
    const db = fresh()
    const k = { schoolYear: 2026, groupId: 'g1', studentId: 's1', date: '2026-10-30', period: 3 }
    expect(await cycleAttendance(db, k)).toBe('absent')
    expect(await cycleAttendance(db, k)).toBe('late')
    expect(await cycleAttendance(db, { ...k, period: 4 })).toBe('absent')
    const rows = await attendanceOn(db, 'g1', '2026-10-30')
    expect(rows.map((r) => `${r.period}:${r.status}`).sort()).toEqual(['3:late', '4:absent'])
    await setAttendance(db, k, null)
    expect((await attendanceOn(db, 'g1', '2026-10-30')).map((r) => r.period)).toEqual([4])
  })
  it('사유 넣기 · 백업 · 복원', async () => {
    const db = fresh()
    await setAttendance(db, { schoolYear: 2026, groupId: 'g1', studentId: 's1', date: '2026-10-30' }, 'absent')
    const [r] = await attendanceOn(db, 'g1', '2026-10-30')
    await setAttendReason(db, r.id, '질병')
    const file = await exportAll(db)
    expect(file.counts.attendance).toBe(1)
    const db2 = fresh()
    await restoreAll(db2, file)
    const [back] = await attendanceOn(db2, 'g1', '2026-10-30')
    expect(back.status).toBe('absent')
    expect(back.reason).toBe('질병')
  })
})

describe('고교학점제 출석률 2/3 (2026-11-04)', () => {
  it('16회 수업: 5번 빠짐까지 괜찮음, 6번부터 미만', async () => {
    const { creditRisk } = await import('../src/lib/attendance')
    expect(creditRisk(3, 16)).toBe('ok')
    expect(creditRisk(4, 16)).toBe('caution')
    expect(creditRisk(5, 16)).toBe('caution')
    expect(creditRisk(6, 16)).toBe('danger')
    expect(creditRisk(0, 0)).toBe('ok')
  })
})

describe('월간 출결표', () => {
  it('같은 날 여러 교시면 무거운 것 하나, 날짜별 출석 아닌 학생 수', () => {
    const rows = [row('a', 'late', 1), row('a', 'absent', 2), row('b', 'early', 1), { ...row('b', 'result', 3), date: '2026-10-29', id: 'x' }]
    const { cell, perDay } = attendByDay(rows)
    expect(cell.get('a|2026-10-30')?.status).toBe('absent')
    expect(cell.get('b|2026-10-29')?.status).toBe('result')
    expect(perDay.get('2026-10-30')).toBe(2)
    expect(perDay.get('2026-10-29')).toBe(1)
  })
})
