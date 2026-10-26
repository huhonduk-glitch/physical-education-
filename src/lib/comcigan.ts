import { looksLikePe } from './neisOpenApi'

/**
 * 컴시간알리미 시간표 (2026-10-26 교사 결정: 학교 + 내 이름으로 시간표 가져오기, 다른 체육 선생님 겹침).
 * 컴시간은 공식 API가 없고 http만 되며 CORS가 없어 브라우저에서 바로 못 부른다 → 교사가 만든 중계(relay/comcigan-worker.js)를 거친다.
 * 오가는 것: 학교 이름 · 학교 코드 · 컴시간이 공개하는 시간표(과목 · 교사 이름 · 강의실). 학생 정보는 없다.
 * 해석 방법은 공개 라이브러리 comcigan-parser(MIT, leegeunhyeok)의 동작을 참고해 새로 썼다. 컴시간 구조가 바뀌면 동작하지 않을 수 있다.
 *
 * 칸 값: 학급 시간표(자료147) = 과목 × 분리 + 교사 (분리 = 100이면 교사 × 100 + 과목), 교사 시간표(자료542) = 과목 × 1000 + 학년 × 100 + 반.
 * 앞에 '>'가 붙으면 바뀐 수업(시간표 변경).
 */

export interface ComciConfig {
  /** 데이터 경로 번호 (예: '36179') */
  route: string
  /** 학교 찾기 접두 (예: '17384l') */
  searchPrefix: string
  /** 학교 코드 앞 (예: '73629_') */
  scPrefix: string
  /** 마지막 인자 (예: '1') */
  r: string
}

/** 학생용 첫 화면(/st, CP949) 글에서 바뀌는 코드들을 뽑는다 */
export function parseStPage(html: string): ComciConfig {
  const ra = /school_ra\(sc\)\s*\{\s*\$\.ajax\(\{\s*url:\s*'\.\/(\d+)\?([^']*)'\s*\+\s*sc/.exec(html)
  const sd = /sc_data\('([^']*)',\s*sc\s*,\s*(\d+)\s*,\s*'(\d+)'\)/.exec(html)
  if (!ra || !sd) throw new Error('컴시간 화면 구조가 바뀌어 읽지 못했어요.')
  return { route: ra[1], searchPrefix: ra[2], scPrefix: sd[1], r: sd[2] }
}

let cp949: Map<string, number[]> | null = null
/** CP949(EUC-KR) 바꿈표: 브라우저에는 CP949 인코더가 없어 디코더로 거꾸로 만든다 (한 번만) */
function cp949Table(): Map<string, number[]> {
  if (cp949) return cp949
  const m = new Map<string, number[]>()
  const dec = new TextDecoder('euc-kr')
  for (let a = 0x81; a <= 0xfe; a++)
    for (let b = 0x41; b <= 0xfe; b++) {
      const ch = dec.decode(new Uint8Array([a, b]))
      if (ch.length === 1 && ch !== '�' && !m.has(ch)) m.set(ch, [a, b])
    }
  cp949 = m
  return m
}

/** 학교 이름 → CP949 퍼센트 글 (컴시간 학교 찾기) */
export function cp949Percent(s: string): string {
  const t = cp949Table()
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c < 0x80) out += /[A-Za-z0-9]/.test(ch) ? ch : `%${c.toString(16).padStart(2, '0')}`
    else {
      const b = t.get(ch)
      if (!b) continue
      out += b.map((x) => `%${x.toString(16)}`).join('')
    }
  }
  return out
}

export function searchPath(cfg: ComciConfig, name: string): string {
  return `/${cfg.route}?${cfg.searchPrefix}${cp949Percent(name)}`
}

/** 시간표 자료 경로. week = 0 이번 주, 1 다음 주 … */
export function dataPath(cfg: ComciConfig, schoolCode: number, week = 0): string {
  return `/${cfg.route}?${btoa(`${cfg.scPrefix}${schoolCode}_${week}_${cfg.r}`)}`
}

/** 응답 끝의 찌꺼기를 자르고 JSON으로 */
export function parseJsonBody(body: string): unknown {
  return JSON.parse(body.slice(0, body.lastIndexOf('}') + 1))
}

export interface ComciSchool {
  code: number
  region: string
  name: string
}

export function parseSearch(json: unknown): ComciSchool[] {
  const list = (json as Record<string, unknown[][]>)['학교검색'] ?? []
  return list.map((r) => ({ region: String(r[1] ?? ''), name: String(r[2] ?? ''), code: Number(r[3]) })).filter((s) => Number.isFinite(s.code))
}

export interface ComciLesson {
  day: number
  period: number
  grade: number
  classNo: number
  subject: string
  teacher: string
  teacherNo: number
  room?: string
  changed: boolean
}

export interface ComciData {
  school: string
  teachers: string[]
  subjects: string[]
  /** 학년별 반 수 */
  classCount: number[]
  /** '1(08:20)' … */
  periodTimes: string[]
  /** [주 번호, '26-10-26 ~ 26-10-31'] */
  weeks: [number, string][]
  /** 학급 시간표 전부 (학급 칸 기준) */
  lessons: ComciLesson[]
}

const num = (v: unknown) => {
  if (typeof v === 'number') return { n: v, changed: false }
  const s = String(v ?? '')
  return { n: Number(s.replace(/^>/, '')) || 0, changed: s.startsWith('>') }
}

/** 시간표 자료 → 학급 시간표 칸 목록 (과목 · 교사 · 강의실) */
export function parseData(json: unknown): ComciData {
  const d = json as Record<string, unknown>
  const sep = Number(d['분리'] ?? 1000)
  const teachers = (d['자료446'] as string[] | undefined) ?? []
  const subjects = ((d['자료492'] as unknown[] | undefined) ?? []).map((x) => String(x))
  const classCount = ((d['학급수'] as number[] | undefined) ?? []).map(Number)
  const table = (d['자료147'] as unknown[][][][] | undefined) ?? []
  const rooms = (d['자료245'] as unknown[][][][] | undefined) ?? []
  const lessons: ComciLesson[] = []
  for (let g = 1; g < table.length; g++) {
    const byClass = table[g] as unknown as unknown[][][]
    for (let c = 1; c <= (classCount[g] ?? 0) && c < (byClass?.length ?? 0); c++) {
      for (let day = 1; day <= 5; day++) {
        const row = (byClass[c]?.[day] as unknown[] | undefined) ?? []
        for (let p = 1; p < row.length; p++) {
          const { n, changed } = num(row[p])
          if (!n) continue
          const subj = sep === 100 ? n % 100 : Math.floor(n / sep)
          const tno = sep === 100 ? Math.floor(n / 100) : n % sep
          const roomRaw = String((rooms[g] as unknown as unknown[][][] | undefined)?.[c]?.[day]?.[p] ?? '')
          lessons.push({
            day,
            period: p,
            grade: g,
            classNo: c,
            subject: subjects[subj] ?? '',
            teacher: teachers[tno] ?? '',
            teacherNo: tno,
            room: roomRaw.replace(/^\d+_/, '') || undefined,
            changed,
          })
        }
      }
    }
  }
  return {
    school: String(d['학교명'] ?? ''),
    teachers,
    subjects,
    classCount,
    periodTimes: ((d['일과시간'] as string[] | undefined) ?? []).map(String),
    weeks: ((d['일자자료'] as [number, string][] | undefined) ?? []).map((w) => [Number(w[0]), String(w[1])]),
    lessons,
  }
}

/** 이름으로 교사 찾기 (띄어쓰기 무시, 성만 다르게 적힌 경우는 찾지 않음) */
export function findTeacher(data: ComciData, name: string): number[] {
  const n = name.replace(/\s+/g, '')
  if (!n) return []
  return data.teachers.map((t, i) => (i > 0 && t.replace(/[\s*]+/g, '') === n ? i : -1)).filter((i) => i > 0)
}

export function teacherLessons(data: ComciData, teacherNo: number): ComciLesson[] {
  return data.lessons.filter((l) => l.teacherNo === teacherNo).sort((a, b) => a.day - b.day || a.period - b.period || a.grade - b.grade || a.classNo - b.classNo)
}

/** 체육 과목을 가르치는 교사 번호 (과목 이름이 체육 · 운동 · 스포츠 … 이거나 강의실이 체육관 · 운동장) */
export function peTeacherNos(data: ComciData, isPe: (subject: string) => boolean = looksLikePe): number[] {
  const set = new Set<number>()
  for (const l of data.lessons) if (l.teacherNo && (isPe(l.subject) || /체육관|운동장|강당/.test(l.room ?? ''))) set.add(l.teacherNo)
  return [...set].sort((a, b) => a - b)
}

export interface ComciPeCell {
  day: number
  period: number
  /** 같은 시각의 체육 선생님 수업 (교사마다 한 줄, 합반은 반을 묶음) */
  items: { teacher: string; teacherNo: number; classes: string[]; subject: string; room?: string; changed: boolean }[]
  /** 같은 강의실(체육관 등)을 둘 이상이 쓰는지 */
  roomClash: string[]
}

/** 체육 선생님들의 한 주: 요일 × 교시 */
export function peGrid(data: ComciData, teacherNos: readonly number[]): Map<string, ComciPeCell> {
  const out = new Map<string, ComciPeCell>()
  const pick = new Set(teacherNos)
  for (const l of data.lessons) {
    if (!pick.has(l.teacherNo)) continue
    const k = `${l.day}|${l.period}`
    const cell = out.get(k) ?? out.set(k, { day: l.day, period: l.period, items: [], roomClash: [] }).get(k)!
    const it = cell.items.find((x) => x.teacherNo === l.teacherNo && x.subject === l.subject)
    const cls = `${l.grade}-${l.classNo}`
    if (it) {
      if (!it.classes.includes(cls)) it.classes.push(cls)
    } else cell.items.push({ teacher: l.teacher, teacherNo: l.teacherNo, classes: [cls], subject: l.subject, room: l.room, changed: l.changed })
  }
  for (const c of out.values()) {
    const rooms = new Map<string, number>()
    for (const it of c.items) if (it.room) rooms.set(it.room, (rooms.get(it.room) ?? 0) + 1)
    c.roomClash = [...rooms.entries()].filter(([, n]) => n >= 2).map(([r]) => r)
    c.items.sort((a, b) => a.teacherNo - b.teacherNo)
  }
  return out
}
