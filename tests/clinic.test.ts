import { describe, expect, it } from 'vitest'
import { changeSummary, presentCount, toggleMember, type ClinicChange } from '../src/lib/clinic'
import type { StudentPaps } from '../src/lib/paps'

const p = (total: number, grade: number, complete = true): StudentPaps => ({ factors: [] as unknown as StudentPaps['factors'], sum: total, complete, total: complete ? total : null, grade: complete ? grade : null, avgGrade: null })
const c = (id: string, first: StudentPaps | null, latest: StudentPaps | null, latestRound = 2): ClinicChange => ({ studentId: id, first, latest, latestRound })

describe('건강체력교실 운영', () => {
  it('참여 횟수', () => {
    const m = presentCount([
      { id: '1', date: '2026-05-01', activity: '줄넘기', present: ['a', 'b'] },
      { id: '2', date: '2026-05-08', activity: '걷기', present: ['a'] },
    ])
    expect([m.get('a'), m.get('b'), m.get('c')]).toEqual([2, 1, undefined])
  })
  it('변화 분석: 다시 측정한 학생만, 4·5등급 → 3등급 이상은 저체력 벗어남', () => {
    const s = changeSummary([
      c('a', p(30, 4), p(45, 3)), // +15, 벗어남
      c('b', p(15, 5), p(18, 5)), // +3
      c('c', p(35, 4), p(30, 4)), // −5
      c('d', p(30, 4), p(30, 4), 1), // 아직 다시 측정 안 함
      c('e', p(30, 4), p(10, 5, false)), // 미완료 → 비교 안 함
    ])
    expect(s).toEqual({ compared: 3, up: 2, same: 0, down: 1, avgDelta: 4.3, leftLow: 1, notRemeasured: 1 })
  })
  it('참여 학생 넣기 · 빼기', () => {
    const a = toggleMember([], { studentId: 'a', why: '종합 4등급' })
    expect(toggleMember(a, { studentId: 'b', why: '참여 희망' }).map((x) => x.studentId)).toEqual(['a', 'b'])
    expect(toggleMember(a, { studentId: 'a', why: '' })).toEqual([])
  })
})
