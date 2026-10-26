import { describe, expect, it } from 'vitest'
import fs from 'fs'
import data from './fixtures/comcigan-data.json'
import { cp949Percent, dataPath, findTeacher, myPicks, parseData, parseSearch, parseStPage, peGrid, peTeacherNos, searchPath, teacherLessons } from '../src/lib/comcigan'

// 컴시간 실제 응답(2026-10-26, 한 고등학교)을 교사 이름 · 학교 이름만 가려 저장한 자료
const st = fs.readFileSync('tests/fixtures/comcigan-st.txt', 'utf8')
const d = parseData(data)

describe('컴시간 코드 · 주소', () => {
  it('첫 화면에서 경로 코드를 뽑는다', () => {
    expect(parseStPage(st)).toEqual({ route: '36179', searchPrefix: '17384l', scPrefix: '73629_', r: '1' })
  })
  it('학교 이름은 CP949로, 자료 주소는 base64로', () => {
    expect(cp949Percent('삼성여자')).toBe('%bb%ef%bc%ba%bf%a9%c0%da')
    const cfg = parseStPage(st)
    expect(searchPath(cfg, '삼성여자')).toBe('/36179?17384l%bb%ef%bc%ba%bf%a9%c0%da')
    expect(dataPath(cfg, 15095)).toBe(`/36179?${btoa('73629_15095_0_1')}`)
    expect(dataPath(cfg, 15095, 2)).toBe(`/36179?${btoa('73629_15095_0_2')}`)
  })
  it('학교 찾기 결과', () => {
    expect(parseSearch({ 학교검색: [[24966, '제주', '시연고등학교', 15095]] })).toEqual([{ code: 15095, region: '제주', name: '시연고등학교' }])
  })
})

describe('컴시간 시간표 해석', () => {
  it('학교 정보 · 교사 · 학급 시간표', () => {
    expect(d.school).toBe('시연고등학교')
    expect(d.teachers.length - 1).toBe(48)
    expect(d.classCount.slice(1)).toEqual([7, 9, 9])
    expect(d.periodTimes[0]).toBe('1(08:20)')
    // 1학년 2반 월요일 1교시 = 과목 1, 교사 1
    const l = d.lessons.find((x) => x.grade === 1 && x.classNo === 2 && x.day === 1 && x.period === 1)!
    expect(l).toMatchObject({ teacherNo: 1, teacher: '교사01' })
  })
  it('바뀐 수업(>) 표시 · 강의실', () => {
    expect(d.lessons.some((x) => x.changed)).toBe(true)
    expect(d.lessons.some((x) => x.room === '체육관')).toBe(true)
  })
  it('교사 시간표: 학급 시간표에서 그 교사 칸만, 교사 시간표(자료542)와 같은 칸', () => {
    const mine = teacherLessons(d, 27)
    expect(mine.length).toBeGreaterThan(10)
    expect(mine.every((x) => x.teacherNo === 27)).toBe(true)
    // 자료542: 교사 27 월요일 2교시 = 과목 22 · 1학년 1반
    expect(mine.find((x) => x.day === 1 && x.period === 2)).toMatchObject({ grade: 1, classNo: 1, subject: '체육' })
  })
  it('이름으로 교사 찾기 · 체육 교사 · 체육 칸 표', () => {
    expect(findTeacher(d, '교사 27')).toEqual([27])
    expect(findTeacher(d, '없는이름')).toEqual([])
    const pe = peTeacherNos(d)
    expect(pe).toEqual(expect.arrayContaining([27, 28]))
    const grid = peGrid(d, pe)
    const c = grid.get('1|2')!
    expect(c.items.some((x) => x.teacherNo === 27 && x.classes.includes('1-1'))).toBe(true)
  })
})

describe('내 수업 · 가린 이름', () => {
  it('*로 가린 이름도 찾는다', () => {
    expect(findTeacher({ teachers: ['', '김*수', '박민수'] }, '김민수')).toEqual([1])
    expect(findTeacher({ teachers: ['', '김*수', '박민수'] }, '박민수')).toEqual([2])
    expect(findTeacher({ teachers: ['', '김*수'] }, '김수')).toEqual([])
  })
  it('내 수업 → 시간표 넣기 꼴(요일 · 교시마다 하나)', () => {
    const picks = myPicks(d, 27)
    const keys = picks.map((p) => `${p.day}|${p.period}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(picks.find((p) => p.day === 1 && p.period === 2)).toEqual({ day: 1, period: 2, subject: '체육', classes: [{ grade: 1, classNo: 1 }] })
  })
})
