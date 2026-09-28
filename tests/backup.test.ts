import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupFileName, backupOverdue, checkBackup, exportAll, restoreAll } from '../src/db/backup'
import { PeDatabase } from '../src/db/db'

describe('백업·복원', () => {
  let a: PeDatabase
  let b: PeDatabase
  beforeEach(() => {
    a = new PeDatabase(`a-${Math.random()}`)
    b = new PeDatabase(`b-${Math.random()}`)
  })
  afterEach(async () => {
    await a.delete()
    await b.delete()
  })

  it('백업 → 다른 기기에 복원하면 자료가 똑같다 (JSON 왕복)', async () => {
    await a.students.add({ id: 's1', schoolYear: 2026, grade: 1, classNo: 3, classCode: '03', number: 1, name: '가나다', gender: 'F', studentCode: '10301', status: '재학', memo: '' })
    await a.records.add({ id: 'r1', schoolYear: 2026, studentId: 's1', date: '2026-04-01', type: 'exemplary', category: '정리정돈', keywordIds: ['k1'], createdAt: 1, updatedAt: 1 })
    await a.settings.put({ key: 'schoolYear', value: 2026 })
    await b.students.add({ id: 'old', schoolYear: 2025, grade: 2, classNo: 1, classCode: '01', number: 9, name: '지울것', gender: 'M', studentCode: '20109', status: '재학', memo: '' })

    const file = JSON.parse(JSON.stringify(await exportAll(a)))
    const c = checkBackup(file)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.file.counts.students).toBe(1)
    await restoreAll(b, c.file)
    expect(await b.students.toArray()).toEqual(await a.students.toArray())
    expect(await b.records.toArray()).toEqual(await a.records.toArray())
    expect(await b.students.get('old')).toBeUndefined()
  })

  it('다른 파일은 거부', () => {
    expect(checkBackup({ hello: 1 }).ok).toBe(false)
    expect(checkBackup({ format: 'pe-records-backup', version: 99, tables: {} }).ok).toBe(false)
    expect(checkBackup({ format: 'pe-records-backup', version: 1, tables: { students: 'x' } }).ok).toBe(false)
  })

  it('파일 이름은 backup으로 시작 (.gitignore가 막음)', () => {
    expect(backupFileName(new Date(2026, 8, 28, 9, 5))).toBe('backup_체육기록_20260928_0905.json')
  })

  it('7일 지나면 경고', () => {
    const day = 24 * 3600 * 1000
    expect(backupOverdue(0, 10 * day)).toBe(true)
    expect(backupOverdue(5 * day, 10 * day)).toBe(false)
    expect(backupOverdue(2 * day, 10 * day)).toBe(true)
  })
})
