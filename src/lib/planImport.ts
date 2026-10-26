import type { Cell } from './pdfTable'
import type { WeekRow } from './progressPlan'
import { STANDARDS } from './standards'

/**
 * 진도표 파일 읽기 (6-5). 순수 함수.
 * 학교 평가계획서의 '교수학습 운영 계획' 표(월 · 주(학점) · 단원명 · 성취기준 · 수업방법 · 평가방법)를 주차 계획으로 바꾼다.
 * 시도마다 양식이 달라 열 위치를 고정하지 않고 머리글 낱말로 찾는다. 결과는 반드시 미리보기에서 교사가 확인한다.
 */

export interface ParsedPlan {
  weeks: WeekRow[]
  /** 범교과 연계 (사회정서 · 안전 · 생태전환 · 인성 …): 시기와 주제 */
  extras: { when: string; label: string }[]
  warnings: string[]
}

/** 성취기준 코드: [12스생2-01-01], 〔12스생2-01-01 처럼 괄호가 빠져도 찾는다 */
const CODE = /(\d{1,2}[가-힣]+\d*(?:-\d{2}){1,2})(?![\d-])/g
const ALL_CODES = STANDARDS.subjects.flatMap((s) => s.areas.flatMap((a) => a.standards.map((x) => x.code)))
export function standardCodes(text: string): string[] {
  const out: string[] = []
  const ms = [...text.matchAll(CODE)]
  ms.forEach((m, i) => {
    out.push(`[${m[1]}]`)
    // '[12운건02-03] ~ [12운건02-04]'처럼 범위면 사이 성취기준도 (성취기준 목록에 있는 것만)
    const next = ms[i + 1]
    if (next && /^[\]\s〕]*[~∼〜-]\s*[[〔]?$/.test(text.slice(m.index! + m[1].length, next.index))) {
      const prefix = m[1].replace(/-\d{2}$/, '')
      const lo = `[${m[1]}]`
      const hi = `[${next[1]}]`
      for (const c of ALL_CODES) if (c > lo && c < hi && c.startsWith(`[${prefix}`)) out.push(c)
    }
  })
  return [...new Set(out)]
}

/** '1. 배드민턴 이해하기' → '배드민턴 이해하기' */
export function cleanUnit(s: string): string {
  return s
    .replace(/^\s*(\d+|[가-하])[.)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const EVENT = /고\s*사|시\s*험|휴\s*업|방\s*학|체\s*험\s*학\s*습|수\s*학\s*여\s*행|축\s*제|행\s*사/
const WEEK_CELL = /^(\d{1,2})\s*(?:주)?\s*[(（]\s*(\d)\s*[)）]$/

const cx = (c: Cell) => (c.x0 + c.x1) / 2
const cy = (c: Cell) => (c.y0 + c.y1) / 2
const area = (c: Cell) => (c.x1 - c.x0) * (c.y1 - c.y0)

function cellAt(cells: readonly Cell[], x: number, y: number): Cell | undefined {
  let best: Cell | undefined
  for (const c of cells) if (x >= c.x0 - 0.5 && x <= c.x1 + 0.5 && y >= c.y0 - 0.5 && y <= c.y1 + 0.5 && (!best || area(c) < area(best))) best = c
  return best
}

const norm = (s: string) => s.replace(/\s+/g, '')

/** PDF 쪽마다의 칸 → 주차 계획 */
export function weeksFromCells(pages: readonly Cell[][]): ParsedPlan {
  const weeks: WeekRow[] = []
  const extras: { when: string; label: string }[] = []
  const warnings: string[] = []
  let month: number | undefined

  for (const cells of pages) {
    // 1) 머리글: '단원'과 '성취기준'이 같은 줄에 있는 표
    const unitH = cells.find((c) => /단원/.test(norm(c.text)) && norm(c.text).length <= 8)
    const stdH = unitH && cells.find((c) => /성취기준/.test(norm(c.text)) && norm(c.text).length <= 16 && Math.abs(cy(c) - cy(unitH)) < 25)
    if (unitH && stdH) {
      const headerY = Math.min(unitH.y0, stdH.y0)
      const inHeader = (c: Cell) => c.y0 >= headerY - 1 && c.y0 < headerY + 40 && c.y1 > headerY
      const header = cells.filter(inHeader)
      const methodH = header.find((c) => /수업방법|교수방법|지도방법/.test(norm(c.text)))
      const evalH = header.find((c) => norm(c.text) === '평가방법') ?? header.find((c) => /평가/.test(norm(c.text)) && c !== stdH && !/^수업/.test(norm(c.text)))
      const weekH = header.find((c) => /^주(\(|$|차|시수|학점)/.test(norm(c.text)))
      const monthH = header.find((c) => norm(c.text) === '월') ?? header.find((c) => norm(c.text) === '시기')
      // 월 단위 진도표: '시수/누계' 열에 '5/5' (이번 달 시수 / 누계)
      const hoursH = header.find((c) => /시수|누계/.test(norm(c.text)) && !/^주/.test(norm(c.text)))
      const body = cells.filter((c) => c.y1 <= headerY + 1)
      const weekCells = body
        .filter((c) => WEEK_CELL.test(norm(c.text)) && (!weekH || (cx(c) >= weekH.x0 - 2 && cx(c) <= weekH.x1 + 2)))
        .sort((a, b) => b.y1 - a.y1)
      if (!weekCells.length && hoursH) {
        const rows = body.filter((c) => /^\d+\/\d+$/.test(norm(c.text)) && cx(c) >= hoursH.x0 - 2 && cx(c) <= hoursH.x1 + 2).sort((a, b) => b.y1 - a.y1)
        for (const r of rows) {
          const y = cy(r)
          const at = (h: Cell | undefined) => (h ? cellAt(body, cx(h), y) : undefined)
          const mt = /^(\d{1,2})월$/.exec(norm(at(monthH)?.text ?? ''))
          if (mt) month = Number(mt[1])
          const uCell = at(unitH)
          const sCell = at(stdH)
          const stdText = sCell?.text ?? ''
          const row: WeekRow = { month, week: weeks.length + 1, label: month ? `${month}월` : undefined, hours: Number(norm(r.text).split('/')[0]), unit: cleanUnit(uCell?.text ?? ''), standards: standardCodes(stdText) }
          const content = stdText.replace(/[[〔]?\d{1,2}[가-힣]+\d*(?:-\d{2}){1,2}[\]〕]?\s*([~∼,]\s*)?/g, '').replace(/^[\s▪•]+/, '').trim()
          if (content) row.content = content
          const meth = at(methodH)?.text
          const ev = at(evalH)?.text
          if (meth) row.method = meth
          if (ev) row.evalNote = ev
          weeks.push(row)
        }
      }
      for (const w of weekCells) {
        const m = WEEK_CELL.exec(norm(w.text))!
        const y = cy(w)
        const at = (h: Cell | undefined) => (h ? cellAt(body, cx(h), y) : undefined)
        const uCell = at(unitH)
        const sCell = at(stdH)
        const mCell = at(monthH)
        if (mCell && /^\d{1,2}$/.test(norm(mCell.text))) month = Number(norm(mCell.text))
        const row: WeekRow = { month, week: Number(m[1]), hours: Number(m[2]), unit: '', standards: [] }
        const merged = uCell && uCell === sCell
        if (merged && EVENT.test(uCell.text)) {
          row.event = norm(uCell.text)
        } else {
          const stdText = sCell?.text ?? ''
          row.standards = standardCodes(stdText)
          row.unit = cleanUnit(uCell && !merged ? uCell.text : '')
          if (!row.unit && !row.standards.length && stdText) row.unit = cleanUnit(stdText) // 단원 칸과 합쳐진 줄 (예: 오리엔테이션)
          const meth = at(methodH)?.text
          const ev = at(evalH)?.text
          if (meth && meth !== uCell?.text) row.method = meth
          if (ev && ev !== uCell?.text) row.evalNote = ev
        }
        weeks.push(row)
      }
    }
    // 2) 범교과 연계: '9월 6주차' 같은 시기 칸 + 왼쪽 칸 내용 + 위의 '※ …' 제목
    for (const c of cells) {
      if (!/^\d{1,2}월\d{1,2}주차?$/.test(norm(c.text))) continue
      const left = cells
        .filter((o) => o !== c && o.x1 <= c.x0 + 1 && Math.min(o.y1, c.y1) - Math.max(o.y0, c.y0) > 3 && !/과목|성취수준|학습주제|교육영역/.test(norm(o.text)) && !/^\S+\(\d학기\)$/.test(norm(o.text)))
        .sort((a, b) => b.x1 - a.x1 || b.y1 - a.y1)[0]
      const title = cells
        .filter((o) => o.text.trim().startsWith('※') && o.y0 >= c.y1 - 1)
        .sort((a, b) => a.y0 - b.y0)[0]
      const kind = title ? title.text.replace(/^※\s*/, '').replace(/\(.*?\)/g, '').replace(/(교과\s*)?(연계\s*)?(수업)?계획/g, '').trim() : ''
      extras.push({ when: c.text.trim(), label: [kind, left?.text.trim()].filter(Boolean).join(': ') })
    }
  }
  if (!weeks.length) warnings.push('진도표(주차 · 단원명 · 성취기준 표)를 찾지 못했어요. 스캔한 PDF는 읽을 수 없어요.')
  const dup = weeks.map((w) => w.week).filter((w, i, a) => a.indexOf(w) !== i)
  if (dup.length) warnings.push(`같은 주차가 두 번 나왔어요: ${[...new Set(dup)].join(', ')}주`)
  return { weeks, extras, warnings }
}

/** 엑셀 · 붙여넣기 표 → 주차 계획 (차시 열이 있으면 한 줄 = 한 차시) */
export function weeksFromGrid(rows: readonly (readonly (string | number | null | undefined)[])[], defaultHours = 1): ParsedPlan {
  const grid = rows.map((r) => r.map((v) => (v == null ? '' : String(v).trim())))
  const find = (cells: string[], re: RegExp, not?: RegExp) => cells.findIndex((c) => re.test(norm(c)) && !(not && not.test(norm(c))))
  let hi = -1
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    if (find(grid[i], /단원/) >= 0 && (find(grid[i], /성취기준/) >= 0 || find(grid[i], /내용|주제|활동/) >= 0)) {
      hi = i
      break
    }
  }
  if (hi < 0) return { weeks: [], extras: [], warnings: ['머리글 줄(단원 · 성취기준 또는 학습 내용)을 찾지 못했어요.'] }
  const h = grid[hi]
  const col = {
    month: find(h, /^월$/),
    week: find(h, /^주(\(|$|차|시수|학점)|^주차/, /주안점/),
    lesson: find(h, /^차시$|^차시\(|^\d*차시/),
    hours: find(h, /시수|학점|시간/, /주\(/),
    unit: find(h, /단원/),
    content: find(h, /학습내용|내용|주제|활동/),
    std: find(h, /성취기준/),
    method: find(h, /수업방법|교수방법|지도방법/),
    evalN: find(h, /평가/, /성취기준/),
  }
  const weeks: WeekRow[] = []
  let last: { unit: string; standards: string[]; month?: number } = { unit: '', standards: [] }
  let seq = 0
  for (const r of grid.slice(hi + 1)) {
    if (r.every((c) => !c)) continue
    const get = (i: number) => (i >= 0 ? (r[i] ?? '') : '')
    const wk = get(col.week)
    const wm = WEEK_CELL.exec(norm(wk))
    const joined = norm(r.join(''))
    const month = /^\d{1,2}$/.test(get(col.month)) ? Number(get(col.month)) : last.month
    if (!get(col.unit) && !get(col.content) && EVENT.test(joined) && joined.length < 20) {
      weeks.push({ month, week: wm ? Number(wm[1]) : Number(wk) || ++seq, hours: 0, unit: '', standards: [], event: joined.replace(/^\d+(\(\d\))?/, '') })
      continue
    }
    const unit = cleanUnit(get(col.unit)) || last.unit
    const stdText = get(col.std)
    const standards = stdText ? standardCodes(stdText) : last.standards
    const hours = col.lesson >= 0 ? 1 : wm ? Number(wm[2]) : Number(get(col.hours)) || defaultHours
    const week = wm ? Number(wm[1]) : Number(wk) || ++seq
    const row: WeekRow = { month, week, hours, unit, standards }
    if (get(col.content)) row.content = get(col.content)
    if (get(col.method)) row.method = get(col.method)
    if (get(col.evalN)) row.evalNote = get(col.evalN)
    weeks.push(row)
    last = { unit, standards, month }
  }
  return { weeks, extras: [], warnings: weeks.length ? [] : ['표에서 읽을 줄이 없어요.'] }
}

/** 붙여넣은 글 → 표 (탭 우선, 없으면 쉼표) */
export function textToGrid(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : ','
  return lines.map((l) => l.split(sep).map((c) => c.trim()))
}

/** 미리보기 요약: 차시 합계 · 고사 주 · 성취기준 없는 주 */
export function summarize(p: ParsedPlan): { lessons: number; eventWeeks: number; noStdWeeks: number } {
  return {
    lessons: p.weeks.filter((w) => !w.event).reduce((n, w) => n + w.hours, 0),
    eventWeeks: p.weeks.filter((w) => w.event).length,
    noStdWeeks: p.weeks.filter((w) => !w.event && w.hours > 0 && !w.standards.length).length,
  }
}
