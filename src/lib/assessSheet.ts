import type { AssessItem, Assessment, AssessmentScore } from '../db/types'
import { areaTotal, fmtNum, itemMax, itemPoints, levelOf } from './assessScore'

/**
 * 평가 기록표 (2026-10-31 교사 요청): 평가 설정에 따라 칸이 바뀌는 표.
 * 체크리스트 요소 → 항목마다 칸 + 만족 수 + 점수 / 기록표 → 기록 + 점수 / 등급표 → (등급) + 점수 / 점수 입력 → 점수.
 * 글 칸 · 제출 구분 · 합계 · 수준 · 비고는 평가에 정한 것만. 엑셀 받기와 인쇄가 같은 표를 쓴다.
 */

export interface SheetStudent {
  no: string
  name: string
  gender: 'M' | 'F' | null
  score?: AssessmentScore
}

export interface SheetCol {
  /** 위 머리글 (요소 이름 등). 같은 값이 이어지면 한 묶음 */
  group: string
  /** 아래 머리글 (①, 만족 수, 점수 …). 묶음이 아니면 '' */
  sub: string
  cell: (s: SheetStudent) => string | number
}

export const circled = (i: number) => (i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`)

/** 등급 이름이 점수와 다르면(A·B·C) 등급 칸을 따로 보여 준다 */
const levelNamed = (it: AssessItem) => (it.levels ?? []).some((l) => l.label !== String(l.points))

export function sheetColumns(a: Assessment, items: readonly AssessItem[]): SheetCol[] {
  const cols: SheetCol[] = [
    { group: '번호', sub: '', cell: (s) => s.no },
    { group: '이름', sub: '', cell: (s) => s.name },
  ]
  for (const t of a.texts ?? []) cols.push({ group: t, sub: '', cell: (s) => s.score?.texts?.[t] ?? '' })
  for (const it of items) {
    const head = `${it.label}(${fmtNum(itemMax(it))})`
    const raw = (s: SheetStudent) => s.score?.scores[it.id]
    const pts = (s: SheetStudent) => (s.score?.status ? '' : (itemPoints(it, raw(s), s.gender) ?? ''))
    if (it.checks?.length) {
      it.checks.forEach((_, k) => cols.push({ group: head, sub: circled(k), cell: (s) => (s.score?.checks?.[it.id]?.includes(k) ? 'O' : '') }))
      cols.push({ group: head, sub: '만족 수', cell: (s) => raw(s) ?? '' })
      cols.push({ group: head, sub: '점수', cell: pts })
    } else if (it.method === 'record') {
      cols.push({ group: head, sub: `기록(${it.unit ?? ''})`, cell: (s) => raw(s) ?? '' })
      cols.push({ group: head, sub: '점수', cell: pts })
    } else if (it.method === 'level' && levelNamed(it)) {
      cols.push({ group: head, sub: '등급', cell: (s) => raw(s) ?? '' })
      cols.push({ group: head, sub: '점수', cell: pts })
    } else {
      cols.push({ group: head, sub: '', cell: pts })
    }
  }
  const max = items.reduce((n, it) => n + itemMax(it), 0)
  const total = (s: SheetStudent) => areaTotal(a, s.score, s.gender, items)
  if (a.specials?.length) cols.push({ group: '제출 구분', sub: '', cell: (s) => s.score?.status ?? '' })
  cols.push({ group: `합계(${fmtNum(max)})`, sub: '', cell: (s) => (total(s).done ? fmtNum(total(s).total) : '') })
  if (a.levelCuts?.length) cols.push({ group: '수준', sub: '', cell: (s) => (total(s).complete ? levelOf(a.levelCuts, total(s).total, max) : '') })
  cols.push({ group: '비고', sub: '', cell: (s) => s.score?.note ?? '' })
  return cols
}

/** 표 한 장: 머리글 2줄(묶음이 없으면 1줄) + 학생 줄. blank면 번호 · 이름만 채운 빈 기록지 */
export function recordSheet(a: Assessment, items: readonly AssessItem[], students: readonly SheetStudent[], blank = false): (string | number)[][] {
  const cols = sheetColumns(a, items)
  const two = cols.some((c) => c.sub)
  const head1 = cols.map((c) => c.group)
  const head2 = cols.map((c) => c.sub)
  const body = students.map((s) => cols.map((c, i) => (blank && i > 1 ? '' : c.cell(s))))
  return two ? [head1, head2, ...body] : [head1, ...body]
}

/** 채점 기준 (기록표 옆 · 인쇄 첫 장): 요소마다 기준 줄 */
export function criteriaLines(a: Assessment, items: readonly AssessItem[]): { title: string; lines: string[] }[] {
  const out = items.map((it) => {
    const lines: string[] = []
    if (it.checks?.length) {
      it.checks.forEach((c, k) => lines.push(`${circled(k)} ${c}`))
      ;[...(it.bands ?? [])].sort((x, y) => y.limit - x.limit).forEach((b) => lines.push(`${fmtNum(b.limit)}개 만족 → ${fmtNum(b.points)}점`))
      lines.push(`0개 → ${fmtNum(it.basePoints ?? 0)}점`)
    } else if (it.method === 'level') {
      for (const l of it.levels ?? []) lines.push(`${l.label === String(l.points) ? `${fmtNum(l.points)}점` : `${l.label} (${fmtNum(l.points)}점)`}${l.desc ? ` ${l.desc}` : ''}`)
    } else if (it.method === 'record') {
      const word = it.better === 'lower' ? '이하' : '이상'
      const band = (label: string, bands: typeof it.bands, base: number | undefined) => {
        const sorted = [...(bands ?? [])].sort((x, y) => (it.better === 'lower' ? x.limit - y.limit : y.limit - x.limit))
        lines.push(`${label}${sorted.map((b) => `${fmtNum(b.limit)}${it.unit ?? ''} ${word} ${fmtNum(b.points)}점`).join(' · ')} · 그 밖 ${fmtNum(base ?? 0)}점`)
      }
      band(it.bandsF?.length ? '남 ' : '', it.bands, it.basePoints)
      if (it.bandsF?.length) band('여 ', it.bandsF, it.basePointsF ?? it.basePoints)
    } else {
      lines.push(`0~${fmtNum(it.max ?? 0)}점`)
    }
    if (it.nonPartPoints !== undefined) lines.push(`미참여 ${fmtNum(it.nonPartPoints)}점`)
    return { title: `${it.label} (${fmtNum(itemMax(it))}점)`, lines }
  })
  if (a.specials?.length) out.push({ title: '제출 구분 (평가 전체 점수)', lines: a.specials.map((x) => `${x.label} ${fmtNum(x.points)}점`) })
  if (a.levelCuts?.length) {
    const cuts = [...a.levelCuts].sort((x, y) => y.min - x.min)
    out.push({ title: '성취 수준', lines: cuts.map((c) => (c.min > 0 ? `${c.label}: 만점의 ${fmtNum(c.min)}% 이상` : `${c.label}: 그 밖`)) })
  }
  return out
}
