import { describe, expect, it } from 'vitest'
import { answersOf, readSurvey, summarize, type Survey, type SurveyStudent } from '../src/lib/survey'

const st = (id: string, grade: number, classNo: number, number: number, name: string): SurveyStudent => ({ id, grade, classNo, number, name })
const roster = [st('a', 1, 3, 12, '김하늘'), st('b', 1, 3, 13, '이바다'), st('c', 1, 4, 1, '김하늘'), st('d', 2, 1, 5, '박구름')]

describe('설문 결과 넣기 (구글 설문 응답 시트)', () => {
  it('학번 · 이름으로 맞추고, 타임스탬프 · 이메일은 빼고 나머지 열 = 질문', () => {
    const text = [
      '타임스탬프\t이메일 주소\t학번\t이름\t가장 하고 싶은 종목\t이번 단원에서 잘한 점',
      '2026. 11. 3 오후 2:01:11\tx@school.kr\t10312\t김하늘\t배드민턴\t스텝을 끝까지 익힘',
      '2026. 11. 3 오후 2:02:00\t\t1-3-13\t이바다\t농구, 배드민턴\t',
    ].join('\n')
    const r = readSurvey(text, roster)
    expect(r.questions).toEqual(['가장 하고 싶은 종목', '이번 단원에서 잘한 점'])
    expect(r.idColumns).toEqual(['학번', '이름'])
    expect(r.rows).toEqual([
      { studentId: 'a', answers: ['배드민턴', '스텝을 끝까지 익힘'] },
      { studentId: 'b', answers: ['농구, 배드민턴', ''] },
    ])
    expect(r.problems).toEqual([])
  })
  it('학년 · 반 · 번호 열, 같은 이름은 학번 없으면 넣지 않음, 학번 · 이름이 다르면 막음, 같은 학생은 마지막 응답', () => {
    const text = ['학년\t반\t번호\t성명\t소감', '2\t1\t5\t박구름\t처음', '\t\t\t김하늘\t누구?', '2\t1\t5\t박구름\t고침', '1\t3\t13\t김하늘\t틀린 짝'].join('\n')
    const r = readSurvey(text, roster)
    expect(r.rows).toEqual([{ studentId: 'd', answers: ['고침'] }])
    expect(r.problems[0]).toContain('같은 이름이 2명')
    expect(r.problems[1]).toContain('맞지 않아')
  })
  it('머리글이 없으면 알림', () => {
    expect(readSurvey('김하늘\t배드민턴', roster).problems[0]).toContain('머리글 줄')
  })
  it('질문별 모아 보기: 선택형은 수(체크박스 쉼표 나눔), 서술형은 개수', () => {
    const s: Pick<Survey, 'questions' | 'answers'> = { questions: ['종목', '잘한 점'], answers: { a: ['배드민턴', '스텝을 익힘'], b: ['농구, 배드민턴', '패스를 많이 함'], d: ['농구', ''] } }
    const [q1, q2] = summarize(s)
    expect(q1.kind).toBe('choice')
    expect(q1.counts).toEqual([
      { answer: '배드민턴', n: 2 },
      { answer: '농구', n: 2 },
    ])
    expect(q2.kind).toBe('text')
    expect(q2.filled).toBe(2)
  })
  it('한 학생의 답 (빈 답 빼기)', () => {
    const sv: Survey = { id: 's', title: '배드민턴 자기평가', kind: '자기평가서', createdAt: 0, questions: ['잘한 점', '아쉬운 점'], answers: { a: ['스텝', ' '] } }
    expect(answersOf([sv], 'a')).toEqual([{ survey: '배드민턴 자기평가', kind: '자기평가서', question: '잘한 점', answer: '스텝' }])
    expect(answersOf([sv], 'b')).toEqual([])
  })
})
