import type { AttendReason, AttendStatus } from '../db/types'

/**
 * 나이스 출결과 맞춰 보기 (2026-11-26 교사 요청 '출결 엑셀은 인터넷에서 찾아봐', 슈퍼스쿨 '나이스 자료 비교' 참고).
 * 근거(양식): 나이스 [학급별출결현황] 엑셀 — 학급 하나 · 달 하나. 머리글 = 번호 · 성명 · 수업일수 · 결석/지각/조퇴/결과 × 질병/미인정/기타/인정 · 결석총계/지각총계/조퇴총계/결과총계
 * (예전 양식은 인정 칸이 없다). 칸 이름은 슈퍼스쿨이 이 파일을 읽는 공개 화면 코드(2026-11-24 확인)와 2025 기재요령 출결상황(질병 · 미인정 · 기타, 출석인정)을 대조함.
 * 이 파일은 학급 하루 전체(모든 교과) 출결이라, 체육 수업 기록이 나이스보다 많은 칸만 '빠졌을 수 있음'으로 알린다(적은 것은 다른 교과 때문일 수 있어 정상).
 * 파일은 기기 안에서만 읽고 저장하지 않는다.
 */

export const KINDS: { status: AttendStatus; label: string }[] = [
  { status: 'absent', label: '결석' },
  { status: 'late', label: '지각' },
  { status: 'early', label: '조퇴' },
  { status: 'result', label: '결과' },
]
export const REASONS: AttendReason[] = ['질병', '미인정', '기타', '인정']

export type CountKey = `${AttendStatus}|${AttendReason}`
export type Counts = Partial<Record<CountKey, number>>

export interface NeisAttendRow {
  no: number
  name: string
  /** 수업일수 */
  days?: number
  counts: Counts
}

export interface NeisAttendFile {
  /** 제목에서 찾은 학급 (예: '3학년 9반') */
  grade?: number
  classNo?: number
  rows: NeisAttendRow[]
  /** 인정 칸이 있는 양식인지 */
  hasRecognized: boolean
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, '')
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const KIND_OF = new Map(KINDS.map((k) => [k.label, k.status]))

/** 엑셀 칸(행 × 열) → 나이스 학급별출결현황. 머리글을 이름으로 찾는다(빈칸 · 열 순서가 달라도). 못 읽으면 오류 글 */
export function readNeisAttend(grid: readonly (readonly unknown[])[]): NeisAttendFile | { error: string } {
  // 학급: 위쪽 줄 어딘가의 'N학년 N반'
  let grade: number | undefined
  let classNo: number | undefined
  for (const row of grid.slice(0, 8)) {
    const m = /(\d{1,2})학년\s*(\d{1,2})반/.exec(row.map((c) => String(c ?? '')).join(' '))
    if (m) {
      grade = Number(m[1])
      classNo = Number(m[2])
      break
    }
  }
  const head = grid.findIndex((row) => {
    const cells = row.map(clean)
    return cells.includes('번호') && (cells.includes('성명') || cells.includes('이름'))
  })
  if (head < 0) return { error: "머리글(번호 · 성명)을 찾지 못했어요. 나이스 [학급별출결현황]에서 받은 엑셀을 그대로 올려 주세요." }
  const top = grid[head].map(clean)
  const col = { no: top.indexOf('번호'), name: top.includes('성명') ? top.indexOf('성명') : top.indexOf('이름'), days: top.findIndex((c) => c === '수업일수') }
  // 결석 · 지각 · 조퇴 · 결과 아래(같은 줄 또는 다음 줄)의 사유 칸
  const map: { col: number; key: CountKey }[] = []
  const tryLevel = (labels: string[], subs: string[]) => {
    let group: AttendStatus | null = null
    for (let c = 0; c < Math.max(labels.length, subs.length); c++) {
      const g = KIND_OF.get(labels[c] ?? '')
      if (g) group = g
      else if (labels[c] && /계$/.test(labels[c])) group = null
      // '결석-질병'처럼 한 칸에 둘 다
      const both = /^(결석|지각|조퇴|결과)-?(질병|미인정|기타|인정)$/.exec(subs[c] ?? '') ?? /^(결석|지각|조퇴|결과)-?(질병|미인정|기타|인정)$/.exec(labels[c] ?? '')
      if (both) {
        map.push({ col: c, key: `${KIND_OF.get(both[1])!}|${both[2] as AttendReason}` })
        continue
      }
      const r = subs[c] as AttendReason
      if (group && REASONS.includes(r)) map.push({ col: c, key: `${group}|${r}` })
    }
  }
  const sub = (grid[head + 1] ?? []).map(clean)
  tryLevel(top, sub)
  if (!map.length) tryLevel(top, top)
  if (!map.length) return { error: '결석 · 지각 · 조퇴 · 결과 칸을 찾지 못했어요. 나이스 [학급별출결현황] 엑셀인지 확인해 주세요.' }
  const startAt = sub.some((c) => REASONS.includes(c as AttendReason)) ? head + 2 : head + 1
  const rows: NeisAttendRow[] = []
  for (const row of grid.slice(startAt)) {
    const no = num(row[col.no])
    const name = String(row[col.name] ?? '').trim()
    if (!no || !name || /계|합/.test(name)) continue
    const counts: Counts = {}
    for (const m of map) {
      const v = num(row[m.col])
      if (v) counts[m.key] = (counts[m.key] ?? 0) + v
    }
    rows.push({ no, name, ...(col.days >= 0 ? { days: num(row[col.days]) } : {}), counts })
  }
  if (!rows.length) return { error: '학생 줄을 찾지 못했어요.' }
  return { grade, classNo, rows, hasRecognized: map.some((m) => m.key.endsWith('|인정')) }
}

/** 체육 수업 출결 → 학생마다 그 달 횟수 (같은 날 같은 종류 · 사유는 한 번 — 나이스는 날마다 셈). 사유가 없으면 사유 칸에는 안 넣고 합계에만 */
export function pelogCounts(rows: readonly { studentId: string; date: string; status: AttendStatus; reason?: AttendReason }[], month: string): Map<string, { counts: Counts; totals: Partial<Record<AttendStatus, number>> }> {
  const seen = new Set<string>()
  const out = new Map<string, { counts: Counts; totals: Partial<Record<AttendStatus, number>> }>()
  for (const r of rows) {
    if (!r.date.startsWith(month)) continue
    const k = `${r.studentId}|${r.date}|${r.status}`
    if (seen.has(k)) continue
    seen.add(k)
    const o = out.get(r.studentId) ?? out.set(r.studentId, { counts: {}, totals: {} }).get(r.studentId)!
    o.totals[r.status] = (o.totals[r.status] ?? 0) + 1
    if (r.reason) o.counts[`${r.status}|${r.reason}`] = (o.counts[`${r.status}|${r.reason}`] ?? 0) + 1
  }
  return out
}

export interface CompareLine {
  studentId: string
  no: number
  name: string
  /** 체육 기록이 나이스보다 많은 칸 (예: 결과 미인정 PE 2 · 나이스 1) */
  more: { label: string; pe: number; neis: number }[]
}

/**
 * 맞춰 보기: 학생을 번호 + 이름으로 잇고(이름은 들어 있으면), 종류 합계 · 종류×사유마다 체육 기록 > 나이스인 곳만.
 * 반환: 이은 학생 수 · 못 이은 나이스 줄 · 다른 학생 목록.
 */
export function compareAttend(
  file: NeisAttendFile,
  students: readonly { id: string; number: number; name: string }[],
  pe: ReturnType<typeof pelogCounts>,
): { matched: number; unmatched: string[]; lines: CompareLine[] } {
  const lines: CompareLine[] = []
  const unmatched: string[] = []
  let matched = 0
  for (const r of file.rows) {
    const s = students.find((x) => x.number === r.no && (r.name.includes(x.name) || x.name.includes(r.name)))
    if (!s) {
      unmatched.push(`${r.no} ${r.name}`)
      continue
    }
    matched++
    const mine = pe.get(s.id)
    if (!mine) continue
    const more: CompareLine['more'] = []
    for (const k of KINDS) {
      const neisTotal = REASONS.reduce((t, rr) => t + (r.counts[`${k.status}|${rr}`] ?? 0), 0)
      const peTotal = mine.totals[k.status] ?? 0
      if (peTotal > neisTotal) more.push({ label: `${k.label} 합계`, pe: peTotal, neis: neisTotal })
      for (const rr of REASONS) {
        if (rr === '인정' && !file.hasRecognized) continue
        const p = mine.counts[`${k.status}|${rr}`] ?? 0
        const n = r.counts[`${k.status}|${rr}`] ?? 0
        if (p > n && peTotal <= neisTotal) more.push({ label: `${k.label} ${rr}`, pe: p, neis: n })
      }
    }
    if (more.length) lines.push({ studentId: s.id, no: r.no, name: s.name, more })
  }
  return { matched, unmatched, lines: lines.sort((a, b) => a.no - b.no) }
}
