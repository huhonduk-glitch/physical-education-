import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CourtDiagram, { type CourtId } from '../components/CourtDiagram'
import RuleVisual, { type Visual } from '../components/RuleVisual'
import type { SportGuide } from '../data/sports'
import { PHOTOS } from '../data/sportPhotos'
import { buildSlides } from './sportSlides'

/**
 * 종목 자료 → PowerPoint 파일. 앱 안 슬라이드와 같은 목록(buildSlides), 같은 검은 화면 디자인 — 줄은 모두 보인 상태로.
 * pptxgenjs(MIT)를 이 버튼을 누를 때만 불러온다. 사진은 앱에 넣어 둔 파일, 경기장 · 핵심 규칙 그림은 SVG를 PNG로 바꿔 넣는다 → 인터넷 없이 만들어짐.
 */
const BASE = import.meta.env.BASE_URL
const FONT = 'Malgun Gothic'
const BG = '000000'
const WHITE = 'F5F5F7'
const MUTED = 'A1A1A6'
const DIM = '86868B'
const BLUE = '2997FF'
const CARD = '1D1D1F'

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

async function toPng(src: string, maxW: number, bg = '#000000'): Promise<Img> {
  const im = await loadImage(src)
  const w = Math.min(maxW, im.naturalWidth || maxW)
  const h = Math.round(((im.naturalHeight || maxW * 0.6) / (im.naturalWidth || maxW)) * w)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(im, 0, 0, w, h)
  return { data: c.toDataURL(src.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 0.88), w, h }
}

const svgPng = (svg: string, w: number) => toPng(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', `<svg width="${w}" `))}`, w)
const visualPng = (v: Visual) => svgPng(renderToStaticMarkup(createElement(RuleVisual, { v })), 1200)
const courtPng = (court: CourtId) => svgPng(renderToStaticMarkup(createElement(CourtDiagram, { court })), 1600)

/** 상자(x, y, w, h 인치) 안에 비율을 지켜 넣기 */
const fit = (img: Img, x: number, y: number, w: number, h: number) => {
  const s = Math.min(w / img.w, h / img.h)
  const iw = img.w * s
  const ih = img.h * s
  return { data: img.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih }
}
/** 상자를 꽉 채우고 넘치는 쪽을 자르기 (표지 사진) */
const cover = (img: Img, x: number, y: number, w: number, h: number) => ({ data: img.data, x, y, w, h, sizing: { type: 'cover' as const, w, h } })

export async function downloadSportPptx(g: SportGuide): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5 in
  pptx.title = `${g.name} 수업자료`
  pptx.author = 'PE LOG'
  const eyebrow = (slide: ReturnType<typeof pptx.addSlide>, n: string, label: string, x: number, y: number, w: number) =>
    slide.addText(
      [
        ...(n ? [{ text: `${n}  `, options: { color: BLUE } }] : []),
        { text: label, options: { color: MUTED } },
      ],
      { x, y, w, h: 0.45, fontFace: FONT, fontSize: 16, bold: true },
    )
  const heading = (slide: ReturnType<typeof pptx.addSlide>, text: string, x: number, y: number, w: number, h = 1.1, size = 36) =>
    slide.addText(text, { x, y, w, h, fontFace: FONT, fontSize: size, bold: true, color: WHITE, valign: 'top', fit: 'shrink' })

  for (const s of buildSlides(g)) {
    const slide = pptx.addSlide()
    slide.background = { color: BG }
    if (s.kind === 'cover') {
      if (s.cover) {
        const img = await toPng(`${BASE}${s.cover.src}`, 1400)
        slide.addImage(cover(img, 0, 0, 7.6, 7.5))
        slide.addShape(pptx.ShapeType.rect, { x: 5.2, y: 0, w: 2.4, h: 7.5, fill: { color: BG, transparency: 40 }, line: { color: BG, transparency: 100 } })
        slide.addText(`사진: ${s.cover.credit} · ${s.cover.license} · 위키미디어 공용`, { x: 0.2, y: 7.05, w: 7, h: 0.35, fontFace: FONT, fontSize: 9, color: DIM })
      }
      const x = s.cover ? 7.2 : 0.8
      slide.addText(s.group, { x, y: 1.7, w: 5.8, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: MUTED })
      slide.addText(s.title, { x, y: 2.2, w: 5.8, h: 1.6, fontFace: FONT, fontSize: 66, bold: true, color: WHITE, fit: 'shrink' })
      slide.addText(s.sub, { x, y: 3.9, w: 5.8, h: 1, fontFace: FONT, fontSize: 20, color: MUTED, valign: 'top' })
      if (s.keys.length) slide.addText(s.keys.map((k, i) => ({ text: `${i + 1} ${k}`, options: { breakLine: true } })), { x, y: 5, w: 5.8, h: 1.6, fontFace: FONT, fontSize: 15, bold: true, color: WHITE, valign: 'top' })
      continue
    }
    if (s.kind === 'keys') {
      eyebrow(slide, '★', '핵심 규칙 한눈에', 0.5, 0.35, 12)
      heading(slide, s.title, 0.5, 0.8, 12, 0.9)
      const n = s.keys.length
      const cols = n > 4 ? 5 : 4
      const cw = (12.3 - (cols - 1) * 0.2) / cols
      for (const [k, key] of s.keys.entries()) {
        const x = 0.5 + (k % cols) * (cw + 0.2)
        const y = 2 + Math.floor(k / cols) * 2.8
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: 4.6, fill: { color: CARD }, line: { color: CARD }, rectRadius: 0.15 })
        slide.addImage(fit(await visualPng(key.visual), x + 0.1, y + 0.15, cw - 0.2, 3.3))
        slide.addText([{ text: `${k + 1} `, options: { color: BLUE } }, { text: key.title, options: { color: WHITE } }], { x: x + 0.1, y: y + 3.6, w: cw - 0.2, h: 0.8, fontFace: FONT, fontSize: 17, bold: true, fit: 'shrink' })
      }
      continue
    }
    if (s.kind === 'key') {
      slide.addImage(fit(await visualPng(s.key.visual), 0.4, 0.6, 6.8, 6.3))
      eyebrow(slide, String(s.no), `핵심 규칙 · ${s.total}가지 중`, 7.6, 1.2, 5.3)
      heading(slide, s.key.title, 7.6, 1.7, 5.3, 1.2, 38)
      slide.addText(s.key.line, { x: 7.6, y: 3, w: 5.3, h: 1.8, fontFace: FONT, fontSize: 22, bold: true, color: WHITE, valign: 'top', fit: 'shrink' })
      if (s.key.why) slide.addText(s.key.why, { x: 7.6, y: 4.8, w: 5.3, h: 1.3, fontFace: FONT, fontSize: 16, color: MUTED, valign: 'top', fit: 'shrink' })
      slide.addText(`[${s.key.ref}]`, { x: 7.6, y: 6.2, w: 5.3, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: DIM })
      continue
    }
    if (s.kind === 'quiz') {
      eyebrow(slide, `Q${s.no}`, `O / X 퀴즈 · ${s.total}문제`, 0.8, 0.8, 11.7)
      slide.addText(s.quiz.q, { x: 0.8, y: 1.4, w: 11.7, h: 1.8, fontFace: FONT, fontSize: 34, bold: true, color: WHITE, align: 'center', valign: 'middle', fit: 'shrink' })
      for (const [k, m] of (['O', 'X'] as const).entries()) {
        const right = (m === 'O') === s.quiz.a
        slide.addShape(pptx.ShapeType.ellipse, { x: 4.6 + k * 2.6, y: 3.4, w: 1.6, h: 1.6, fill: { color: right ? (m === 'O' ? '30D158' : 'FF453A') : '2C2C2E' }, line: { color: BG } })
        slide.addText(m, { x: 4.6 + k * 2.6, y: 3.4, w: 1.6, h: 1.6, fontFace: FONT, fontSize: 54, bold: true, color: right ? BG : '48484A', align: 'center', valign: 'middle' })
      }
      slide.addText(`${s.quiz.why}  [${s.quiz.ref}]`, { x: 1.2, y: 5.4, w: 10.9, h: 1.2, fontFace: FONT, fontSize: 20, color: WHITE, align: 'center', valign: 'top', fit: 'shrink' })
      slide.addNotes('정답 동그라미가 칠해져 있어요. 수업에서는 먼저 손을 들게 한 뒤 보여 주세요.')
      continue
    }
    if (s.kind === 'sources') {
      heading(slide, s.title, 0.6, 0.4, 12, 0.8, 30)
      const lines = [
        ...s.sources.map((x) => ({ text: `${x.label} (${x.edition})\n${x.url}`, options: { bullet: true, breakLine: true } })),
        ...s.photos.map((p) => ({ text: `사진: ${p.credit} · ${p.license} · ${p.url}`, options: { bullet: true, breakLine: true } })),
        { text: '경기장 · 핵심 규칙 그림은 규칙서 내용으로 PE LOG가 직접 그림. 규칙 요약은 규칙서를 읽고 쉬운 말로 줄인 것(원문 아님).', options: { breakLine: true } },
      ]
      slide.addText(lines, { x: 0.6, y: 1.3, w: 12.1, h: 5.8, fontFace: FONT, fontSize: 13, color: WHITE, valign: 'top', paraSpaceAfter: 6 })
      continue
    }
    // 절
    const photo = s.figure?.kind === 'photo' ? PHOTOS[s.figure.photo] : null
    const court = s.figure?.kind === 'court' ? s.figure : null
    let x = 0.6
    let w = 12.1
    if (photo) {
      const img = await toPng(`${BASE}${photo.src}`, 1400)
      slide.addImage(cover(img, 0, 0, 6, 7.5))
      slide.addShape(pptx.ShapeType.rect, { x: 4.6, y: 0, w: 1.4, h: 7.5, fill: { color: BG, transparency: 45 }, line: { color: BG, transparency: 100 } })
      slide.addText(`사진: ${photo.credit} · ${photo.license}`, { x: 0.2, y: 7.05, w: 5.6, h: 0.35, fontFace: FONT, fontSize: 9, color: DIM })
      x = 6.4
      w = 6.4
    } else if (court) {
      w = 5.9
      const img = await courtPng(court.court)
      const box = fit(img, 6.8, 1.2, 6, 5.4)
      slide.addImage(box)
      slide.addText(court.caption, { x: 6.8, y: box.y + box.h + 0.05, w: 6, h: 0.4, fontFace: FONT, fontSize: 11, color: DIM, align: 'center' })
    }
    eyebrow(slide, String(s.chapter), s.part ? `${s.title} · ${s.part}` : s.title, x, 0.35, w)
    heading(slide, s.lead ?? s.title, x, 0.8, w, 1.2, s.lead ? 26 : 34)
    let y = 2.1
    if (s.specs?.length) {
      const cols = s.specs.length > 3 ? 2 : 3
      const cw = (w - (cols - 1) * 0.15) / cols
      s.specs.forEach((sp, k) => {
        const cx = x + (k % cols) * (cw + 0.15)
        const cy = y + Math.floor(k / cols) * 0.95
        slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: 0.85, fill: { color: CARD }, line: { color: CARD }, rectRadius: 0.08 })
        slide.addText([{ text: sp.label, options: { fontSize: 11, color: MUTED, breakLine: true } }, { text: sp.value, options: { fontSize: 17, bold: true, color: WHITE } }], { x: cx + 0.1, y: cy, w: cw - 0.2, h: 0.85, fontFace: FONT, valign: 'middle', fit: 'shrink' })
      })
      y += Math.ceil(s.specs.length / cols) * 0.95 + 0.15
    }
    slide.addText(
      s.items.flatMap((it) => [
        { text: it.t, options: { bullet: { code: '25CF' }, color: WHITE, breakLine: !it.ref } },
        ...(it.ref ? [{ text: `  [${it.ref}]`, options: { fontSize: 12, color: DIM, breakLine: true } }] : []),
      ]),
      { x, y, w, h: 7.2 - y, fontFace: FONT, fontSize: 18, valign: 'top', paraSpaceAfter: 8, fit: 'shrink' },
    )
  }
  await pptx.writeFile({ fileName: `${g.name} 수업자료.pptx` })
}
