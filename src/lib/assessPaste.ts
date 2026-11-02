import type { AssessItem, Assessment, AssessmentScore } from '../db/types'
import { circled } from './assessSheet'

/**
 * 구글 시트 · 엑셀에서 복사한 채점 결과를 기록표 칸으로 (2026-11-02 교사 요청).
 * 머리글 줄(번호 · 이름/성명 …)이 있어야 한다. 열은 머리글 이름으로 맞춘다:
 *  - 이름 · 성명 / 번호 → 학생 (이름 먼저, 같은 이름이 여럿이면 번호)
 *  - 글 칸 이름(예: 탐구주제(안전 저해요소)) → 글 칸
 *  - 요소 이름(예: ①융합성(40)) → 그 요소 점수 · 등급
 *  - ① ~ ⑳로 시작하는 나머지 열 → 체크리스트 요소의 항목 (TRUE · O · ✓ · 1 = 만족)
 *  - 제출 · 비고 → 제출 구분 · 메모
 *  - 만족 수 · 점수 · 합계 · 수준 → 앱이 다시 계산하므로 읽지 않는다
 * 순수 함수 — 저장은 화면에서.
 */

export interface PasteStudent {
  id: string
  name: string
  no: string
}

export interface PasteRow {
  studentId: string
  name: string
  patch: Pick<AssessmentScore, 'scores' | 'checks' | 'texts' | 'status' | 'note'>
}

export interface PasteResult {
  rows: PasteRow[]
  /** 열 맞춤 설명 (화면에 보여 줌) */
  columns: string[]
  problems: string[]
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/\(.*?\)/g, '').toLowerCase()
const TRUE = /^(true|o|ㅇ|✓|✔|v|1|y|yes|예|만족)$/i
const IGNORE = /만족|점수|합계|수준|총점/

/** 탭(시트 · 엑셀 복사) 또는 쉼표로 나눈 표. 큰따옴표로 감싼 칸 안의 줄바꿈도 한 칸으로 */
export function splitTable(text: string): string[][] {
  const tab = text.includes('\t')
  const sep = tab ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"' && cell === '') q = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

export function readPaste(text: string, a: Assessment, items: readonly AssessItem[], students: readonly PasteStudent[]): PasteResult {
  const table = splitTable(text)
  const problems: string[] = []
  const hi = table.findIndex((r) => r.some((c) => /^(이름|성명|학생\s*이름)$/.test(c.replace(/\s+/g, ' ').trim())) || r.some((c) => c.trim() === '번호'))
  if (hi < 0) return { rows: [], columns: [], problems: ['머리글 줄(번호 · 이름)을 찾지 못했어요. 시트의 머리글 줄부터 함께 복사해 주세요.'] }
  const head = table[hi]
  const used = new Set<number>()
  const find = (re: RegExp) => head.findIndex((c, i) => !used.has(i) && re.test(c.trim()))
  const take = (i: number) => (i >= 0 && used.add(i), i)
  const nameCol = take(find(/^(이름|성명|학생\s*이름)$/))
  const noCol = take(find(/^번호$/))
  const columns: string[] = []
  // 글 칸
  const textCols = (a.texts ?? []).map((t) => {
    const i = take(head.findIndex((c, k) => !used.has(k) && norm(c).startsWith(norm(t))))
    if (i >= 0) columns.push(`${head[i]} → 글 칸 '${t}'`)
    return { t, i }
  })
  // 요소 이름으로 맞는 열 (체크리스트 요소는 이름이 아니라 ①~ 열로)
  const itemCols = items.map((it) => {
    if (it.checks?.length) return { it, i: -1 }
    const label = norm(it.label)
    const i = take(head.findIndex((c, k) => !used.has(k) && !IGNORE.test(c) && label.length > 0 && norm(c.replace(/^[①-⑳]/, '')).includes(label)))
    if (i >= 0) columns.push(`${head[i]} → 요소 '${it.label}'`)
    return { it, i }
  })
  // 체크리스트 항목 열: ①, ②… 로 시작하는 남은 열
  const checkItem = items.find((it) => it.checks?.length)
  const checkCols: { k: number; i: number }[] = []
  if (checkItem) {
    checkItem.checks!.forEach((_, k) => {
      const i = take(head.findIndex((c, x) => !used.has(x) && c.trim().startsWith(circled(k))))
      if (i >= 0) checkCols.push({ k, i })
    })
    if (checkCols.length) columns.push(`${checkCols.map((c) => circled(c.k)).join('')} → '${checkItem.label}' 체크 ${checkCols.length}개`)
  }
  const statusCol = take(find(/제출/))
  if (statusCol >= 0) columns.push(`${head[statusCol]} → 제출 구분`)
  const noteCol = take(find(/^비고/))
  if (noteCol >= 0) columns.push(`${head[noteCol]} → 메모`)
  if (nameCol < 0 && noCol < 0) problems.push('이름 · 번호 열이 없어요.')

  const byName = new Map<string, PasteStudent[]>()
  for (const s of students) byName.set(norm(s.name), [...(byName.get(norm(s.name)) ?? []), s])
  const rows: PasteRow[] = []
  for (const r of table.slice(hi + 1)) {
    const name = nameCol >= 0 ? (r[nameCol] ?? '') : ''
    const no = noCol >= 0 ? (r[noCol] ?? '').replace(/번$/, '') : ''
    if (!name && !no) continue
    let st: PasteStudent | undefined
    const same = name ? (byName.get(norm(name)) ?? []) : []
    if (same.length === 1) st = same[0]
    else if (same.length > 1) st = same.find((s) => s.no === no)
    else if (!name && no) st = students.find((s) => s.no === no)
    if (!st) {
      problems.push(`${no ? `${no}번 ` : ''}${name || ''}: 이 수업반 명렬에서 찾지 못했어요${same.length > 1 ? ' (같은 이름이 여럿)' : ''}.`)
      continue
    }
    const label = `${st.no}번 ${st.name}`
    const patch: PasteRow['patch'] = { scores: {}, checks: {}, texts: {} }
    for (const { t, i } of textCols) if (i >= 0 && r[i]) patch.texts![t] = r[i]
    for (const { it, i } of itemCols) {
      if (i < 0) continue
      const v = (r[i] ?? '').trim()
      if (!v) continue
      if (it.method === 'level') {
        const lv = it.levels?.find((l) => norm(l.label) === norm(v)) ?? it.levels?.find((l) => Number(v) === l.points)
        if (lv) patch.scores[it.id] = lv.label
        else problems.push(`${label} '${it.label}': '${v}'는 등급표에 없는 값이에요.`)
      } else {
        const n = Number(v)
        if (Number.isFinite(n)) patch.scores[it.id] = n
        else problems.push(`${label} '${it.label}': '${v}'는 숫자가 아니에요.`)
      }
    }
    if (checkItem && checkCols.length) {
      const on = checkCols.filter(({ i }) => TRUE.test((r[i] ?? '').trim())).map(({ k }) => k)
      patch.checks![checkItem.id] = on
      patch.scores[checkItem.id] = on.length
    }
    if (statusCol >= 0) {
      const v = (r[statusCol] ?? '').trim()
      const sp = a.specials?.find((x) => norm(x.label) === norm(v) || norm(x.label).startsWith(norm(v)) && norm(v).length >= 2)
      // '' = 정상 제출(저장할 때 제출 구분을 지움)
      patch.status = sp ? sp.label : ''
      if (!sp && v && !/^(o|ㅇ|정상|제출|○)$/i.test(v)) problems.push(`${label} 제출 구분 '${v}'는 이 평가에 없는 구분이에요 (정상 제출로 둠).`)
    }
    if (noteCol >= 0 && r[noteCol]) patch.note = r[noteCol]
    rows.push({ studentId: st.id, name: label, patch })
  }
  if (!rows.length && !problems.length) problems.push('머리글 아래에 학생 줄이 없어요.')
  return { rows, columns, problems }
}
