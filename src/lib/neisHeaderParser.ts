/**
 * 나이스 PAPS 양식 헤더 해석 (CLAUDE.md 4-5 "헤더 파서").
 * 헤더 글자 → { 종목, 단위, 차수(1/2/없음), 좌우(R/L/없음) }. 열 구조를 코드에 고정하지 않는다.
 * 공백·괄호 위치 차이는 무시한다: '앉아윗몸 앞으로 굽히기(cm) 1차' = '앉아윗몸앞으로굽히기 1차 (cm)'
 */
import type { EventId } from './paps'
import { matchNeisCommonHeader, type NeisCommonField } from './neisCommonColumns'
import { cellText } from './text'

/** 나이스 양식에 나올 수 있는 측정 칸 종류 (BMI는 신장·체중으로 계산하므로 칸이 따로 없다) */
export type MeasureKey = Exclude<EventId, 'bmi'> | 'height' | 'weight' | 'heartRate' | 'bodyFat'

export type NeisColumn =
  | { kind: 'common'; header: string; field: NeisCommonField }
  | { kind: 'measure'; header: string; key: MeasureKey; unit: string; attempt: number | null; side: 'R' | 'L' | null }
  | { kind: 'unknown'; header: string }

const UNITS = ['kg/m²', 'kg/m2', '회/분', 'bpm', 'cm', 'kg', '회', '초', '점', '%', 'm']

/** 종목 이름(공백·괄호·기호 제거) → 앱 내부 id */
const NAME_TO_KEY: [RegExp, MeasureKey][] = [
  [/^왕복오래달리기$/, 'shuttleRun'],
  [/^오래달리기-?걷기$/, 'longRunWalk'],
  [/^오래달리기$/, 'longRunWalk'],
  [/^스텝검사(pei)?$/i, 'stepTest'],
  [/^(스텝검사)?심박수?$/, 'heartRate'],
  [/^앉아윗몸앞으로굽히기$/, 'sitAndReach'],
  [/^종합유연성(검사)?$/, 'totalFlexibility'],
  [/^(무릎대고)?팔굽혀펴기$/, 'pushUp'],
  [/^윗몸말아올리기$/, 'curlUp'],
  [/^악력$/, 'gripStrength'],
  [/^50(m|미터)달리기$/i, 'sprint50m'],
  [/^제자리멀리뛰기$/, 'standingLongJump'],
  [/^(신장|키)$/, 'height'],
  [/^(체중|몸무게)$/, 'weight'],
  [/^체지방(률|율)$/, 'bodyFat'],
]

function normName(s: string): string {
  return s.replace(/\s+/g, '').replace(/[()（）[\]·.]/g, '')
}

export function parseNeisHeader(raw: unknown): NeisColumn {
  const header = cellText(raw)
  const common = matchNeisCommonHeader(header)
  if (common) return { kind: 'common', header, field: common }

  let s = header.replace(/\s+/g, '')
  // 단위: 괄호 안이 단위일 때만 떼어 낸다 ('(무릎대고)'는 종목 이름의 일부)
  let unit = ''
  s = s.replace(/[(（]([^)）]*)[)）]/g, (m, inner: string) => {
    if (UNITS.includes(inner)) {
      unit = inner
      return ''
    }
    return m
  })
  let attempt: number | null = null
  s = s.replace(/([1-9])(차|회차)/g, (_, d) => ((attempt = Number(d)), ''))
  let side: 'R' | 'L' | null = null
  s = s.replace(/(오른쪽|오른손|우측)/g, () => ((side = 'R'), '')).replace(/(왼쪽|왼손|좌측)/g, () => ((side = 'L'), ''))
  // '심박수1', '심박수 2회' 처럼 차수 없이 번호만 붙은 경우
  const hr = /^(.*심박수?)([1-3])$/.exec(normName(s))
  if (hr) {
    attempt = Number(hr[2])
    s = hr[1]
  }
  const name = normName(s)
  for (const [re, key] of NAME_TO_KEY) {
    if (re.test(name)) return { kind: 'measure', header, key, unit, attempt, side }
  }
  return { kind: 'unknown', header }
}

export function parseNeisHeaders(headers: readonly unknown[]): NeisColumn[] {
  return headers.map(parseNeisHeader)
}

/** 헤더 한 줄 붙여넣기 → 칸 목록 (탭 구분, 없으면 | 또는 쉼표) */
export function splitHeaderLine(line: string): string[] {
  const t = line.replace(/\r?\n.*$/s, '')
  const parts = t.includes('\t') ? t.split('\t') : t.includes('|') ? t.split('|') : t.split(',')
  return parts.map((p) => p.trim()).filter((p) => p !== '')
}

export const MEASURE_LABEL: Record<MeasureKey, string> = {
  shuttleRun: '왕복오래달리기',
  longRunWalk: '오래달리기-걷기',
  stepTest: '스텝검사',
  gripStrength: '악력',
  curlUp: '윗몸말아올리기',
  pushUp: '팔굽혀펴기',
  sitAndReach: '앉아윗몸앞으로굽히기',
  totalFlexibility: '종합유연성',
  sprint50m: '50m달리기',
  standingLongJump: '제자리멀리뛰기',
  height: '신장',
  weight: '체중',
  heartRate: '심박수',
  bodyFat: '체지방률',
}

export function cellLabel(c: { key: MeasureKey; attempt: number | null; side: 'R' | 'L' | null }): string {
  const parts = [MEASURE_LABEL[c.key]]
  if (c.attempt) parts.push(c.key === 'heartRate' ? `${c.attempt}회` : `${c.attempt}차`)
  if (c.side) parts.push(c.side === 'R' ? '오른쪽' : '왼쪽')
  return parts.join(' ')
}
