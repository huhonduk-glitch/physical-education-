/**
 * 나이스 교육정보 개방 포털 (https://open.neis.go.kr) 공개 자료 불러오기 — 재설계 5단계 (2026-10-10 교사 승인).
 *
 * 보내는 것: 학교 이름(검색할 때) · 교육청 코드 · 학교 코드 · 날짜 · (있으면) 교사의 인증키. **학생 정보는 보내지 않는다.**
 * 받는 것: 학교 정보 · 학급 목록 · 반별 시간표(과목명) · 학사일정. 교사 이름·학생 명단은 공개 자료에 없다.
 *
 * 인증키가 없으면 맛보기로 앞 5줄만 준다(쪽을 넘겨도 같은 5줄 — 2026-10-10 실제 응답으로 확인).
 * 그래서 학교 찾기만 인증키 없이 되고, 학급·시간표·학사일정은 인증키가 있어야 한다.
 * 응답 모양(실제 응답에서 확인): { [서비스]: [{ head: [{list_total_count}, {RESULT:{CODE,MESSAGE}}] }, { row: [...] }] }
 * 자료가 없으면 { RESULT: { CODE: 'INFO-200' } }, 오류면 { RESULT: { CODE: 'ERROR-xxx', MESSAGE } }.
 */

export const NEIS_BASE = 'https://open.neis.go.kr/hub/'

export type SchoolKind = '초' | '중' | '고' | '기타'

export interface NeisSchool {
  officeCode: string
  officeName: string
  schoolCode: string
  name: string
  kind: SchoolKind
  address: string
}

export interface NeisClass {
  grade: number
  classNo: number
  /** 반 이름 원문 (숫자가 아닐 수도 있다) */
  className: string
  dept: string
  course: string
}

export interface NeisLesson {
  /** yyyy-mm-dd */
  date: string
  /** 1=월 … 5=금 (토·일은 0·6) */
  day: number
  grade: number
  classNo: number
  className: string
  period: number
  subject: string
}

export interface NeisEvent {
  date: string
  name: string
  /** 해당 학년 (비어 있으면 전체) */
  grades: number[]
}

type Row = Record<string, string | null | undefined>

export class NeisError extends Error {}

/** 응답 → 줄 목록과 전체 개수. 자료 없음은 빈 목록 */
export function parseNeis(json: unknown, service: string): { rows: Row[]; total: number } {
  const j = json as Record<string, unknown>
  const result = (j?.RESULT ?? null) as { CODE?: string; MESSAGE?: string } | null
  if (result) {
    if (result.CODE === 'INFO-200') return { rows: [], total: 0 }
    throw new NeisError(neisMessage(result.CODE, result.MESSAGE))
  }
  const body = j?.[service] as { head?: unknown[]; row?: Row[] }[] | undefined
  if (!Array.isArray(body)) throw new NeisError('나이스 응답을 알아보지 못했어요')
  const head = (body[0]?.head ?? []) as Record<string, unknown>[]
  const total = Number(head.find((h) => 'list_total_count' in h)?.list_total_count ?? 0)
  const code = (head.find((h) => 'RESULT' in h)?.RESULT as { CODE?: string; MESSAGE?: string } | undefined) ?? {}
  if (code.CODE && code.CODE !== 'INFO-000') throw new NeisError(neisMessage(code.CODE, code.MESSAGE))
  return { rows: body[1]?.row ?? [], total }
}

export function neisMessage(code?: string, message?: string): string {
  if (code === 'ERROR-290') return '인증키가 맞지 않아요. 설정에서 인증키를 다시 확인해 주세요.'
  if (code === 'ERROR-337') return '오늘 쓸 수 있는 횟수를 다 썼어요. 내일 다시 해 주세요.'
  if (code === 'ERROR-500' || code === 'ERROR-600') return '나이스 서버에 문제가 있어요. 잠시 뒤 다시 해 주세요.'
  return message ? `나이스: ${message}` : '나이스에서 자료를 받지 못했어요'
}

const ymd = (s: string | null | undefined) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '')
const num = (s: string | null | undefined) => {
  const n = Number(String(s ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
const kindOf = (s: string | null | undefined): SchoolKind => (s?.includes('고등') ? '고' : s?.includes('중학') ? '중' : s?.includes('초등') ? '초' : '기타')

export function toSchool(r: Row): NeisSchool {
  return {
    officeCode: r.ATPT_OFCDC_SC_CODE ?? '',
    officeName: r.ATPT_OFCDC_SC_NM ?? '',
    schoolCode: r.SD_SCHUL_CODE ?? '',
    name: r.SCHUL_NM ?? '',
    kind: kindOf(r.SCHUL_KND_SC_NM),
    address: `${r.ORG_RDNMA ?? ''}`.trim(),
  }
}

export function toClass(r: Row): NeisClass {
  return { grade: num(r.GRADE), classNo: num(r.CLASS_NM), className: r.CLASS_NM ?? '', dept: r.DDDEP_NM ?? '', course: r.DGHT_CRSE_SC_NM ?? '' }
}

/** 시간표 과목명 앞뒤 기호·공백 정리 (예: '-체육 ' → '체육') */
export const cleanSubject = (s: string | null | undefined) => String(s ?? '').replace(/^[\s\-*·]+|[\s\-*·]+$/g, '')

export function toLesson(r: Row): NeisLesson {
  const date = ymd(r.ALL_TI_YMD)
  return {
    date,
    day: date ? new Date(`${date}T00:00:00`).getDay() : 0,
    grade: num(r.GRADE),
    classNo: num(r.CLASS_NM),
    className: r.CLASS_NM ?? '',
    period: num(r.PERIO),
    subject: cleanSubject(r.ITRT_CNTNT),
  }
}

export function toEvent(r: Row): NeisEvent {
  const flags = [r.ONE_GRADE_EVENT_YN, r.TW_GRADE_EVENT_YN, r.THREE_GRADE_EVENT_YN, r.FR_GRADE_EVENT_YN, r.FIV_GRADE_EVENT_YN, r.SIX_GRADE_EVENT_YN]
  const grades = flags.flatMap((f, i) => (f === 'Y' ? [i + 1] : []))
  return { date: ymd(r.AA_YMD), name: (r.EVENT_NM ?? '').trim(), grades }
}

export const TIMETABLE_SERVICE: Record<SchoolKind, string> = { 고: 'hisTimetable', 중: 'misTimetable', 초: 'elsTimetable', 기타: 'hisTimetable' }

/** 체육 과목으로 보이는지 (2015·2022 개정 과목명 + 학교 자율 과목 이름에 흔한 말). 교사가 화면에서 고칠 수 있는 첫 추천일 뿐이다 */
export function looksLikePe(subject: string): boolean {
  return /체육|운동|스포츠|건강|댄스|무용|레저|요가|구기|육상|수영/.test(subject.replace(/\s+/g, ''))
}

export interface SlotGroup {
  key: string
  day: number
  period: number
  subject: string
  classes: { grade: number; classNo: number; className: string }[]
}

/**
 * 한 주 시간표 → 요일·교시·과목별 묶음. 같은 시각 같은 과목을 여러 반이 들으면(합반·선택과목) 한 묶음이 된다.
 * 여러 주를 받아도 같은 요일·교시·과목은 하나로 합친다.
 */
export function slotGroups(lessons: readonly NeisLesson[], filter: (subject: string) => boolean = () => true): SlotGroup[] {
  const m = new Map<string, SlotGroup>()
  for (const l of lessons) {
    if (l.day < 1 || l.day > 5 || !l.period || !l.subject || !filter(l.subject)) continue
    const key = `${l.day}|${l.period}|${l.subject}`
    const g = m.get(key) ?? m.set(key, { key, day: l.day, period: l.period, subject: l.subject, classes: [] }).get(key)!
    if (!g.classes.some((c) => c.grade === l.grade && c.className === l.className)) g.classes.push({ grade: l.grade, classNo: l.classNo, className: l.className })
  }
  for (const g of m.values()) g.classes.sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
  return [...m.values()].sort((a, b) => a.day - b.day || a.period - b.period || a.subject.localeCompare(b.subject, 'ko'))
}

/** 날짜가 든 주의 월요일·금요일 (yyyy-mm-dd) */
export function weekOf(date: string): [string, string] {
  const d = new Date(`${date}T00:00:00`)
  const dow = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - (dow - 1))
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return [f(mon), f(fri)]
}

const compact = (d: string) => d.replaceAll('-', '')

export function neisUrl(service: string, params: Record<string, string | number | undefined>, key?: string): string {
  const q = new URLSearchParams({ Type: 'json' })
  if (key?.trim()) q.set('KEY', key.trim())
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  return `${NEIS_BASE}${service}?${q.toString()}`
}

type Fetcher = (url: string) => Promise<unknown>
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 한 번 받기. 잠깐 끊기면(와이파이·서버 혼잡) 3번까지 다시 해 본다 */
const defaultFetch: Fetcher = async (url) => {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    if (i) await wait(600 * i)
    try {
      const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
      if (res.ok) return res.json()
      last = new NeisError(`나이스 서버가 응답하지 않아요 (${res.status})`)
      if (res.status < 500 && res.status !== 429) break
    } catch {
      last = new NeisError('인터넷에 연결되지 않았어요. 와이파이를 확인해 주세요.')
    }
  }
  throw last
}

export const NEED_KEY = '인증키가 있어야 전부 받을 수 있어요. 아래 [인증키]에 넣어 주세요 (무료).'

/**
 * 쪽을 넘기며 모두 받기 (인증키가 있으면 한 번에 1000줄).
 * 인증키가 없으면 맛보기 5줄뿐이라: allowPartial이면 그 5줄만, 아니면 전체가 5줄보다 많을 때 인증키를 달라고 한다.
 */
export async function fetchAll(
  service: string,
  params: Record<string, string | number | undefined>,
  opts: { key?: string; fetcher?: Fetcher; onProgress?: (done: number, total: number) => void; maxRows?: number; allowPartial?: boolean } = {},
): Promise<Row[]> {
  const hasKey = !!opts.key?.trim()
  const size = hasKey ? 1000 : 5
  const get = opts.fetcher ?? defaultFetch
  const first = parseNeis(await get(neisUrl(service, { ...params, pIndex: 1, pSize: size }, opts.key)), service)
  if (!hasKey) {
    if (first.total > first.rows.length && !opts.allowPartial) throw new NeisError(NEED_KEY)
    return first.rows
  }
  const total = Math.min(first.total, opts.maxRows ?? 5000)
  const rows = [...first.rows]
  opts.onProgress?.(rows.length, total)
  const pages = Math.ceil(total / size)
  for (let p = 2; p <= pages; p += 2) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(2, pages - p + 1) }, (_, i) => get(neisUrl(service, { ...params, pIndex: p + i, pSize: size }, opts.key)).then((j) => parseNeis(j, service).rows)),
    )
    for (const b of batch) rows.push(...b)
    opts.onProgress?.(Math.min(rows.length, total), total)
  }
  return rows.slice(0, total)
}

export async function searchSchools(name: string, opts: { key?: string; fetcher?: Fetcher } = {}): Promise<NeisSchool[]> {
  const rows = await fetchAll('schoolInfo', { SCHUL_NM: name.trim() }, { ...opts, maxRows: 30, allowPartial: true })
  return rows.map(toSchool).filter((s) => s.kind === '중' || s.kind === '고')
}

export async function fetchClasses(s: NeisSchool, year: number, opts: { key?: string; fetcher?: Fetcher; onProgress?: (d: number, t: number) => void } = {}): Promise<NeisClass[]> {
  const rows = await fetchAll('classInfo', { ATPT_OFCDC_SC_CODE: s.officeCode, SD_SCHUL_CODE: s.schoolCode, AY: year }, opts)
  const seen = new Set<string>()
  return rows
    .map(toClass)
    .filter((c) => c.grade > 0 && c.classNo > 0 && !seen.has(`${c.grade}-${c.classNo}`) && !!seen.add(`${c.grade}-${c.classNo}`))
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
}

export async function fetchWeekTimetable(
  s: NeisSchool,
  date: string,
  opts: { key?: string; fetcher?: Fetcher; grade?: number; onProgress?: (d: number, t: number) => void } = {},
): Promise<NeisLesson[]> {
  const [from, to] = weekOf(date)
  const rows = await fetchAll(
    TIMETABLE_SERVICE[s.kind],
    { ATPT_OFCDC_SC_CODE: s.officeCode, SD_SCHUL_CODE: s.schoolCode, TI_FROM_YMD: compact(from), TI_TO_YMD: compact(to), GRADE: opts.grade },
    opts,
  )
  return rows.map(toLesson)
}

export async function fetchSchedule(s: NeisSchool, from: string, to: string, opts: { key?: string; fetcher?: Fetcher } = {}): Promise<NeisEvent[]> {
  const rows = await fetchAll('SchoolSchedule', { ATPT_OFCDC_SC_CODE: s.officeCode, SD_SCHUL_CODE: s.schoolCode, AA_FROM_YMD: compact(from), AA_TO_YMD: compact(to) }, { ...opts, maxRows: 500 })
  return rows
    .map(toEvent)
    .filter((e) => e.date && e.name && !/^토요휴업일$/.test(e.name))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 오늘부터 days일 안의 학사일정 (같은 날 같은 이름은 하나만, 방학 중 '방학' 줄이 매일 있는 경우도 한 번만) */
export function upcomingEvents(events: readonly NeisEvent[], today: string, days = 21, max = 4): NeisEvent[] {
  const end = new Date(`${today}T00:00:00`)
  end.setDate(end.getDate() + days)
  const last = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const seenName = new Set<string>()
  const out: NeisEvent[] = []
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.date < today || e.date > last || seenName.has(e.name)) continue
    seenName.add(e.name)
    out.push(e)
    if (out.length >= max) break
  }
  return out
}

/** 'D-3' / '오늘' */
export function dday(date: string, today: string): string {
  const d = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
  return d === 0 ? '오늘' : d > 0 ? `D-${d}` : `D+${-d}`
}
