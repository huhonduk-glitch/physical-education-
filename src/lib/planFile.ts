import { buildCells, readPdf } from './pdfTable'
import { textToGrid, weeksFromCells, weeksFromGrid, type ParsedPlan } from './planImport'
import { readGridsFromFile } from './rosterFile'

/**
 * 진도표 파일 읽기 (브라우저). PDF는 PDF.js(Apache-2.0, 앱에 묶음 · 인터넷 안 씀)를 이때만 불러온다.
 * 파일은 이 기기 안에서만 읽고 어디로도 보내지 않는다.
 */
export async function readPlanFile(file: File, defaultHours: number): Promise<ParsedPlan> {
  const data = await file.arrayBuffer()
  if (/\.pdf$/i.test(file.name)) {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const pages = await readPdf(pdfjs as unknown as Parameters<typeof readPdf>[0], new Uint8Array(data))
    return weeksFromCells(pages.map((p) => buildCells(p).cells))
  }
  if (/\.hwpx?$/i.test(file.name)) {
    return { weeks: [], extras: [], warnings: ['한글 파일은 바로 못 읽어요. 한글에서 [파일 → PDF로 저장] 또는 표를 엑셀로 복사해 주세요.'] }
  }
  const grids = await readGridsFromFile(data, file.name)
  for (const g of grids) {
    const p = weeksFromGrid(g.grid, defaultHours)
    if (p.weeks.length) return p
  }
  return { weeks: [], extras: [], warnings: ['표에서 진도표 머리글(단원 · 성취기준 또는 학습 내용)을 찾지 못했어요.'] }
}

export function readPlanText(text: string, defaultHours: number): ParsedPlan {
  return weeksFromGrid(textToGrid(text), defaultHours)
}
