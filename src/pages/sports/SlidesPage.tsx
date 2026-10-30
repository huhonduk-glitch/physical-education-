import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { sportOf } from '../../data/sports'
import { buildSlides, stepsOf, type Slide } from '../../lib/sportSlides'
import SlideView from './SlideView'

const label = (s: Slide) =>
  s.kind === 'cover' ? '표지' : s.kind === 'keys' ? '핵심 규칙' : s.kind === 'key' ? `핵심 ${s.no} · ${s.key.title}` : s.kind === 'section' ? `${s.chapter} ${s.title}${s.part ? ` ${s.part}` : ''}` : s.kind === 'quiz' ? `퀴즈 ${s.no}` : '출처'

/**
 * 종목 자료 슬라이드 (2026-10-30 다시 짬): 검은 화면 · 누를 때마다 한 줄씩 → 다 보이면 다음 장.
 * 화면 누르기 · → · 스페이스 = 다음, ← = 이전, O = 전체 보기, F = 전체 화면, Esc = 닫기. [PPT로 받기]는 모든 줄이 보인 상태로.
 */
export default function SlidesPage() {
  const { sport = '' } = useParams()
  const nav = useNavigate()
  const g = sportOf(sport)
  const slides = useMemo(() => (g ? buildSlides(g) : []), [g])
  const [i, setI] = useState(0)
  const [step, setStep] = useState(0)
  const [overview, setOverview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const touch = useRef<number | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const next = useCallback(() => {
    if (!slides.length) return
    if (step < stepsOf(slides[i])) setStep(step + 1)
    else if (i < slides.length - 1) {
      setI(i + 1)
      setStep(0)
    }
  }, [i, step, slides])
  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1)
    else if (i > 0) {
      setI(i - 1)
      setStep(stepsOf(slides[i - 1]))
    }
  }, [i, step, slides])
  const jump = (k: number) => {
    setI(k)
    setStep(0)
    setOverview(false)
  }
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen?.().catch(() => undefined)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev()
      else if (e.key === 'o' || e.key === 'O' || e.key === 'ㅐ') setOverview((v) => !v)
      else if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') fullscreen()
      else if (e.key === 'Escape') {
        if (overview) setOverview(false)
        else if (!document.fullscreenElement) nav(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, nav, overview])
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

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

  const ctl = 'grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30'
  return (
    <div ref={root} className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={`${g.name} 슬라이드`}>
      <div
        className="relative min-h-0 flex-1"
        onClick={(e) => {
          // 그림 안의 버튼(넷볼 포지션 등)은 넘기지 않는다
          if ((e.target as HTMLElement).closest('button')) return
          next()
        }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          if (Math.abs(dx) > 50) (dx < 0 ? next : prev)()
          touch.current = null
        }}
      >
        <div className="absolute inset-0 m-auto aspect-video max-h-full max-w-full">
          <SlideView key={i} slide={slides[i]} step={step} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),8px)]">
        <button type="button" className={ctl} onClick={() => nav(-1)} aria-label="닫기">
          <Icon name="close" />
        </button>
        <button type="button" className={ctl} onClick={() => setOverview(true)} aria-label="전체 보기 (O)">
          <Icon name="grid" />
        </button>
        <button type="button" className="h-11 rounded-full bg-white/10 px-4 text-sm font-bold whitespace-nowrap hover:bg-white/20 disabled:opacity-40" onClick={download} disabled={busy}>
          {busy ? '만드는 중…' : 'PPT로 받기'}
        </button>
        <span className="min-w-0 flex-1 truncate px-2 text-center text-xs text-white/50">{label(slides[i])}</span>
        <button type="button" className={ctl} onClick={prev} disabled={i === 0 && step === 0} aria-label="이전">
          <Icon name="chevronLeft" />
        </button>
        <span className="h-11 min-w-[4.5rem] rounded-full bg-white/10 px-3 text-center text-sm leading-[2.75rem] font-bold tabular-nums">
          {i + 1} / {slides.length}
        </span>
        <button type="button" className={ctl} onClick={next} disabled={i === slides.length - 1 && step >= stepsOf(slides[i])} aria-label="다음">
          <Icon name="chevronRight" />
        </button>
        <button type="button" className={`${ctl} hidden sm:grid`} onClick={fullscreen} aria-label="전체 화면 (F)">
          <Icon name="expand" />
        </button>
      </div>
      {err && <p className="px-4 pb-2 text-sm font-bold text-[#ff453a]">{err}</p>}
      {overview && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-black/95 p-4" role="dialog" aria-label="전체 보기">
          <div className="mb-3 flex items-center">
            <p className="flex-1 text-lg font-black">{g.name} · 전체 {slides.length}장</p>
            <button type="button" className={ctl} onClick={() => setOverview(false)} aria-label="닫기">
              <Icon name="close" />
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slides.map((s, k) => (
              <li key={k}>
                <button type="button" className={`block w-full overflow-hidden rounded-xl text-left ring-2 ${k === i ? 'ring-[#2997ff]' : 'ring-transparent'}`} onClick={() => jump(k)}>
                  <div className="pointer-events-none aspect-video w-full overflow-hidden">
                    <div className="h-[400%] w-[400%] origin-top-left scale-[0.25]">
                      <SlideView slide={s} />
                    </div>
                  </div>
                  <p className="truncate bg-[#1d1d1f] px-2 py-1 text-xs font-bold">
                    {k + 1}. {label(s)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
