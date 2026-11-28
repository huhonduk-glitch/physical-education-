import { describe, expect, it } from 'vitest'
import { readObservations } from '../src/lib/observePaste'

const members = [
  { id: 'a', no: '1', studentCode: '10101', name: '학생가' },
  { id: 'b', no: '2', studentCode: '10102', name: '학생나' },
  { id: 'c', no: '3', studentCode: '10103', name: '학생나' }, // 같은 이름
]

describe('관찰 메모 한꺼번에 넣기', () => {
  it('엑셀 · 시트에서 복사한 줄(탭): 머리글 건너뜀 · 학번 · 번호 · 이름', () => {
    const r = readObservations('학번\t이름\t내용\n10101\t학생가\t모둠 활동에서 역할을 나눔\n2\t학생나\t시범을 자원함', members)
    expect(r.items).toEqual([
      { studentId: 'a', text: '모둠 활동에서 역할을 나눔', who: '1 학생가' },
      { studentId: 'b', text: '시범을 자원함', who: '2 학생나' },
    ])
    expect(r.problems).toEqual([])
  })
  it('띄어 쓴 줄 · 이름만(한 명일 때) · 같은 이름 · 번호와 이름이 다름 · 못 찾음', () => {
    const r = readObservations('3. 학생나 경기 규칙을 친구에게 설명함\n학생가 준비운동을 이끌어 줌\n학생나 이름만 적음\n1 학생나 번호 이름 다름\n99 없는 학생 내용', members)
    expect(r.items.map((x) => [x.studentId, x.text])).toEqual([
      ['c', '경기 규칙을 친구에게 설명함'],
      ['a', '준비운동을 이끌어 줌'],
    ])
    expect(r.problems).toHaveLength(3)
    expect(r.problems[0]).toContain('같은 이름이 2명')
    expect(r.problems[1]).toContain('1번은 학생가인데 이름이 학생나')
    expect(r.problems[2]).toContain('찾지 못함')
  })
})
