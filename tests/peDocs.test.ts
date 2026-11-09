import { describe, expect, it } from 'vitest'
import { DRAFT_DOCS, draftText, FORMS, mergeEvents, submitEvents, SUBMITS } from '../src/data/peDocs'
import { WORK_DOCS } from '../src/data/peWork'

describe('매년 기안 · 제출 문서 (운영방향 누리집 PDF)', () => {
  it('모든 문서에 근거 · 꼭 넣을 내용 · 쪽(자료 쪽수 안)이 있다', () => {
    const max = WORK_DOCS.final.pages
    for (const d of DRAFT_DOCS) {
      expect(d.basis.length).toBeGreaterThan(0)
      expect(d.include.length).toBeGreaterThan(0)
      for (const p of Array.isArray(d.page) ? d.page : [d.page]) expect(p).toBeGreaterThan(0), expect(p).toBeLessThanOrEqual(max)
    }
    expect(DRAFT_DOCS.map((d) => d.id)).toEqual(expect.arrayContaining(['girls', 'club-outside', 'club-year', 'clinic', 'committee']))
    // 교사 지적(11-09): 안전 연간계획 · 공간 확보 · 교구 확충은 따로 기안하는 필수 문서가 아님
    expect(DRAFT_DOCS.map((d) => d.id)).not.toEqual(expect.arrayContaining(['safety']))
    expect(DRAFT_DOCS.some((d) => ['safety', 'space', 'equipment'].includes(d.id))).toBe(false)
    for (const f of FORMS) if (f.page) expect(f.page).toBeLessThanOrEqual(max)
  })
  it('기안문 초안: 제목 · 관련 근거 · 세부 계획 빈칸, 학교 이름', () => {
    const t = draftText(DRAFT_DOCS.find((d) => d.id === 'girls')!, { schoolName: '시연고', year: 2026 })
    expect(t.split('\n')[0]).toBe('제목: 2026학년도 여학생 체육활동 활성화 계획')
    expect(t).toContain('1. 관련: 학교체육 진흥법 제13조의2')
    expect(t).toContain('  1) 수업 내: 체육수업 다양화')
    expect(t.trim().endsWith('시연고')).toBe(true)
  })
  it('제출 일정 → 업무 달력 (1~2월은 다음 해, 두 번 넣어도 한 번)', () => {
    const ev = submitEvents(2026)
    expect(ev.length).toBe(SUBMITS.reduce((n, s) => n + s.due.length, 0))
    expect(ev.find((e) => e.title.startsWith('학생건강체력평가 결과'))).toMatchObject({ date: '2026-05-29', kind: 'neis' })
    const once = mergeEvents([], ev)
    expect(mergeEvents(once.list, ev).added).toBe(0)
  })
})
