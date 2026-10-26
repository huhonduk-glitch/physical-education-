import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'fs'
import { readPdf, buildCells } from './src/lib/pdfTable.ts'
// 필요한 쪽만: readPdf는 전 쪽을 읽으므로 쪽 범위를 잘라 읽는 작은 래퍼
const data = new Uint8Array(fs.readFileSync(process.argv[2]))
const from = Number(process.argv[3]), to = Number(process.argv[4])
const doc = await pdfjs.getDocument({ data }).promise
const fake = { getDocument: () => ({ promise: Promise.resolve({ numPages: to - from + 1, getPage: (n: number) => doc.getPage(n + from - 1) }) }), OPS: pdfjs.OPS }
const pages = await readPdf(fake as any, data)
fs.writeFileSync(process.argv[5], JSON.stringify(pages))
pages.forEach((p, i) => {
  const { cells } = buildCells(p)
  console.log('=== PAGE', from + i, 'rects', p.rects.length, 'cells', cells.length)
  for (const c of cells.sort((a, b) => b.y1 - a.y1 || a.x0 - b.x0)) console.log(Math.round(c.x0), Math.round(c.x1), Math.round(c.y0), Math.round(c.y1), c.text.slice(0, 80))
})
