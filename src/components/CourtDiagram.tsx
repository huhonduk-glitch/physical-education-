import type { ReactNode } from 'react'

/**
 * 경기장 그림 (2026-10-27): 공식 규칙서 치수 그대로 미터 단위로 그린다(사진 · 남의 그림을 쓰지 않음 → 저작권 걱정 없음).
 * 숫자 출처는 src/data/sports.ts 각 종목 '경기장' 절의 조항. PPT로 내보낼 때도 이 SVG를 그림으로 바꿔 쓴다.
 */
export type CourtId = 'basketball' | 'football' | 'futsal' | 'netball' | 'tchoukball' | 'ultimate'

const INK = '#1f2937'
const LINE = '#ffffff'

/** 치수 표시: 양쪽 화살표 줄 + 글자 */
function Dim({ x1, y1, x2, y2, label, size, dx = 0, dy = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; size: number; dx?: number; dy?: number }) {
  const mx = (x1 + x2) / 2 + dx
  const my = (y1 + y2) / 2 + dy
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  return (
    <g stroke={INK} fill={INK}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={size * 0.08} markerStart="url(#arr)" markerEnd="url(#arr)" />
      <text x={mx} y={my} fontSize={size} stroke="none" textAnchor="middle" dominantBaseline="middle" transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined} paintOrder="stroke">
        {label}
      </text>
    </g>
  )
}

function Frame({ w, h, m, title, children }: { w: number; h: number; m: number; title: string; children: ReactNode }) {
  const font = Math.max(w, h) / 34
  return (
    <svg viewBox={`${-m} ${-m} ${w + m * 2} ${h + m * 2}`} className="h-auto w-full" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'Pretendard, "Malgun Gothic", sans-serif' }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={INK} />
        </marker>
      </defs>
      <rect x={-m} y={-m} width={w + m * 2} height={h + m * 2} fill="#f6f7f9" />
      <g fontSize={font}>{children}</g>
    </svg>
  )
}

function Basketball() {
  const W = 28
  const H = 15
  const lw = 0.1
  const end = (flip: boolean) => {
    const X = (x: number) => (flip ? W - x : x)
    const s = flip ? -1 : 1
    const b = 1.575 // 바스켓 중심 (2.5.4)
    const yLine = 7.5 - 0.9 // 3점 직선: 사이드라인에서 0.9 m
    const meet = b + Math.sqrt(6.75 ** 2 - yLine ** 2)
    return (
      <g>
        {/* 제한구역 4.9 m × 5.8 m (2.5.3) */}
        <rect x={flip ? W - 5.8 : 0} y={7.5 - 2.45} width={5.8} height={4.9} fill="#b5723a" stroke={LINE} strokeWidth={lw} />
        {/* 자유투 반원 r 1.8 */}
        <circle cx={X(5.8)} cy={7.5} r={1.8} fill="none" stroke={LINE} strokeWidth={lw} />
        {/* 3점 선 */}
        <path d={`M ${X(0)} ${7.5 - yLine} L ${X(meet)} ${7.5 - yLine} A 6.75 6.75 0 0 ${flip ? 0 : 1} ${X(meet)} ${7.5 + yLine} L ${X(0)} ${7.5 + yLine}`} fill="none" stroke={LINE} strokeWidth={lw} />
        {/* 노차지 반원 r 1.25 · 바스켓 */}
        <path d={`M ${X(b)} ${7.5 - 1.25} A 1.25 1.25 0 0 ${flip ? 0 : 1} ${X(b)} ${7.5 + 1.25}`} fill="none" stroke={LINE} strokeWidth={lw * 0.8} />
        <line x1={X(1.2)} y1={7.5 - 0.9} x2={X(1.2)} y2={7.5 + 0.9} stroke={INK} strokeWidth={0.12} />
        <circle cx={X(b)} cy={7.5} r={0.23} fill="none" stroke="#f97316" strokeWidth={0.08} />
        <text x={X(b + 0.6 * s)} y={7.5 - 1.6} fontSize={0.95} fill={LINE} textAnchor="middle">
          링
        </text>
      </g>
    )
  }
  return (
    <Frame w={W} h={H} m={5} title="농구 코트 28 m × 15 m">
      <rect x={0} y={0} width={W} height={H} fill="#d39a5f" stroke={LINE} strokeWidth={lw} />
      <line x1={14} y1={0} x2={14} y2={H} stroke={LINE} strokeWidth={lw} />
      <circle cx={14} cy={7.5} r={1.8} fill="none" stroke={LINE} strokeWidth={lw} />
      {end(false)}
      {end(true)}
      <Dim x1={0} y1={-1.76} x2={W} y2={-1.76} label="28 m" size={1.22} dy={-0.94} />
      <Dim x1={-1.76} y1={0} x2={-1.76} y2={H} label="15 m" size={1.22} dx={-0.94} />
      <Dim x1={0} y1={H + 1.76} x2={5.8} y2={H + 1.76} label="자유투 선 5.8 m" size={1.01} dy={1.01} />
      <Dim x1={1.575} y1={7.5} x2={1.575 + 6.75} y2={7.5} label="3점 6.75 m" size={0.81} dy={-0.74} />
      <text x={W - 7} y={H + 2.84} fontSize={1.01} fill={INK} textAnchor="middle">
        링 높이 3.05 m · 중앙 원 반지름 1.8 m
      </text>
    </Frame>
  )
}

function Football() {
  // 길이 90~120 m · 너비 45~90 m 중 예시 105 × 68 (Law 1). 나머지는 규칙서 고정 치수
  const W = 105
  const H = 68
  const lw = 0.35
  const end = (flip: boolean) => {
    const X = (x: number) => (flip ? W - x : x)
    const pa = 40.32
    const ga = 18.32
    return (
      <g fill="none" stroke={LINE} strokeWidth={lw}>
        <rect x={flip ? W - 16.5 : 0} y={(H - pa) / 2} width={16.5} height={pa} />
        <rect x={flip ? W - 5.5 : 0} y={(H - ga) / 2} width={5.5} height={ga} />
        <circle cx={X(11)} cy={H / 2} r={0.35} fill={LINE} />
        {/* 페널티 아크: 페널티 마크에서 9.15 m, 페널티 에어리어 밖만 */}
        <path d={`M ${X(16.5)} ${H / 2 - Math.sqrt(9.15 ** 2 - 5.5 ** 2)} A 9.15 9.15 0 0 ${flip ? 0 : 1} ${X(16.5)} ${H / 2 + Math.sqrt(9.15 ** 2 - 5.5 ** 2)}`} />
        <rect x={flip ? W : -2} y={H / 2 - 3.66} width={2} height={7.32} fill="#e5e7eb" stroke={INK} strokeWidth={0.25} />
      </g>
    )
  }
  return (
    <Frame w={W} h={H} m={19} title="축구 경기장">
      <rect x={0} y={0} width={W} height={H} fill="#3e8e4f" stroke={LINE} strokeWidth={lw} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={LINE} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r={9.15} fill="none" stroke={LINE} strokeWidth={lw} />
      {[
        [0, 0, 0, 1],
        [W, 0, 1, 1],
        [0, H, 0, 0],
        [W, H, 1, 0],
      ].map(([x, y, fx, fy]) => (
        <path key={`${x}${y}`} d={`M ${x + (fx ? -1 : 1)} ${y} A 1 1 0 0 ${fx !== fy ? 1 : 0} ${x} ${y + (fy ? 1 : -1)}`} fill="none" stroke={LINE} strokeWidth={lw} />
      ))}
      {end(false)}
      {end(true)}
      <Dim x1={0} y1={-6.75} x2={W} y2={-6.75} label="길이 90~120 m (그림은 105 m)" size={4.05} dy={-3.51} />
      <Dim x1={-8.1} y1={0} x2={-8.1} y2={H} label="너비 45~90 m (68 m)" size={4.05} dx={-3.51} />
      <Dim x1={0} y1={H + 5.4} x2={16.5} y2={H + 5.4} label="16.5 m" size={3.51} dy={3.24} />
      <Dim x1={W - 11} y1={H + 5.4} x2={W} y2={H + 5.4} label="페널티 마크 11 m" size={3.51} dy={3.24} />
      <Dim x1={W / 2} y1={H / 2} x2={W / 2 + 9.15} y2={H / 2} label="9.15 m" size={3.24} dy={-2.43} />
      <text x={W / 2} y={H + 15.53} fontSize={3.78} fill={INK} textAnchor="middle">
        골대 7.32 m × 2.44 m · 골 에어리어 5.5 m · 코너 아크 1 m
      </text>
    </Frame>
  )
}

function Futsal() {
  // 길이 25~42 m · 너비 16~25 m 중 예시 40 × 20 (Law 1)
  const W = 40
  const H = 20
  const lw = 0.12
  const end = (flip: boolean) => {
    const X = (x: number) => (flip ? W - x : x)
    const p = 1.58 // 골대 바깥(3 m + 8 cm 기둥 둘)의 반
    const c = H / 2
    const sweep = flip ? 0 : 1
    return (
      <g fill="none" stroke={LINE} strokeWidth={lw}>
        {/* 페널티 에어리어: 골대 바깥에서 반지름 6 m 사분원 + 3.16 m 직선 */}
        <path d={`M ${X(0)} ${c - p - 6} A 6 6 0 0 ${sweep} ${X(6)} ${c - p} L ${X(6)} ${c + p} A 6 6 0 0 ${sweep} ${X(0)} ${c + p + 6}`} />
        <circle cx={X(6)} cy={c} r={0.15} fill={LINE} />
        <circle cx={X(10)} cy={c} r={0.15} fill={LINE} />
        <rect x={flip ? W : -1} y={c - 1.5} width={1} height={3} fill="#e5e7eb" stroke={INK} strokeWidth={0.08} />
      </g>
    )
  }
  return (
    <Frame w={W} h={H} m={8} title="풋살 경기장">
      <rect x={0} y={0} width={W} height={H} fill="#2f6fb0" stroke={LINE} strokeWidth={lw} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={LINE} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r={3} fill="none" stroke={LINE} strokeWidth={lw} />
      {end(false)}
      {end(true)}
      {/* 교체 지역: 하프라인에서 5 m 떨어진 곳부터 5 m */}
      {[W / 2 - 10, W / 2 - 5, W / 2 + 5, W / 2 + 10].map((x) => (
        <line key={x} x1={x} y1={H - 0.4} x2={x} y2={H + 0.54} stroke={INK} strokeWidth={0.1} />
      ))}
      <Dim x1={0} y1={-2.43} x2={W} y2={-2.43} label="길이 25~42 m (그림은 40 m)" size={1.62} dy={-1.35} />
      <Dim x1={-2.7} y1={0} x2={-2.7} y2={H} label="너비 16~25 m (20 m)" size={1.49} dx={-1.35} />
      <Dim x1={0} y1={H + 2.16} x2={6} y2={H + 2.16} label="6 m" size={1.35} dy={1.22} />
      <Dim x1={0} y1={H + 4.59} x2={10} y2={H + 4.59} label="10 m 마크" size={1.35} dy={1.22} />
      <text x={W / 2} y={H + 2.03} fontSize={1.22} fill={INK} textAnchor="middle">
        ↑ 교체 지역 5 m
      </text>
      <text x={W - 9} y={H + 5.4} fontSize={1.35} fill={INK} textAnchor="middle">
        골대 3 m × 2 m · 중앙 원 반지름 3 m
      </text>
    </Frame>
  )
}

function Netball() {
  const W = 30.5
  const H = 15.25
  const lw = 0.1
  return (
    <Frame w={W} h={H} m={5} title="넷볼 코트 30.5 m × 15.25 m">
      <rect x={0} y={0} width={W} height={H} fill="#3b82c4" stroke={LINE} strokeWidth={lw} />
      <line x1={W / 3} y1={0} x2={W / 3} y2={H} stroke={LINE} strokeWidth={lw} />
      <line x1={(W * 2) / 3} y1={0} x2={(W * 2) / 3} y2={H} stroke={LINE} strokeWidth={lw} />
      <circle cx={W / 2} cy={H / 2} r={0.45} fill="none" stroke={LINE} strokeWidth={lw} />
      <path d={`M 0 ${H / 2 - 4.9} A 4.9 4.9 0 0 1 0 ${H / 2 + 4.9}`} fill="#2f6ea8" stroke={LINE} strokeWidth={lw} />
      <path d={`M ${W} ${H / 2 - 4.9} A 4.9 4.9 0 0 0 ${W} ${H / 2 + 4.9}`} fill="#2f6ea8" stroke={LINE} strokeWidth={lw} />
      <circle cx={0} cy={H / 2} r={0.25} fill="#f97316" />
      <circle cx={W} cy={H / 2} r={0.25} fill="#f97316" />
      {['골 서드', '센터 서드', '골 서드'].map((t, i) => (
        <text key={i} x={(W / 6) * (i * 2 + 1)} y={1.4} fontSize={1.15} fill={LINE} textAnchor="middle">
          {t}
        </text>
      ))}
      <text x={2.6} y={H / 2 + 0.3} fontSize={0.95} fill={LINE} textAnchor="middle">
        골 서클
      </text>
      <Dim x1={0} y1={-1.76} x2={W} y2={-1.76} label="30.5 m" size={1.22} dy={-0.94} />
      <Dim x1={-1.76} y1={0} x2={-1.76} y2={H} label="15.25 m" size={1.22} dx={-0.94} />
      <Dim x1={0} y1={H + 1.76} x2={4.9} y2={H + 1.76} label="반지름 4.9 m" size={1.01} dy={1.01} />
      <text x={W - 8} y={H + 2.84} fontSize={1.01} fill={INK} textAnchor="middle">
        골대 높이 3.05 m · 중앙 원 지름 0.9 m
      </text>
    </Frame>
  )
}

function Tchoukball() {
  // 길이 26~29 m · 너비 15~17 m 중 예시 28 × 16 (규칙 1.1)
  const W = 28
  const H = 16
  const lw = 0.1
  return (
    <Frame w={W} h={H} m={5} title="츄크볼 경기장">
      <rect x={0} y={0} width={W} height={H} fill="#4f7fbf" stroke={LINE} strokeWidth={lw} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={LINE} strokeWidth={lw} />
      <path d={`M 0 ${H / 2 - 3} A 3 3 0 0 1 0 ${H / 2 + 3}`} fill="#c2410c" stroke={LINE} strokeWidth={lw} />
      <path d={`M ${W} ${H / 2 - 3} A 3 3 0 0 0 ${W} ${H / 2 + 3}`} fill="#c2410c" stroke={LINE} strokeWidth={lw} />
      <rect x={0.2} y={H / 2 - 0.5} width={0.5} height={1} fill="#111827" />
      <rect x={W - 0.7} y={H / 2 - 0.5} width={0.5} height={1} fill="#111827" />
      <text x={0.4} y={H / 2 - 3.5} fontSize={0.95} fill={LINE} textAnchor="start">
        금지 구역
      </text>
      <text x={2.4} y={H / 2 + 0.25} fontSize={0.81} fill={LINE} textAnchor="start">
        ← 프레임
      </text>
      <Dim x1={0} y1={-1.76} x2={W} y2={-1.76} label="길이 26~29 m (그림은 28 m)" size={1.15} dy={-0.94} />
      <Dim x1={-1.76} y1={0} x2={-1.76} y2={H} label="너비 15~17 m" size={1.15} dx={-0.94} />
      <Dim x1={W - 3} y1={H + 1.62} x2={W} y2={H + 1.62} label="반지름 3 m" size={1.01} dy={1.01} />
    </Frame>
  )
}

function Ultimate() {
  const W = 100
  const H = 37
  const lw = 0.3
  return (
    <Frame w={W} h={H} m={12} title="얼티미트 경기장 100 m × 37 m">
      <rect x={0} y={0} width={W} height={H} fill="#3e8e4f" stroke={LINE} strokeWidth={lw} />
      <rect x={0} y={0} width={18} height={H} fill="#2f7a40" stroke={LINE} strokeWidth={lw} />
      <rect x={W - 18} y={0} width={18} height={H} fill="#2f7a40" stroke={LINE} strokeWidth={lw} />
      {[36, W - 36].map((x) => (
        <g key={x} stroke={LINE} strokeWidth={lw * 1.4}>
          <line x1={x - 1} y1={H / 2 - 1} x2={x + 1} y2={H / 2 + 1} />
          <line x1={x - 1} y1={H / 2 + 1} x2={x + 1} y2={H / 2 - 1} />
        </g>
      ))}
      <text x={9} y={H / 2} fontSize={3.51} fill={LINE} textAnchor="middle">
        엔드존
      </text>
      <text x={W - 9} y={H / 2} fontSize={3.51} fill={LINE} textAnchor="middle">
        엔드존
      </text>
      <text x={W / 2} y={H / 2} fontSize={3.78} fill={LINE} textAnchor="middle">
        센트럴 존
      </text>
      <text x={36} y={H / 2 + 4} fontSize={2.7} fill={LINE} textAnchor="middle">
        브릭 마크
      </text>
      <Dim x1={0} y1={-4.05} x2={W} y2={-4.05} label="100 m" size={3.51} dy={-2.7} />
      <Dim x1={-4.05} y1={0} x2={-4.05} y2={H} label="37 m" size={3.51} dx={-2.7} />
      <Dim x1={0} y1={H + 4.05} x2={18} y2={H + 4.05} label="18 m" size={3.24} dy={2.7} />
      <Dim x1={18} y1={H + 4.05} x2={W - 18} y2={H + 4.05} label="64 m" size={3.24} dy={2.7} />
    </Frame>
  )
}

export default function CourtDiagram({ court }: { court: CourtId }) {
  switch (court) {
    case 'basketball':
      return <Basketball />
    case 'football':
      return <Football />
    case 'futsal':
      return <Futsal />
    case 'netball':
      return <Netball />
    case 'tchoukball':
      return <Tchoukball />
    case 'ultimate':
      return <Ultimate />
  }
}
