import { useState, type ReactNode } from 'react'
import CourtDiagram from '../../components/CourtDiagram'
import RuleVisual, { NETBALL_AREAS, NETBALL_ORDER, type NetballPos } from '../../components/RuleVisual'
import type { Figure } from '../../data/sports'
import { PHOTOS } from '../../data/sportPhotos'
import type { KeyRule } from '../../data/sportKeys'
import type { Slide } from '../../lib/sportSlides'

const BASE = import.meta.env.BASE_URL

/** 그림 한 개: 경기장(직접 그림) 또는 사진(저작자 · 라이선스 함께) — 종목 안내 화면(흰 바탕)에서 쓴다 */
export function FigureView({ figure, compact = false }: { figure: Figure; compact?: boolean }) {
  if (figure.kind === 'court')
    return (
      <figure className="space-y-1">
        <CourtDiagram court={figure.court} />
        <figcaption className={`text-center text-ink-3 ${compact ? 'text-xs' : 'text-sm'}`}>{figure.caption}</figcaption>
      </figure>
    )
  const p = PHOTOS[figure.photo]
  if (!p) return null
  return (
    <figure className="space-y-1">
      <img src={`${BASE}${p.src}`} alt={figure.caption} className="mx-auto max-h-[46vh] w-auto rounded-xl object-contain" loading="lazy" />
      <figcaption className={`text-center text-ink-3 ${compact ? 'text-xs' : 'text-sm'}`}>
        {figure.caption}
        <span className="block text-[0.7em]">
          사진: {p.credit} · {p.license} · 위키미디어 공용
        </span>
      </figcaption>
    </figure>
  )
}

/** 넷볼 구역 그림 + 포지션 고르기 (누르면 그 선수가 갈 수 있는 구역만 밝게) */
export function ZonesPicker({ dark = true }: { dark?: boolean }) {
  const [pos, setPos] = useState<NetballPos | null>(null)
  return (
    <div className="space-y-2">
      <RuleVisual v={{ kind: 'zones', pos }} />
      <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="포지션">
        {NETBALL_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={pos === p}
            title={NETBALL_AREAS[p].name}
            onClick={(e) => {
              e.stopPropagation()
              setPos(pos === p ? null : p)
            }}
            className={`min-h-[40px] min-w-[46px] rounded-full px-3 text-[clamp(0.8rem,1.4vw,1.05rem)] font-extrabold transition-colors ${
              pos === p ? 'bg-[#2997ff] text-white' : dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-fill text-ink'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 핵심 규칙 그림: 넷볼 구역은 포지션을 고를 수 있게 */
export function KeyVisual({ k, dark = true }: { k: KeyRule; dark?: boolean }) {
  return k.visual.kind === 'zones' ? <ZonesPicker dark={dark} /> : <RuleVisual v={k.visual} />
}

const show = (on: boolean) => `transition-[opacity,transform] duration-500 ${on ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'}`
const Eyebrow = ({ n, label }: { n?: string | number; label: string }) => (
  <p className="text-[clamp(0.9rem,1.7vw,1.35rem)] font-bold text-[#a1a1a6]">
    {n !== undefined && <span className="mr-2 text-[#2997ff]">{n}</span>}
    {label}
  </p>
)
const H = ({ children }: { children: ReactNode }) => <h2 className="mt-1 text-[clamp(1.7rem,4.2vw,3.4rem)] leading-[1.15] font-black tracking-tight text-white">{children}</h2>
const Ref = ({ r }: { r: string }) => <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[clamp(0.75rem,1.3vw,1rem)] font-bold text-[#a1a1a6]">[{r}]</span>

/** 사진을 왼쪽에 크게 깔고 오른쪽으로 검게 녹이기 (참고 강의 사이트 방식) */
function PhotoBleed({ photo, caption }: { photo: string; caption?: string }) {
  const p = PHOTOS[photo]
  if (!p) return null
  return (
    <div className="absolute inset-y-0 left-0 w-[58%]">
      <img src={`${BASE}${p.src}`} alt={caption ?? ''} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/30 to-black" />
      <p className="absolute bottom-2 left-3 text-[0.65rem] text-white/60">
        사진: {p.credit} · {p.license} · 위키미디어 공용
      </p>
    </div>
  )
}

/** 슬라이드 한 장 (16:9, 검은 화면). step = 지금까지 연 단계 수 */
export default function SlideView({ slide, step = 99 }: { slide: Slide; step?: number }) {
  if (slide.kind === 'cover')
    return (
      <div className="relative h-full overflow-hidden bg-black">
        {slide.cover && (
          <div className="absolute inset-y-0 left-0 w-[62%]">
            <img src={`${BASE}${slide.cover.src}`} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/40 to-black" />
            <p className="absolute bottom-2 left-3 text-[0.65rem] text-white/60">
              사진: {slide.cover.credit} · {slide.cover.license}
            </p>
          </div>
        )}
        <div className={`relative flex h-full flex-col justify-center p-[5%] ${slide.cover ? 'ml-[48%]' : ''}`}>
          <Eyebrow label={slide.group} />
          <h1 className="mt-2 text-[clamp(2.8rem,8vw,6.5rem)] leading-none font-black tracking-tight text-white">{slide.title}</h1>
          <p className="mt-4 text-[clamp(1rem,2.2vw,1.7rem)] font-semibold text-[#a1a1a6]">{slide.sub}</p>
          {slide.keys.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {slide.keys.map((k, i) => (
                <span key={k} className="rounded-full bg-white/10 px-3 py-1.5 text-[clamp(0.8rem,1.4vw,1.1rem)] font-bold text-white">
                  <span className="mr-1 text-[#2997ff]">{i + 1}</span>
                  {k}
                </span>
              ))}
            </div>
          )}
          <p className="mt-8 text-[clamp(0.7rem,1.1vw,0.9rem)] text-white/40">PE LOG · 체육수업 종합 플랫폼</p>
        </div>
      </div>
    )

  if (slide.kind === 'keys')
    return (
      <div className="flex h-full flex-col bg-black p-[3.5%]">
        <Eyebrow n="★" label="핵심 규칙 한눈에" />
        <H>{slide.title}</H>
        <div className={`mt-[2%] grid min-h-0 flex-1 gap-[1.5%] ${slide.keys.length > 4 ? 'grid-cols-3' : 'grid-cols-2'} ${slide.keys.length > 4 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          {slide.keys.map((k, i) => (
            <div key={k.title} className="flex min-h-0 flex-col rounded-2xl bg-[#1d1d1f] p-[4%]">
              <div className="flex min-h-0 flex-1 items-center overflow-hidden">{k.visual.kind === 'zones' ? <RuleVisual v={{ kind: 'zones' }} /> : <RuleVisual v={k.visual} />}</div>
              <p className="mt-2 text-[clamp(0.95rem,1.8vw,1.45rem)] font-black text-white">
                <span className="mr-1.5 text-[#2997ff]">{i + 1}</span>
                {k.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    )

  if (slide.kind === 'key')
    return (
      <div className="grid h-full grid-cols-1 items-center gap-[4%] bg-black p-[4%] md:grid-cols-[1.15fr_1fr]">
        <div className="min-h-0">
          <KeyVisual k={slide.key} />
        </div>
        <div className="min-h-0">
          <Eyebrow n={slide.no} label={`핵심 규칙 · ${slide.total}가지 중`} />
          <H>{slide.key.title}</H>
          <p className={`mt-[6%] text-[clamp(1.1rem,2.5vw,2rem)] leading-snug font-bold text-white ${show(step >= 1)}`}>{slide.key.line}</p>
          {slide.key.why && <p className={`mt-4 text-[clamp(0.95rem,1.9vw,1.5rem)] leading-snug font-semibold text-[#a1a1a6] ${show(step >= 2)}`}>{slide.key.why}</p>}
          <div className={`mt-5 ${show(step >= 1)}`}>
            <Ref r={slide.key.ref} />
          </div>
        </div>
      </div>
    )

  if (slide.kind === 'quiz') {
    const open = step >= 1
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black p-[5%] text-center">
        <Eyebrow n={`Q${slide.no}`} label={`O / X 퀴즈 · ${slide.total}문제`} />
        <p className="mt-4 max-w-[85%] text-[clamp(1.5rem,3.8vw,3rem)] leading-tight font-black text-white">{slide.quiz.q}</p>
        <div className="mt-[4%] flex items-center gap-[6%]">
          {(['O', 'X'] as const).map((m) => {
            const right = (m === 'O') === slide.quiz.a
            return (
              <span
                key={m}
                className={`grid aspect-square w-[clamp(4rem,11vw,8.5rem)] place-items-center rounded-full text-[clamp(2.4rem,6vw,5rem)] font-black transition-all duration-500 ${
                  !open ? 'bg-white/10 text-white' : right ? (m === 'O' ? 'scale-110 bg-[#30d158] text-black' : 'scale-110 bg-[#ff453a] text-white') : 'bg-white/5 text-white/20'
                }`}
              >
                {m}
              </span>
            )
          })}
        </div>
        <div className={`mt-[4%] max-w-[80%] ${show(open)}`}>
          <p className="text-[clamp(1rem,2.2vw,1.7rem)] font-bold text-white">{slide.quiz.why}</p>
          <div className="mt-3">
            <Ref r={slide.quiz.ref} />
          </div>
        </div>
      </div>
    )
  }

  if (slide.kind === 'sources')
    return (
      <div className="h-full overflow-y-auto bg-black p-[4%] text-white">
        <Eyebrow label="자료" />
        <H>{slide.title}</H>
        <ul className="mt-4 space-y-2 text-[clamp(0.85rem,1.6vw,1.2rem)]">
          {slide.sources.map((s) => (
            <li key={s.url}>
              <b>{s.label}</b> <span className="text-[#a1a1a6]">({s.edition})</span>
              <span className="block break-all text-sm text-[#86868b]">{s.url}</span>
            </li>
          ))}
        </ul>
        {slide.photos.length > 0 && (
          <>
            <p className="mt-5 font-bold">사진 (위키미디어 공용 · 자유 이용)</p>
            <ul className="mt-1 space-y-1 text-sm text-[#a1a1a6]">
              {slide.photos.map((p) => (
                <li key={p.src}>
                  {p.credit} · {p.license} · <span className="break-all text-[#86868b]">{p.url}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-sm text-[#86868b]">경기장 · 핵심 규칙 그림은 규칙서 내용으로 PE LOG가 직접 그렸어요. 규칙 요약은 규칙서를 읽고 쉬운 말로 줄인 것이에요(원문 아님).</p>
      </div>
    )

  // 절 (장 번호 · 큰 제목 · 하나씩 나타나는 줄 · 큰 숫자 칸 · 그림)
  const photo = slide.figure?.kind === 'photo' ? slide.figure : null
  const court = slide.figure?.kind === 'court' ? slide.figure : null
  const specOffset = slide.specs?.length ? 1 : 0
  return (
    <div className="relative h-full overflow-hidden bg-black">
      {photo && <PhotoBleed photo={photo.photo} caption={photo.caption} />}
      <div className={`relative grid h-full gap-[3%] p-[3.5%] ${photo ? 'ml-[46%]' : court ? 'md:grid-cols-[1fr_1.1fr]' : ''}`}>
        <div className="flex min-h-0 flex-col">
          <Eyebrow n={slide.chapter} label={slide.part ? `${slide.title} · ${slide.part}` : slide.title} />
          <H>{slide.lead ?? slide.title}</H>
          {slide.specs && slide.specs.length > 0 && (
            <div className={`mt-[3%] grid gap-2 ${slide.specs.length > 3 ? 'grid-cols-2' : 'grid-cols-3'} ${show(step >= 1)}`}>
              {slide.specs.map((s) => (
                <div key={s.label} className="rounded-xl bg-[#1d1d1f] px-3 py-2">
                  <p className="text-[clamp(0.7rem,1.2vw,0.95rem)] font-bold text-[#a1a1a6]">{s.label}</p>
                  <p className="text-[clamp(0.95rem,1.9vw,1.5rem)] leading-tight font-black text-white tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <ul className="mt-[3%] min-h-0 space-y-[1.2%] overflow-hidden pb-1">
            {slide.items.map((it, i) => (
              <li key={it.t} className={`flex gap-3 text-[clamp(1rem,2vw,1.5rem)] leading-snug font-semibold text-[#f5f5f7] ${show(step >= specOffset + i + 1)}`}>
                <span className="mt-[0.45em] h-2.5 w-2.5 shrink-0 rounded-full bg-[#2997ff]" aria-hidden />
                <span>
                  {it.t}
                  {it.ref && <span className="ml-1.5 text-[0.65em] font-bold whitespace-nowrap text-[#86868b]">[{it.ref}]</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {court && (
          <figure className="flex min-h-0 flex-col justify-center">
            <div className="overflow-hidden rounded-2xl">
              <CourtDiagram court={court.court} />
            </div>
            <figcaption className="mt-2 text-center text-[clamp(0.7rem,1.2vw,0.95rem)] text-[#86868b]">{court.caption}</figcaption>
          </figure>
        )}
      </div>
    </div>
  )
}
