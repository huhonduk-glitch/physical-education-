import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { attendanceOn, setAttendReason, setAttendance, setNeisCarried } from '../src/db/attendanceRepo'
import { carryDateLabel, carryDays, carrySummary, carryText, isCarried, pendingCount } from '../src/lib/neisCarry'
import type { Attendance } from '../src/db/types'

const row = (o: Partial<Attendance>): Attendance => ({ id: 'a', schoolYear: 2026, groupId: 'g1', studentId: 's1', date: '2026-11-11', status: 'absent', createdAt: 1, updatedAt: 1, ...o })
const groups = [
  { id: 'g1', name: '1학년 2반' },
  { id: 'g2', name: '1학년 10반' },
]
const who = (id: string) => ({ s1: { no: '5', name: '학생가' }, s2: { no: '12', name: '학생나' }, s3: { no: '3', name: '학생다' } })[id]

describe('나이스에 옮길 출결 묶기', () => {
  const rows = [
    row({ id: 'a1', studentId: 's2', period: 3 }),
    row({ id: 'a2', studentId: 's1', period: 3, status: 'late', reason: '질병' }),
    row({ id: 'a3', studentId: 's3', date: '2026-11-10', groupId: 'g2', status: 'result' }),
    row({ id: 'a4', studentId: 's3', date: '2026-11-11', groupId: 'g2', neisAt: 100 }),
    row({ id: 'a5', studentId: 's9', date: '2026-11-11', groupId: 'g1', period: 3, status: 'early' }),
    row({ id: 'a6', studentId: 's1', groupId: 'gone' }),
  ]
  it('안 옮긴 줄만, 오래된 날부터 · 번호순, 지운 수업반은 빼고 명단에 없는 학생은 남김', () => {
    const days = carryDays(rows, groups, who)
    expect(days.map((d) => `${d.date} ${d.groupName}`)).toEqual(['2026-11-10 1학년 10반', '2026-11-11 1학년 2반'])
    expect(days[1].rows.map((r) => r.name)).toEqual(['학생가', '학생나', '(명단에 없음)'])
    expect(pendingCount(rows)).toBe(5)
    expect(isCarried(rows[3])).toBe(true)
  })
  it('옮긴 줄 보기', () => {
    const done = carryDays(rows, groups, who, true)
    expect(done).toHaveLength(1)
    expect(done[0].rows[0]).toMatchObject({ id: 'a4', done: true })
  })
  it('복사 글: 사유는 고를 때만', () => {
    const day = carryDays(rows, groups, who)[1]
    expect(carryText(day)).toBe('11/11(수) 1학년 2반\n3교시 5번 학생가 지각\n3교시 12번 학생나 결석\n3교시 (명단에 없음) 조퇴')
    expect(carryText(day, true)).toContain('학생가 지각(질병)')
    expect(carrySummary(day)).toBe('결석 1 · 지각 1 · 조퇴 1')
    expect(carryDateLabel('2026-11-15')).toBe('11/15(일)')
  })
})

describe('옮김 표시 저장', () => {
  let n = 0
  const made: string[] = []
  const open = () => {
    const name = `carry-test-${n++}`
    made.push(name)
    return new PeDatabase(name)
  }
  afterEach(async () => {
    for (const name of made.splice(0)) await Dexie.delete(name)
  })
  const key = { schoolYear: 2026, groupId: 'g1', studentId: 's1', date: '2026-11-11' }
  it('표시 · 풀기, 상태나 사유가 바뀌면 다시 옮길 것으로', async () => {
    const db = open()
    await setAttendance(db, key, 'absent')
    const [a] = await attendanceOn(db, 'g1', '2026-11-11')
    await setNeisCarried(db, [a.id], true)
    expect(isCarried((await attendanceOn(db, 'g1', '2026-11-11'))[0])).toBe(true)
    // 같은 상태로 다시 정하면 그대로
    await setAttendance(db, key, 'absent')
    expect(isCarried((await attendanceOn(db, 'g1', '2026-11-11'))[0])).toBe(true)
    // 상태가 바뀌면 풀림
    await setAttendance(db, key, 'late')
    expect(isCarried((await attendanceOn(db, 'g1', '2026-11-11'))[0])).toBe(false)
    await setNeisCarried(db, [a.id], true)
    await setAttendReason(db, a.id, '질병')
    expect(isCarried((await attendanceOn(db, 'g1', '2026-11-11'))[0])).toBe(false)
    await setNeisCarried(db, [a.id], true)
    await setNeisCarried(db, [a.id], false)
    expect(isCarried((await attendanceOn(db, 'g1', '2026-11-11'))[0])).toBe(false)
    db.close()
  })
})
