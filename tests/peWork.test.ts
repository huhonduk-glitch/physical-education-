import { describe, expect, it } from 'vitest'
import { WORK_DOCS, WORK_TOPICS, srcLabel, workTopic, type WorkSrc } from '../src/data/peWork'

const allSrcs = (): WorkSrc[] =>
  WORK_TOPICS.flatMap((t) => [
    ...t.calendar.map((c) => c.src),
    ...t.menus.flatMap((m) => [...m.steps, ...(m.tips ?? [])].map((s) => s.src)),
    ...t.rules.flatMap((r) => r.lines.map((l) => l.src)),
    ...t.forms.map((f) => f.src),
    ...(t.trainings ?? []).map((x) => x.src),
    ...(t.trainingNotes ?? []).map((x) => x.src),
    ...(t.formGroups ?? []).flatMap((g) => g.lines.map((l) => l.src)),
  ])

describe('학교체육 업무 안내 자료', () => {
  it('운동부 · 스포츠클럽 · 체육소위원회', () => {
    expect(WORK_TOPICS.map((t) => t.id)).toEqual(['team', 'club', 'committee'])
    expect(workTopic('committee')?.menus).toEqual([]) // 나이스에 소위원회 메뉴 없음 (교사 확인 2026-11-10)
    expect(workTopic('club')?.title).toBe('학교스포츠클럽')
    expect(workTopic('x')).toBeUndefined()
  })
  it('모든 줄에 출처 쪽이 있고 자료 쪽수 안', () => {
    const srcs = allSrcs()
    expect(srcs.length).toBeGreaterThan(60)
    for (const s of srcs) {
      const pages = Array.isArray(s.page) ? s.page : [s.page]
      for (const p of pages) {
        expect(p).toBeGreaterThanOrEqual(1)
        expect(p).toBeLessThanOrEqual(WORK_DOCS[s.doc].pages)
      }
      if (Array.isArray(s.page)) expect(s.page[0]).toBeLessThan(s.page[1])
    }
  })
  it('나이스 메뉴는 경로 · 순서가 있음', () => {
    for (const t of WORK_TOPICS)
      for (const m of t.menus) {
        expect(m.path.length).toBeGreaterThanOrEqual(2)
        expect(m.steps.length).toBeGreaterThan(0)
      }
  })
  it('운동부 필수교육: 64쪽 법적 의무교육 표 5가지 + 근거, 선택은 지도자 연수뿐', () => {
    const tr = workTopic('team')?.trainings ?? []
    const legal = tr.filter((x) => x.kind === '법적 의무')
    expect(legal.map((x) => x.name)).toEqual(['(성)폭력 예방교육', '스포츠분야 인권교육', '도핑방지 교육', '체육지도자 재교육', '성폭력 등 폭력 예방교육'])
    for (const x of legal) expect(x.basis).toBeTruthy()
    expect(tr.filter((x) => x.kind === '선택').map((x) => x.name)).toEqual(['학교운동부지도자 연수'])
    for (const x of tr) {
      expect(x.who).toBeTruthy()
      expect(x.times).toBeTruthy()
    }
    expect(workTopic('club')?.trainings).toBeUndefined()
  })
  it('운동부 서류 묶음', () => {
    const groups = workTopic('team')?.formGroups ?? []
    expect(groups.map((g) => g.title)).toEqual(['교육청에 내는 엑셀 서식 (공문 첨부 xls)', '학교에서 쓰고 갖춰 두는 서류', '전지훈련 서류', '지도자 채용 · 재계약 서류'])
    for (const g of groups) expect(g.lines.length).toBeGreaterThan(0)
  })
  it('쪽 표시', () => {
    expect(srcLabel({ doc: 'plan', page: 62 })).toBe('운영방향 62쪽')
    expect(srcLabel({ doc: 'neis', page: [92, 93] })).toBe('나이스 교육자료 92~93쪽')
  })
})
