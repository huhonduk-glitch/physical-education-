import { describe, expect, it } from 'vitest'
import { basisOf } from '../src/db/seteukLevelRepo'
import type { Assessment, AssessmentScore, ClassGroup, ClassRecord, Student } from '../src/db/types'
import { partsForLevel } from '../src/lib/seteukDraft'
import { aiEvidence } from '../src/pages/seteuk/seteukShared'

const s: Student = { id: 's1', schoolYear: 2026, grade: 1, classNo: 1, classCode: '01', number: 1, name: '김가명', gender: 'F', studentCode: '10101', status: '재학', memo: '' }
const g: ClassGroup = { id: 'g1', schoolYear: 2026, semester: 0, kind: 'homeroom', name: '1학년 1반', subject: '체육', grade: 1, classNo: 1, memberIds: [], color: 'blue', sortOrder: 0, archived: false, createdAt: 0 } as ClassGroup
const rec = (id: string, type: ClassRecord['type'], category: string, note?: string, groupId = 'g1'): ClassRecord => ({ id, schoolYear: 2026, studentId: 's1', date: `2026-09-0${id.length}`, type, category, note, keywordIds: [], groupId, createdAt: 0, updatedAt: 0 })
const a: Assessment = {
  id: 'a1', schoolYear: 2026, title: '배드민턴', grade: 1, rubric: [], altTaskEnabled: false, groupIds: ['g1'],
  items: [{ id: 'i1', label: '기능', method: 'level', levels: [{ label: 'A', points: 10, desc: '하이클리어를 정확한 자세로 수행함' }, { label: 'B', points: 6 }] }, { id: 'i2', label: '태도', method: 'direct', max: 10 }],
}
const sc: AssessmentScore = { id: 'x', assessmentId: 'a1', studentId: 's1', scores: { i1: 'A', i2: 6 }, note: '김가명이 박라마에게 서브를 알려 줌' }

describe('세특 근거 모으기', () => {
  const b = basisOf(s, {
    group: g, year: 2026, keywords: [], assessments: [a], scores: [sc], captains: [], groups: [g], paps: 2,
    records: [rec('r1', 'exemplary', '친구 도움', '모둠 연습을 이끎'), rec('r22', 'exemplary', '친구 도움'), rec('r333', 'unprepared', '체육복'), rec('r4444', 'observation', '관찰', '다른 반 기록', 'g2')],
  })
  it('수행평가 비율 · 칭찬 · 메모 · 지도 · PAPS', () => {
    expect(b.signals.assess).toBeCloseTo(16 / 20)
    expect(b.signals).toMatchObject({ praise: 2, notes: 1, guide: 1, paps: 2 })
  })
  it('다른 수업반 기록과 지도 기록은 근거에 없음, 등급 기준 문장은 있음', () => {
    expect(b.evidence.map((e) => e.id)).toEqual(['r1', 'note:a1'])
    expect(b.parts.map((p) => p.kind)).toEqual(['praise', 'note', 'assess'])
    expect(b.parts.find((p) => p.kind === 'assess')?.text).toContain('하이클리어를 정확한 자세로 수행함')
  })
  it('수준 틀 문장 수 · 중요 먼저 · 빼기', () => {
    expect(partsForLevel(b.parts, { maxParts: 1, important: ['assess:a1:i1'] }).map((p) => p.kind)).toEqual(['assess'])
    expect(partsForLevel(b.parts, { maxParts: 5, excluded: ['praise'] }).map((p) => p.kind)).toEqual(['note', 'assess'])
  })
  it('AI 근거: 이름 가림 · 중요 표시 · 뺀 것 제외', () => {
    const ev = aiEvidence(b, { important: ['r1'], excluded: ['praise'], names: ['김가명', '박라마'] })
    expect(ev.join('\n')).not.toMatch(/김가명|박라마|가명/)
    expect(ev.some((l) => l.startsWith('(중요) ') && l.includes('모둠 연습을 이끎'))).toBe(true)
    expect(ev.some((l) => l.includes('꾸준히 모범'))).toBe(false)
  })
})

import { checkSeteuk } from '../src/lib/seteukCheck'
import { draftParts, draftText } from '../src/lib/seteukDraft'
describe('틀 초안은 앱 검사기에 걸리지 않음', () => {
  it('칭찬 여러 항목 · 부장 활동을 쉼표로 이음', () => {
    const r = (id: string, type: ClassRecord['type'], category: string): ClassRecord => ({ id, schoolYear: 2026, studentId: 's1', date: '2026-09-01', type, category, keywordIds: [], createdAt: 0, updatedAt: 0 })
    const t = draftText(draftParts({ records: [r('1', 'exemplary', '안전 지킴'), r('2', 'exemplary', '안전 지킴'), r('3', 'exemplary', '적극 참여'), r('4', 'exemplary', '적극 참여'), r('5', 'captain', '출석 확인'), r('6', 'captain', '교구 준비')], keywords: [], assessments: [], captainRoles: ['부장'] }))
    expect(t).toContain('안전 지킴, 적극 참여')
    expect(checkSeteuk(t).filter((h) => h.id === 'symbol')).toEqual([])
  })
})
