import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CourtDiagram from '../components/CourtDiagram'
import type { Figure, SportGuide } from '../data/sports'
import { PHOTOS } from '../data/sportPhotos'
import { buildSlides } from './sportSlides'

/**
 * 종목 자료 → PowerPoint 파일 (2026-10-27 교사 요청). 앱 안 슬라이드와 같은 내용(buildSlides).
 * pptxgenjs(MIT)를 이 버튼을 누를 때만 불러온다. 사진은 앱에 넣어 둔 파일, 경기장은 SVG를 그림(PNG)으로 바꿔 넣는다 → 인터넷 없이 만들어짐.
 */
const BASE = import.meta.env.BASE_URL
const FONT = 'Malgun Gothic'
const INK = '1F2937'
const MUTED = '6B7280'
const BRAND = '1B64DA'

interface Img {
  data: string
  w: number
  h: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = fail
    im.src = src
  })
}

async function toPng(src: string, maxW: number): Promise<Img> {
  const im = await loadImage(src)
  const w = Math.min(maxW, im.naturalWidth || maxW)
  const h = Math.round(((im.naturalHeight || maxW * 0.6) / (im.naturalWidth || maxW)) * w)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(im, 0, 0, w, h)
  return { data: c.toDataURL(src.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 0.88), w, h }
}

async function figureImage(f: Figure): Promise<Img | null> {
  if (f.kind === 'photo') {
    const p = PHOTOS[f.photo]
    return p ? toPng(`${BASE}${p.src}`, 1000) : null
  }
  const svg = renderToStaticMarkup(createElement(CourtDiagram, { court: f.court }))
  const sized = svg.replace('<svg ', '<svg width="1600" ')
  return toPng(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`, 1600)
}

/** 상자(x, y, w, h 인치) 안에 비율을 지켜 넣기 */
const fit = (img: Img, x: number, y: number, w: number, h: number) => {
  const s = Math.min(w / img.w, h / img.h)
  const iw = img.w * s
  const ih = img.h * s
  return { data: img.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih }
}

export async function downloadSportPptx(g: SportGuide): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5 in
  pptx.title = `${g.name} 수업자료`
  pptx.author = 'PE LOG'

  for (const s of buildSlides(g)) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FFFFFF' }
    if (s.kind === 'title') {
      slide.addText(s.group, { x: 0.7, y: 1.6, w: 6.8, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: BRAND })
      slide.addText(s.title, { x: 0.7, y: 2.1, w: 6.8, h: 1.5, fontFace: FONT, fontSize: 60, bold: true, color: INK })
      slide.addText(s.sub, { x: 0.7, y: 3.7, w: 6.8, h: 1.2, fontFace: FONT, fontSize: 22, color: MUTED, valign: 'top' })
      if (s.cover) {
        const img = await toPng(`${BASE}${s.cover.src}`, 1000)
        slide.addImage(fit(img, 7.8, 0.8, 5, 5.4))
        slide.addText(`사진: ${s.cover.credit} · ${s.cover.license} · 위키미디어 공용`, { x: 7.8, y: 6.3, w: 5, h: 0.4, fontFace: FONT, fontSize: 10, color: MUTED, align: 'center' })
      }
      slide.addText('PE LOG · 체육수업 종합 플랫폼', { x: 0.7, y: 6.6, w: 6, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED })
      continue
    }
    if (s.kind === 'sources') {
      slide.addText(s.title, { x: 0.6, y: 0.4, w: 12, h: 0.8, fontFace: FONT, fontSize: 32, bold: true, color: INK })
      const lines = [
        ...s.sources.map((x) => ({ text: `${x.label} (${x.edition})\n${x.url}`, options: { bullet: true, breakLine: true } })),
        ...s.photos.map((p) => ({ text: `사진: ${p.credit} · ${p.license} · ${p.url}`, options: { bullet: true, breakLine: true } })),
        { text: '경기장 그림은 규칙서 치수로 PE LOG가 직접 그림. 규칙 요약은 규칙서를 읽고 쉬운 말로 줄인 것(원문 아님).', options: { breakLine: true } },
      ]
      slide.addText(lines, { x: 0.6, y: 1.3, w: 12.1, h: 5.8, fontFace: FONT, fontSize: 13, color: INK, valign: 'top', paraSpaceAfter: 6 })
      continue
    }
    const side = !!(s.figure || s.specs?.length)
    const textW = side ? 7.2 : 12.1
    slide.addText(`${s.title}${s.part ? `  ${s.part}` : ''}`, { x: 0.6, y: 0.35, w: 12.1, h: 0.8, fontFace: FONT, fontSize: 30, bold: true, color: INK })
    let y = 1.3
    if (s.lead) {
      slide.addText(s.lead, { x: 0.6, y, w: textW, h: 0.9, fontFace: FONT, fontSize: 18, bold: true, color: BRAND, fill: { color: 'E8F3FF' }, margin: 8, valign: 'middle' })
      y += 1.05
    }
    slide.addText(
      s.items.map((it) => ({
        text: it.t,
        options: { bullet: true, breakLine: !it.ref },
      })).flatMap((run, k) => {
        const ref = s.items[k].ref
        return ref ? [run, { text: `  [${ref}]`, options: { fontSize: 12, color: MUTED, breakLine: true } }] : [run]
      }),
      { x: 0.6, y, w: textW, h: 7.1 - y, fontFace: FONT, fontSize: 18, color: INK, valign: 'top', paraSpaceAfter: 8 },
    )
    if (side) {
      let fy = 1.3
      if (s.specs?.length) {
        const rows = s.specs.map((sp) => [
          { text: sp.label, options: { bold: true, color: MUTED } },
          { text: `${sp.value}${sp.ref ? `  [${sp.ref}]` : ''}`, options: { bold: true, color: INK } },
        ])
        slide.addTable(rows, { x: 8.1, y: fy, w: 4.7, fontFace: FONT, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'E5E7EB' }, colW: [1.5, 3.2] })
        fy += 0.38 * rows.length + 0.3
      }
      if (s.figure) {
        const img = await figureImage(s.figure)
        if (img) {
          const box = fit(img, 8.1, fy, 4.7, Math.max(1.5, 6.4 - fy))
          slide.addImage(box)
          const p = s.figure.kind === 'photo' ? PHOTOS[s.figure.photo] : null
          slide.addText(p ? `${s.figure.caption} — 사진: ${p.credit} · ${p.license}` : s.figure.caption, { x: 8.1, y: box.y + box.h + 0.05, w: 4.7, h: 0.5, fontFace: FONT, fontSize: 10, color: MUTED, align: 'center', valign: 'top' })
        }
      }
    }
  }
  await pptx.writeFile({ fileName: `${g.name} 수업자료.pptx` })
}
