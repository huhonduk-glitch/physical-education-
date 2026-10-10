import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { PeDatabase } from '../src/db/db'
import { applyNeisTimetable } from '../src/db/neisRepo'
import type { Student } from '../src/db/types'
import { describe, expect, it } from 'vitest'
import {
  fetchAll,
  fetchWeekTimetable,
  looksLikePe,
  dday,
  neisUrl,
  parseNeis,
  slotGroups,
  toEvent,
  toLesson,
  upcomingEvents,
  weekOf,
  type NeisSchool,
} from '../src/lib/neisOpenApi'

/** 실제 나이스 응답과 같은 모양 (값은 꾸민 것) */
const ok = (service: string, total: number, rows: Record<string, string>[]) => ({
  [service]: [{ head: [{ list_total_count: total }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] }, { row: rows }],
})
const tt = (ymd: string, grade: string, cls: string, perio: string, subject: string) => ({ ALL_TI_YMD: ymd, GRADE: grade, CLASS_NM: cls, PERIO: perio, ITRT_CNTNT: subject })
const school: NeisSchool = { officeCode: 'X10', officeName: '교육청', schoolCode: '1234567', name: '가나고등학교', kind: '고', address: '' }

describe('나이스 공개 API', () => {
  it('응답 읽기: 정상 · 자료 없음 · 오류', () => {
    expect(parseNeis(ok('classInfo', 2, [{ GRADE: '1' }]), 'classInfo')).toEqual({ rows: [{ GRADE: '1' }], total: 2 })
    expect(parseNeis({ RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } }, 'classInfo')).toEqual({ rows: [], total: 0 })
    expect(() => parseNeis({ RESULT: { CODE: 'ERROR-290', MESSAGE: 'x' } }, 'classInfo')).toThrow(/인증키/)
    expect(() => parseNeis({ foo: 1 }, 'classInfo')).toThrow()
  })
  it('주소: 인증키가 있을 때만 KEY, 빈 값은 빼기', () => {
    expect(neisUrl('classInfo', { AY: 2026, GRADE: undefined }, '')).toBe('https://open.neis.go.kr/hub/classInfo?Type=json&AY=2026')
    expect(neisUrl('classInfo', { AY: 2026 }, ' abc ')).toContain('KEY=abc')
  })
  it('시간표 한 줄 → 요일·교시·과목', () => {
    expect(toLesson(tt('20261012', '2', '3', '4', '-운동과 건강 '))).toEqual({ date: '2026-10-12', day: 1, grade: 2, classNo: 3, className: '3', period: 4, subject: '운동과 건강' })
  })
  it('학사일정: 해당 학년', () => {
    expect(toEvent({ AA_YMD: '20261001', EVENT_NM: '중간고사', ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'N', THREE_GRADE_EVENT_YN: 'Y', FR_GRADE_EVENT_YN: '*' })).toEqual({
      date: '2026-10-01',
      name: '중간고사',
      grades: [1, 3],
    })
  })
  it('체육 과목 추천', () => {
    for (const s of ['체육', '운동과 건강', '스포츠 생활1', '스포츠 과학', '체육 탐구', '스포츠 문화']) expect(looksLikePe(s)).toBe(true)
    for (const s of ['국어', '화학2', '수학']) expect(looksLikePe(s)).toBe(false)
  })
  it('요일·교시·과목으로 묶기 (합반은 한 칸에 여러 반, 같은 요일 다른 주는 합침)', () => {
    const g = slotGroups(
      [
        tt('20261012', '1', '1', '3', '운동과 건강'),
        tt('20261012', '1', '2', '3', '운동과 건강'),
        tt('20261012', '1', '1', '4', '국어'),
        tt('20261019', '1', '1', '3', '운동과 건강'),
        tt('20261013', '2', '5', '1', '스포츠 생활1'),
        tt('20261017', '2', '5', '1', '체육'), // 토요일 → 뺌
      ].map(toLesson),
      looksLikePe,
    )
    expect(g.map((x) => [x.day, x.period, x.subject, x.classes.map((c) => `${c.grade}-${c.classNo}`).join(',')])).toEqual([
      [1, 3, '운동과 건강', '1-1,1-2'],
      [2, 1, '스포츠 생활1', '2-5'],
    ])
  })
  it('그 주 월~금', () => {
    expect(weekOf('2026-10-14')).toEqual(['2026-10-12', '2026-10-16'])
    expect(weekOf('2026-10-18')).toEqual(['2026-10-12', '2026-10-16'])
    expect(weekOf('2026-10-12')).toEqual(['2026-10-12', '2026-10-16'])
  })
  it('인증키가 없으면 맛보기 5줄뿐: 더 있으면 인증키를 달라고 하고, 학교 찾기는 5줄로 보여 준다', async () => {
    const sample = Array.from({ length: 5 }, (_, i) => ({ N: String(i) }))
    const fetcher = async () => ok('classInfo', 12, sample)
    await expect(fetchAll('classInfo', { AY: 2026 }, { fetcher })).rejects.toThrow(/인증키/)
    expect(await fetchAll('classInfo', { AY: 2026 }, { fetcher, allowPartial: true })).toHaveLength(5)
    expect(await fetchAll('classInfo', { AY: 2026 }, { fetcher: async () => ok('classInfo', 3, sample.slice(0, 3)) })).toHaveLength(3)
  })
  it('인증키가 있으면 1000줄씩 쪽을 넘겨 모두 받는다', async () => {
    const all = Array.from({ length: 2300 }, (_, i) => ({ N: String(i) }))
    const urls: string[] = []
    const rows = await fetchAll('classInfo', { AY: 2026 }, {
      key: 'k',
      fetcher: async (url) => {
        urls.push(url)
        const p = Number(new URL(url).searchParams.get('pIndex'))
        return ok('classInfo', 2300, all.slice((p - 1) * 1000, p * 1000))
      },
    })
    expect(rows.map((r) => r.N)).toEqual(all.map((r) => r.N))
    expect(urls).toHaveLength(3)
    expect(urls.every((u) => u.includes('pSize=1000') && u.includes('KEY=k'))).toBe(true)
  })
  it('인증키 있으면 1000줄씩, 시간표는 고등학교 서비스로 그 주를 받는다', async () => {
    let seen = ''
    const l = await fetchWeekTimetable(school, '2026-10-14', {
      key: 'k',
      fetcher: async (url) => {
        seen = url
        return ok('hisTimetable', 1, [tt('20261014', '1', '1', '2', '체육')])
      },
    })
    expect(seen).toContain('hisTimetable?')
    expect(seen).toContain('pSize=1000')
    expect(seen).toContain('TI_FROM_YMD=20261012')
    expect(seen).toContain('TI_TO_YMD=20261016')
    expect(seen).not.toMatch(/학생|STUDENT/i)
    expect(l[0]).toMatchObject({ day: 3, period: 2, subject: '체육' })
  })
})


describe('나이스 시간표 → 수업반 · 시간표', () => {
  it('반 하나는 학적반, 여러 반은 합반 수강반, 고르지 않은 칸은 비우기/남기기', async () => {
    const name = 'test-neis-apply'
    const db = new PeDatabase(name)
    const st = (grade: number, classNo: number, number: number): Student => ({
      id: `${grade}${classNo}${number}`, schoolYear: 2026, grade, classNo, classCode: '01', number, name: `학생${number}`, gender: 'M',
      studentCode: `${grade}${String(classNo).padStart(2, '0')}${String(number).padStart(2, '0')}`, status: '재학', memo: '',
    })
    await db.students.bulkAdd([st(1, 1, 1), st(1, 1, 2), st(1, 2, 1), st(2, 1, 1)])
    await db.groups.add({ id: 'old', schoolYear: 2026, semester: 0, kind: 'homeroom', name: '1학년 1반', subject: '체육', grade: 1, classNo: 1, memberIds: [], color: 'blue', sortOrder: 0, archived: false, createdAt: 0 })
    const current = [{ day: 5, period: 7, groupId: 'old' }, { day: 1, period: 1, groupId: 'old' }]
    const r = await applyNeisTimetable(db, {
      schoolYear: 2026,
      current,
      replaceAll: false,
      picks: [
        { day: 1, period: 1, subject: '운동과 건강', classes: [{ grade: 1, classNo: 1 }] },
        { day: 2, period: 3, subject: '스포츠 생활1', classes: [{ grade: 1, classNo: 2 }, { grade: 1, classNo: 1 }] },
        { day: 3, period: 2, subject: '체육', classes: [{ grade: 2, classNo: 1 }] },
      ],
    })
    const groups = await db.groups.toArray()
    expect(r.createdHomerooms).toBe(1)
    expect(r.createdElectives).toEqual(['스포츠 생활1 1-1·1-2'])
    expect(groups.find((g) => g.id === 'old')?.subject).toBe('운동과 건강')
    const el = groups.find((g) => g.kind === 'elective')!
    expect(el.memberIds.sort()).toEqual(['111', '112', '121'])
    expect(r.timetable.map((e) => `${e.day}-${e.period}`)).toEqual(['1-1', '2-3', '3-2', '5-7'])
    const again = await applyNeisTimetable(db, { schoolYear: 2026, current: r.timetable, replaceAll: true, picks: [{ day: 2, period: 3, subject: '스포츠 생활1', classes: [{ grade: 1, classNo: 1 }, { grade: 1, classNo: 2 }] }] })
    expect(again.createdElectives).toEqual([])
    expect(again.timetable).toEqual([{ day: 2, period: 3, groupId: el.id }])
    db.close()
    await Dexie.delete(name)
  })
})

describe('홈 학사일정', () => {
  it('3주 안, 같은 이름은 한 번', () => {
    const ev = [
      { date: '2026-10-05', name: '개교기념일', grades: [] },
      { date: '2026-10-12', name: '중간고사', grades: [1, 2, 3] },
      { date: '2026-10-13', name: '중간고사', grades: [1, 2, 3] },
      { date: '2026-10-20', name: '체육대회', grades: [] },
      { date: '2026-12-20', name: '방학', grades: [] },
    ]
    expect(upcomingEvents(ev, '2026-10-10').map((e) => e.name)).toEqual(['중간고사', '체육대회'])
    expect(dday('2026-10-12', '2026-10-10')).toBe('D-2')
    expect(dday('2026-10-10', '2026-10-10')).toBe('오늘')
  })
})
