import type { Cell } from './pdfTable'
import { buildItem, checkedMethods, checklistFrom, titleAndMax, type ScoreRow } from './assessPlan'
import { standardCodes } from './planImport'
import type { AssessItem } from '../db/types'

/**
 * 평가계획서 PDF의 '수행평가 세부계획 및 세부기준' 표 → 평가 목록 (6-5 ②). 순수 함수.
 * 표 모양(학교 양식):
 *   [교육과정 영역 | …] [성취기준 | …] [평가요소 | …] [평가방법 | ■…] [평가시기 | 9월 중 | 반영비율 | 40% | 만점 | 40점]
 *   [평가과제(배점) | 성취수준별 예상 득점 및 수행 특성] → [제목 (40점) | A | 설명] …
 *   [채 점 기 준 | 채점요소 | 기대 수행 | 배점] → [요소 | 남자 20회 이상, 여자 15회 이상 | 40점] …
 * 열 위치를 고정하지 않고 낱말이 적힌 칸과 그 오른쪽 칸으로 읽는다.
 */

export interface PlannedAssessment {
  title: string
  max?: number
  area?: string
  standards: string[]
  standardText?: string
  elements?: string
  methods: string[]
  when?: string
  ratio?: string
  levelDescs: { label: string; desc: string }[]
  item?: AssessItem
  problems: string[]
}

type PCell = Cell & { page: number }
const norm = (s: string) => s.replace(/\s+/g, '')
const overlapY = (a: Cell, b: Cell) => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)

/** 같은 줄에서 이 칸 바로 오른쪽 칸들 (세로로 겹치는 것) */
function rightOf(cells: readonly PCell[], label: PCell, stopAt?: (c: PCell) => boolean): PCell[] {
  const row = cells
    .filter((c) => c.page === label.page && c !== label && c.x0 >= label.x1 - 1.5 && overlapY(c, label) > Math.min(label.y1 - label.y0, c.y1 - c.y0) * 0.5)
    .sort((a, b) => a.x0 - b.x0 || b.y1 - a.y1)
  if (!stopAt) return row
  const out: PCell[] = []
  for (const c of row) {
    if (stopAt(c)) break
    out.push(c)
  }
  return out
}

const LABEL = {
  area: /^교육과정영역$/,
  std: /^성취기준$/,
  elements: /^평가요소$/,
  method: /^평가방법$/,
  when: /^평가시기$/,
  ratio: /^반영비율$/,
  max: /^만점$/,
}
const isLabel = (c: Cell) => Object.values(LABEL).some((re) => re.test(norm(c.text)))

export function assessmentsFromCells(pages: readonly Cell[][]): PlannedAssessment[] {
  const cells: PCell[] = pages.flatMap((cs, page) => cs.map((c) => ({ ...c, page })))
  const ordered = [...cells].sort((a, b) => a.page - b.page || b.y1 - a.y1 || a.x0 - b.x0)
  const out: PlannedAssessment[] = []
  let cur: PlannedAssessment | null = null
  let n = 0

  const textRight = (label: PCell) =>
    rightOf(cells, label, isLabel)
      .map((c) => c.text)
      .join(' ')
      .trim()

  for (const c of ordered) {
    const t = norm(c.text)
    if (LABEL.area.test(t)) {
      // 세부계획 표만: 아래에 '평가요소'가 있는 표 (개요 표의 '교육과정 영역'은 건너뜀)
      const hasElements = cells.some((o) => LABEL.elements.test(norm(o.text)) && ((o.page === c.page && o.y1 <= c.y0 + 1 && c.y0 - o.y1 < 160) || (o.page === c.page + 1 && c.y0 < 200)))
      if (!hasElements) continue
      cur = { title: '', standards: [], methods: [], levelDescs: [], problems: [], area: textRight(c) }
      out.push(cur)
      continue
    }
    if (!cur) continue
    if (LABEL.std.test(t)) {
      const s = textRight(c)
      cur.standardText = s
      cur.standards = standardCodes(s)
    } else if (LABEL.elements.test(t)) cur.elements = textRight(c)
    else if (LABEL.method.test(t)) cur.methods = checkedMethods(textRight(c))
    else if (LABEL.when.test(t)) cur.when = rightOf(cells, c, isLabel)[0]?.text
    else if (LABEL.ratio.test(t)) cur.ratio = rightOf(cells, c, isLabel)[0]?.text
    else if (LABEL.max.test(t)) {
      const m = /(\d+(?:\.\d+)?)/.exec(rightOf(cells, c, isLabel)[0]?.text ?? '')
      if (m) cur.max = Number(m[1])
    } else if (/^평가과제/.test(t)) {
      // 다음 줄들: [제목 (배점)] [A] [설명]
      const below = cells.filter((o) => o.page === c.page && o.y1 <= c.y0 + 1.5 && o.x0 < c.x1 - 1).sort((a, b) => b.y1 - a.y1)
      const titleCell = below[0]
      if (titleCell) {
        const tm = titleAndMax(titleCell.text)
        cur.title = tm.title
        if (tm.max !== undefined && cur.max === undefined) cur.max = tm.max
        const levels = cells.filter((o) => o.page === c.page && /^[A-E]$/.test(norm(o.text)) && overlapY(o, titleCell) > 1).sort((a, b) => b.y1 - a.y1)
        for (const lv of levels) {
          const desc = rightOf(cells, lv)[0]?.text ?? ''
          cur.levelDescs.push({ label: norm(lv.text), desc })
        }
      }
    } else if (t === '기대수행') {
      const head = c
      const pointsH = rightOf(cells, head).find((o) => norm(o.text) === '배점')
      const nameH = cells.find((o) => o.page === head.page && norm(o.text) === '채점요소' && overlapY(o, head) > 1)
      if (!pointsH) continue
      const rows = cells
        .filter((o) => o.page === head.page && o.y1 <= head.y0 + 1.5 && (o.x0 + o.x1) / 2 >= head.x0 && (o.x0 + o.x1) / 2 <= head.x1)
        .sort((a, b) => b.y1 - a.y1)
      const scoreRows: ScoreRow[] = []
      let lastY = head.y0
      for (const r of rows) {
        if (lastY - r.y1 > 6) break // 표가 끝남
        const pc = cells.find((o) => o.page === r.page && (o.x0 + o.x1) / 2 >= pointsH.x0 && (o.x0 + o.x1) / 2 <= pointsH.x1 && overlapY(o, r) > (r.y1 - r.y0) * 0.5)
        const m = /(\d+(?:\.\d+)?)\s*점?/.exec(pc?.text ?? '')
        if (!m) break
        scoreRows.push({ expect: r.text, points: Number(m[1]) })
        lastY = r.y0
      }
      const nameCell = nameH ? cells.find((o) => o.page === head.page && o !== nameH && (o.x0 + o.x1) / 2 >= nameH.x0 && (o.x0 + o.x1) / 2 <= nameH.x1 && o.y1 <= nameH.y0 + 1.5 && o.y1 > lastY) : undefined
      const label = nameCell?.text.replace(/\s+/g, ' ').trim() || cur.title || `채점 요소`
      const isCount = scoreRows.some((r) => /만족|충족/.test(r.expect))
      const built = buildItem(label, scoreRows, { id: `plan-${++n}`, checks: isCount ? checklistFrom(cur.elements ?? '') : undefined })
      cur.item = built.item
      cur.problems.push(...built.problems)
    }
  }

  for (const a of out) {
    if (!a.title) a.title = a.item?.label ?? '이름 없는 평가'
    if (!a.item) a.problems.push('채점 기준 표(기대 수행 · 배점)를 찾지 못했어요. 평가를 만든 뒤 채점 요소를 직접 넣어 주세요')
    const max = a.item ? Math.max(a.item.basePoints ?? 0, a.item.basePointsF ?? 0, ...(a.item.bands ?? []).map((b) => b.points), ...(a.item.bandsF ?? []).map((b) => b.points)) : undefined
    if (a.max !== undefined && max !== undefined && Math.abs(max - a.max) > 1e-9) a.problems.push(`만점이 ${a.max}점인데 채점 기준의 가장 높은 점수는 ${max}점이에요`)
  }
  return out.filter((a) => a.item || a.elements)
}

/** 평가 영역별 만점 합 · 반영비율 합 확인 */
export function planTotals(list: readonly PlannedAssessment[]): { max: number; ratio: number } {
  return {
    max: list.reduce((n, a) => n + (a.max ?? 0), 0),
    ratio: list.reduce((n, a) => n + (Number(/(\d+(?:\.\d+)?)/.exec(a.ratio ?? '')?.[1]) || 0), 0),
  }
}
