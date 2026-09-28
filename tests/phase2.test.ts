import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEYWORD_SEED } from '../src/data/keywordSeed'
import { PeDatabase } from '../src/db/db'
import { addAbsences, addRecords, applyCaptainChange, ensureKeywordSeed, undo } from '../src/db/recordsRepo'
import type { Captain, ClassRecord, Keyword } from '../src/db/types'
import { planCaptainChange, captainOn } from '../src/lib/captains'
import { dayBefore, monthLabel, shortDateLabel, toDateStr } from '../src/lib/dates'
import { countByCategory, countByMonth, keywordSummary, summarizeDay } from '../src/lib/recordStats'
import { classForNow, currentPeriod, setTimetableCell } from '../src/lib/timetable'

describe('날짜', () => {
  it('기기 시간 기준 날짜 (밤 늦게도 날짜가 밀리지 않음)', () => {
    expect(toDateStr(new Date(2026, 3, 15, 23, 59))).toBe('2026-04-15')
  })
  it('전날, 월 이름, 짧은 날짜', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
    expect(monthLabel('2026-04')).toBe('4월')
    expect(shortDateLabel('2026-09-28')).toBe('9/28(월)')
  })
})

describe('시간표로 지금 반 고르기', () => {
  const starts = ['09:00', '10:00', '11:00']
  const tt = [
    { day: 1, period: 1, grade: 1, classNo: 3 },
    { day: 1, period: 2, grade: 2, classNo: 5 },
  ]
  const mon = (h: number, m: number) => new Date(2026, 8, 28, h, m) // 2026-09-28 월요일

  it('수업 중이면 그 교시', () => {
    expect(currentPeriod(mon(9, 30), starts, 50)).toBe(1)
    expect(currentPeriod(mon(10, 49), starts, 50)).toBe(2)
  })
  it('시작 10분 전부터 그 교시로 본다', () => {
    expect(currentPeriod(mon(9, 52), starts, 50)).toBe(2)
    expect(currentPeriod(mon(8, 49), starts, 50)).toBeNull()
  })
  it('시간표에서 반을 찾는다', () => {
    expect(classForNow(mon(9, 10), tt, starts, 50)).toEqual({ grade: 1, classNo: 3, period: 1 })
    expect(classForNow(mon(10, 10), tt, starts, 50)).toEqual({ grade: 2, classNo: 5, period: 2 })
  })
  it('빈 교시·주말은 null', () => {
    expect(classForNow(mon(11, 10), tt, starts, 50)).toBeNull()
    expect(classForNow(new Date(2026, 8, 27, 9, 10), tt, starts, 50)).toBeNull() // 일요일
  })
  it('시간표 칸 바꾸기·비우기', () => {
    const t2 = setTimetableCell(tt, 1, 1, { grade: 3, classNo: 1 })
    expect(t2.find((t) => t.day === 1 && t.period === 1)).toEqual({ day: 1, period: 1, grade: 3, classNo: 1 })
    expect(t2).toHaveLength(2)
    expect(setTimetableCell(tt, 1, 1, null)).toHaveLength(1)
  })
})

function rec(p: Partial<ClassRecord>): ClassRecord {
  return {
    id: Math.random().toString(),
    schoolYear: 2026,
    studentId: 's1',
    date: '2026-04-01',
    type: 'exemplary',
    category: '정리정돈',
    keywordIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...p,
  }
}

describe('기록 집계', () => {
  it('월별 개수', () => {
    const rs = [rec({ date: '2026-04-01' }), rec({ date: '2026-04-20' }), rec({ date: '2026-03-02' })]
    expect(countByMonth(rs)).toEqual([
      { month: '2026-03', count: 1 },
      { month: '2026-04', count: 2 },
    ])
  })
  it('항목별 개수 (많은 것부터)', () => {
    const rs = [rec({ category: '체육복' }), rec({ category: '실내화' }), rec({ category: '체육복' })]
    expect(countByCategory(rs)).toEqual([
      { category: '체육복', count: 2 },
      { category: '실내화', count: 1 },
    ])
  })
  it('키워드 빈도와 근거 기록 — 미준비 기록은 뺀다', () => {
    const kw: Keyword[] = [
      { id: 'k1', label: '책임감', category: '리더십', isActive: true, sortOrder: 0 },
      { id: 'k2', label: '배려', category: '배려', isActive: true, sortOrder: 1 },
    ]
    const rs = [
      rec({ keywordIds: ['k1'], date: '2026-04-01' }),
      rec({ keywordIds: ['k1', 'k2'], date: '2026-04-05', note: '공 정리' }),
      rec({ type: 'unprepared', category: '체육복', keywordIds: ['k2'] }),
    ]
    const s = keywordSummary(rs, kw)
    expect(s.map((x) => [x.keyword.label, x.count])).toEqual([
      ['책임감', 2],
      ['배려', 1],
    ])
    expect(s[0].records[0].note).toBe('공 정리') // 최근 기록부터
  })
  it('오늘 요약: 종류별 개수와 견학', () => {
    const m = summarizeDay(
      [rec({ type: 'unprepared' }), rec({ type: 'unprepared' }), rec({ studentId: 's2', type: 'observation' })],
      [{ id: 'a', schoolYear: 2026, studentId: 's2', date: '2026-04-01', reason: '부상', altTaskDone: false }],
    )
    expect(m.get('s1')).toMatchObject({ unprepared: 2, absent: false })
    expect(m.get('s2')).toMatchObject({ observation: 1, absent: true })
  })
})

describe('체육부장 교체 이력', () => {
  const base = { schoolYear: 2026, grade: 1, classNo: 3, role: '부장' as const }
  const cap = (p: Partial<Captain>): Captain => ({ id: 'c1', ...base, studentId: 'a', from: '2026-03-02', ...p })

  it('그 날짜의 부장', () => {
    const list = [cap({ to: '2026-06-30' }), cap({ id: 'c2', studentId: 'b', from: '2026-07-01' })]
    expect(captainOn(list, '부장', '2026-05-01')?.studentId).toBe('a')
    expect(captainOn(list, '부장', '2026-07-01')?.studentId).toBe('b')
    expect(captainOn(list, '부부장', '2026-07-01')).toBeUndefined()
  })
  it('교체하면 기존 임기는 전날로 끝내고 새 임기를 연다 (이력 보존)', () => {
    const ch = planCaptainChange([cap({})], { ...base, studentId: 'b', date: '2026-07-01' }, dayBefore)
    expect(ch.close).toEqual({ id: 'c1', to: '2026-06-30' })
    expect(ch.add).toMatchObject({ studentId: 'b', from: '2026-07-01' })
  })
  it('같은 날 다시 바꾸면 그날 기록만 바꿔 끼운다', () => {
    const ch = planCaptainChange([cap({ from: '2026-07-01' })], { ...base, studentId: 'b', date: '2026-07-01' }, dayBefore)
    expect(ch.remove).toBe('c1')
    expect(ch.close).toBeUndefined()
  })
  it('같은 사람이면 아무것도 안 바뀐다', () => {
    expect(planCaptainChange([cap({})], { ...base, studentId: 'a', date: '2026-07-01' }, dayBefore)).toEqual({})
  })
  it('해제(사람 없음)', () => {
    const ch = planCaptainChange([cap({})], { ...base, studentId: null, date: '2026-07-01' }, dayBefore)
    expect(ch.close).toBeDefined()
    expect(ch.add).toBeUndefined()
  })
})

describe('기록 저장·되돌리기 (기기 안 저장소)', () => {
  let db: PeDatabase
  beforeEach(() => {
    db = new PeDatabase(`t-${Math.random()}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('기본 키워드는 처음 한 번만 들어간다', async () => {
    await ensureKeywordSeed(db)
    await ensureKeywordSeed(db)
    const n = Object.values(KEYWORD_SEED).flat().length
    expect(await db.keywords.count()).toBe(n)
    expect(n).toBeGreaterThanOrEqual(20)
    expect(n).toBeLessThanOrEqual(30)
  })

  it('여러 명 한꺼번에 기록 → 되돌리기', async () => {
    const ids = await addRecords(db, {
      schoolYear: 2026, studentIds: ['a', 'b', 'c'], date: '2026-04-01', type: 'unprepared', category: '체육복',
    })
    expect(await db.records.count()).toBe(3)
    await undo(db, { recordIds: ids, absenceIds: [], absenceBefore: [] })
    expect(await db.records.count()).toBe(0)
  })

  it('메모는 앞뒤 공백을 지우고, 비어 있으면 저장하지 않는다', async () => {
    const [id1] = await addRecords(db, { schoolYear: 2026, studentIds: ['a'], date: '2026-04-01', type: 'observation', category: '관찰', note: '  공 정리 ' })
    const [id2] = await addRecords(db, { schoolYear: 2026, studentIds: ['a'], date: '2026-04-01', type: 'observation', category: '관찰', note: '  ' })
    expect((await db.records.get(id1))?.note).toBe('공 정리')
    expect((await db.records.get(id2))?.note).toBeUndefined()
  })

  it('견학: 같은 날 두 번 누르면 사유만 바뀌고, 되돌리면 원래 사유로', async () => {
    const first = await addAbsences(db, { schoolYear: 2026, studentIds: ['a'], date: '2026-04-01', reason: '부상' })
    const second = await addAbsences(db, { schoolYear: 2026, studentIds: ['a'], date: '2026-04-01', reason: '질병' })
    expect(await db.absences.count()).toBe(1)
    expect((await db.absences.get(first.added[0]))?.reason).toBe('질병')
    await undo(db, { recordIds: [], absenceIds: second.added, absenceBefore: second.updated })
    expect((await db.absences.get(first.added[0]))?.reason).toBe('부상')
  })

  it('부장 교체 저장', async () => {
    const base = { schoolYear: 2026, grade: 1, classNo: 3, role: '부장' as const }
    await applyCaptainChange(db, planCaptainChange([], { ...base, studentId: 'a', date: '2026-03-02' }, dayBefore))
    await applyCaptainChange(db, planCaptainChange(await db.captains.toArray(), { ...base, studentId: 'b', date: '2026-07-01' }, dayBefore))
    const all = (await db.captains.toArray()).sort((x, y) => x.from.localeCompare(y.from))
    expect(all.map((c) => [c.studentId, c.from, c.to])).toEqual([
      ['a', '2026-03-02', '2026-06-30'],
      ['b', '2026-07-01', undefined],
    ])
  })
})
