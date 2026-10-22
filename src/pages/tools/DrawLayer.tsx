import { useLayoutEffect, useRef, useState } from 'react'
import { jointAngle, tilt, type Pt } from '../../lib/motion'

/**
 * 영상 위에 선·각도 그리기 (B-3). 점은 화면 크기와 상관없는 0~1 비율 좌표로 기억한다.
 * - 선: 두 점 → 수평에서 기운 각도(0~90°)
 * - 각도: 세 점(가운데가 꼭짓점) → 관절각(0~180°)
 * 영상 위에서도 잘 보이게 흰 선 + 검은 테두리.
 */
export type DrawTool = 'line' | 'angle'
export type Shape = { kind: 'line'; pts: [Pt, Pt] } | { kind: 'angle'; pts: [Pt, Pt, Pt] }

const NEED: Record<DrawTool, number> = { line: 2, angle: 3 }

/** 비율 좌표 → 실제 크기로 바꿔 계산 (가로세로 비가 다른 영상에서도 각도가 맞게) */
export function shapeLabel(s: Shape, w: number, h: number): string {
  const p = s.pts.map((q) => ({ x: q.x * w, y: q.y * h }))
  const v = s.kind === 'line' ? tilt(p[0], p[1]) : jointAngle(p[0], p[1], p[2])
  return v === null ? '—' : `${v}°`
}

/** 저장할 그림(캔버스)에 같은 모양으로 그린다 */
export function paintShapes(ctx: CanvasRenderingContext2D, shapes: readonly Shape[], w: number, h: number) {
  const unit = Math.max(2, Math.round(Math.min(w, h) / 160))
  for (const s of shapes) {
    const p = s.pts.map((q) => ({ x: q.x * w, y: q.y * h }))
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [color, width] of [
      ['#000000', unit * 2.5],
      ['#ffffff', unit * 1.2],
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
      ctx.stroke()
    }
    for (const q of p) {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = unit
      ctx.beginPath()
      ctx.arc(q.x, q.y, unit * 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    const at = s.kind === 'angle' ? p[1] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
    const text = shapeLabel(s, w, h)
    ctx.font = `800 ${unit * 7}px system-ui, sans-serif`
    const tw = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(at.x + unit * 4, at.y - unit * 9, tw + unit * 4, unit * 9)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, at.x + unit * 6, at.y - unit * 2)
  }
}

export default function DrawLayer({
  tool,
  shapes,
  onChange,
  aspect,
}: {
  tool: DrawTool | null
  shapes: Shape[]
  onChange: (s: Shape[]) => void
  /** 영상 가로/세로 (각도 계산용) */
  aspect: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [draft, setDraft] = useState<Pt[]>([])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 도구를 바꾸면 그리던 점은 버린다
  useLayoutEffect(() => setDraft([]), [tool])

  const tap = (e: React.PointerEvent) => {
    if (!tool) return
    const r = ref.current!.getBoundingClientRect()
    const pt = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    const next = [...draft, pt]
    if (next.length < NEED[tool]) return setDraft(next)
    setDraft([])
    onChange([...shapes, tool === 'line' ? { kind: 'line', pts: [next[0], next[1]] } : { kind: 'angle', pts: [next[0], next[1], next[2]] }])
  }

  const { w, h } = size
  // 각도는 영상의 실제 비율로 (화면에 늘어나 보여도 각도는 같게)
  const aw = 1000 * aspect
  const ah = 1000
  return (
    <div ref={ref} className={`absolute inset-0 touch-none ${tool ? 'cursor-crosshair' : ''}`} onPointerDown={tap} aria-label={tool ? (tool === 'line' ? '두 점을 눌러 선 긋기' : '세 점을 눌러 각도 재기(가운데가 꼭짓점)') : undefined}>
      <svg width={w} height={h} className="pointer-events-none absolute inset-0">
        {shapes.map((s, i) => {
          const p = s.pts.map((q) => ({ x: q.x * w, y: q.y * h }))
          const d = p.map((q, k) => `${k ? 'L' : 'M'}${q.x},${q.y}`).join(' ')
          const at = s.kind === 'angle' ? p[1] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
          const text = shapeLabel(s, aw, ah)
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#000" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {p.map((q, k) => (
                <circle key={k} cx={q.x} cy={q.y} r={6} fill="#fff" stroke="#000" strokeWidth={2} />
              ))}
              <rect x={at.x + 8} y={at.y - 26} width={text.length * 10 + 14} height={24} rx={6} fill="rgba(0,0,0,0.75)" />
              <text x={at.x + 15} y={at.y - 9} fontSize={16} fontWeight={800} fill="#fff">
                {text}
              </text>
            </g>
          )
        })}
        {draft.map((q, k) => (
          <circle key={k} cx={q.x * w} cy={q.y * h} r={7} fill="#2a78d6" stroke="#fff" strokeWidth={2} />
        ))}
      </svg>
    </div>
  )
}
