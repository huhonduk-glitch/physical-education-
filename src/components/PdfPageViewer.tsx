import { useEffect, useRef, useState } from 'react'
import { getDocData } from '../db/docStore'
import Icon from './Icon'

/**
 * 이 기기에 넣어 둔 PDF의 한 쪽을 앱 안에서 그려 보여 준다 (PDF.js, 앱에 묶음 · 인터넷 안 씀).
 * 폰 크롬은 PDF를 화면 안에서 못 열고 내려받기만 해서, 쪽을 직접 그림으로 그린다.
 */

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> }
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; canvas?: HTMLCanvasElement }) => { promise: Promise<void>; cancel: () => void }
}

const cache = new Map<string, Promise<PdfDoc>>()

async function loadPdf(key: string): Promise<PdfDoc> {
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const blob = await getDocData(key)
      if (!blob) throw new Error('파일이 없어요. 다시 넣어 주세요.')
      const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
      const doc = (await task.promise) as unknown as PdfDoc
      doc.destroy = () => task.destroy()
      return doc
    })()
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

/** 파일을 바꾸거나 지웠을 때 */
export function forgetPdf(key: string): void {
  const p = cache.get(key)
  cache.delete(key)
  void p?.then((d) => d.destroy()).catch(() => undefined)
}

/** 넣은 PDF의 쪽수 (넣을 때 판 확인용) */
export async function countPdfPages(data: ArrayBuffer): Promise<number> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  const n = (await task.promise).numPages
  await task.destroy()
  return n
}

export default function PdfPageViewer({ docKey, title, page, onClose }: { docKey: string; title: string; page: number; onClose: () => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [n, setN] = useState(page)
  const [err, setErr] = useState('')
  const [big, setBig] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    loadPdf(docKey)
      .then((d) => live && setDoc(d))
      .catch((e) => live && setErr(e instanceof Error ? e.message : 'PDF를 열지 못했어요.'))
    return () => {
      live = false
    }
  }, [docKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setN((v) => v + 1)
      if (e.key === 'ArrowLeft') setN((v) => Math.max(1, v - 1))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const last = doc?.numPages ?? page
  const cur = Math.min(Math.max(1, n), last)

  useEffect(() => {
    if (!doc || !canvas.current || !box.current) return
    let task: { cancel: () => void } | null = null
    let live = true
    void (async () => {
      const pg = await doc.getPage(cur)
      if (!live || !canvas.current || !box.current) return
      const base = pg.getViewport({ scale: 1 })
      const cssW = Math.max(280, box.current.clientWidth - 24) * (big ? 2 : 1)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const vp = pg.getViewport({ scale: (cssW / base.width) * ratio })
      const c = canvas.current
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      c.style.width = `${Math.floor(vp.width / ratio)}px`
      c.style.height = 'auto'
      const ctx = c.getContext('2d')
      if (!ctx) return
      const t = pg.render({ canvasContext: ctx, viewport: vp, canvas: c })
      task = t
      await t.promise.catch(() => undefined)
    })()
    return () => {
      live = false
      task?.cancel()
    }
  }, [doc, cur, big])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center gap-2 border-b border-line px-3 pt-[env(safe-area-inset-top)]">
        <button type="button" className="btn btn-ghost h-12 w-12 p-0" aria-label="닫기" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="min-w-0 flex-1 py-2">
          <p className="truncate font-bold">{title}</p>
          <p className="hint">
            {cur} / {last}쪽
          </p>
        </div>
        <button type="button" className="btn btn-soft h-11 px-3 text-sm" onClick={() => setBig((v) => !v)}>
          {big ? '화면에 맞추기' : '크게 보기'}
        </button>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-fill p-2">
        {err ? <p className="p-4 font-bold text-danger">{err}</p> : !doc ? <p className="hint p-4">여는 중…</p> : <canvas ref={canvas} className={`mx-auto block bg-white shadow ${big ? '' : 'max-w-full'}`} />}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <button type="button" className="btn btn-outline" disabled={cur <= 1} onClick={() => setN(cur - 1)}>
          ◀ 앞 쪽
        </button>
        <button type="button" className="btn btn-outline" disabled={cur >= last} onClick={() => setN(cur + 1)}>
          다음 쪽 ▶
        </button>
      </div>
    </div>
  )
}
