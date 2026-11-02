import type { AssessItem, Assessment } from '../db/types'
import { checklistBands, LEVEL_CUT_PRESETS } from '../lib/assessScore'

/**
 * 평가 틀 예시 (2026-10-31): 교사가 2026학년도 실제로 쓴 평가 기록지(구글 시트)의 구조 · 점수 규칙 · 평가 요소 문장.
 * 학생 정보는 없다. 고르면 복사본이 만들어지고 교사가 고쳐 쓴다.
 */
export interface AssessTemplate {
  id: string
  name: string
  kind: string
  summary: string
  build: (newId: () => string) => Pick<Assessment, 'title' | 'items' | 'specials' | 'texts' | 'levelCuts'>
}

const SAFETY_CHECKS = [
  '학교 생활 및 체육 환경과 관련된 요소를 선정하였는가?',
  '뚜렷한 안전 저해요소를 포함하였는가?',
  '개선방향의 현실성이 있는가?',
  '논리성을 바탕으로 개선방향을 제안하였는가?',
  '안전저해요소 선정 이유를 구체적으로 작성하였는가?',
  '참고자료나 사례를 표기하였는가?',
  '자신만의 생각이나 아이디어가 포함되어 있는가?',
]

const rubricItem = (id: string, label: string, levels: [number, string][]): AssessItem => ({
  id,
  label,
  method: 'level',
  levels: levels.map(([points, desc]) => ({ label: String(points), points, desc })),
})

export const ASSESS_TEMPLATES: AssessTemplate[] = [
  {
    id: 'checklist',
    name: '체크리스트형 탐구활동',
    kind: '체크리스트',
    summary: '평가 요소 7개 중 만족한 개수로 점수 (예: 학교체육시설 안전탐구활동, 30 + 개수 × 10점)',
    build: (newId) => ({
      title: '학교체육시설 안전탐구활동',
      texts: ['탐구주제'],
      items: [{ id: newId(), label: '안전탐구활동', method: 'record', unit: '개', better: 'higher', checks: [...SAFETY_CHECKS], bands: checklistBands(SAFETY_CHECKS.length, 30, 10), basePoints: 30 }],
      specials: [
        { label: '백지 제출', points: 20 },
        { label: '미응시(미인정)', points: 15 },
      ],
    }),
  },
  {
    id: 'rubric',
    name: '루브릭형 탐구보고서',
    kind: '루브릭',
    summary: '요소마다 점수별 채점 기준, 합계로 상 · 중 · 하 (예: 스포츠 메가 이벤트 융합 탐구보고서)',
    build: (newId) => ({
      title: '스포츠 메가 이벤트 융합 탐구보고서',
      items: [
        rubricItem(newId(), '융합성', [
          [40, '메가 이벤트 요소와 진로 희망 분야를 연계한 구체적 키워드 3개 이상 포함'],
          [33, '연계 키워드 2개 포함'],
          [26, '연계 키워드 1개 포함'],
          [19, '진로 분야 언급은 있으나 메가 이벤트와 연계성이 전혀 없음'],
          [12, '진로와 무관한 내용·핵심 키워드 전혀 없음'],
        ]),
        rubricItem(newId(), '전문성', [
          [30, '통계·논문·기사 등 객관적 근거 자료 3개 이상 인용 + 출처 명확'],
          [24, '근거 자료 2개 인용 + 기본적 분석 포함'],
          [18, '근거 자료 1개 인용 또는 단순 사실 나열에 그침'],
          [12, '자료 인용 없이 주관적 주장 위주·출처 불분명'],
          [9, '자료 전혀 없음 또는 작성 분량이 양식의 30% 미만'],
        ]),
        rubricItem(newId(), '결론/제언', [
          [30, '시사점·향후 발전 방향을 2가지 이상 논리적으로 제시'],
          [24, '결론 도출 + 진로 연관 제언을 1가지 이상 구체적으로 기술'],
          [18, '결론은 도출했으나 제언이 본문 내용과 연결되지 않음'],
          [12, '결론·제언이 3문장 이하로 빈약·시사점 없음'],
          [9, '결론 누락 또는 평가 취지와 무관한 결론'],
        ]),
      ],
      specials: [{ label: '미응시', points: 25 }],
      levelCuts: LEVEL_CUT_PRESETS['3'].map((c) => ({ ...c })),
    }),
  },
]
