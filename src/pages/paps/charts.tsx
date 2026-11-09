/**
 * PAPS 통계 그래프 (B-4). 라이브러리 없이 SVG로 그려서 오프라인에서도 된다.
 *
 * 색 (dataviz 검증기 통과, 흰 바탕):
 * - 등급 1→5 (2026-11-09 교사: "톤앤톤이라 구분이 안 된다"): 파랑 한 색 진하기 → **좋음 파랑 · 3등급 회색 · 나쁨 빨강**
 *   양쪽으로 갈리는 색(diverging). 붙은 두 칸 색각 이상 ΔE 14.9 이상 · 보통 눈 18.3 이상. 칸 안에는 등급 숫자도 같이 적는다.
 * - 남·여 비교: 파랑 #2a78d6 · 주황 #eb6834 (색각 이상 ΔE 24.7)
 * - 회차: 진하기가 아니라 서로 다른 색(파랑 · 주황 · 청록 · 노랑 · 분홍) — 2~3회차 나란히 막대가 한눈에 갈리게
 * 글자는 늘 글자색(ink)이고, 막대·점에만 색을 쓴다. 범례는 2개 이상일 때만.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const GRADE_COLORS = ['#1c5cab', '#6da7ec', '#cfcdc5', '#ec7a6a', '#b8282b'] as const
/** 등급 칸 안 글자: 진한 칸(1·5등급)은 흰 글자, 연한 칸은 진한 글자 */
const GRADE_TEXT = ['#ffffff', '#191f28', '#191f28', '#191f28', '#ffffff']
/** 분포 그림 바탕 띠 (등급 색을 아주 옅게) */
const GRADE_TINT = ['#e3edf9', '#eef5fd', '#f4f3f0', '#fdeeec', '#f8e1e1']
export const GENDER_COLORS = { M: '#2a78d6', F: '#eb6834' } as const
export const SERIES_1 = '#2a78d6'
/** 회차 색: 범주색 순서 그대로 (dataviz 기본 팔레트 1~5번) */
const ROUND_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const TRACK = '#f2f4f6'
const GRID = '#e5e8eb'
const AXIS = '#6b7684'
const INK = '#191f28'
const INK2 = '#4e5968'

/** 그래프 칸의 실제 너비 (글자 크기가 화면 너비 따라 커지지 않게 픽셀로 그린다) */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setW(Math.max(260, el.clientWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

interface Tip {
  x: number
  y: number
  body: ReactNode
}

/** 마우스를 올리거나(PC) 손가락으로 누르면(폰) 뜨는 설명 상자 */
function TipBox({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x, 70), width - 70)
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[0.8rem] leading-snug font-semibold whitespace-nowrap text-white shadow-[var(--shadow-float)]"
      style={{ left, top: tip.y - 8 }}
      role="status"
    >
      {tip.body}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem] font-semibold text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** 종합등급 분포: 회차마다 한 줄, 1~5등급을 100% 누적 막대로 */
export function GradeStack({ rows, labelW = 92, emptyText = '다 측정한 학생이 없어요' }: { rows: { label: string; dist: readonly number[] }[]; labelW?: number; emptyText?: string }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState<Tip | null>(null)
  const barH = 28
  const rowH = 42
  const plotW = width - labelW - 4
  const h = rows.length * rowH + 4
  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="종합등급 분포">
        {rows.map((r, ri) => {
          const total = r.dist.reduce((a, b) => a + b, 0)
          const y = ri * rowH + (rowH - barH) / 2
          let x = labelW
          return (
            <g key={r.label}>
              <text x={0} y={y + barH / 2} dominantBaseline="middle" fontSize={13} fontWeight={700} fill={INK}>
                {r.label}
              </text>
              {total === 0 ? (
                <text x={labelW} y={y + barH / 2} dominantBaseline="middle" fontSize={12} fill={AXIS}>
                  {emptyText}
                </text>
              ) : (
                <>
                  <clipPath id={`gs-${ri}`}>
                    <rect x={labelW} y={y} width={plotW} height={barH} rx={4} />
                  </clipPath>
                  <g clipPath={`url(#gs-${ri})`}>
                    {r.dist.map((n, gi) => {
                      if (n === 0) return null
                      const w = (n / total) * plotW
                      const x0 = x
                      x += w
                      const show = (body: ReactNode) => setTip({ x: x0 + w / 2, y, body })
                      const body = (
                        <>
                          {r.label} · {gi + 1}등급 {n}명 ({Math.round((n / total) * 100)}%)
                        </>
                      )
                      return (
                        <g key={gi} onPointerEnter={() => show(body)} onClick={() => show(body)}>
                          {/* 칸 사이 2px 바탕색 틈 */}
                          <rect x={x0} y={y} width={Math.max(0, w - 2)} height={barH} fill={GRADE_COLORS[gi]} />
                          {w > 22 && (
                            <text x={x0 + (w - 2) / 2} y={y + barH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill={GRADE_TEXT[gi]}>
                              {/* 넓으면 '2등급 5', 좁으면 숫자만 — 색만으로 등급을 알게 하지 않는다 */}
                              {w > 62 ? `${gi + 1}등급 ${n}` : n}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <TipBox tip={tip} width={width} />
    </div>
  )
}

/** 요인별 평균 점수 (0~20): 요인마다 가로 막대 1개(또는 남·여 2개) */
export function FactorBars({ items, max = 20 }: { items: { label: string; values: { key: string; label: string; color: string; value: number | null; n: number }[] }[]; max?: number }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState<Tip | null>(null)
  const labelW = 96
  const per = items[0]?.values.length ?? 1
  const barH = per > 2 ? 14 : per > 1 ? 18 : 24
  const groupH = per * (barH + 4) + 14
  const top = 18
  const plotW = width - labelW - (per > 1 ? 80 : 44)
  const xs = (v: number) => labelW + (v / max) * plotW
  const h = top + items.length * groupH
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max]
  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="체력요인별 평균 점수">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={top - 4} y2={h} stroke={GRID} strokeWidth={1} />
            <text x={xs(t)} y={10} textAnchor="middle" fontSize={11} fill={AXIS}>
              {t}
            </text>
          </g>
        ))}
        {items.map((it, i) => {
          const gy = top + i * groupH + 6
          return (
            <g key={it.label}>
              <text x={0} y={gy + (per * (barH + 4)) / 2 - 2} dominantBaseline="middle" fontSize={13} fontWeight={700} fill={INK}>
                {it.label}
              </text>
              {it.values.map((v, k) => {
                const y = gy + k * (barH + 4)
                const body = (
                  <>
                    {it.label}
                    {per > 1 ? ` · ${v.label}` : ''} · 평균 {v.value ?? '—'}점 ({v.n}명)
                  </>
                )
                const show = () => setTip({ x: v.value === null ? labelW : xs(v.value), y, body })
                return (
                  <g key={v.key} onPointerEnter={show} onClick={show}>
                    <rect x={labelW} y={y - 2} width={plotW} height={barH + 4} fill="transparent" />
                    {/* 만점까지 옅은 바탕 막대 — 얼마나 찼는지 한눈에 */}
                    <rect x={labelW} y={y} width={plotW} height={barH} rx={4} fill={TRACK} />
                    {v.value !== null && v.value > 0 && <rect x={labelW} y={y} width={xs(v.value) - labelW} height={barH} rx={4} fill={v.color} />}
                    <text x={v.value === null ? labelW + 6 : xs(v.value) + 6} y={y + barH / 2} dominantBaseline="middle" fontSize={per > 1 ? 12 : 13} fontWeight={800} fill={v.value === null ? AXIS : INK}>
                      {v.value === null ? '측정 없음' : per > 1 ? `${v.label} ${v.value}` : v.value}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <TipBox tip={tip} width={width} />
    </div>
  )
}

/**
 * 회차별 추이: 꺾은선 한 줄 (회차가 x축). 값이 없는 회차는 건너뛴다.
 * zones를 주면 바탕에 등급 띠(종합점수 80·60·40·20점 경계)를 옅게 깔아 평균이 몇 등급 자리인지 보인다.
 */
export function TrendLine({ points, max, unit, zones }: { points: { label: string; value: number | null; n: number }[]; max: number; unit: string; zones?: { from: number; to: number; grade: number }[] }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState<Tip | null>(null)
  const left = 34
  const right = zones ? 52 : 20
  const top = 22
  const h = 210
  const bottom = 36
  const plotH = h - top - bottom
  const inset = 28 // 첫·끝 점이 축에 붙지 않게
  const step = points.length > 1 ? (width - left - right - inset * 2) / (points.length - 1) : 0
  const xs = (i: number) => (points.length > 1 ? left + inset + i * step : (left + width - right) / 2)
  const ys = (v: number) => top + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  const has = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null)
  const path = has.map((p, k) => `${k ? 'L' : 'M'}${xs(p.i)},${ys(p.value!)}`).join(' ')
  const area = has.length > 1 ? `${path} L${xs(has[has.length - 1].i)},${ys(0)} L${xs(has[0].i)},${ys(0)} Z` : ''
  const labelAll = has.length <= 6
  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="회차별 추이">
        {zones?.map((z) => (
          <g key={z.grade}>
            <rect x={left} y={ys(z.to)} width={width - left - right} height={ys(z.from) - ys(z.to)} fill={GRADE_TINT[z.grade - 1]} />
            <text x={width - right + 6} y={(ys(z.from) + ys(z.to)) / 2} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={INK2}>
              {z.grade}등급
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={width - right} y1={ys(t)} y2={ys(t)} stroke={GRID} strokeWidth={1} />
            <text x={left - 6} y={ys(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS}>
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label} x={xs(i)} y={h - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill={INK2}>
            {p.label}
          </text>
        ))}
        {area && !zones && <path d={area} fill={SERIES_1} opacity={0.1} />}
        {has.length > 1 && <path d={path} fill="none" stroke={SERIES_1} strokeWidth={2.5} strokeLinejoin="round" />}
        {has.map((p) => (
          <circle key={p.i} cx={xs(p.i)} cy={ys(p.value!)} r={6} fill={SERIES_1} stroke="#fff" strokeWidth={2} />
        ))}
        {(labelAll ? has : has.slice(-1)).map((p) => (
          <text key={`v${p.i}`} x={xs(p.i)} y={ys(p.value!) - 13} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} stroke="#fff" strokeWidth={3} paintOrder="stroke">
            {p.value}
            {unit}
          </text>
        ))}
        {/* 회차마다 넓게 누르는 칸 (점보다 크게) */}
        {points.map((p, i) => {
          const body = (
            <>
              {p.label} · {p.value === null ? '자료 없음' : `${p.value}${unit}`} ({p.n}명)
            </>
          )
          const show = () => setTip({ x: xs(i), y: p.value === null ? top + plotH / 2 : ys(p.value), body })
          return (
            <rect
              key={p.label}
              x={xs(i) - Math.max(step, 60) / 2}
              y={top}
              width={Math.max(step, 60)}
              height={plotH}
              fill="transparent"
              onPointerEnter={show}
              onClick={show}
            />
          )
        })}
      </svg>
      <TipBox tip={tip} width={width} />
    </div>
  )
}

export interface StripDot {
  id: string
  name: string
  value: number
  /** 숫자 등급 1~5 (BMI 판정 같은 글자 등급은 null → 회색) */
  grade: number | null
}

/**
 * 종목 기록 분포: 학생 한 명 = 점 하나. 바탕 띠는 공식 기준표의 등급 구역(그 학년·성별) — 띠 위에 'N등급 · M명'.
 * 성별마다 기준이 달라 줄을 나눈다.
 */
export function DotStrip({ rows, unit }: { rows: { label: string; dots: StripDot[]; zones: { min: number | null; grade: number | string }[] }[]; unit: string }) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState<Tip | null>(null)
  const left = 12
  const right = 12
  const rowH = 108
  const all = rows.flatMap((r) => r.dots.map((d) => d.value))
  if (all.length === 0) return <p className="hint">이 요인에 기록이 있는 학생이 없어요.</p>
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.08
  lo -= pad
  hi += pad
  const xs = (v: number) => left + ((v - lo) / (hi - lo)) * (width - left - right)
  const h = rows.length * rowH + 22
  const fmt = (v: number) => String(Math.round(v * 100) / 100)
  return (
    <div ref={ref} className="relative" onPointerLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="기록 분포">
        {rows.map((r, ri) => {
          const y0 = ri * rowH
          const mid = y0 + 66
          // 같은 자리에 겹치는 점은 위아래로 번갈아 비켜 놓는다
          const used = new Map<number, number>()
          // 등급 구역 → 화면 안에 보이는 부분만 [a, b)
          const zs = r.zones
            .map((z, zi) => ({ ...z, a: Math.max(lo, z.min ?? -Infinity), b: Math.min(hi, r.zones[zi + 1]?.min ?? Infinity) }))
            .filter((z) => z.b > z.a)
          return (
            <g key={r.label}>
              <text x={0} y={y0 + 14} fontSize={13} fontWeight={700} fill={INK}>
                {r.label} <tspan fill={AXIS} fontWeight={600}>({r.dots.length}명)</tspan>
              </text>
              {zs.map((z) => {
                const x1 = xs(z.a)
                const zw = xs(z.b) - x1
                const g = typeof z.grade === 'number' ? z.grade : null
                const n = g ? r.dots.filter((d) => d.grade === g).length : 0
                return (
                  <g key={String(z.min)}>
                    <rect x={x1} y={y0 + 22} width={Math.max(0, zw - 1)} height={rowH - 30} fill={g ? GRADE_TINT[g - 1] : TRACK} />
                    {g && <rect x={x1} y={y0 + 22} width={Math.max(0, zw - 1)} height={4} fill={GRADE_COLORS[g - 1]} />}
                    {zw > 34 && (
                      <text x={x1 + zw / 2} y={y0 + 40} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK2}>
                        {g ? (zw > 64 ? `${g}등급 · ${n}명` : `${g}등급`) : String(z.grade)}
                      </text>
                    )}
                  </g>
                )
              })}
              {[...r.dots]
                .sort((a, b) => a.value - b.value)
                .map((d) => {
                  const x = xs(d.value)
                  const bucket = Math.round(x / 9)
                  const k = used.get(bucket) ?? 0
                  used.set(bucket, k + 1)
                  const dy = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 13
                  const y = mid + Math.max(-22, Math.min(30, dy))
                  const body = (
                    <>
                      {d.name} · {fmt(d.value)}
                      {unit}
                      {d.grade ? ` · ${d.grade}등급` : ''}
                    </>
                  )
                  const show = () => setTip({ x, y: y - 6, body })
                  return (
                    <g key={d.id} onPointerEnter={show} onClick={show}>
                      <circle cx={x} cy={y} r={11} fill="transparent" />
                      <circle cx={x} cy={y} r={6.5} fill={d.grade ? GRADE_COLORS[d.grade - 1] : AXIS} stroke="#fff" strokeWidth={1.5} />
                      <circle cx={x} cy={y} r={7.5} fill="none" stroke="rgba(25,31,40,0.35)" strokeWidth={1} />
                    </g>
                  )
                })}
            </g>
          )
        })}
        <text x={left} y={h - 4} fontSize={11} fill={AXIS}>
          {fmt(lo + pad)}
          {unit}
        </text>
        <text x={width - right} y={h - 4} textAnchor="end" fontSize={11} fill={AXIS}>
          {fmt(hi - pad)}
          {unit}
        </text>
      </svg>
      <TipBox tip={tip} width={width} />
    </div>
  )
}

/** 학생 한 명 체력 프로필: 요인마다 회차별 막대 (0~20점). 회차는 늦을수록 진한 파랑 */
export function ProfileBars({ factors, series }: { factors: string[]; series: { label: string; color: string; values: (number | null)[] }[] }) {
  return (
    <FactorBars
      items={factors.map((f, i) => ({
        label: f,
        values: series.map((s) => ({ key: s.label, label: s.label, color: s.color, value: s.values[i], n: 1 })),
      }))}
    />
  )
}

/** 회차 색: 서로 다른 색 (1회차 파랑 · 2회차 주황 · 3회차 청록 …). 8회차가 넘으면 다시 처음 색 */
export function roundColors(n: number): string[] {
  return Array.from({ length: Math.max(1, n) }, (_, i) => ROUND_COLORS[i % ROUND_COLORS.length])
}
