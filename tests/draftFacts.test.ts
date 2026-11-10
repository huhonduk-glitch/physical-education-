import { describe, expect, it } from 'vitest'
import { draftFacts, type FactsInput } from '../src/lib/draftFacts'
import type { Factor, StudentPaps } from '../src/lib/paps'
import type { SchoolPapsRow } from '../src/lib/schoolPaps'

const F: Factor[] = ['심폐지구력', '근력·근지구력', '유연성', '순발력', '비만']
const paps = (grade: number, total: number, bmi = '정상'): StudentPaps => ({
  factors: F.map((factor) => ({ factor, eventId: null, value: 1, band: { grade: factor === '비만' ? bmi : 3, points: 10, min: 0, max: 0 }, points: 10 })) as StudentPaps['factors'],
  sum: total,
  complete: true,
  total,
  grade,
  avgGrade: null,
})
let n = 0
const row = (grade: number, gender: 'M' | 'F', g: number, total: number, bmi = '정상'): SchoolPapsRow => ({ studentId: `s${++n}`, grade, classNo: 1, number: n, name: `학생${n}`, gender, paps: paps(g, total, bmi), excluded: false })
const base: FactsInput = {
  year: 2026,
  schoolLevel: '고',
  students: [
    { grade: 1, gender: 'F' },
    { grade: 1, gender: 'M' },
    { grade: 2, gender: 'F' },
  ],
  paps: [row(1, 'F', 4, 30), row(1, 'M', 2, 70), row(2, 'F', 2, 60, '고도비만')],
  lastPaps: [row(1, 'F', 5, 15), row(1, 'M', 3, 50)],
  rule: { lowGrades: [4, 5], obeseLabels: ['경도비만', '고도비만'] },
  configs: [
    { grade: 1, events: ['왕복오래달리기', '악력'] },
    { grade: 1, events: ['왕복오래달리기', '윗몸말아올리기'] },
  ],
  rounds: [
    { grade: 1, round: 1, date: '2026-03-20' },
    { grade: 2, round: 1, date: '2026-03-10' },
    { grade: 1, round: 2, date: '2026-10-01' },
  ],
}

describe('기안문 초안 현황 줄 (앱 자료만, 학생 이름 없음)', () => {
  it('여학생 계획: 여학생 수 · 학년별 · 여학생 PAPS (남학생과 비교)', () => {
    const t = draftFacts('girls', base).join('\n')
    expect(t).toContain('여학생 2명 (전체 3명)')
    expect(t).toContain('학년별: 고1 1명 · 고2 1명')
    expect(t).toContain('평균 종합점수 45점, 종합 4·5등급 1명(50%)')
    expect(t).toContain('남학생 평균 종합점수 70점')
    expect(t).not.toMatch(/학생\d/)
  })
  it('건강체력교실: 대상 후보 · 저체력 비율 · 작년', () => {
    const t = draftFacts('clinic', base).join('\n')
    expect(t).toContain('대상 후보 2명 (저체력 1명 · 비만 판정 1명')
    expect(t).toContain('학교 전체 저체력 비율 33.3%')
    expect(t).toContain('작년(2025) 저체력 비율 50%')
  })
  it('PAPS 계획: 대상 · 학년별 종목(겹치면 한 번) · 1회차 기간 · 작년 결과', () => {
    const t = draftFacts('paps', base).join('\n')
    expect(t).toContain('대상 3명 — 고1 2명 · 고2 1명')
    expect(t).toContain('고1 측정 종목: 왕복오래달리기, 악력, 윗몸말아올리기')
    expect(t).toContain('1회차(정시) 측정: 2026-03-10 ~ 2026-03-20')
    expect(t).toContain('작년(2025) 결과: 평균 종합점수 32.5점')
  })
  it('소위원회: 위원 구성 · 회의 안건', () => {
    const t = draftFacts('committee', {
      ...base,
      committee: {
        members: [
          { id: '1', name: '김교감', role: '교감', kind: '당연직', post: '부위원장' },
          { id: '2', name: '정외부', role: '지역 체육회', kind: '외부' },
        ],
        meetings: [{ id: 'm', kind: '1학기 정기', date: '2026-04-10', time: '16:00', place: '', present: [], agenda: [{ title: '학교스포츠클럽 조직', body: '', decision: '원안 가결' }], note: '' }],
      },
    }).join('\n')
    expect(t).toContain('위원 2명 (당연직 1 · 위촉 0 · 외부 1)')
    expect(t).toContain('김교감(부위원장 · 교감)')
    expect(t).toContain('2026-04-10 1학기 정기: 안건 학교스포츠클럽 조직')
  })
  it('자료가 없으면 아무 줄도 넣지 않음 (스포츠클럽 · 운동부는 앱에 자료 없음)', () => {
    expect(draftFacts('club-year', base)).toEqual([])
    expect(draftFacts('girls', { ...base, students: [], paps: [] })).toEqual([])
  })
})
