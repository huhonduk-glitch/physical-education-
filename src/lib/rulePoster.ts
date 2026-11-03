/**
 * 핵심 규칙 한 장 그림(포스터) 배치 계산 (2026-11-03 교사 요청: 선생님이 만든 넷볼 '7가지 주요 규칙' 그림처럼
 * 밝은 바탕에 번호 카드 · 그림 · 쉬운 설명을 한 장에). 내용은 src/data/sportKeys.ts의 핵심 규칙(조항 있음)만 쓴다.
 * 1600 × 900 칸 위에 카드 자리와 글 줄바꿈을 정한다. 글 폭은 글꼴 없이 어림잡아 셈(한글 1자 ≈ 글자 크기).
 */
export const POSTER_W = 1600
export const POSTER_H = 900
export const VIS_RATIO = 400 / 260 // RuleVisual 그림 가로 : 세로

const MARGIN = 40
const GAP = 24
const TOP = 168
const BOTTOM = 850
const PAD = 22
const HEAD = 58

/** 카드 몇 개를 몇 줄로: 3 · 5 → 한 줄, 4 → 2 × 2, 7 → 4 + 3 */
export function posterRows(n: number): number[] {
  if (n <= 3 || n === 5) return [n]
  if (n === 4) return [2, 2]
  if (n === 6) return [3, 3]
  if (n === 7) return [4, 3]
  return [Math.ceil(n / 2), Math.floor(n / 2)]
}

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/
/** 글 폭 어림 (px) */
export function textWidth(s: string, px: number): number {
  let w = 0
  for (const ch of s) w += (HANGUL.test(ch) ? 1.0 : ch === ' ' ? 0.3 : /[0-9A-Za-z]/.test(ch) ? 0.6 : 0.42) * px
  return w
}

/** 띄어쓰기 단위로 줄바꿈 (한 낱말이 너무 길면 글자 단위) */
export function wrapText(s: string, maxW: number, px: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word
    if (textWidth(next, px) <= maxW) {
      cur = next
      continue
    }
    if (cur) lines.push(cur)
    cur = ''
    let piece = ''
    for (const ch of word) {
      if (textWidth(piece + ch, px) > maxW && piece) {
        lines.push(piece)
        piece = ''
      }
      piece += ch
    }
    cur = piece
  }
  if (cur) lines.push(cur)
  return lines
}

export interface TextBlock {
  size: number
  lines: string[]
  /** 덧붙임(왜 중요한지) — 자리가 있을 때만 */
  extra: string[]
}

/** 상자에 들어가는 가장 큰 글자 크기를 고른다. 덧붙임은 들어갈 때만 넣는다 */
export function fitText(main: string, extra: string | undefined, w: number, h: number, sizes = [30, 28, 26, 24, 22, 20, 18, 16]): TextBlock {
  const LH = 1.38
  for (const size of sizes) {
    const lines = wrapText(main, w * 0.97, size)
    const used = lines.length * size * LH
    if (used > h) continue
    const ex = extra ? wrapText(extra, w * 0.97, size * 0.82) : []
    const exH = ex.length ? ex.length * size * 0.82 * LH + size * 0.5 : 0
    return { size, lines, extra: used + exH <= h ? ex : [] }
  }
  const size = sizes[sizes.length - 1]
  const all = wrapText(main, w, size)
  const max = Math.max(1, Math.floor(h / (size * LH)))
  return { size, lines: all.length > max ? [...all.slice(0, max - 1), `${all[max - 1]}…`] : all, extra: [] }
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export interface PosterCard extends Box {
  vis: Box
  text: Box
  horizontal: boolean
}

/** 카드 자리 · 그림 자리 · 글 자리 */
export function posterLayout(n: number): PosterCard[] {
  const rows = posterRows(n)
  const cardH = (BOTTOM - TOP - (rows.length - 1) * GAP) / rows.length
  const out: PosterCard[] = []
  rows.forEach((cols, r) => {
    const cardW = (POSTER_W - 2 * MARGIN - (cols - 1) * GAP) / cols
    const y = TOP + r * (cardH + GAP)
    for (let c = 0; c < cols; c++) {
      const x = MARGIN + c * (cardW + GAP)
      const innerW = cardW - 2 * PAD
      const bodyY = y + HEAD + 6
      const bodyH = cardH - HEAD - 6 - PAD - 26 // 아래 조항 줄
      const horizontal = cardW / cardH >= 1.6
      if (horizontal) {
        const vh = bodyH
        const vw = Math.min(vh * VIS_RATIO, innerW * 0.5)
        const vis = { x: x + PAD, y: bodyY + (vh - vw / VIS_RATIO) / 2, w: vw, h: vw / VIS_RATIO }
        out.push({ x, y, w: cardW, h: cardH, horizontal, vis, text: { x: x + PAD + vw + 20, y: bodyY, w: innerW - vw - 20, h: bodyH } })
      } else {
        const vw0 = innerW
        const vh = Math.min(vw0 / VIS_RATIO, bodyH * 0.62)
        const vw = vh * VIS_RATIO
        const vis = { x: x + (cardW - vw) / 2, y: bodyY, w: vw, h: vh }
        out.push({ x, y, w: cardW, h: cardH, horizontal, vis, text: { x: x + PAD, y: bodyY + vh + 14, w: innerW, h: bodyH - vh - 14 } })
      }
    }
  })
  return out
}

export const posterTitle = (name: string, n: number) => `${name.replace(/\s*\(.*\)\s*$/, '')} 핵심 규칙 ${n}가지`

/** 그려 둔 포스터 SVG 문자열 → PNG 파일 받기 (2배 크기) */
export async function downloadSvgPng(svg: string, fileName: string, scale = 2): Promise<void> {
  const im = new Image()
  im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await im.decode()
  const c = document.createElement('canvas')
  c.width = POSTER_W * scale
  c.height = POSTER_H * scale
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  const blob: Blob = await new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('PNG 실패'))), 'image/png'))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
