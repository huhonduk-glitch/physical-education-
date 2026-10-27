import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { sportOf } from '../../data/sports'
import { buildSlides } from '../../lib/sportSlides'
import SlideView from './SlideView'

/** 종목 자료 슬라이드: 전체 화면 · 좌우로 밀기 · 화살표 키 · [PPT로 받기] (빔 프로젝터로 수업할 때) */
export default function SlidesPage() {
  const { sport = '' } = useParams()
  const nav = useNavigate()
  const g = sportOf(sport)
  const slides = useMemo(() => (g ? buildSlides(g) : []), [g])
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const touch = useRef<number | null>(null)
  const go = (d: number) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      else if (e.key === 'Escape') nav(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length])

  if (!g) return <Navigate to="/sports" replace />

  const download = async () => {
    setBusy(true)
    setErr('')
    try {
      const { downloadSportPptx } = await import('../../lib/sportPptx')
      await downloadSportPptx(g)
    } catch {
      setErr('PPT를 만들지 못했어요. 다시 해 보세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`${g.name} 슬라이드`}>
      <div className="flex items-center gap-2 border-b border-line px-3 pt-[max(env(safe-area-inset-top),6px)] pb-1.5 print:hidden">
        <button type="button" className="btn btn-soft min-h-[44px] px-3" onClick={() => nav(-1)}>
          <Icon name="close" /> 닫기
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold text-ink-3 tabular-nums">
          {g.name} · {i + 1} / {slides.length}
        </p>
        <button type="button" className="btn btn-primary min-h-[44px] px-3" onClick={download} disabled={busy}>
          <Icon name="download" /> {busy ? '만드는 중…' : 'PPT로 받기'}
        </button>
      </div>
      {err && <p className="px-4 py-1 text-sm font-bold text-danger">{err}</p>}
      <div
        className="relative min-h-0 flex-1"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        <div className="mx-auto h-full max-w-[min(100%,calc((100dvh-120px)*16/9))]">
          <SlideView slide={slides[i]} />
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),8px)] print:hidden">
        <button type="button" className="btn btn-soft min-h-[52px] flex-1" onClick={() => go(-1)} disabled={i === 0} aria-label="이전 장">
          <Icon name="chevronLeft" /> 이전
        </button>
        <div className="flex gap-1" aria-hidden>
          {slides.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full ${k === i ? 'w-4 bg-brand' : 'w-1.5 bg-fill-2'}`} />
          ))}
        </div>
        <button type="button" className="btn btn-primary min-h-[52px] flex-1" onClick={() => go(1)} disabled={i === slides.length - 1} aria-label="다음 장">
          다음 <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  )
}
