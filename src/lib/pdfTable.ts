/**
 * PDF 표 읽기 (6-5). 순수 함수 + PDF.js를 받아 쓰는 읽기 함수.
 * 한글·워드에서 PDF로 저장한 표는 칸마다 테두리(사각형)를 그린다.
 * 사각형과 글자 위치를 읽어 "글자가 들어 있는 가장 작은 칸"에 글자를 넣는다 → 합쳐진 칸도 칸 하나로 읽힌다.
 * 스캔한 PDF(글자 없음)는 읽을 수 없다.
 */

export interface PdfText {
  x: number
  y: number
  w: number
  h: number
  str: string
}
export interface PdfRect {
  x0: number
  y0: number
  x1: number
  y1: number
}
export interface PdfPage {
  width: number
  height: number
  rects: PdfRect[]
  texts: PdfText[]
}
export interface Cell extends PdfRect {
  text: string
}

/** 비슷한 사각형은 하나로, 너무 작거나 페이지 전체인 것은 뺀다 */
export function cleanRects(rects: readonly PdfRect[], page: { width: number; height: number }): PdfRect[] {
  const out: PdfRect[] = []
  for (const r of rects) {
    const w = r.x1 - r.x0
    const h = r.y1 - r.y0
    if (w < 6 || h < 5) continue
    if (w > page.width * 0.95 && h > page.height * 0.9) continue
    if (out.some((o) => Math.abs(o.x0 - r.x0) < 1 && Math.abs(o.x1 - r.x1) < 1 && Math.abs(o.y0 - r.y0) < 1 && Math.abs(o.y1 - r.y1) < 1)) continue
    out.push(r)
  }
  return out
}

const area = (r: PdfRect) => (r.x1 - r.x0) * (r.y1 - r.y0)

/**
 * 칸 안의 글자 조각 → 한 줄 글. 위에서 아래, 왼쪽에서 오른쪽.
 * 줄이 바뀐 곳은 늘 띄어 쓴다 (한글은 낱말 중간에서도 줄이 바뀌어 "강 화하고"처럼 될 수 있음 — 미리보기에서 고친다)
 */
export function joinTexts(items: readonly PdfText[]): string {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfText[][] = []
  for (const t of sorted) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line[0].y - t.y) < Math.max(2, t.h * 0.4)) line.push(t)
    else lines.push([t])
  }
  return lines
    .map((l) =>
      l
        .sort((a, b) => a.x - b.x)
        .map((t) => t.str)
        .join(' '),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 글자를 칸에 넣는다. 칸 밖의 글자(표 밖의 제목 등)는 outside로 */
export function buildCells(page: PdfPage): { cells: Cell[]; outside: PdfText[] } {
  const rects = cleanRects(page.rects, page)
  const buckets = new Map<PdfRect, PdfText[]>()
  const outside: PdfText[] = []
  for (const t of page.texts) {
    if (!t.str.trim()) continue
    const cx = t.x + t.w / 2
    const cy = t.y + Math.max(1, t.h * 0.35)
    let best: PdfRect | null = null
    for (const r of rects) if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1 && (!best || area(r) < area(best))) best = r
    if (best) buckets.set(best, [...(buckets.get(best) ?? []), t])
    else outside.push(t)
  }
  const cells = [...buckets.entries()].map(([r, ts]) => ({ ...r, text: joinTexts(ts) }))
  return { cells, outside }
}

/** PDF.js 모듈(브라우저 또는 node legacy)과 파일 → 쪽마다 사각형·글자 */
export async function readPdf(
  pdfjs: { getDocument: (src: { data: Uint8Array }) => { promise: Promise<unknown> }; OPS: Record<string, number> },
  data: Uint8Array,
): Promise<PdfPage[]> {
  type Doc = { numPages: number; getPage: (n: number) => Promise<Page> }
  type Page = {
    view: number[]
    getTextContent: () => Promise<{ items: { str?: string; transform?: number[]; width?: number; height?: number }[] }>
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>
  }
  const doc = (await pdfjs.getDocument({ data }).promise) as Doc
  const pages: PdfPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const [vx0, vy0, vx1, vy1] = page.view
    const tc = await page.getTextContent()
    const texts: PdfText[] = tc.items
      .filter((it) => typeof it.str === 'string' && it.transform)
      .map((it) => ({ str: it.str!, x: it.transform![4], y: it.transform![5], w: it.width ?? 0, h: it.height || Math.abs(it.transform![3]) || 10 }))
    const ops = await page.getOperatorList()
    const rects: PdfRect[] = []
    ops.fnArray.forEach((fn, i) => {
      if (fn !== pdfjs.OPS.constructPath) return
      const bbox = ops.argsArray[i]?.[2] as Record<string, number> | number[] | undefined
      if (!bbox) return
      const b = Array.isArray(bbox) ? bbox : [bbox[0], bbox[1], bbox[2], bbox[3]]
      if (b.length === 4 && b.every((v) => Number.isFinite(v))) rects.push({ x0: Math.min(b[0], b[2]), y0: Math.min(b[1], b[3]), x1: Math.max(b[0], b[2]), y1: Math.max(b[1], b[3]) })
    })
    pages.push({ width: vx1 - vx0, height: vy1 - vy0, rects, texts })
  }
  return pages
}
