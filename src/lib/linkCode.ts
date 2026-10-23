import qrcode from 'qrcode-generator'
import type { StudentPaps } from './paps'

/**
 * 튼튼몬 연동 코드 v1 (PELOG_LINK_FORMAT.md). 체력요인 4개 등급 + 측정일만 담는 7글자 코드.
 * 이름·학번·성별·측정값·BMI는 넣지 않는다. 계산은 문서의 참고 코드와 똑같이 한다(튼튼몬과 같은 코드가 나와야 함).
 * 발급한 코드는 저장하지 않고 볼 때마다 다시 계산한다.
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ' // 31자: 0 1 I L O 없음
const BASE = 31 // 소수 → 체크값이 한 글자 오타·이웃 글자 바뀜을 모두 잡음
const VERSION = 1
const EPOCH = Date.UTC(2024, 0, 1) // 날짜 0 = 2024-01-01
const DAY_MS = 86400000
const DAYS = 16384 // 2024-01-01 ~ 2068-11-08

export type LinkGrade = number | null

export interface LinkGrades {
  cardio: LinkGrade
  strength: LinkGrade
  flex: LinkGrade
  power: LinkGrade
}

const dayIndex = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS)
}
const fromDayIndex = (n: number): string => new Date(EPOCH + n * DAY_MS).toISOString().slice(0, 10)
/** 체크값: 1~7번째 글자 값 × 자리 번호(1~7)의 합이 31로 나누어떨어지게 (9 = 7의 역수, mod 31) */
const checkValue = (vals: number[]): number => {
  const s = vals.reduce((a, v, i) => a + (i + 1) * v, 0) % BASE
  return ((BASE - s) * 9) % BASE
}

/** 코드 만들기. 등급은 1~5, 측정 안 했으면 null. date = 'YYYY-MM-DD'. 결과는 'XXXX-XXX' */
export function makeCode({ cardio, strength, flex, power, date }: LinkGrades & { date: string }): string {
  const g = [cardio, strength, flex, power].map((x) => (x === null || x === undefined ? 0 : Number(x)))
  if (g.some((x) => !Number.isInteger(x) || x < 0 || x > 5)) throw new Error('등급은 1~5 또는 빈칸')
  if (g.every((x) => x === 0)) throw new Error('등급이 하나도 없어요')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || fromDayIndex(dayIndex(date)) !== date) throw new Error('날짜 형식: YYYY-MM-DD')
  const d = dayIndex(date)
  if (d < 0 || d >= DAYS) throw new Error('날짜 범위: 2024-01-01 ~ 2068-11-08')
  let n = (((g[0] * 6 + g[1]) * 6 + g[2]) * 6 + g[3]) * DAYS + d
  const body: number[] = []
  for (let i = 0; i < 5; i++) {
    body.unshift(n % BASE)
    n = Math.floor(n / BASE)
  }
  const vals = [7 + VERSION, ...body]
  vals.push(checkValue(vals))
  const s = vals.map((v) => ALPHABET[v]).join('')
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export type ReadResult =
  | { ok: true; version: number; date: string; grades: LinkGrades }
  | { ok: false; reason: 'confusable' | 'length' | 'char' | 'check' | 'version' | 'range' }

/** 코드 읽기 (튼튼몬 쪽과 같은 규칙). 앱에서는 테스트로 왕복 확인에만 쓴다 */
export function readCode(text: string): ReadResult {
  const s = String(text || '').toUpperCase().replace(/[\s-]/g, '')
  if (/[01ILO]/.test(s)) return { ok: false, reason: 'confusable' }
  if (s.length !== 7) return { ok: false, reason: 'length' }
  const vals = [...s].map((c) => ALPHABET.indexOf(c))
  if (vals.some((v) => v < 0)) return { ok: false, reason: 'char' }
  if (vals.reduce((a, v, i) => a + (i + 1) * v, 0) % BASE !== 0) return { ok: false, reason: 'check' }
  const version = vals[0] - 7
  if (version !== VERSION) return { ok: false, reason: 'version' }
  let n = 0
  for (const v of vals.slice(1, 6)) n = n * BASE + v
  const d = n % DAYS
  let gi = Math.floor(n / DAYS)
  if (gi > 1295) return { ok: false, reason: 'range' }
  const g: number[] = []
  for (let i = 0; i < 4; i++) {
    g.unshift(gi % 6)
    gi = Math.floor(gi / 6)
  }
  if (g.every((x) => x === 0)) return { ok: false, reason: 'range' }
  const grade = (x: number): LinkGrade => x || null
  return { ok: true, version, date: fromDayIndex(d), grades: { cardio: grade(g[0]), strength: grade(g[1]), flex: grade(g[2]), power: grade(g[3]) } }
}

/** 이미 계산한 PAPS 결과에서 4개 요인의 숫자 등급만 (BMI·측정값은 쓰지 않음). 기록이 없는 요인은 null */
export function linkGrades(p: StudentPaps | null | undefined): LinkGrades {
  const of = (factor: string): LinkGrade => {
    const g = p?.factors.find((f) => f.factor === factor)?.band?.grade
    return typeof g === 'number' ? g : null
  }
  return { cardio: of('심폐지구력'), strength: of('근력·근지구력'), flex: of('유연성'), power: of('순발력') }
}

export type SlipResult = { ok: true; code: string } | { ok: false; reason: 'excluded' | 'noGrades' | 'noDate' | 'badDate' }

/** 학생 한 명의 쪽지 코드. 측정 제외 → 코드 없음, 4개 모두 빈칸 → 코드 없음, 회차 측정일이 없으면 → 코드 없음 */
export function slipCode(p: StudentPaps | null | undefined, excluded: boolean, date: string | null): SlipResult {
  if (excluded) return { ok: false, reason: 'excluded' }
  const g = linkGrades(p)
  if (!g.cardio && !g.strength && !g.flex && !g.power) return { ok: false, reason: 'noGrades' }
  if (!date) return { ok: false, reason: 'noDate' }
  try {
    return { ok: true, code: makeCode({ ...g, date }) }
  } catch {
    return { ok: false, reason: 'badDate' }
  }
}

/** QR 칸 (코드 글자만, 영숫자 모드, 오류 정정 M). true = 검은 칸 */
export function qrModules(code: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(code, 'Alphanumeric')
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}
