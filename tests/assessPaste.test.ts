import { describe, expect, it } from 'vitest'
import { ASSESS_TEMPLATES } from '../src/data/assessTemplates'
import type { Assessment } from '../src/db/types'
import { areaTotal } from '../src/lib/assessScore'
import { readPaste, splitTable } from '../src/lib/assessPaste'
import { checkStatement, draftParts } from '../src/lib/seteukDraft'

let n = 0
const newId = () => `id${++n}`
const make = (tid: string): Assessment => ({ id: 'a', schoolYear: 2026, grade: 3, rubric: [], altTaskEnabled: false, groupIds: ['g'], ...ASSESS_TEMPLATES.find((t) => t.id === tid)!.build(newId) })
const students = [
  { id: 's1', name: '학생A', no: '1' },
  { id: 's2', name: '학생B', no: '2' },
  { id: 's3', name: '학생C', no: '3' },
  { id: 's4', name: '학생C', no: '4' },
]

// 교사 구글 시트와 같은 모양 (이름은 가명). 시트에서 복사하면 탭으로 나뉜다
const CHECK_SHEET = [
  ['번호', '성명', '탐구주제(안전 저해요소)', '①요소선정', '②저해요소', '③현실성', '④논리성', '⑤선정이유', '⑥참고자료', '⑦자기생각', '만족항목수', '제출구분', '점수'],
  ['1', '학생A', '체육관 바닥 미끄럼', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', '7', 'O', '100'],
  ['2', '학생B', '운동장 배수구 덮개', 'TRUE', 'FALSE', 'TRUE', 'FALSE', 'TRUE', 'FALSE', 'TRUE', '4', 'O', '70'],
  ['3', '학생C', '', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', '0', '백지 제출', '20'],
  ['9', '학생Z', '', '', '', '', '', '', '', '', '', '', ''],
]
  .map((r) => r.join('\t'))
  .join('\n')

describe('구글 시트 붙여넣기 → 기록표', () => {
  it('체크리스트형: 탐구주제 · ①~⑦ · 제출 구분, 같은 이름은 번호로, 명렬에 없는 학생은 알림', () => {
    const a = make('checklist')
    const it0 = a.items![0]
    const r = readPaste(CHECK_SHEET, a, a.items!, students)
    expect(r.rows.map((x) => x.studentId)).toEqual(['s1', 's2', 's3'])
    expect(r.rows[0].patch.texts).toEqual({ 탐구주제: '체육관 바닥 미끄럼' })
    expect(r.rows[0].patch.checks![it0.id]).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(r.rows[1].patch.checks![it0.id]).toEqual([0, 2, 4, 6])
    expect(r.rows[1].patch.scores[it0.id]).toBe(4)
    expect(r.rows[2].patch.status).toBe('백지 제출')
    expect(r.problems).toEqual(['9번 학생Z: 이 수업반 명렬에서 찾지 못했어요.'])
    // 앱이 다시 계산한 점수가 시트 점수와 같다 (30 + 개수 × 10, 백지 20)
    expect(r.rows.map((x) => areaTotal(a, { scores: x.patch.scores, status: x.patch.status }).total)).toEqual([100, 70, 20])
    expect(r.columns.join(' ')).toContain('①②③④⑤⑥⑦')
  })
  it('루브릭형: 머리글이 3번째 줄이어도, ①융합성(40) → 융합성 요소, 점수 = 등급표 값', () => {
    const a = make('rubric')
    const text = [['스포츠 메가 이벤트 융합 탐구보고서 수행평가 기록표'], [], ['번호', '이름', '①융합성(40)', '②전문성(30)', '③결론/제언(30)', '합계(100)', '수준', '비고'], ['1', '학생A', '40', '24', '30', '94', '상', '발표 우수'], ['2', '학생B', '35', '18', '12', '', '', '']]
      .map((r) => r.join('\t'))
      .join('\n')
    const r = readPaste(text, a, a.items!, students)
    const [fus, exp, con] = a.items!
    expect(r.rows[0].patch.scores).toEqual({ [fus.id]: '40', [exp.id]: '24', [con.id]: '30' })
    expect(r.rows[0].patch.note).toBe('발표 우수')
    expect(areaTotal(a, { scores: r.rows[0].patch.scores }).total).toBe(94)
    expect(r.problems).toEqual(["2번 학생B '융합성': '35'는 등급표에 없는 값이에요."])
  })
  it('머리글이 없으면 알려 준다 · 큰따옴표 칸 안의 줄바꿈', () => {
    expect(readPaste('1\t학생A\t40', make('rubric'), make('rubric').items!, students).problems[0]).toMatch(/머리글/)
    expect(splitTable('번호\t이름\n1\t"두\n줄"')).toEqual([['번호', '이름'], ['1', '두\n줄']])
  })
})

describe('세특 근거에 기록표 내용 (탐구주제 · 만족한 평가 요소)', () => {
  it('글 칸 · 체크 항목을 문장으로, 제출 구분이 있으면 넣지 않음', () => {
    const a = make('checklist')
    const it0 = a.items![0]
    const parts = draftParts({ records: [], keywords: [], captainRoles: [], assessments: [{ a, items: a.items!, scores: { [it0.id]: 2 }, score: { texts: { 탐구주제: '체육관 바닥 미끄럼' }, checks: { [it0.id]: [0, 2] } } }] })
    expect(parts.map((p) => p.text)).toEqual([
      '「학교체육시설 안전탐구활동」에서 ‘체육관 바닥 미끄럼’을 주제로 탐구함.',
      '「학교체육시설 안전탐구활동」에서 학교 생활 및 체육 환경과 관련된 요소를 선정함, 개선방향의 현실성이 있음.',
    ])
    const none = draftParts({ records: [], keywords: [], captainRoles: [], assessments: [{ a, items: a.items!, scores: {}, score: { status: '백지 제출', texts: { 탐구주제: 'x' } } }] })
    expect(none).toEqual([])
  })
  it('질문 → 서술', () => {
    expect(checkStatement('참고자료나 사례를 표기하였는가?')).toBe('참고자료나 사례를 표기함')
    expect(checkStatement('자신만의 생각이나 아이디어가 포함되어 있는가?')).toBe('자신만의 생각이나 아이디어가 포함되어 있음')
    expect(checkStatement('뚜렷한 안전 저해요소를 포함하였는가?')).toBe('뚜렷한 안전 저해요소를 포함함')
  })
})
