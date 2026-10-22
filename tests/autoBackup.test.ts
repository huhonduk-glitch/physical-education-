import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { listSnapshots, prepareUpgrade } from '../src/db/autoBackup'
import { checkBackup, restoreAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'

let n = 0
const names = () => {
  n += 1
  return { mainDb: `auto-main-${n}`, autoDb: `auto-bk-${n}` }
}

/** 업데이트 전(v4) 저장소를 흉내 낸다: db.ts의 v1~v4 표 구성과 같다 */
async function makeV4(name: string) {
  const old = new Dexie(name)
  old.version(4).stores({
    settings: 'key',
    students: 'id, schoolYear, [schoolYear+grade+classNo], [schoolYear+grade+classNo+number], studentCode, status',
    records: 'id, schoolYear, studentId, date, type, [studentId+date], groupId, [groupId+date]',
    captains: 'id, schoolYear, [schoolYear+grade+classNo], studentId',
    absences: 'id, schoolYear, studentId, date, groupId, [groupId+date]',
    keywords: 'id, category, isActive, sortOrder',
    papsConfigs: 'id, [schoolYear+grade+classNo]',
    papsResults: 'id, schoolYear, studentId, eventId, [studentId+eventId]',
    assessments: 'id, schoolYear, grade',
    assessmentScores: 'id, assessmentId, studentId, [assessmentId+studentId]',
    timerPresets: 'id',
    audioFiles: 'id',
    groups: 'id, schoolYear, kind, [schoolYear+grade+classNo]',
    lessons: 'id, schoolYear, groupId, date, [groupId+date]',
  })
  await old.table('students').bulkAdd([
    { id: 's1', schoolYear: 2026, grade: 1, classNo: 1, number: 1, name: '가명일', gender: 'M', studentCode: '10101', status: '재학', memo: '' },
    { id: 's2', schoolYear: 2026, grade: 1, classNo: 1, number: 2, name: '가명이', gender: 'M', studentCode: '10102', status: '재학', memo: '' },
  ])
  await old.table('papsResults').bulkAdd([
    { id: 'r1', schoolYear: 2026, studentId: 's1', eventId: 'shuttleRun', attempt: null, side: null, value: 34, excluded: false, measuredAt: 1 },
    { id: 'r2', schoolYear: 2026, studentId: 's2', eventId: 'shuttleRun', attempt: null, side: null, value: 51, excluded: false, measuredAt: 1 },
  ])
  await old.table('records').add({ id: 'k1', schoolYear: 2026, studentId: 's1', date: '2026-10-01', type: 'exemplary', category: '정리정돈', keywordIds: [], createdAt: 1, updatedAt: 1 })
  await old.table('settings').put({ key: 'schoolName', value: '가명고' })
  old.close()
}

describe('업데이트 전 자동 백업 (B-5: 바꾸기 전에 기존 자료부터 백업)', () => {
  it('옛 저장소(v4)면 새 버전으로 열기 전에 통째로 복사한다', async () => {
    const o = names()
    await makeV4(o.mainDb)
    const r = await prepareUpgrade(o)
    expect(r.status).toBe('saved')
    const [snap] = await listSnapshots(o.autoDb)
    expect(snap.fromVersion).toBe(4)
    expect(snap.file.counts.students).toBe(2)
    expect(snap.file.counts.papsResults).toBe(2)
    expect(snap.file.counts.records).toBe(1)
    expect(snap.file.counts.papsRounds).toBe(0)
    // 백업 파일과 같은 형식이라 [복원]에 그대로 쓸 수 있다
    expect(checkBackup(snap.file).ok).toBe(true)
  })

  it('원래 저장소는 읽기만 한다: 새 버전으로 열어도 기록이 그대로', async () => {
    const o = names()
    await makeV4(o.mainDb)
    await prepareUpgrade(o)
    const db = new PeDatabase(o.mainDb)
    expect(await db.students.count()).toBe(2)
    expect((await db.papsResults.get('r1'))?.value).toBe(34)
    expect((await db.papsResults.get('r1'))?.roundId).toBeUndefined() // 고치지 않음 → 1회차
    expect(await db.papsRounds.count()).toBe(0)
    expect(await db.records.count()).toBe(1)
    db.close()
  })

  it('이미 새 버전이면 다시 백업하지 않는다 (한 번만)', async () => {
    const o = names()
    await makeV4(o.mainDb)
    await prepareUpgrade(o)
    const db = new PeDatabase(o.mainDb)
    await db.open()
    db.close()
    expect((await prepareUpgrade(o)).status).toBe('not-needed')
    expect((await listSnapshots(o.autoDb)).length).toBe(1)
  })

  it('처음 쓰는 기기(저장소 없음)는 아무것도 만들지 않는다', async () => {
    const o = names()
    expect((await prepareUpgrade(o)).status).toBe('none')
    const dbs = await indexedDB.databases()
    expect(dbs.some((d) => d.name === o.mainDb)).toBe(false)
  })

  it('자동 백업으로 되돌리면 업데이트 전 자료로 돌아간다', async () => {
    const o = names()
    await makeV4(o.mainDb)
    await prepareUpgrade(o)
    const db = new PeDatabase(o.mainDb)
    await db.papsResults.clear()
    const [snap] = await listSnapshots(o.autoDb)
    await restoreAll(db, snap.file)
    expect(await db.papsResults.count()).toBe(2)
    db.close()
  })
})
