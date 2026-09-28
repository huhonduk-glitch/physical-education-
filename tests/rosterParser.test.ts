import { describe, expect, it } from 'vitest'
import { parsePastedRoster, type PasteContext } from '../src/lib/rosterParser'

const noClass: PasteContext = { grade: null, classNo: null }
const class13: PasteContext = { grade: 1, classNo: 3 }

function one(text: string, ctx = noClass) {
  const r = parsePastedRoster(text, ctx)
  expect(r.rows).toHaveLength(1)
  return r.rows[0]
}

const pick = (r: ReturnType<typeof one>) => ({
  grade: r.grade,
  classNo: r.classNo,
  number: r.number,
  name: r.name,
  gender: r.gender,
  problems: r.problems,
})

describe('붙여넣기 명렬 — CLAUDE.md 4-1-B 의 8가지 모양', () => {
  it('① 탭 구분: 1\\t3\\t12\\t홍길동\\t여', () => {
    expect(pick(one('1\t3\t12\t홍길동\t여'))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: 'F', problems: [],
    })
  })

  it('② 1학년 3반 12번 홍길동', () => {
    expect(pick(one('1학년 3반 12번 홍길동'))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('③ 1-3-12 홍길동', () => {
    expect(pick(one('1-3-12 홍길동'))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('④ 10312 홍길동 (학번)', () => {
    expect(pick(one('10312 홍길동'))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('⑤ 10312홍길동 (띄어쓰기 없음)', () => {
    expect(pick(one('10312홍길동'))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('⑥ 12 홍길동 (반을 먼저 고름)', () => {
    expect(pick(one('12 홍길동', class13))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('⑦ 12. 홍길동 (반을 먼저 고름)', () => {
    expect(pick(one('12. 홍길동', class13))).toEqual({
      grade: 1, classNo: 3, number: 12, name: '홍길동', gender: null, problems: [],
    })
  })

  it('⑧ 이름만 → 줄 순서대로 번호', () => {
    const r = parsePastedRoster('홍길동\n김철수\n\n이영희\n', class13)
    expect(r.rows.map((x) => [x.number, x.name, x.grade, x.classNo])).toEqual([
      [1, '홍길동', 1, 3],
      [2, '김철수', 1, 3],
      [3, '이영희', 1, 3],
    ])
    expect(r.rows.every((x) => x.problems.length === 0)).toBe(true)
  })
})

describe('붙여넣기 명렬 — 변형과 예외', () => {
  it('반을 고르지 않고 번호+이름만 넣으면 반을 고르라고 알린다', () => {
    const r = parsePastedRoster('12 홍길동', noClass)
    expect(r.needsClass).toBe(true)
    expect(r.rows[0].problems[0]).toContain('반을 먼저 골라')
  })

  it('이름만 넣고 반을 안 고르면 역시 알린다', () => {
    const r = parsePastedRoster('홍길동', noClass)
    expect(r.needsClass).toBe(true)
  })

  it('줄 안의 학년·반이 먼저 고른 반보다 우선한다', () => {
    const r = one('2-5-7 김하나', class13)
    expect([r.grade, r.classNo, r.number]).toEqual([2, 5, 7])
  })

  it('윈도우 줄바꿈(\\r\\n)과 앞뒤 공백을 견딘다', () => {
    const r = parsePastedRoster('  1-3-1 가나다  \r\n1-3-2 라마바\r\n', noClass)
    expect(r.rows.map((x) => [x.number, x.name])).toEqual([
      [1, '가나다'],
      [2, '라마바'],
    ])
  })

  it('성별 글자(남/여)를 읽는다', () => {
    expect(one('1-3-12 홍길동 남').gender).toBe('M')
    expect(one('12 홍길동 여', class13).gender).toBe('F')
  })

  it('나이스식 성별 코드(이름 뒤 1/2)를 읽는다', () => {
    expect(pick(one('1\t3\t12\t홍길동\t2'))).toMatchObject({ number: 12, name: '홍길동', gender: 'F' })
  })

  it('탭 구분 번호+이름(반을 먼저 고름)', () => {
    expect(pick(one('12\t홍길동', class13))).toMatchObject({ grade: 1, classNo: 3, number: 12, name: '홍길동' })
  })

  it('반+번호+이름 (학년만 먼저 고름)', () => {
    expect(pick(one('3 12 홍길동', { grade: 1, classNo: null }))).toMatchObject({
      grade: 1, classNo: 3, number: 12, name: '홍길동',
    })
  })

  it('12번 홍길동 도 된다', () => {
    expect(pick(one('12번 홍길동', class13))).toMatchObject({ number: 12, name: '홍길동' })
  })

  it('쉼표 구분도 된다', () => {
    expect(pick(one('1,3,12,홍길동'))).toMatchObject({ grade: 1, classNo: 3, number: 12, name: '홍길동' })
  })

  it('이름이 없으면 이름이 빈 줄로 남는다 (확인 단계에서 빨간색)', () => {
    expect(one('1-3-12').name).toBe('')
  })

  it('알 수 없는 긴 숫자는 문제로 표시한다', () => {
    expect(one('1234 홍길동', class13).problems.length).toBeGreaterThan(0)
  })

  it('첫 줄이 헤더면 표로 읽는다 (엑셀에서 헤더까지 복사)', () => {
    const r = parsePastedRoster('번호\t이름\t성별\n1\t가나다\t여\n2\t라마바\t남', class13)
    expect(r.mode).toBe('table')
    expect(r.rows.map((x) => [x.grade, x.classNo, x.number, x.name, x.gender])).toEqual([
      [1, 3, 1, '가나다', 'F'],
      [1, 3, 2, '라마바', 'M'],
    ])
  })

  it('나이스 명렬 헤더를 통째로 붙여넣어도 읽는다', () => {
    const text = [
      '학년도\t과정명\t계열명\t학년\t학과명\t반명\t반코드\t번호\t학생성명\t성별(남:1 여:2)\t생년월일',
      '2026\t주간\t일반계\t1\t일반학과\t1\t01\t1\t가나다\t2\t20550829',
    ].join('\n')
    const r = parsePastedRoster(text, noClass)
    expect(r.mode).toBe('table')
    expect(r.rows[0]).toMatchObject({ schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: 1, name: '가나다', gender: 'F' })
    expect(JSON.stringify(r.rows[0])).not.toContain('20550829')
  })

  it('빈 글자는 빈 결과', () => {
    expect(parsePastedRoster('\n\n  \n', class13).rows).toEqual([])
  })
})
