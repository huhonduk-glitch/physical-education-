/**
 * 견적서 파일 읽기 (브라우저, 6-21). 1단계는 이 기기 안에서만 읽는다.
 * 사진 · 스캔본은 2단계(AI)로 넘기기 위해 그림으로 만든다 — 위아래를 잘라 업체 연락처 칸을 빼고 보낼 수 있다.
 */
import { buildCells, readPdf } from './pdfTable'
import { QuoteError, QuoteScanError, parseQuoteGrid, parseQuotePages, type Quote } from './quote'
import type { AiImage } from './aiPolish'
import { readGridsFromFile } from './rosterFile'

export const isImageFile = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
export const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

async function pdfjsLib() {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

/** 1단계: 엑셀 · CSV · 글자 있는 PDF → 견적. 사진 · 스캔 PDF는 QuoteScanError */
export async function readQuoteFile(file: File): Promise<Quote> {
  if (isImageFile(file)) throw new QuoteScanError('사진이에요.')
  if (/\.hwpx?$/i.test(file.name)) throw new QuoteError('한글 파일은 바로 못 읽어요. 한글에서 [파일 → PDF로 저장]하거나 표를 복사해 붙여 넣어 주세요.')
  const data = await file.arrayBuffer()
  if (isPdfFile(file)) {
    const pdfjs = await pdfjsLib()
    const pages = await readPdf(pdfjs as unknown as Parameters<typeof readPdf>[0], new Uint8Array(data))
    return parseQuotePages(pages, buildCells)
  }
  const sheets = await readGridsFromFile(data, file.name)
  let first: unknown = null
  for (const s of sheets) {
    try {
      return parseQuoteGrid(s.grid)
    } catch (e) {
      first ??= e
    }
  }
  throw first instanceof QuoteError ? first : new QuoteError('표에서 품목을 찾지 못했어요.')
}

const MAX_SIDE = 1800

/** 사진 · PDF(앞 2쪽) → 한 장의 그림 (긴 변 1,800px 이하) */
export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  if (isPdfFile(file)) {
    const pdfjs = await pdfjsLib()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages = []
    for (let n = 1; n <= Math.min(2, doc.numPages); n++) {
      const pg = await doc.getPage(n)
      const base = pg.getViewport({ scale: 1 })
      const vp = pg.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) })
      const c = document.createElement('canvas')
      c.width = Math.round(vp.width)
      c.height = Math.round(vp.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      await pg.render({ canvasContext: ctx, viewport: vp, canvas: c } as never).promise
      pages.push(c)
    }
    canvas.width = Math.max(...pages.map((c) => c.width))
    canvas.height = pages.reduce((h, c) => h + c.height, 0)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    let y = 0
    for (const c of pages) {
      ctx.drawImage(c, 0, y)
      y += c.height
    }
    return canvas
  }
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new QuoteError('이 사진 형식은 브라우저가 못 열어요(아이폰 HEIC 등). 화면을 캡처한 사진이나 JPG로 넣어 주세요.')
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas
}

/** 위 · 아래를 잘라(0~1 비율) JPEG로 → AI에 보낼 그림 */
export function cropToImage(src: HTMLCanvasElement, top: number, bottom: number): AiImage {
  const y0 = Math.round(src.height * Math.max(0, Math.min(top, 0.95)))
  const y1 = Math.round(src.height * Math.max(top + 0.05, Math.min(bottom, 1)))
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = Math.max(1, y1 - y0)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(src, 0, y0, src.width, c.height, 0, 0, src.width, c.height)
  const url = c.toDataURL('image/jpeg', 0.85)
  return { mediaType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
}
