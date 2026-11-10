/**
 * 설문 결과 넣기 (2026-11-10 교사 승인 '다음 할 일 1').
 * 구글 설문 응답 시트(또는 엑셀)를 머리글 줄부터 복사해 붙여 넣으면 학생마다 답을 맞춘다.
 *  - 학생 열: 학번(10312 · 1-3-12) / 학년 · 반 · 번호 / 이름 · 성명 — 학번 → 학년반번호 → 이름(한 명일 때) 순으로 찾음
 *  - 타임스탬프 · 이메일 · 점수 열은 읽지 않음. 나머지 열 = 질문
 *  - 같은 학생이 여러 번 내면 마지막(아래) 응답
 * 기재요령(길라잡이): 학생이 써 낸 글(자기평가서 · 동료평가서 · 소감문 …)은 **참고만**, 세특에 그대로 옮기지 않는다
 * → 세특 편집 창에는 '참고' 칸으로만 보이고, 틀 초안 · AI 요청에는 넣지 않는다.
 * 저장: settings.surveys[학년도] (이 기기 · 백업). 순수 함수 — 저장은 화면에서.
 */
import { splitTable } from './assessPaste'

export const SURVEY_KINDS = ['자기평가서', '동료평가서', '수업 소감문', '선호도 · 설문'] as const
export type SurveyKind = (typeof SURVEY_KINDS)[number]

export interface Survey {
  id: string
  title: string
  kind: SurveyKind
  createdAt: number
  questions: string[]
  /** 학생 id → 질문 순서대로 답 */
  answers: Record<string, string[]>
}

export interface SurveyStudent {
  id: string
  grade: number
  classNo: number
  number: number
  name: string
  studentCode?: string
}

export interface SurveyRead {
  questions: string[]
  rows: { studentId: string; answers: string[] }[]
  /** 학생 열 설명 */
  idColumns: string[]
  problems: string[]
}

const SKIP = /타임스탬프|timestamp|이메일|email|점수|score/i
const t = (s: string) => s.replace(/\s+/g, '')

export function readSurvey(text: string, students: readonly SurveyStudent[]): SurveyRead {
  const table = splitTable(text)
  const isId = (c: string) => /^(학번|이름|성명|학생이름|번호|학년|반)$/.test(t(c).replace(/\(.*?\)/g, ''))
  const hi = table.findIndex((r) => r.some(isId))
  if (hi < 0) return { questions: [], rows: [], idColumns: [], problems: ['머리글 줄(학번 또는 이름)을 찾지 못했어요. 응답 시트의 첫 줄(질문 줄)부터 함께 복사해 주세요.'] }
  const head = table[hi]
  const col = (re: RegExp) => head.findIndex((c) => re.test(t(c).replace(/\(.*?\)/g, '')))
  const codeCol = col(/^학번$/)
  const gradeCol = col(/^학년$/)
  const classCol = col(/^반$/)
  const noCol = col(/^번호$/)
  const nameCol = col(/^(이름|성명|학생이름)$/)
  const idCols = [codeCol, gradeCol, classCol, noCol, nameCol].filter((i) => i >= 0)
  const qCols = head.map((_, i) => i).filter((i) => !idCols.includes(i) && !SKIP.test(head[i]) && head[i].trim() !== '')
  const problems: string[] = []
  const byCode = new Map(students.map((s) => [`${s.grade}${String(s.classNo).padStart(2, '0')}${String(s.number).padStart(2, '0')}`, s]))
  for (const s of students) if (s.studentCode) byCode.set(s.studentCode, s)
  const byName = new Map<string, SurveyStudent[]>()
  for (const s of students) byName.set(t(s.name), [...(byName.get(t(s.name)) ?? []), s])
  const found = new Map<string, string[]>()
  for (const r of table.slice(hi + 1)) {
    const cell = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
    let s: SurveyStudent | undefined
    const code = cell(codeCol).replace(/\D/g, '')
    if (code) s = byCode.get(code)
    if (!s && codeCol >= 0) {
      const m = cell(codeCol).match(/(\d+)\D+(\d+)\D+(\d+)/)
      if (m) s = byCode.get(`${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}`)
    }
    if (!s && gradeCol >= 0 && classCol >= 0 && noCol >= 0) s = byCode.get(`${cell(gradeCol).replace(/\D/g, '')}${cell(classCol).replace(/\D/g, '').padStart(2, '0')}${cell(noCol).replace(/\D/g, '').padStart(2, '0')}`)
    const name = cell(nameCol)
    if (!s && name) {
      const c = byName.get(t(name)) ?? []
      if (c.length === 1) s = c[0]
      else if (c.length > 1) {
        problems.push(`${name}: 같은 이름이 ${c.length}명이에요. 학번 열을 함께 넣어 주세요.`)
        continue
      }
    }
    if (s && name && t(name) !== t(s.name)) {
      problems.push(`${cell(codeCol) || name}: 학번과 이름이 맞지 않아 넣지 않았어요 (${s.name} ↔ ${name}).`)
      continue
    }
    if (!s) {
      if (name || code) problems.push(`${name || cell(codeCol)}: 명렬에서 찾지 못했어요.`)
      continue
    }
    found.set(s.id, qCols.map((i) => cell(i))) // 같은 학생은 마지막 응답
  }
  return {
    questions: qCols.map((i) => head[i].trim()),
    rows: [...found].map(([studentId, answers]) => ({ studentId, answers })),
    idColumns: idCols.map((i) => head[i]),
    problems,
  }
}

/** 질문마다 답 모아 보기: 선택형(짧은 답 8종류 이하, 겹치는 답 있음)은 수를 센다(많은 순), 아니면 서술형 */
export function summarize(s: Pick<Survey, 'questions' | 'answers'>): { question: string; kind: 'choice' | 'text'; counts: { answer: string; n: number }[]; filled: number }[] {
  const rows = Object.values(s.answers)
  return s.questions.map((q, qi) => {
    const vals = rows.map((r) => (r[qi] ?? '').trim()).filter(Boolean)
    // 체크박스 문항(여러 개 고름)은 쉼표로 나뉜다
    const parts = vals.flatMap((v) => (v.length <= 40 && v.includes(', ') ? v.split(', ') : [v]))
    const m = new Map<string, number>()
    for (const v of parts) m.set(v, (m.get(v) ?? 0) + 1)
    // 선택형: 답 종류 8개 이하 · 모두 짧음(20자) · 같은 답이 한 번이라도 겹침 (서술형은 보통 다 다름)
    const choice = m.size > 0 && m.size <= 8 && [...m.keys()].every((k) => k.length <= 20) && Math.max(...m.values()) >= 2
    return { question: q, kind: choice ? 'choice' : 'text', counts: [...m].map(([answer, n]) => ({ answer, n })).sort((a, b) => b.n - a.n), filled: vals.length }
  })
}

/** 한 학생의 답 (세특 편집 창 '참고'): 빈 답은 빼고 */
export function answersOf(surveys: readonly Survey[], studentId: string): { survey: string; kind: SurveyKind; question: string; answer: string }[] {
  return surveys.flatMap((s) => (s.answers[studentId] ?? []).map((a, i) => ({ survey: s.title, kind: s.kind, question: s.questions[i], answer: a.trim() })).filter((x) => x.answer))
}
