import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SportGuide } from '../data/sports'
import { SPORT_KEYS } from '../data/sportKeys'
import { fitText, POSTER_H, POSTER_W, posterLayout, posterTitle, textWidth } from '../lib/rulePoster'
import { Illust } from './illust'
import RuleVisual from './RuleVisual'

/**
 * 핵심 규칙 한 장 그림 (2026-11-03). 선생님이 만든 넷볼 그림처럼 밝은 바탕 · 번호 카드 · 그림 · 쉬운 설명.
 * 그림 하나(SVG)라서 화면 · 슬라이드 · PNG 받기 · PPT에 똑같이 들어간다. 그림 안 규칙 그림은 RuleVisual(직접 그림).
 */
const FONT = 'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const NAVY = '#0b2545'
const ORANGE = '#ff8a00'

/** 카드 제목: 칸에 들어가는 가장 큰 글자 (34 → 16) */
const titleSize = (t: string, w: number) => [34, 32, 30, 28, 26, 24, 22, 20, 18, 16].find((px) => textWidth(t, px) <= w * 0.95) ?? 16

export default function RulePoster({ sport }: { sport: SportGuide }) {
  const keys = SPORT_KEYS[sport.id]?.keys ?? []
  const cards = posterLayout(keys.length)
  const src = sport.sources[0]
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${POSTER_W} ${POSTER_H}`} width={POSTER_W} height={POSTER_H} role="img" aria-label={posterTitle(sport.name, keys.length)} style={{ fontFamily: FONT }}>
      <defs>
        <linearGradient id="rp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38d1c4" />
          <stop offset="0.55" stopColor="#36a9f2" />
          <stop offset="1" stopColor="#2f6fe0" />
        </linearGradient>
        <filter id="rp-sh" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#062a4f" floodOpacity="0.25" />
        </filter>
      </defs>
      <rect width={POSTER_W} height={POSTER_H} fill="url(#rp-bg)" />
      {/* 바닥 코트 선 (장식) */}
      <g fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="6">
        <line x1={POSTER_W / 2} y1="0" x2={POSTER_W / 2} y2={POSTER_H} />
        <circle cx={POSTER_W / 2} cy={POSTER_H / 2 + 60} r="150" />
        <path d={`M0 ${POSTER_H * 0.25} A 260 260 0 0 1 0 ${POSTER_H * 0.9}`} />
        <path d={`M${POSTER_W} ${POSTER_H * 0.25} A 260 260 0 0 0 ${POSTER_W} ${POSTER_H * 0.9}`} />
      </g>
      <text x={POSTER_W / 2} y="88" textAnchor="middle" fontSize="62" fontWeight="900" fill={NAVY} stroke="#fff" strokeWidth="10" strokeLinejoin="round" paintOrder="stroke">
        {posterTitle(sport.name, keys.length)}
      </text>
      <text x={POSTER_W / 2} y="140" textAnchor="middle" fontSize="28" fontWeight="800" fill="#fff">
        {sport.emoji} 처음 배우는 친구들을 위한 쉬운 안내
      </text>
      {keys.map((k, i) => {
        const b = cards[i]
        const t = fitText(k.line, k.why, b.text.w, b.text.h)
        const lh = t.size * 1.38
        const exSize = t.size * 0.82
        return (
          <g key={k.title}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="28" fill="#fff" filter="url(#rp-sh)" />
            <circle cx={b.x + 22 + 21} cy={b.y + 22 + 19} r="21" fill={ORANGE} />
            <text x={b.x + 22 + 21} y={b.y + 22 + 28} textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff">
              {i + 1}
            </text>
            <text x={b.x + 22 + 52} y={b.y + 22 + 30} fontSize={titleSize(k.title, b.w - 22 - 52 - 14)} fontWeight="900" fill={NAVY}>
              {k.title}
            </text>
            <svg x={b.vis.x} y={b.vis.y} width={b.vis.w} height={b.vis.h} viewBox="0 0 400 260">
              {k.illust ? <Illust id={k.illust} /> : <RuleVisual v={k.visual} />}
            </svg>
            <text fontSize={t.size} fontWeight="700" fill="#1f2a37">
              {t.lines.map((l, j) => (
                <tspan key={j} x={b.text.x} y={b.text.y + t.size + j * lh}>
                  {l}
                </tspan>
              ))}
            </text>
            {t.extra.length > 0 && (
              <text fontSize={exSize} fontWeight="600" fill="#5b6675">
                {t.extra.map((l, j) => (
                  <tspan key={j} x={b.text.x} y={b.text.y + t.lines.length * lh + t.size * 0.5 + exSize + j * exSize * 1.38}>
                    {l}
                  </tspan>
                ))}
              </text>
            )}
            <text x={b.x + 22} y={b.y + b.h - 18} fontSize="17" fontWeight="700" fill="#8a94a3">
              [{k.ref}]
            </text>
          </g>
        )
      })}
      <text x={POSTER_W / 2} y="884" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fillOpacity="0.9">
        {src ? `근거: ${src.label} (${src.edition})` : ''} · 규칙서 내용으로 PE LOG가 그림
      </text>
    </svg>
  )
}

/** 포스터 SVG 문자열 (PNG 받기 · PPT) */
export const rulePosterSvg = (sport: SportGuide) => renderToStaticMarkup(createElement(RulePoster, { sport }))
