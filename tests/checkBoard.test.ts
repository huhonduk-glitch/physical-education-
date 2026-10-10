import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { toggleCheck, undo } from '../src/db/recordsRepo'
import type { Absence, ClassRecord } from '../src/db/types'
import { cellCounts, checkItems, periodRange, tallyByStudent } from '../src/lib/checkBoard'

const rec = (studentId: string, type: ClassRecord['type'], category: string, date = '2026-04-01'): ClassRecord => ({
  id: Math.random().toString(),
  schoolYear: 2026,
  studentId,
  date,
  type,
  category,
  keywordIds: [],
  createdAt: 1,
  updatedAt: 1,
})

describe('체크 항목', () => {
  it('지도 먼저, 칭찬 다음, 기타는 뺀다', () => {
    const items = checkItems({ unprepared: ['체육복', '기타'], exemplary: ['용구 정리', '기타'], captain: [] })
    expect(items.map((i) => i.key)).toEqual(['unprepared|체육복', 'exemplary|용구 정리'])
  })
})

describe('칸 개수 · 학생별 누적', () => {
  const records = [rec('a', 'unprepared', '체육복'), rec('a', 'unprepared', '체육복', '2026-04-02'), rec('a', 'exemplary', '정리정돈'), rec('b', 'observation', '관찰'), rec('b', 'unprepared', '기타')]
  it('학생·항목별 개수', () => {
    const c = cellCounts(records)
    expect(c.get('a')?.get('unprepared|체육복')).toBe(2)
    expect(c.get('a')?.get('exemplary|정리정돈')).toBe(1)
    expect(c.get('b')?.get('unprepared|체육복')).toBeUndefined()
  })
  it('칭찬·지도·메모·견학 일수 (같은 날 견학 두 번은 하루)', () => {
    const abs: Absence[] = [
      { id: 'x', schoolYear: 2026, studentId: 'b', date: '2026-04-01', reason: '부상', altTaskDone: false },
      { id: 'y', schoolYear: 2026, studentId: 'b', date: '2026-04-01', reason: '질병', altTaskDone: false },
      { id: 'z', schoolYear: 2026, studentId: 'b', date: '2026-04-03', reason: '질병', altTaskDone: false },
    ]
    const t = tallyByStudent(records, abs)
    expect(t.get('a')).toMatchObject({ plus: 1, minus: 2, notes: 0, absent: 0 })
    expect(t.get('b')).toMatchObject({ plus: 0, minus: 1, notes: 1, absent: 2 })
  })
})

describe('기간', () => {
  it('학기·학년도·이번 달 (윤년 2월 포함)', () => {
    expect(periodRange('sem1', 2026, '2026-10-09')).toEqual(['2026-03-01', '2026-08-31'])
    expect(periodRange('sem2', 2027, '2027-10-09')).toEqual(['2027-09-01', '2028-02-29'])
    expect(periodRange('year', 2026, '2026-10-09')).toEqual(['2026-03-01', '2027-02-28'])
    expect(periodRange('month', 2026, '2026-02-10')).toEqual(['2026-02-01', '2026-02-28'])
  })
})

describe('체크 칸 누르기', () => {
  let db: PeDatabase
  beforeEach(() => {
    db = new PeDatabase(`chk-${Math.random()}`)
  })
  afterEach(async () => {
    await db.delete()
  })
  const input = { schoolYear: 2026, groupId: 'g1', studentId: 's1', date: '2026-04-01', type: 'unprepared' as const, category: '체육복' }

  it('없으면 만들고, 있으면 지운다. 다른 수업반·날짜 기록은 그대로', async () => {
    await db.records.add({ ...rec('s1', 'unprepared', '체육복'), id: 'other', groupId: 'g2' })
    const a = await toggleCheck(db, input)
    expect(a.checked).toBe(true)
    expect(await db.records.where('[groupId+date]').equals(['g1', '2026-04-01']).count()).toBe(1)
    const b = await toggleCheck(db, input)
    expect(b.checked).toBe(false)
    expect(await db.records.where('[groupId+date]').equals(['g1', '2026-04-01']).count()).toBe(0)
    expect(await db.records.get('other')).toBeTruthy()
    // 풀기를 되돌리면 다시 체크된다
    await undo(db, b.token)
    expect(await db.records.where('[groupId+date]').equals(['g1', '2026-04-01']).count()).toBe(1)
  })
})
