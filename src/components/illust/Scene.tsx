import type { ReactNode } from 'react'

/**
 * 삽화 장면 틀 (2026-11-03): 400 × 260, 밝은 체육관 — 벽 + 바닥 + 흰 선. 규칙 카드 · 슬라이드 · 포스터에 같은 그림.
 */
export const FONT = 'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
export const K = {
  navy: '#0b2545',
  red: '#e5383b',
  green: '#1f9d55',
  yellow: '#ffc93c',
  teamA: '#f97316',
  teamB: '#2563eb',
  floor: '#3cb4a5',
  floorDark: '#2e9c8f',
  wall: '#e3f3ff',
}

export function Scene({ label, children, floorY = 200, floor = K.floor, wall = K.wall, plain = false }: { label: string; children: ReactNode; floorY?: number; floor?: string; wall?: string; plain?: boolean }) {
  return (
    <svg viewBox="0 0 400 260" className="h-auto w-full" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: FONT }}>
      <defs>
        <clipPath id="sc-clip">
          <rect width="400" height="260" rx="16" />
        </clipPath>
        <marker id="sc-arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={K.navy} />
        </marker>
        <marker id="sc-arr-g" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={K.green} />
        </marker>
        <marker id="sc-arr-y" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={K.navy} />
        </marker>
      </defs>
      <g clipPath="url(#sc-clip)">
        {plain ? (
          <rect width="400" height="260" fill={wall} />
        ) : (
          <>
            <rect width="400" height={floorY} fill={wall} />
            <rect y={floorY - 34} width="400" height="8" fill="#ffffff" opacity={0.7} />
            <path d={`M0 ${floorY} H400 V260 H0 z`} fill={floor} />
            <path d={`M0 ${floorY + 0.5} H400`} stroke="#ffffff" strokeWidth={2} opacity={0.6} />
            <path d={`M-20 252 L60 ${floorY + 6} M420 252 L340 ${floorY + 6}`} stroke="#ffffff" strokeWidth={2.5} opacity={0.5} />
          </>
        )}
        {children}
      </g>
    </svg>
  )
}

/** ✓ · ✕ 동그라미 표 */
export function Mark({ x, y, ok, r = 15 }: { x: number; y: number; ok: boolean; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={ok ? K.green : K.red} stroke="#ffffff" strokeWidth={3} />
      {ok ? (
        <path d={`M${x - r * 0.45} ${y + r * 0.02} l${r * 0.3} ${r * 0.32} l${r * 0.6} ${-r * 0.62}`} stroke="#fff" strokeWidth={r * 0.26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={`M${x - r * 0.38} ${y - r * 0.38} l${r * 0.76} ${r * 0.76} M${x + r * 0.38} ${y - r * 0.38} l${-r * 0.76} ${r * 0.76}`} stroke="#fff" strokeWidth={r * 0.26} strokeLinecap="round" />
      )}
    </g>
  )
}

/** 글 상자 (말풍선 꼬리 선택) */
export function Pill({ x, y, text, color = K.navy, bg = '#ffffff', size = 15, tail }: { x: number; y: number; text: string; color?: string; bg?: string; size?: number; tail?: 'down' | 'up' }) {
  const w = [...text].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? size : ch === ' ' ? size * 0.3 : size * 0.6), 0) + size * 1.3
  const h = size * 1.9
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={bg} stroke={color === '#ffffff' ? 'none' : '#0b254522'} strokeWidth={1} />
      {tail === 'down' && <path d={`M${x - 6} ${y + h / 2 - 1} l6 8 l6 -8 z`} fill={bg} />}
      {tail === 'up' && <path d={`M${x - 6} ${y - h / 2 + 1} l6 -8 l6 8 z`} fill={bg} />}
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={size} fontWeight={900} fill={color}>
        {text}
      </text>
    </g>
  )
}
