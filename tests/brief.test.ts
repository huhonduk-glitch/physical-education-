import { describe, expect, it } from 'vitest'
import { briefLines, briefLinks, briefText, type BriefInput } from '../src/lib/brief'

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
    expect(lines.map((l) => l.to)).toEqual(['/attend/neis', '/plans', '/more/assessments', '/work/calendar', '/more/backup'])
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
})
