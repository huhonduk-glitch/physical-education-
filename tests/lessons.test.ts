import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { saveLesson } from '../src/db/lessonsRepo'
import type { Absence, ClassRecord, Lesson } from '../src/db/types'
import { countsByDate, journalRows, previousLesson, unitSuggestions } from '../src/lib/lessons'

const rec = (date: string, type: ClassRecord['type']): ClassRecord => ({ id: Math.random().toString(), schoolYear: 2026, studentId: 's1', date, type, category: 'x', keywordIds: [], createdAt: 0, updatedAt: 0 })
const abs = (date: string, studentId: string): Absence => ({ id: Math.random().toString(), schoolYear: 2026, studentId, date, reason: '부상', altTaskDone: false })
const les = (date: string, o: Partial<Lesson> = {}): Lesson => ({ id: date, schoolYear: 2026, groupId: 'g', date, activity: '', createdAt: 0, updatedAt: 0, ...o })

describe('수업 일지', () => {
  it('날짜별 칭찬·지도·견학 (같은 학생 견학 두 줄은 한 명)', () => {
    const c = countsByDate([rec('2026-03-02', 'exemplary'), rec('2026-03-02', 'unprepared'), rec('2026-03-02', 'observation')], [abs('2026-03-02', 'a'), abs('2026-03-02', 'a'), abs('2026-03-03', 'b')])
    expect(c.get('2026-03-02')).toEqual({ exemplary: 1, unprepared: 1, absent: 1 })
    expect(c.get('2026-03-03')).toEqual({ exemplary: 0, unprepared: 0, absent: 1 })
  })
  it('지난 시간 일지, 단원 자동 완성', () => {
    const l = [les('2026-03-02', { unit: '농구' }), les('2026-03-09', { unit: '배구' }), les('2026-03-05', { unit: '농구' })]
    expect(previousLesson(l, '2026-03-06')?.date).toBe('2026-03-05')
    expect(previousLesson(l, '2026-03-02')).toBeUndefined()
    expect(unitSuggestions(l)).toEqual(['배구', '농구'])
  })
  it('엑셀 표: 일지 없는 기록 날짜도 줄이 생긴다', () => {
    const rows = journalRows([les('2026-03-02', { unit: '농구', activity: '패스', period: 3 })], countsByDate([rec('2026-03-04', 'exemplary')], [abs('2026-03-02', 'a')]), 30)
    expect(rows[0][0]).toBe('날짜')
    expect(rows[1]).toEqual(['2026-03-02', 3, '농구', '패스', '', 29, 1, 0, 0])
    expect(rows[2]).toEqual(['2026-03-04', '', '', '', '', 30, 0, 1, 0])
  })
  it('저장: 만들기 → 고치기 → 비우면 지우기', async () => {
    const name = 'test-lessons'
    const db = new PeDatabase(name)
    const key = { schoolYear: 2026, groupId: 'g1', date: '2026-03-02' }
    expect(await saveLesson(db, key, { activity: '  ', unit: '' })).toBe('empty')
    expect(await saveLesson(db, key, { activity: '패스', unit: ' 농구 ', period: 3 })).toBe('saved')
    expect(await saveLesson(db, key, { activity: '드리블', unit: '농구' })).toBe('saved')
    const all = await db.lessons.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ activity: '드리블', unit: '농구', groupId: 'g1' })
    expect(await saveLesson(db, key, { activity: '' })).toBe('deleted')
    expect(await db.lessons.count()).toBe(0)
    db.close()
    await Dexie.delete(name)
  })
})
