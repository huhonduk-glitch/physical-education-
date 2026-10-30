/**
 * 세특 수준 나누기 (6-7, 2026-10-30 교사 요청). 순수 함수. 인터넷 안 씀.
 * 수업반 학생을 근거(수행평가 · 칭찬·관찰 · PAPS 종합등급 · 지도)로 최대 5수준으로 나누고,
 * 수준마다 분량과 짜임(쓰기 틀)을 달리한다. 수준은 '제안'이고 교사가 학생마다 고친다.
 * 지도 기록은 수준 계산에서 감점으로만 쓰고 세특 문장에는 넣지 않는다(교사 결정).
 * 수준(숫자)은 AI로 보내지 않는다 — 분량 · 짜임 지시만 보낸다.
 */

export interface LevelSignals {
  studentId: string
  /** 이 수업반 수행평가 영역 점수 합 / 만점 합 (0~1). 채점한 평가가 없으면 null */
  assess: number | null
  /** 칭찬(솔선수범) 횟수 */
  praise: number
  /** 메모를 남긴 관찰 · 칭찬 · 부장 활동 수 */
  notes: number
  /** 붙은 세특 키워드 가짓수 */
  keywords: number
  captain: boolean
  /** PAPS 종합등급 1~5 (미완료 · 미측정이면 null) */
  paps: number | null
  /** 지도(미준비) 횟수 */
  guide: number
  /** 세특에 쓸 수 있는 근거 수 (메모 있는 기록 · 키워드 붙은 기록 · 수행평가 메모 · 받은 등급 기준) */
  evidence: number
}

/** 비중 (교사가 고침). guide는 감점 크기(최대 몇 점 깎을지, 100점 기준) */
export interface LevelWeights {
  assess: number
  activity: number
  paps: number
  guide: number
}

export const DEFAULT_WEIGHTS: LevelWeights = { assess: 50, activity: 35, paps: 15, guide: 10 }

export const LEVEL_FACTOR_LABEL: Record<keyof LevelWeights, string> = {
  assess: '수행평가 점수',
  activity: '칭찬 · 관찰 기록',
  paps: 'PAPS 종합등급',
  guide: '지도 기록 (감점)',
}

/** 근거가 이보다 적으면 '근거 부족' — 수준과 상관없이 기록을 더 모으도록 알린다 */
export const THIN_EVIDENCE = 2

/** 칭찬·관찰 활동량: 칭찬 + 메모 + 키워드 가짓수의 절반 + 부장 2 */
export const activityRaw = (s: LevelSignals) => s.praise + s.notes + s.keywords / 2 + (s.captain ? 2 : 0)

/** 반 안에서 몇 번째쯤인지 0~1 (같은 값은 같은 자리, 모두 같으면 0.5) */
export function percentile(values: readonly number[]): number[] {
  const n = values.length
  if (n <= 1) return values.map(() => 0.5)
  return values.map((v) => {
    const below = values.filter((x) => x < v).length
    const same = values.filter((x) => x === v).length
    return (below + (same - 1) / 2) / (n - 1)
  })
}

export interface LevelScore {
  studentId: string
  /** 0~100 */
  score: number
  /** 요인별 0~1 (없으면 null) — 화면에 근거로 보여 준다 */
  parts: { assess: number | null; activity: number; paps: number | null; guide: number }
  thin: boolean
}

/**
 * 점수 = (수행평가 비율 × 비중 + 활동량 순위 × 비중 + PAPS(1등급=1 … 5등급=0) × 비중) ÷ 쓴 비중 합 × 100 − 지도 순위 × 감점.
 * 학생에게 없는 요인(채점 안 된 수행평가 · 미측정 PAPS)은 그 학생 계산에서 빼고 나머지 비중으로 나눈다.
 */
export function levelScores(signals: readonly LevelSignals[], w: LevelWeights = DEFAULT_WEIGHTS): LevelScore[] {
  const act = percentile(signals.map(activityRaw))
  const anyGuide = signals.some((s) => s.guide > 0)
  const gd = anyGuide ? percentile(signals.map((s) => s.guide)) : signals.map(() => 0)
  return signals.map((s, i) => {
    const papsPart = s.paps === null ? null : (5 - Math.min(5, Math.max(1, s.paps))) / 4
    const items: [number | null, number][] = [
      [s.assess === null ? null : Math.min(1, Math.max(0, s.assess)), w.assess],
      [act[i], w.activity],
      [papsPart, w.paps],
    ]
    const used = items.filter(([v, wt]) => v !== null && wt > 0) as [number, number][]
    const wsum = used.reduce((a, [, wt]) => a + wt, 0)
    const base = wsum ? (used.reduce((a, [v, wt]) => a + v * wt, 0) / wsum) * 100 : 50
    const guidePart = s.guide > 0 ? gd[i] : 0
    const score = Math.max(0, Math.min(100, base - guidePart * w.guide))
    return { studentId: s.studentId, score: Math.round(score * 10) / 10, parts: { assess: items[0][0], activity: act[i], paps: papsPart, guide: guidePart }, thin: s.evidence < THIN_EVIDENCE }
  })
}

/**
 * 순위로 수준 나누기: 위에서부터 고르게 count개 수준 (count = 가장 높은 수준).
 * 같은 점수는 같은 수준. 학생 수가 수준 수보다 적어도 동작한다.
 */
export function assignLevels(scores: readonly { studentId: string; score: number }[], count = 5): Map<string, number> {
  const n = scores.length
  const out = new Map<string, number>()
  for (const s of scores) {
    const higher = scores.filter((x) => x.score > s.score).length
    out.set(s.studentId, n ? count - Math.min(count - 1, Math.floor((higher / n) * count)) : count)
  }
  return out
}

/** 수준별 쓰기 틀 */
export interface LevelFrame {
  name: string
  /** 목표 분량 (나이스 바이트) */
  minBytes: number
  maxBytes: number
  /** 짜임 · 강조 (AI 지시와 교사 안내에 같이 쓴다) */
  guide: string
  /** 기기 안 틀 초안에 넣을 문장 수 상한 */
  maxParts: number
}

/** 5수준 기본 틀 (5 = 가장 높음). 교사가 설정에서 고친다 */
export const DEFAULT_FRAMES: Record<1 | 2 | 3 | 4 | 5, LevelFrame> = {
  5: { name: '탁월', minBytes: 1300, maxBytes: 1500, maxParts: 8, guide: '근거 활동 3가지 이상을 무엇을 · 어떻게 했는지 구체적으로 쓰고, 동료를 이끌거나 원리를 탐구하거나 전략을 적용한 모습과 그 과정에서 드러난 성장을 이어서 씀. 근거에 있는 강점을 마지막 한 문장으로 묶음.' },
  4: { name: '우수', minBytes: 1100, maxBytes: 1400, maxParts: 6, guide: '근거 활동 2~3가지를 구체적으로 쓰고, 기능 · 태도의 강점과 나아진 과정을 씀.' },
  3: { name: '성실', minBytes: 900, maxBytes: 1200, maxParts: 5, guide: '근거 활동 2가지 정도를 중심으로 성실하게 참여한 모습과 나아진 점을 과장 없이 씀.' },
  2: { name: '노력', minBytes: 700, maxBytes: 1000, maxParts: 4, guide: '근거 활동 1~2가지에서 참여하며 노력한 장면과 나아진 점을 긍정적으로 씀. 부족한 점 · 지도 내용은 쓰지 않음.' },
  1: { name: '기초', minBytes: 450, maxBytes: 800, maxParts: 3, guide: '참여한 활동과 노력한 장면 1가지를 긍정적으로 짧게 씀. 부족한 점 · 지도 내용은 쓰지 않음.' },
}

/** count개 수준일 때 수준 k(1~count)가 쓸 기본 틀 번호 (3수준이면 1·3·5 틀) */
export function frameIndex(level: number, count: number): 1 | 2 | 3 | 4 | 5 {
  if (count <= 1) return 3
  const k = Math.min(count, Math.max(1, level))
  return (Math.round(((k - 1) * 4) / (count - 1)) + 1) as 1 | 2 | 3 | 4 | 5
}

export function frameFor(level: number, count: number, frames: Partial<Record<1 | 2 | 3 | 4 | 5, LevelFrame>> = {}): LevelFrame {
  const i = frameIndex(level, count)
  return frames[i] ?? DEFAULT_FRAMES[i]
}

/** AI에 붙일 분량 · 짜임 지시 (수준 숫자 · 이름은 넣지 않는다) */
export function frameInstruction(f: LevelFrame): string {
  return `분량과 짜임: 나이스 ${f.minBytes.toLocaleString()}~${f.maxBytes.toLocaleString()}바이트(한글 약 ${Math.round(f.minBytes / 2.7)}~${Math.round(f.maxBytes / 2.7)}자). ${f.guide} 근거가 모자라면 분량을 억지로 채우지 말고 짧게 씀.`
}
