import type { AssessItem } from '../db/types'

/**
 * 수행평가 루브릭 만들기 (재설계 5단계). 순수 함수 — 인공지능을 쓰지 않고, 정해 둔 틀로 초안을 만든다.
 *
 * 1) 성취기준 글에 든 낱말로 평가 방법을 추천한다 (예: '경기'·'전략' → 경기 수행).
 * 2) 평가 방법마다 채점 요소와 비율, 단계별 판단 기준 틀을 갖고 있다. {c} 자리에 교사가 적은 평가 내용(예: 농구 레이업 슛)이 들어간다.
 * 3) 결과는 교사가 고치는 출발점이다. 성취기준 문장 자체는 교육과정 파일에서만 가져온다(지어내지 않는다).
 */

export type RubricMethod = 'skill' | 'game' | 'record' | 'expression' | 'report' | 'practice'

interface ElementTemplate {
  label: string
  weight: number
  /** 가장 잘함 → 가장 부족함, 5단계 */
  descs: [string, string, string, string, string]
  /** 기록표로 채점하는 요소 (기록 측정) */
  record?: boolean
}

interface MethodTemplate {
  label: string
  desc: string
  /** 성취기준에 이 낱말이 있으면 이 방법을 추천 */
  words: string[]
  elements: ElementTemplate[]
}

export const METHODS: Record<RubricMethod, MethodTemplate> = {
  skill: {
    label: '기능 실연',
    desc: '동작·기술을 직접 해 보이기 (예: 레이업 슛, 매트 운동, 리시브)',
    words: ['기능', '기술', '동작', '자세', '익혀', '익히', '연습'],
    elements: [
      {
        label: '동작의 정확성',
        weight: 0.4,
        descs: [
          '{c}의 동작을 정확하고 안정적으로 수행한다',
          '{c}의 동작을 대체로 정확하게 수행한다',
          '{c}의 기본 동작을 수행하나 정확성이 부족하다',
          '{c}의 동작 일부를 도움을 받아 수행한다',
          '{c}의 동작을 시도하나 수행에 어려움이 있다',
        ],
      },
      {
        label: '동작의 연결',
        weight: 0.3,
        descs: [
          '준비–실행–마무리 동작을 자연스럽게 연결한다',
          '동작을 대체로 연결하나 일부 끊김이 있다',
          '동작 사이의 연결이 자주 끊긴다',
          '동작을 하나씩 따로 수행한다',
          '동작의 순서를 구분하는 데 어려움이 있다',
        ],
      },
      {
        label: '과제 성공',
        weight: 0.3,
        descs: ['{c} 과제를 일관되게 성공한다', '{c} 과제를 대부분 성공한다', '{c} 과제를 절반 정도 성공한다', '{c} 과제를 가끔 성공한다', '{c} 과제 성공이 드물다'],
      },
    ],
  },
  game: {
    label: '경기 수행',
    desc: '실제 경기·게임 속에서 기능과 전략 쓰기 (관찰 평가)',
    words: ['경기', '전략', '전술', '경쟁', '게임', '팀'],
    elements: [
      {
        label: '경기 기능 활용',
        weight: 0.35,
        descs: [
          '{c} 상황에 맞는 기능을 정확하게 골라 쓴다',
          '{c} 중에 익힌 기능을 대체로 알맞게 쓴다',
          '{c} 중에 기본 기능을 쓰나 상황 판단이 늦다',
          '{c} 중에 기능 사용이 제한적이다',
          '{c} 중에 기능을 쓰는 데 어려움이 있다',
        ],
      },
      {
        label: '전략·전술 적용',
        weight: 0.35,
        descs: [
          '팀의 전략을 이해하고 자기 역할에 맞게 움직인다',
          '전략을 이해하고 대체로 역할에 맞게 움직인다',
          '전략을 알고 있으나 경기 중 적용이 부족하다',
          '안내를 받으면 전략에 따라 움직인다',
          '전략과 자기 역할을 구분하는 데 어려움이 있다',
        ],
      },
      {
        label: '협력과 의사소통',
        weight: 0.3,
        descs: [
          '동료와 적극적으로 소통하며 팀 플레이를 이끈다',
          '동료와 소통하며 팀 플레이에 참여한다',
          '팀 플레이에 참여하나 소통이 적다',
          '팀 활동에 소극적으로 참여한다',
          '팀 활동 참여가 드물다',
        ],
      },
    ],
  },
  record: {
    label: '기록 측정',
    desc: '시간·거리·횟수로 재기 (점수는 기록표로)',
    words: ['기록', '도전', '거리', '속도', '시간', '횟수', '측정'],
    elements: [
      { label: '{c} 기록', weight: 0.7, record: true, descs: ['', '', '', '', ''] },
      {
        label: '목표 설정과 연습',
        weight: 0.3,
        descs: [
          '자기 기록을 분석해 알맞은 목표를 세우고 꾸준히 연습한다',
          '목표를 세우고 대체로 꾸준히 연습한다',
          '목표를 세우나 연습이 꾸준하지 않다',
          '안내를 받아 목표를 세우고 일부 연습한다',
          '목표 설정과 연습이 거의 없다',
        ],
      },
    ],
  },
  expression: {
    label: '표현 · 작품 발표',
    desc: '움직임으로 표현하고 작품 발표하기 (무용, 창작 체조 등)',
    words: ['표현', '창작', '작품', '무용', '리듬', '움직임', '감상'],
    elements: [
      {
        label: '표현 요소 활용',
        weight: 0.4,
        descs: [
          '신체·공간·힘·관계 등 표현 요소를 다양하고 정확하게 활용한다',
          '표현 요소를 대체로 알맞게 활용한다',
          '표현 요소를 일부만 활용한다',
          '표현 요소 활용이 단순하다',
          '표현 요소를 활용하는 데 어려움이 있다',
        ],
      },
      {
        label: '구성의 창의성',
        weight: 0.3,
        descs: [
          '{c}의 주제를 살려 독창적으로 구성한다',
          '{c}의 주제에 맞게 구성한다',
          '{c}의 구성이 주제와 부분적으로 맞는다',
          '{c}의 구성이 단순하고 반복적이다',
          '{c} 작품을 구성하는 데 어려움이 있다',
        ],
      },
      {
        label: '협력과 발표',
        weight: 0.3,
        descs: [
          '모둠원과 협력하여 자신감 있게 발표한다',
          '모둠원과 협력하여 발표한다',
          '발표에 참여하나 협력이 부족하다',
          '발표에 소극적으로 참여한다',
          '발표 참여가 어렵다',
        ],
      },
    ],
  },
  report: {
    label: '보고서 · 탐구',
    desc: '운동 계획·건강 관리·스포츠 탐구를 글로 정리하기',
    words: ['계획', '분석', '탐구', '설계', '건강', '체력', '관리', '조사', '평가하', '이해'],
    elements: [
      {
        label: '내용의 정확성',
        weight: 0.35,
        descs: [
          '{c}에 관한 내용을 정확하고 충실하게 정리한다',
          '{c}에 관한 내용을 대체로 정확하게 정리한다',
          '{c}에 관한 내용이 일부 부정확하거나 빠져 있다',
          '{c}에 관한 내용이 단편적이다',
          '{c}에 관한 내용을 정리하는 데 어려움이 있다',
        ],
      },
      {
        label: '분석과 적용',
        weight: 0.35,
        descs: [
          '자신의 자료를 분석해 알맞은 방법을 스스로 설계한다',
          '자료를 분석해 방법을 설계한다',
          '자료 분석이 부분적이다',
          '안내를 받아 자료를 분석한다',
          '자료를 분석하는 데 어려움이 있다',
        ],
      },
      {
        label: '실천과 성찰',
        weight: 0.3,
        descs: [
          '계획을 꾸준히 실천하고 결과를 구체적으로 돌아본다',
          '계획을 실천하고 결과를 돌아본다',
          '실천이 일부이고 성찰이 간단하다',
          '실천과 성찰이 형식적이다',
          '실천과 성찰이 거의 없다',
        ],
      },
    ],
  },
  practice: {
    label: '실천 · 태도',
    desc: '안전 · 규칙 · 배려 · 스포츠맨십 관찰하기',
    words: ['안전', '태도', '스포츠맨십', '배려', '실천', '예절', '규칙', '존중', '공정'],
    elements: [
      {
        label: '규칙과 안전',
        weight: 0.35,
        descs: [
          '규칙과 안전 수칙을 스스로 지키고 동료에게도 안내한다',
          '규칙과 안전 수칙을 잘 지킨다',
          '규칙과 안전 수칙을 대체로 지키나 가끔 놓친다',
          '안내를 받으면 규칙과 안전 수칙을 지킨다',
          '규칙과 안전 수칙을 지키는 데 어려움이 있다',
        ],
      },
      {
        label: '배려와 협력',
        weight: 0.35,
        descs: ['동료를 존중하고 적극적으로 돕는다', '동료를 존중하며 협력한다', '협력하나 배려가 부족할 때가 있다', '협력 활동에 소극적이다', '협력 활동 참여가 드물다'],
      },
      {
        label: '참여와 자기 관리',
        weight: 0.3,
        descs: [
          '{c} 활동에 꾸준히 적극적으로 참여한다',
          '{c} 활동에 성실하게 참여한다',
          '{c} 활동 참여가 고르지 않다',
          '{c} 활동에 소극적으로 참여한다',
          '{c} 활동 참여가 드물다',
        ],
      },
    ],
  },
}

export const METHOD_ORDER: RubricMethod[] = ['skill', 'game', 'record', 'expression', 'report', 'practice']

/** 성취기준 글 → 어울리는 평가 방법 (맞은 낱말이 많은 순). 아무것도 안 맞으면 기능 실연 */
export function recommendMethods(text: string): { method: RubricMethod; words: string[] }[] {
  const t = text.replace(/\s+/g, '')
  const scored = METHOD_ORDER.map((m) => ({ method: m, words: METHODS[m].words.filter((w) => t.includes(w)) }))
  const hit = scored.filter((x) => x.words.length > 0).sort((a, b) => b.words.length - a.words.length || METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method))
  return hit.length ? hit : [{ method: 'skill', words: [] }]
}

/** 5단계 판단 기준 중 n단계에 쓸 것 (가장 잘함과 가장 부족함은 늘 넣는다) */
export function pickSteps(n: number): number[] {
  if (n <= 1) return [0]
  if (n === 2) return [0, 4]
  if (n === 3) return [0, 2, 4]
  if (n === 4) return [0, 1, 3, 4]
  return [0, 1, 2, 3, 4]
}

export const LEVEL_SETS: Record<string, string[]> = {
  'A–E (5단계)': ['A', 'B', 'C', 'D', 'E'],
  'A–D (4단계)': ['A', 'B', 'C', 'D'],
  '상·중·하 (3단계)': ['상', '중', '하'],
  'A–C (3단계)': ['A', 'B', 'C'],
}

export interface RubricRow {
  label: string
  max: number
  record: boolean
  levels: { label: string; points: number; desc: string }[]
}

const fill = (s: string, content: string) => s.replaceAll('{c}', content.trim() || '활동')

/** 요소별 만점: 비율대로 나누고 반올림, 끝 요소가 나머지를 받아 합이 만점이 되게 */
export function splitMax(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const out = weights.map((w) => Math.round((total * w) / sum))
  out[out.length - 1] = total - out.slice(0, -1).reduce((a, b) => a + b, 0)
  return out
}

/** 등급 점수: 만점에서 고르게 내려가되 가장 낮은 등급도 0점이 아니게 (예: 40점 5단계 → 40·34·28·22·16) */
export function levelPoints(max: number, n: number, floorRatio = 0.4): number[] {
  if (n <= 1) return [max]
  const low = Math.round(max * floorRatio)
  return Array.from({ length: n }, (_, i) => Math.round(max - ((max - low) * i) / (n - 1)))
}

export function buildRubric(opts: { method: RubricMethod; content: string; levels: string[]; max: number; floorRatio?: number }): RubricRow[] {
  const tpl = METHODS[opts.method]
  const maxes = splitMax(opts.max, tpl.elements.map((e) => e.weight))
  const steps = pickSteps(opts.levels.length)
  return tpl.elements.map((e, i) => {
    const pts = levelPoints(maxes[i], opts.levels.length, opts.floorRatio)
    return {
      label: fill(e.label, opts.content),
      max: maxes[i],
      record: !!e.record,
      levels: e.record ? [] : opts.levels.map((label, k) => ({ label, points: pts[k], desc: fill(e.descs[steps[k]], opts.content) })),
    }
  })
}

/** 루브릭 → 수행평가 채점 요소 (등급표, 기록 요소는 빈 기록표로 — 교사가 구간을 넣는다) */
export function rubricToItems(rows: readonly RubricRow[], newId: () => string): AssessItem[] {
  return rows.map((r) =>
    r.record
      ? { id: newId(), label: r.label, method: 'record' as const, unit: '', better: 'higher' as const, bands: [], basePoints: 0 }
      : { id: newId(), label: r.label, method: 'level' as const, levels: r.levels.map((l) => ({ label: l.label, points: l.points, desc: l.desc })) },
  )
}

/** 표로 내보내기 (엑셀·인쇄): 요소 | 배점 | 등급별 기준 */
export function rubricTable(rows: readonly RubricRow[], levels: readonly string[]): (string | number)[][] {
  return [
    ['평가 요소', '배점', ...levels.map((l) => `${l}`)],
    ...rows.map((r) => [r.label, r.max, ...(r.record ? levels.map((_, i) => (i === 0 ? '기록표로 채점 (구간은 평가 만들기에서)' : '')) : r.levels.map((l) => `${l.desc} (${l.points}점)`))]),
  ]
}
