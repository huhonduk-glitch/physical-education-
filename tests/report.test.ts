import { describe, expect, it } from 'vitest'
import type { Assessment, ClassRecord, Keyword, Student } from '../src/db/types'
import { buildReport } from '../src/lib/report'
import { evidenceText, studentEvidence } from '../src/lib/seteuk'

const s: Student = { id: 's1', schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: 1, name: '학생가', gender: 'F', studentCode: '10101', status: '재학', memo: '' }
const kw: Keyword[] = [{ id: 'k1', label: '협동', category: '협동', isActive: true, sortOrder: 0 }]
const r = (type: ClassRecord['type'], category: string, o: Partial<ClassRecord> = {}): ClassRecord => ({ id: Math.random().toString(), schoolYear: 2026, studentId: 's1', date: '2026-03-02', type, category, keywordIds: [], createdAt: 0, updatedAt: 0, ...o })

describe('세특 모아보기', () => {
  it('메모·키워드 있는 기록과 수행평가 메모만, 지도 기록은 기본 제외', () => {
    const recs = [r('exemplary', '친구 도움', { keywordIds: ['k1'], date: '2026-03-05' }), r('exemplary', '정리정돈'), r('unprepared', '체육복', { note: '두 번째' }), r('observation', '관찰', { note: '패스를 먼저 시도함', date: '2026-03-03' })]
    const items = studentEvidence(recs, kw, [{ title: '농구', note: '팀원 격려' }, { title: '배구', note: ' ' }], { includeNegative: false })
    expect(items[0].text).toContain('관찰 — 패스를 먼저 시도함')
    expect(items[1].text).toContain('솔선수범(친구 도움) [협동]')
    expect(items[2].text).toBe('수행평가 「농구」 — 팀원 격려')
    expect(items).toHaveLength(3)
    expect(studentEvidence(recs, kw, [], { includeNegative: true })).toHaveLength(3)
    const txt = evidenceText('학생가', [{ label: '협동', count: 1 }], items)
    expect(txt.split('\n')[0]).toBe('[학생가]')
    expect(txt).toContain('키워드: 협동(1)')
    expect(txt).not.toMatch(/습니다|하였음|함\./)
  })
})

describe('학생 리포트', () => {
  it('횟수·상위 항목·키워드·수행평가 점수', () => {
    const a: Assessment = { id: 'a1', schoolYear: 2026, title: '농구', grade: 1, rubric: [], altTaskEnabled: false, groupIds: ['g'], items: [{ id: 'i', label: '기능', method: 'level', levels: [{ label: 'A', points: 10 }, { label: 'B', points: 8 }] }] }
    const rep = buildReport(s, {
      records: [r('exemplary', '친구 도움', { keywordIds: ['k1'] }), r('exemplary', '친구 도움'), r('unprepared', '체육복'), r('exemplary', '리더십', { studentId: 'other' })],
      absences: [
        { id: 'x', schoolYear: 2026, studentId: 's1', date: '2026-03-02', reason: '부상', altTaskDone: false },
        { id: 'y', schoolYear: 2026, studentId: 's1', date: '2026-03-02', reason: '부상', altTaskDone: false },
      ],
      captains: [{ id: 'c', schoolYear: 2026, grade: 1, classNo: 1, studentId: 's1', role: '부장', from: '2026-03-02' }],
      keywords: kw,
      assessments: [a],
      scores: [{ id: 'z', assessmentId: 'a1', studentId: 's1', scores: { i: 'B' } }],
      groups: [{ id: 'g', schoolYear: 2026, semester: 0, kind: 'homeroom', name: '1-1', subject: '체육', grade: 1, classNo: 1, memberIds: [], color: 'blue', sortOrder: 0, archived: false, createdAt: 0 }],
      paps: null,
      papsExcluded: false,
    })
    expect(rep).toMatchObject({ exemplary: 2, unprepared: 1, absent: 1, captain: ['부장'], keywords: [{ label: '협동', count: 1 }] })
    expect(rep.exemplaryTop).toEqual([{ category: '친구 도움', count: 2 }])
    expect(rep.assessments).toEqual([{ title: '농구', score: '8 / 10점', detail: '기능 B', complete: true }])
  })
})
