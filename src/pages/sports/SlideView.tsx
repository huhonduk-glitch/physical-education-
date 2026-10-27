import CourtDiagram from '../../components/CourtDiagram'
import type { Figure } from '../../data/sports'
import { PHOTOS } from '../../data/sportPhotos'
import type { Slide } from '../../lib/sportSlides'

const BASE = import.meta.env.BASE_URL

/** 그림 한 개: 경기장(직접 그림) 또는 사진(저작자 · 라이선스 함께) */
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

/** 슬라이드 한 장 (16:9). 빔 화면에서도 읽히게 글자를 크게 */
export default function SlideView({ slide }: { slide: Slide }) {
  if (slide.kind === 'title')
    return (
      <div className="grid h-full grid-cols-1 items-center gap-6 p-[4%] md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[clamp(0.9rem,2vw,1.4rem)] font-bold text-brand">{slide.group}</p>
          <h2 className="text-[clamp(2.4rem,7vw,5rem)] leading-tight font-black">{slide.title}</h2>
          <p className="mt-3 text-[clamp(1rem,2.4vw,1.8rem)] font-semibold text-ink-2">{slide.sub}</p>
        </div>
        {slide.cover && (
          <figure>
            <img src={`${BASE}${slide.cover.src}`} alt="" className="mx-auto max-h-[52vh] w-auto rounded-2xl object-contain" />
            <figcaption className="mt-1 text-center text-xs text-ink-3">
              사진: {slide.cover.credit} · {slide.cover.license}
            </figcaption>
          </figure>
        )}
      </div>
    )
  if (slide.kind === 'sources')
    return (
      <div className="h-full overflow-y-auto p-[4%]">
        <h2 className="text-[clamp(1.6rem,4vw,2.8rem)] font-black">{slide.title}</h2>
        <ul className="mt-4 space-y-2 text-[clamp(0.9rem,1.8vw,1.25rem)]">
          {slide.sources.map((s) => (
            <li key={s.url}>
              <b>{s.label}</b> <span className="text-ink-3">({s.edition})</span>
              <span className="block break-all text-sm text-ink-3">{s.url}</span>
            </li>
          ))}
        </ul>
        {slide.photos.length > 0 && (
          <>
            <p className="mt-5 font-bold">사진 (위키미디어 공용 · 자유 이용)</p>
            <ul className="mt-1 space-y-1 text-sm text-ink-2">
              {slide.photos.map((p) => (
                <li key={p.src}>
                  {p.credit} · {p.license} · <span className="break-all text-ink-3">{p.url}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-sm text-ink-3">경기장 그림은 규칙서 치수로 PE LOG가 직접 그렸어요. 규칙 요약은 규칙서를 읽고 쉬운 말로 줄인 것이에요(원문 아님).</p>
      </div>
    )
  const side = slide.figure || slide.specs?.length
  return (
    <div className="flex h-full flex-col p-[3.5%]">
      <h2 className="text-[clamp(1.5rem,3.6vw,2.6rem)] font-black">
        {slide.title}
        {slide.part && <span className="ml-2 text-[0.55em] font-bold text-ink-3">{slide.part}</span>}
      </h2>
      <div className={`mt-3 grid min-h-0 flex-1 gap-5 ${side ? 'md:grid-cols-[1.25fr_1fr]' : ''}`}>
        <div className="min-h-0 overflow-y-auto">
          {slide.lead && <p className="mb-3 rounded-2xl bg-brand-light p-3 text-[clamp(1rem,2vw,1.45rem)] font-bold text-brand-ink">{slide.lead}</p>}
          <ul className="space-y-2.5">
            {slide.items.map((it) => (
              <li key={it.t} className="flex gap-2.5 text-[clamp(1rem,2vw,1.45rem)] leading-snug">
                <span className="mt-[0.5em] h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>
                  {it.t}
                  {it.ref && <span className="ml-1 text-[0.7em] font-bold whitespace-nowrap text-ink-3">[{it.ref}]</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {side && (
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {slide.specs && slide.specs.length > 0 && (
              <table className="w-full text-left text-[clamp(0.85rem,1.6vw,1.15rem)]">
                <tbody>
                  {slide.specs.map((s) => (
                    <tr key={s.label} className="border-b border-line">
                      <th className="py-1.5 pr-2 font-bold text-ink-2">{s.label}</th>
                      <td className="py-1.5 font-extrabold tabular-nums">
                        {s.value}
                        {s.ref && <span className="ml-1 text-[0.7em] font-bold text-ink-3">[{s.ref}]</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {slide.figure && <FigureView figure={slide.figure} />}
          </div>
        )}
      </div>
    </div>
  )
}
