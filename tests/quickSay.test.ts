import { describe, expect, it } from 'vitest'
import { actionLabel, parseSay, type SayMember } from '../src/lib/quickSay'

const members: SayMember[] = [
  { id: 'a', no: '3', name: '김가람' },
  { id: 'b', no: '5', name: '이나래' },
  { id: 'c', no: '7', name: '박다솜' },
  { id: 'd', no: '12', name: '최가람' },
  { id: 'e', no: '13', name: '정마루' },
]
const items = [
  { type: 'unprepared' as const, label: '체육복' },
  { type: 'unprepared' as const, label: '실내화' },
  { type: 'exemplary' as const, label: '정리정돈' },
  { type: 'exemplary' as const, label: '친구 도움' },
  { type: 'exemplary' as const, label: '적극 참여' },
  { type: 'unprepared' as const, label: '정리 안 함' },
]
const read = (t: string) => parseSay(t, members, items)
const ok = (t: string) => {
  const r = read(t)
  if (!r.ok) throw new Error(r.error)
  return { who: r.students.map((s) => s.no).join(','), what: actionLabel(r.action) }
}
const err = (t: string) => {
  const r = read(t)
  return r.ok ? '' : r.error
}

describe('빠른 입력 읽기', () => {
  it('번호 여러 개 + 항목', () => {
    expect(ok('3 7 체육복')).toEqual({ who: '3,7', what: '지도 · 체육복' })
    expect(ok('7번, 3번 실내화')).toEqual({ who: '3,7', what: '지도 · 실내화' })
    expect(ok('5 친구도움')).toEqual({ who: '5', what: '칭찬 · 친구 도움' })
    expect(ok('5 적극')).toEqual({ who: '5', what: '칭찬 · 적극 참여' })
  })
  it('번호 범위: 빈 번호는 건너뜀', () => {
    expect(ok('3~7 체육복').who).toBe('3,5,7')
    expect(ok('12-13 지각')).toEqual({ who: '12,13', what: '출결 · 지각' })
  })
  it('출결 · 견학', () => {
    expect(ok('5 결석').what).toBe('출결 · 결석')
    expect(ok('12 견학 부상').what).toBe('견학 · 부상')
    expect(ok('12 견학').what).toBe('견학 · 기타')
  })
  it('이름: 성 빼고도, 같은 이름이면 번호로', () => {
    expect(ok('이나래 조퇴').who).toBe('5')
    expect(ok('다솜 마루 결과')).toEqual({ who: '7,13', what: '출결 · 결과' })
    expect(err('가람 지각')).toContain('2명')
  })
  it('앞부분이 겹치는 항목 · 양쪽에 있는 항목은 되묻는다', () => {
    expect(err('3 정리')).toContain('양쪽')
    expect(ok('3 칭찬 정리').what).toBe('칭찬 · 정리정돈')
    expect(ok('3 지도 정리').what).toBe('지도 · 정리 안 함')
  })
  it('못 읽는 글은 저장하지 않게 오류로', () => {
    expect(err('')).toContain('예:')
    expect(err('99 체육복')).toContain('99번')
    expect(err('3 7')).toContain('무엇을')
    expect(err('체육복')).toContain('학생')
    expect(err('3 체육복 지각')).toContain('하나만')
    expect(err('3 홍길동 체육복')).toContain('홍길동')
  })
})
