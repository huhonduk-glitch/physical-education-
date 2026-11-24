import { describe, expect, it } from 'vitest'
import { briefLines, briefLinks, briefText, todoTiles, type BriefInput } from '../src/lib/brief'

const base: BriefInput = { lessons: [], nowHHMM: '08:00', pendingNeis: 0, behind: [], grading: [], events: [], backupDays: 1, hasStudents: true }

describe('땅콩이 오늘 브리핑', () => {
  it('알릴 것이 없으면 줄이 없고 인사만', () => {
    expect(briefLines(base)).toEqual([])
    expect(briefText([])).toContain('알려 드릴 게 없어요')
  })
  it('오늘 수업: 전부 · 남은 것 · 모두 마침', () => {
    const lessons = [
      { period: 2, start: '9:40', group: '1학년 2반' },
      { period: 5, start: '13:30', group: '2학년 1반' },
    ]
    expect(briefLines({ ...base, lessons })[0].text).toBe('오늘 수업 2시간: 2교시 1학년 2반 · 5교시 2학년 1반')
    expect(briefLines({ ...base, lessons, nowHHMM: '11:00' })[0].text).toBe('오늘 수업 2시간 가운데 1시간 남았어요: 5교시 2학년 1반')
    expect(briefLines({ ...base, lessons, nowHHMM: '15:00' })[0].text).toContain('모두 마쳤어요')
  })
  it('옮길 출결 · 진도 · 채점 · 업무 · 백업, 여럿이면 3개까지 + 외 N', () => {
    const lines = briefLines({
      ...base,
      pendingNeis: 4,
      behind: [
        { group: 'A', late: 3 },
        { group: 'B', late: 2 },
        { group: 'C', late: 1 },
        { group: 'D', late: 1 },
      ],
      grading: [{ title: '농구', left: 4 }],
      events: [{ title: 'PAPS 결과 제출', dday: 'D-3' }],
      backupDays: 9,
    })
    expect(lines.map((l) => l.to)).toEqual(['/attend/neis', '/plans', '/more/assessments', '/work/calendar', '/more/data'])
    expect(lines[0].text).toContain('4건')
    expect(lines[1].text).toBe('진도가 늦은 반: A(3차시), B(2차시), C(1차시) 외 1')
    expect(lines[4].text).toBe('백업한 지 9일 지났어요.')
    expect(briefText(lines).split('\n')).toHaveLength(6)
    expect(briefLinks(lines).map((l) => l.label)).toEqual(['옮길 출결', '진도표', '수행평가', '업무 달력', '백업'])
  })
  it('백업: 명렬이 없으면 말하지 않고, 한 번도 안 했으면 따로 말함', () => {
    expect(briefLines({ ...base, backupDays: null, hasStudents: false })).toEqual([])
    expect(briefLines({ ...base, backupDays: null })[0].text).toContain('한 번도')
    expect(briefLines({ ...base, backupDays: 6 })).toEqual([])
  })
  it('학생 이름을 받는 칸이 없다 (수 · 반 이름 · 평가 이름만)', () => {
    expect(Object.keys(base).sort()).toEqual(['backupDays', 'behind', 'events', 'grading', 'hasStudents', 'lessons', 'nowHHMM', 'pendingNeis'])
  })
  it('홈 처리할 일: 4칸 · 0도 보임 · 남은 채점은 합 · 늦은 반은 가장 늦은 차시', () => {
    const zero = todoTiles(base)
    expect(zero.map((t) => [t.id, t.value, t.to])).toEqual([
      ['neis', 0, '/attend/neis'],
      ['grading', 0, '/more/assessments'],
      ['behind', 0, '/plans'],
      ['events', 0, '/work/calendar'],
    ])
    expect(zero.map((t) => t.sub)).toEqual(['모두 옮겼어요', '채점 중인 평가 없음', '계획대로', '다가오는 일정 없음'])
    const t = todoTiles({
      ...base,
      pendingNeis: 3,
      grading: [{ title: '농구', left: 4 }, { title: '배구', left: 6 }],
      behind: [{ group: '1-1', late: 1 }, { group: '1-2', late: 3 }],
      events: [{ title: 'PAPS 마감', dday: 'D-2' }],
    })
    expect(t.map((x) => x.value)).toEqual([3, 10, 2, 1])
    expect(t.map((x) => x.sub)).toEqual(['수업 출결 → 나이스', '평가 2개', '가장 늦은 반 3차시', 'PAPS 마감 D-2'])
  })
})
