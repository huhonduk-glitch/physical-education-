import { describe, expect, it } from 'vitest'
import { deltaLabel, praiseSince, sumCounts, weekRanges, weeklySummary } from '../src/lib/weekly'

describe('주간 수업 요약', () => {
  it('이번 주 = 월요일 ~ 오늘, 지난주 = 같은 때(지난 월 ~ 7일 전)', () => {
    // 2026-11-11은 수요일
    expect(weekRanges('2026-11-11')).toEqual({ thisWeek: { from: '2026-11-09', to: '2026-11-11' }, lastWeek: { from: '2026-11-02', to: '2026-11-04' } })
    // 일요일이면 그 주 월요일부터
    expect(weekRanges('2026-11-15').thisWeek.from).toBe('2026-11-09')
    // 월요일이면 오늘 하루
    expect(weekRanges('2026-11-09')).toEqual({ thisWeek: { from: '2026-11-09', to: '2026-11-09' }, lastWeek: { from: '2026-11-02', to: '2026-11-02' } })
  })

  const g = { id: 'g1', name: '1학년 1반', memberIds: ['a', 'b', 'c'] }
  const base = { today: '2026-11-11', groups: [g] }

  it('반마다 칭찬 · 지도 · 견학 · 결석을 이번 주와 지난주로 센다 (다른 반 기록은 빼기)', () => {
    const s = weeklySummary({
      ...base,
      records: [
        { studentId: 'a', date: '2026-11-10', type: 'exemplary', groupId: 'g1' },
        { studentId: 'b', date: '2026-11-11', type: 'exemplary', groupId: 'g1' },
        { studentId: 'b', date: '2026-11-04', type: 'unprepared', groupId: 'g1' },
        { studentId: 'a', date: '2026-11-10', type: 'exemplary', groupId: 'other' },
        { studentId: 'a', date: '2026-10-20', type: 'exemplary', groupId: 'g1' }, // 지난주보다 전
      ],
      absences: [{ studentId: 'c', date: '2026-11-10', groupId: 'g1' }],
      attendance: [
        { studentId: 'c', date: '2026-11-03', status: 'absent', groupId: 'g1' },
        { studentId: 'c', date: '2026-11-10', status: 'late', groupId: 'g1' }, // 지각은 결석이 아님
      ],
    }).groups[0]
    expect(s.thisWeek).toEqual({ praise: 2, guide: 0, absence: 1, absent: 0 })
    expect(s.lastWeek).toEqual({ praise: 0, guide: 1, absence: 0, absent: 1 })
    expect(s.daysThisWeek).toBe(2)
  })

  it('지도가 쌓이는 학생: 최근 14일 3번 이상, 많은 순', () => {
    const r = (id: string, date: string) => ({ studentId: id, date, type: 'unprepared', groupId: 'g1' })
    const s = weeklySummary({
      ...base,
      records: [r('a', '2026-11-11'), r('a', '2026-11-05'), r('a', '2026-10-29'), r('b', '2026-11-11'), r('b', '2026-11-10'), r('b', '2026-10-20'), r('c', '2026-11-11'), r('c', '2026-11-10'), r('c', '2026-11-09'), r('c', '2026-11-02')],
      absences: [],
      attendance: [],
    }).groups[0]
    // a: 10-29는 14일 안(10-29 ~ 11-11) → 3번, b: 10-20은 밖 → 2번
    expect(s.guideRepeat).toEqual([
      { studentId: 'c', count: 4 },
      { studentId: 'a', count: 3 },
    ])
  })

  it('칭찬을 못 받은 학생: 최근 28일, 그 반에서 칭찬을 쓸 때만', () => {
    const none = weeklySummary({ ...base, records: [{ studentId: 'a', date: '2026-11-10', type: 'unprepared', groupId: 'g1' }], absences: [], attendance: [] }).groups[0]
    expect(none.noPraise).toEqual([]) // 칭찬 기록이 하나도 없으면 말하지 않음
    const s = weeklySummary({
      ...base,
      records: [
        { studentId: 'a', date: '2026-11-10', type: 'exemplary', groupId: 'g1' },
        { studentId: 'b', date: '2026-10-01', type: 'exemplary', groupId: 'g1' }, // 28일 밖
      ],
      absences: [],
      attendance: [],
    }).groups[0]
    expect(s.noPraise).toEqual(['b', 'c'])
  })

  it('칭찬 세기 시작: 이번 학기 시작, 학기 초 28일 안이면 최근 28일', () => {
    expect(praiseSince('2026-11-11')).toBe('2026-08-17')
    expect(praiseSince('2026-05-20')).toBe('2026-03-02')
    expect(praiseSince('2026-03-10')).toBe('2026-02-11') // 학기 시작 8일째 → 최근 28일
    expect(praiseSince('2027-01-20')).toBe('2026-08-17') // 겨울방학
    const s = weeklySummary({
      ...base,
      praiseFrom: '2026-09-01',
      records: [{ studentId: 'b', date: '2026-09-10', type: 'exemplary', groupId: 'g1' }],
      absences: [],
      attendance: [],
    }).groups[0]
    expect(s.noPraise).toEqual(['a', 'c'])
  })

  it('증감 글과 합계', () => {
    expect(deltaLabel(5, 2)).toBe('+3')
    expect(deltaLabel(1, 3)).toBe('−2')
    expect(deltaLabel(2, 2)).toBe('같음')
    expect(sumCounts([{ praise: 1, guide: 2, absence: 0, absent: 1 }, { praise: 3, guide: 0, absence: 1, absent: 0 }])).toEqual({ praise: 4, guide: 2, absence: 1, absent: 1 })
  })
})
