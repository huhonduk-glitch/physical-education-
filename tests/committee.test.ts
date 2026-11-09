import { describe, expect, it } from 'vitest'
import { memberProblems, minutesText, noticeBy, passed, passNeeded, quorum, semesterOf, yearStatus, type CommitteeMeeting, type CommitteeMember } from '../src/lib/committee'

const mem = (id: string, kind: CommitteeMember['kind'], post?: CommitteeMember['post']): CommitteeMember => ({ id, name: `위원${id}`, role: kind === '외부' ? '지역 체육회' : '교사', kind, ...(post ? { post } : {}) })
const meet = (p: Partial<CommitteeMeeting>): CommitteeMeeting => ({ id: 'm', kind: '1학기 정기', date: '2026-04-10', time: '16:00', place: '회의실', present: [], agenda: [], note: '', ...p })

describe('학교체육소위원회 (규정 예시 제5조)', () => {
  it('성원 = 재적 과반수, 의결 = 출석 3분의 2 이상', () => {
    expect(quorum(7, 4)).toEqual({ needed: 4, ok: true })
    expect(quorum(7, 3).ok).toBe(false)
    expect(quorum(6, 4)).toEqual({ needed: 4, ok: true })
    expect(quorum(0, 0).ok).toBe(false)
    expect([passNeeded(6), passNeeded(5), passNeeded(4)]).toEqual([4, 4, 3])
    expect(passed({ title: '', body: '', decision: '원안 가결', yes: 4, no: 1 }, 5)).toBe(true)
    expect(passed({ title: '', body: '', decision: '부결', yes: 3, no: 2 }, 5)).toBe(false)
    expect(passed({ title: '', body: '', decision: '보고(의결 없음)' }, 5)).toBeNull()
  })
  it('안건 통보 기한 = 회의 5일 전', () => {
    expect(noticeBy('2026-04-10')).toBe('2026-04-05')
  })
  it('학기별 정기회의 현황 (연 2회 의무, 서면결의는 회의로 안 셈)', () => {
    expect([semesterOf('2026-04-10', 2026), semesterOf('2026-09-01', 2026), semesterOf('2027-02-10', 2026), semesterOf('2026-02-10', 2026)]).toEqual([1, 2, 2, null])
    const st = yearStatus([meet({ date: '2026-04-10' }), meet({ id: 'w', kind: '서면결의', date: '2026-10-01' })], 2026)
    expect(st.map((x) => [x.sem, x.ok])).toEqual([
      [1, true],
      [2, false],
    ])
  })
  it('위원 구성 점검 (5~7명 · 외부위원 · 위원장 · 간사)', () => {
    expect(memberProblems([mem('1', '당연직')])).toHaveLength(4)
    const ok = [mem('1', '당연직', '부위원장'), mem('2', '당연직', '간사'), mem('3', '위촉', '위원장'), mem('4', '위촉'), mem('5', '외부')]
    expect(memberProblems(ok)).toEqual([])
  })
  it('회의록 글: 참석 · 성원 · 의결 기준 · 안건 결과', () => {
    const ms = [mem('1', '당연직', '부위원장'), mem('2', '당연직', '간사'), mem('3', '위촉', '위원장'), mem('4', '위촉'), mem('5', '외부')]
    const t = minutesText(meet({ present: ['1', '2', '3', '5'], agenda: [{ title: '학교스포츠클럽 조직', body: '6개 클럽', decision: '원안 가결', yes: 4, no: 0 }] }), ms, '시연고')
    expect(t).toContain('재적 5명 중 4명 출석 — 과반수 출석으로 개의')
    expect(t).toContain('출석 위원 3분의 2 이상(3명) 찬성')
    expect(t).toContain('안건 1. 학교스포츠클럽 조직')
    expect(t).toContain('결과: 원안 가결 (찬성 4 · 반대 0)')
    expect(t).toContain('불참: 위원4')
  })
})
