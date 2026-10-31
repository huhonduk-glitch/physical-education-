import type { ReactNode } from 'react'

/**
 * 종목 핵심 규칙 그림 (2026-10-30, 교사 요청 '시각자료 살리고 종목 특성이 드러나게').
 * 사진 · 남의 그림을 쓰지 않고 규칙 내용을 PE LOG가 직접 그린 SVG. 검은 슬라이드에서도 · 흰 화면에서도 보이게 색을 쓴다.
 * PPT로 받을 때도 이 SVG를 그림으로 바꿔 넣는다(sportPptx.ts).
 */
export type Visual =
  | { kind: 'timer'; n: number; unit: string; label?: string }
  | { kind: 'zones'; pos?: NetballPos | null }
  | { kind: 'distance'; label: string; note?: string }
  | { kind: 'noContact' }
  | { kind: 'noDribble' }
  | { kind: 'travel' }
  | { kind: 'points'; items: { n: string; label: string }[] }
  | { kind: 'fouls'; n: number; label: string }
  | { kind: 'offside' }
  | { kind: 'noOffside' }
  | { kind: 'handsGK' }
  | { kind: 'cards' }
  | { kind: 'kickIn' }
  | { kind: 'rebound' }
  | { kind: 'pivot' }
  | { kind: 'spirit' }
  | { kind: 'turnover' }
  | { kind: 'touches'; n: number }
  | { kind: 'noDouble' }
  | { kind: 'rotation' }
  | { kind: 'serveHeight' }
  | { kind: 'serveSide' }
  | { kind: 'kitchen' }
  | { kind: 'twoBounce' }
  | { kind: 'underhand' }
  | { kind: 'toss' }
  | { kind: 'kinCall' }
  | { kind: 'allTouch' }
  | { kind: 'threeTeams' }
  | { kind: 'highStick' }

export const C = { ink: '#f5f5f7', mute: '#a1a1a6', line: '#3a3a3c', blue: '#2997ff', red: '#ff453a', green: '#30d158', orange: '#ff9f0a', yellow: '#ffd60a', court: '#1c3a2e', wood: '#3b2a1a', floor: '#1d1d1f' }

/** 넷볼 포지션과 들어갈 수 있는 구역 (World Netball Rules 2024, 규칙 3 그림: 1 공격 골 서클 · 2 공격 서드 · 3 센터 서드 · 4 수비 서드 · 5 수비 골 서클) */
export type NetballPos = 'GS' | 'GA' | 'WA' | 'C' | 'WD' | 'GD' | 'GK'
export const NETBALL_AREAS: Record<NetballPos, { name: string; areas: number[] }> = {
  GS: { name: '골 슈터', areas: [1, 2] },
  GA: { name: '골 어택', areas: [1, 2, 3] },
  WA: { name: '윙 어택', areas: [2, 3] },
  C: { name: '센터', areas: [2, 3, 4] },
  WD: { name: '윙 디펜스', areas: [3, 4] },
  GD: { name: '골 디펜스', areas: [3, 4, 5] },
  GK: { name: '골 키퍼', areas: [4, 5] },
}
export const NETBALL_ORDER: NetballPos[] = ['GS', 'GA', 'WA', 'C', 'WD', 'GD', 'GK']

function Svg({ label, children, vb = '0 0 400 260' }: { label: string; children: ReactNode; vb?: string }) {
  return (
    <svg viewBox={vb} className="h-auto w-full" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: 'Pretendard, "Malgun Gothic", sans-serif' }}>
      <defs>
        <marker id="rv-arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={C.ink} />
        </marker>
        <marker id="rv-arr-b" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={C.blue} />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill={C.floor} rx="14" />
      {children}
    </svg>
  )
}

/** 위에서 본 사람: 머리 + 어깨 */
function Person({ x, y, color = C.blue, label, r = 15 }: { x: number; y: number; color?: string; label?: string; r?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 1.5} ry={r * 0.75} fill={color} opacity={0.35} />
      <circle cx={x} cy={y} r={r * 0.75} fill={color} />
      {label && (
        <text x={x} y={y + 1} fontSize={r * 0.75} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </g>
  )
}
const Ball = ({ x, y, r = 9, color = C.orange }: { x: number; y: number; r?: number; color?: string }) => <circle cx={x} cy={y} r={r} fill={color} stroke="#000" strokeOpacity={0.3} />
const Cross = ({ x, y, s = 22 }: { x: number; y: number; s?: number }) => (
  <g stroke={C.red} strokeWidth={s / 4} strokeLinecap="round">
    <line x1={x - s / 2} y1={y - s / 2} x2={x + s / 2} y2={y + s / 2} />
    <line x1={x + s / 2} y1={y - s / 2} x2={x - s / 2} y2={y + s / 2} />
  </g>
)
const Check = ({ x, y, s = 22 }: { x: number; y: number; s?: number }) => <path d={`M ${x - s / 2} ${y} L ${x - s / 8} ${y + s / 2.5} L ${x + s / 2} ${y - s / 2.5}`} stroke={C.green} strokeWidth={s / 4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
const Txt = ({ x, y, children, size = 16, color = C.ink, w = 700, anchor = 'middle' }: { x: number; y: number; children: ReactNode; size?: number; color?: string; w?: number; anchor?: 'middle' | 'start' | 'end' }) => (
  <text x={x} y={y} fontSize={size} fontWeight={w} fill={color} textAnchor={anchor} dominantBaseline="middle">
    {children}
  </text>
)

function Timer({ n, unit, label }: { n: number; unit: string; label?: string }) {
  const ticks = Math.min(Math.max(n, 3), 30)
  return (
    <Svg label={`${n}${unit}`}>
      <circle cx={200} cy={122} r={92} fill="none" stroke={C.line} strokeWidth={14} />
      <circle cx={200} cy={122} r={92} fill="none" stroke={C.blue} strokeWidth={14} strokeDasharray={`${2 * Math.PI * 92 * 0.78} ${2 * Math.PI * 92}`} transform="rotate(-90 200 122)" strokeLinecap="round" />
      {Array.from({ length: ticks }, (_, i) => {
        const a = (i / ticks) * Math.PI * 2 - Math.PI / 2
        return <line key={i} x1={200 + Math.cos(a) * 72} y1={122 + Math.sin(a) * 72} x2={200 + Math.cos(a) * 78} y2={122 + Math.sin(a) * 78} stroke={C.mute} strokeWidth={2} />
      })}
      <Txt x={200} y={112} size={78} w={900}>
        {n}
      </Txt>
      <Txt x={200} y={166} size={22} color={C.mute}>
        {unit}
      </Txt>
      {label && (
        <Txt x={200} y={243} size={17} color={C.mute} w={600}>
          {label}
        </Txt>
      )}
    </Svg>
  )
}

/** 넷볼 코트 구역: 1~5 구역, 포지션을 고르면 들어갈 수 있는 구역만 밝게 */
function Zones({ pos }: { pos?: NetballPos | null }) {
  // 코트 30.5 × 15.25 m를 360 × 180으로
  const s = 360 / 30.5
  const x0 = 20
  const y0 = 30
  const W = 30.5 * s
  const H = 15.25 * s
  const third = W / 3
  const r = 4.9 * s
  const on = pos ? new Set(NETBALL_AREAS[pos].areas) : null
  const fill = (a: number, base: string) => (on ? (on.has(a) ? C.blue : '#2c2c2e') : base)
  const op = (a: number) => (on ? (on.has(a) ? 0.85 : 0.6) : 0.55)
  return (
    <Svg label={pos ? `${pos} 들어갈 수 있는 구역` : '넷볼 코트 구역'}>
      {/* 2 공격 서드 · 3 센터 · 4 수비 서드 */}
      <rect x={x0} y={y0} width={third} height={H} fill={fill(2, '#2f5d8a')} opacity={op(2)} />
      <rect x={x0 + third} y={y0} width={third} height={H} fill={fill(3, '#3d6b4f')} opacity={op(3)} />
      <rect x={x0 + third * 2} y={y0} width={third} height={H} fill={fill(4, '#7a4b2c')} opacity={op(4)} />
      {/* 1 · 5 골 서클 (반지름 4.9 m 반원) */}
      <path d={`M ${x0} ${y0 + H / 2 - r} A ${r} ${r} 0 0 1 ${x0} ${y0 + H / 2 + r} Z`} fill={fill(1, '#1f4e7a')} opacity={on ? (on.has(1) ? 1 : 0.6) : 0.9} stroke={C.ink} strokeWidth={1.5} />
      <path d={`M ${x0 + W} ${y0 + H / 2 - r} A ${r} ${r} 0 0 0 ${x0 + W} ${y0 + H / 2 + r} Z`} fill={fill(5, '#6b3a1f')} opacity={on ? (on.has(5) ? 1 : 0.6) : 0.9} stroke={C.ink} strokeWidth={1.5} />
      <rect x={x0} y={y0} width={W} height={H} fill="none" stroke={C.ink} strokeWidth={2} />
      <line x1={x0 + third} y1={y0} x2={x0 + third} y2={y0 + H} stroke={C.ink} strokeWidth={1.5} />
      <line x1={x0 + third * 2} y1={y0} x2={x0 + third * 2} y2={y0 + H} stroke={C.ink} strokeWidth={1.5} />
      <circle cx={x0 + W / 2} cy={y0 + H / 2} r={0.45 * s} fill="none" stroke={C.ink} strokeWidth={1.5} />
      {[
        [1, x0 + r * 0.45],
        [2, x0 + third * 0.62],
        [3, x0 + third * 1.5],
        [4, x0 + third * 2.38],
        [5, x0 + W - r * 0.45],
      ].map(([a, x]) => (
        <Txt key={a} x={x} y={y0 + H / 2 + (a === 3 ? -32 : 0)} size={20} w={900} color={on && !on.has(a) ? C.mute : C.ink}>
          {a}
        </Txt>
      ))}
      <Txt x={x0} y={y0 + H + 18} size={13} color={C.mute} anchor="start">
        ← 공격 골 (우리가 넣는 쪽)
      </Txt>
      <Txt x={x0 + W} y={y0 + H + 18} size={13} color={C.mute} anchor="end">
        우리 골 →
      </Txt>
      <Txt x={200} y={16} size={15} color={pos ? C.blue : C.mute}>
        {pos ? `${pos} ${NETBALL_AREAS[pos].name}: ${NETBALL_AREAS[pos].areas.join(' · ')} 구역` : '1 · 5 골 서클   2 · 4 골 서드   3 센터 서드'}
      </Txt>
    </Svg>
  )
}

function Distance({ label, note }: { label: string; note?: string }) {
  return (
    <Svg label={`${label} 거리`}>
      <circle cx={130} cy={130} r={92} fill={C.blue} opacity={0.12} stroke={C.blue} strokeDasharray="6 6" strokeWidth={2} />
      <Person x={130} y={130} color={C.orange} label="공" />
      <Ball x={152} y={112} r={8} />
      <Person x={300} y={130} color={C.blue} label="수비" />
      <line x1={148} y1={180} x2={282} y2={180} stroke={C.ink} strokeWidth={2} markerStart="url(#rv-arr)" markerEnd="url(#rv-arr)" />
      <Txt x={215} y={202} size={26} w={900}>
        {label}
      </Txt>
      <Txt x={200} y={30} size={16} color={C.mute}>
        {note ?? '공 가진 선수의 발에서 재요'}
      </Txt>
    </Svg>
  )
}

function NoContact() {
  return (
    <Svg label="몸싸움 금지">
      <Person x={150} y={125} color={C.orange} label="공" r={22} />
      <Person x={250} y={125} color={C.blue} r={22} />
      <path d="M 196 95 L 204 125 L 196 155" stroke={C.yellow} strokeWidth={4} fill="none" />
      <Cross x={200} y={60} s={40} />
      <Txt x={200} y={205} size={18}>
        밀기 · 잡기 · 기대기 · 공 쳐 내기
      </Txt>
      <Txt x={200} y={232} size={15} color={C.mute} w={600}>
        닿아서 상대 플레이를 방해하면 반칙
      </Txt>
    </Svg>
  )
}

function NoDribble() {
  return (
    <Svg label="드리블 없음">
      <Person x={70} y={150} color={C.orange} />
      <path d="M 90 130 Q 110 200 130 130 Q 150 200 170 130" stroke={C.mute} strokeWidth={3} fill="none" strokeDasharray="5 6" />
      <Ball x={130} y={190} />
      <Cross x={128} y={95} s={34} />
      <Txt x={125} y={232} size={15} color={C.red}>
        혼자 튕기며 가기
      </Txt>
      <Person x={250} y={150} color={C.orange} />
      <Person x={350} y={90} color={C.orange} />
      <line x1={268} y1={140} x2={330} y2={100} stroke={C.blue} strokeWidth={4} markerEnd="url(#rv-arr-b)" />
      <Ball x={300} y={118} r={8} />
      <Check x={300} y={60} s={34} />
      <Txt x={300} y={232} size={15} color={C.green}>
        패스로만 옮기기
      </Txt>
    </Svg>
  )
}

function Travel() {
  return (
    <Svg label="드리블과 트래블링">
      <Person x={80} y={120} color={C.orange} />
      <path d="M 80 140 Q 95 200 110 140 Q 125 200 140 140 Q 155 200 170 140" stroke={C.green} strokeWidth={3} fill="none" />
      <Check x={125} y={70} s={32} />
      <Txt x={125} y={232} size={15} color={C.green}>
        튀기며 가기(드리블)
      </Txt>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={250 + i * 38} cy={i % 2 ? 165 : 140} rx={9} ry={15} fill={C.mute} transform={`rotate(-10 ${250 + i * 38} ${i % 2 ? 165 : 140})`} />
      ))}
      <Ball x={250} y={105} />
      <Cross x={290} y={70} s={32} />
      <Txt x={290} y={232} size={15} color={C.red}>
        들고 걷기(트래블링)
      </Txt>
    </Svg>
  )
}

function Points({ items }: { items: { n: string; label: string }[] }) {
  const w = 360 / items.length
  return (
    <Svg label={items.map((i) => `${i.n} ${i.label}`).join(', ')}>
      {items.map((it, i) => (
        <g key={it.n + it.label}>
          <rect x={20 + i * w + 6} y={40} width={w - 12} height={170} rx={16} fill={[C.blue, C.green, C.orange, C.red][i % 4]} opacity={0.18} stroke={[C.blue, C.green, C.orange, C.red][i % 4]} strokeWidth={2} />
          <Txt x={20 + i * w + w / 2} y={115} size={items.length > 3 ? 46 : 64} w={900} color={[C.blue, C.green, C.orange, C.red][i % 4]}>
            {it.n}
          </Txt>
          <Txt x={20 + i * w + w / 2} y={180} size={15} w={700}>
            {it.label}
          </Txt>
        </g>
      ))}
    </Svg>
  )
}

function Fouls({ n, label }: { n: number; label: string }) {
  const gap = 340 / n
  return (
    <Svg label={`${n}번째 ${label}`}>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle cx={30 + gap / 2 + i * gap} cy={110} r={Math.min(26, gap / 2.6)} fill={i === n - 1 ? C.red : C.line} />
          <Txt x={30 + gap / 2 + i * gap} y={111} size={20} w={900}>
            {i + 1}
          </Txt>
        </g>
      ))}
      <Txt x={200} y={185} size={22} w={900} color={C.red}>
        {label}
      </Txt>
    </Svg>
  )
}

function Offside({ cross }: { cross?: boolean }) {
  return (
    <Svg label={cross ? '오프사이드 없음' : '오프사이드'}>
      <rect x={20} y={20} width={360} height={200} fill={C.court} rx={6} />
      <line x1={360} y1={20} x2={360} y2={220} stroke={C.ink} strokeWidth={3} />
      <Txt x={372} y={120} size={12} color={C.mute}>
        골
      </Txt>
      <line x1={270} y1={20} x2={270} y2={220} stroke={C.yellow} strokeWidth={2} strokeDasharray="7 6" />
      <Person x={340} y={80} color="#8e8e93" label="GK" r={14} />
      <Person x={270} y={150} color="#8e8e93" r={14} />
      <Person x={130} y={130} color={C.blue} r={14} />
      <Ball x={150} y={150} r={7} />
      <Person x={310} y={110} color={cross ? C.blue : C.red} r={14} />
      <line x1={150} y1={130} x2={292} y2={112} stroke={C.ink} strokeWidth={2.5} strokeDasharray="4 5" markerEnd="url(#rv-arr)" />
      <Txt x={270} y={236} size={13} color={C.yellow}>
        뒤에서 두 번째 수비수
      </Txt>
      {cross ? <Check x={312} y={158} s={30} /> : <Cross x={312} y={158} s={30} />}
      <Txt x={110} y={42} size={15} color={cross ? C.green : C.red} anchor="start">
        {cross ? '앞에 있어도 괜찮아요' : '수비수보다 앞에서 받으면 반칙'}
      </Txt>
    </Svg>
  )
}

function HandsGK() {
  return (
    <Svg label="손은 골키퍼만">
      <rect x={20} y={20} width={360} height={200} fill={C.court} rx={6} />
      <rect x={260} y={55} width={120} height={130} fill={C.blue} opacity={0.25} stroke={C.ink} strokeWidth={2} />
      <Txt x={320} y={200} size={13} color={C.blue}>
        페널티 에어리어
      </Txt>
      <Person x={330} y={120} color={C.yellow} label="GK" />
      <Check x={330} y={80} s={26} />
      <Person x={120} y={120} color={C.blue} />
      <Ball x={140} y={100} />
      <Cross x={120} y={70} s={30} />
      <Txt x={120} y={175} size={15} color={C.red}>
        손 · 팔 쓰기
      </Txt>
    </Svg>
  )
}

function Cards() {
  return (
    <Svg label="경고와 퇴장">
      <rect x={95} y={45} width={80} height={115} rx={8} fill={C.yellow} transform="rotate(-8 135 102)" />
      <rect x={225} y={45} width={80} height={115} rx={8} fill={C.red} transform="rotate(8 265 102)" />
      <Txt x={135} y={195} size={18}>
        무모함 → 경고
      </Txt>
      <Txt x={265} y={195} size={18}>
        지나친 힘 → 퇴장
      </Txt>
      <Txt x={200} y={232} size={14} color={C.mute} w={600}>
        그냥 부주의하면 카드 없이 프리킥
      </Txt>
    </Svg>
  )
}

function KickIn() {
  return (
    <Svg label="킥인">
      <rect x={20} y={70} width={360} height={170} fill={C.court} rx={6} />
      <line x1={20} y1={70} x2={380} y2={70} stroke={C.ink} strokeWidth={3} />
      <Txt x={340} y={56} size={13} color={C.mute}>
        터치라인
      </Txt>
      <Ball x={170} y={70} />
      <Person x={150} y={40} color={C.blue} />
      <line x1={178} y1={80} x2={250} y2={170} stroke={C.ink} strokeWidth={3} markerEnd="url(#rv-arr)" />
      <Check x={300} y={140} s={30} />
      <Txt x={200} y={215} size={17}>
        던지지 않고 줄 위에서 발로 차요
      </Txt>
    </Svg>
  )
}

function Rebound() {
  return (
    <Svg label="프레임에 튕기기">
      <rect x={20} y={20} width={360} height={220} fill={C.wood} opacity={0.5} rx={6} />
      <path d={`M 340 130 m -60 0 a 60 60 0 0 1 120 0`} fill="none" stroke={C.mute} strokeDasharray="5 5" />
      <rect x={348} y={95} width={14} height={70} rx={3} fill={C.ink} transform="rotate(-25 355 130)" />
      <Person x={90} y={170} color={C.orange} label="공격" />
      <path d="M 110 160 Q 230 70 345 125" stroke={C.orange} strokeWidth={3} fill="none" markerEnd="url(#rv-arr)" />
      <path d="M 345 130 Q 260 160 190 210" stroke={C.blue} strokeWidth={3} fill="none" strokeDasharray="7 6" markerEnd="url(#rv-arr-b)" />
      <Person x={200} y={80} color={C.blue} label="수비" />
      <Txt x={175} y={226} size={14} color={C.green} anchor="start">
        바닥에 떨어지면 1점
      </Txt>
      <Txt x={120} y={44} size={14} color={C.blue}>
        수비는 튕겨 나온 공을 받아야
      </Txt>
    </Svg>
  )
}

function Pivot() {
  return (
    <Svg label="축발로 돌기">
      <circle cx={200} cy={120} r={70} fill="none" stroke={C.blue} strokeWidth={3} strokeDasharray="8 7" />
      <ellipse cx={200} cy={120} rx={14} ry={24} fill={C.ink} />
      <Txt x={200} y={120} size={11} color="#000">
        축
      </Txt>
      <ellipse cx={258} cy={95} rx={11} ry={19} fill={C.mute} transform="rotate(30 258 95)" />
      <path d="M 268 150 A 70 70 0 0 1 150 168" stroke={C.green} strokeWidth={4} fill="none" markerEnd="url(#rv-arr)" />
      <Check x={300} y={50} s={30} />
      <Txt x={200} y={225} size={16}>
        한 발은 붙이고, 다른 발로만 돌아요
      </Txt>
    </Svg>
  )
}

function Spirit() {
  return (
    <Svg label="스피릿 오브 더 게임">
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return <Person key={i} x={200 + Math.cos(a) * 75} y={120 + Math.sin(a) * 65} color={i % 2 ? C.blue : C.orange} r={14} />
      })}
      <Txt x={200} y={112} size={22} w={900}>
        심판 없음
      </Txt>
      <Txt x={200} y={138} size={14} color={C.mute}>
        스스로 부르고 풀어요
      </Txt>
      <Txt x={200} y={232} size={16} color={C.green}>
        정직 · 존중 · 공정
      </Txt>
    </Svg>
  )
}

function Turnover() {
  return (
    <Svg label="턴오버">
      <Person x={80} y={110} color={C.orange} />
      <path d="M 100 100 Q 190 30 260 180" stroke={C.mute} strokeWidth={3} fill="none" strokeDasharray="6 6" />
      <ellipse cx={262} cy={190} rx={22} ry={7} fill={C.ink} />
      <Cross x={262} y={150} s={26} />
      <path d="M 300 190 Q 340 120 300 70" stroke={C.blue} strokeWidth={4} fill="none" markerEnd="url(#rv-arr-b)" />
      <Txt x={330} y={60} size={15} color={C.blue}>
        상대 공격
      </Txt>
      <Txt x={170} y={232} size={15}>
        떨어짐 · 가로채기 · 밖 → 공격권이 넘어가요
      </Txt>
    </Svg>
  )
}

function Touches({ n }: { n: number }) {
  return (
    <Svg label={`${n}번 안에 넘기기`}>
      <line x1={330} y1={70} x2={330} y2={235} stroke={C.ink} strokeWidth={4} />
      <rect x={326} y={70} width={8} height={70} fill={C.mute} />
      {[0, 1, 2].slice(0, n).map((i) => (
        <g key={i}>
          <Person x={70 + i * 85} y={200} color={C.blue} r={14} label={String(i + 1)} />
        </g>
      ))}
      <path d="M 70 185 Q 112 90 155 185 Q 197 90 240 185 Q 300 30 380 120" stroke={C.orange} strokeWidth={3} fill="none" markerEnd="url(#rv-arr)" />
      <Txt x={160} y={40} size={20} w={900}>
        {n}번 안에 넘기기
      </Txt>
      <Txt x={160} y={66} size={14} color={C.mute}>
        블로킹은 세지 않아요
      </Txt>
    </Svg>
  )
}

function NoDouble() {
  return (
    <Svg label="연달아 두 번 금지">
      <Person x={130} y={175} color={C.blue} label="A" />
      <path d="M 130 155 Q 130 70 130 150" stroke={C.orange} strokeWidth={3} fill="none" />
      <Ball x={130} y={78} />
      <Txt x={130} y={40} size={16} color={C.red}>
        A → A
      </Txt>
      <Cross x={185} y={110} s={30} />
      <Person x={270} y={175} color={C.blue} label="A" />
      <Person x={350} y={175} color={C.blue} label="B" />
      <path d="M 270 155 Q 310 60 350 155" stroke={C.orange} strokeWidth={3} fill="none" markerEnd="url(#rv-arr)" />
      <Txt x={310} y={40} size={16} color={C.green}>
        A → B
      </Txt>
      <Check x={310} y={110} s={30} />
    </Svg>
  )
}

function Rotation() {
  const pos: [number, number, string][] = [
    [280, 70, '2'],
    [200, 70, '3'],
    [120, 70, '4'],
    [120, 180, '5'],
    [200, 180, '6'],
    [280, 180, '1'],
  ]
  return (
    <Svg label="로테이션">
      <line x1={350} y1={20} x2={350} y2={240} stroke={C.ink} strokeWidth={4} />
      <Txt x={372} y={130} size={12} color={C.mute}>
        네트
      </Txt>
      {pos.map(([x, y, l]) => (
        <Person key={l} x={x} y={y} color={l === '1' ? C.orange : C.blue} label={l} r={16} />
      ))}
      <path d="M 300 95 L 300 150" stroke={C.green} strokeWidth={3} markerEnd="url(#rv-arr)" />
      <path d="M 255 180 L 225 180" stroke={C.green} strokeWidth={3} markerEnd="url(#rv-arr)" />
      <path d="M 100 160 L 100 95" stroke={C.green} strokeWidth={3} markerEnd="url(#rv-arr)" />
      <Txt x={200} y={128} size={14} color={C.green}>
        서브권을 얻으면 시계 방향으로 한 칸
      </Txt>
      <Txt x={280} y={222} size={12} color={C.orange}>
        1번 자리에서 서브
      </Txt>
    </Svg>
  )
}

function ServeHeight() {
  return (
    <Svg label="서브 높이 1.15 m">
      <line x1={40} y1={225} x2={360} y2={225} stroke={C.ink} strokeWidth={2} />
      <line x1={40} y1={125} x2={360} y2={125} stroke={C.yellow} strokeWidth={2} strokeDasharray="8 6" />
      <Txt x={355} y={112} size={15} color={C.yellow} anchor="end">
        1.15 m
      </Txt>
      <line x1={70} y1={225} x2={70} y2={125} stroke={C.yellow} strokeWidth={2} markerStart="url(#rv-arr)" markerEnd="url(#rv-arr)" />
      <path d="M 170 170 l -10 -18 l 20 0 z" fill={C.ink} />
      <circle cx={170} cy={172} r={5} fill={C.orange} />
      <Check x={220} y={165} s={26} />
      <path d="M 280 100 l -10 -18 l 20 0 z" fill={C.ink} />
      <circle cx={280} cy={102} r={5} fill={C.orange} />
      <Cross x={320} y={90} s={26} />
      <Txt x={200} y={30} size={15} color={C.mute}>
        칠 때 셔틀 전체가 바닥에서 1.15 m 아래
      </Txt>
    </Svg>
  )
}

function ServeSide() {
  return (
    <Svg label="짝수 오른쪽 홀수 왼쪽">
      <rect x={60} y={30} width={280} height={200} fill={C.court} stroke={C.ink} strokeWidth={2} />
      <line x1={200} y1={30} x2={200} y2={230} stroke={C.ink} strokeWidth={2} />
      <line x1={60} y1={130} x2={340} y2={130} stroke={C.ink} strokeWidth={4} />
      <Txt x={350} y={130} size={12} color={C.mute} anchor="start">
        네트
      </Txt>
      <rect x={200} y={130} width={140} height={100} fill={C.blue} opacity={0.35} />
      <rect x={60} y={130} width={140} height={100} fill={C.orange} opacity={0.3} />
      <Txt x={270} y={175} size={20} w={900}>
        0 · 짝수
      </Txt>
      <Txt x={270} y={203} size={13} color={C.mute}>
        오른쪽
      </Txt>
      <Txt x={130} y={175} size={20} w={900}>
        홀수
      </Txt>
      <Txt x={130} y={203} size={13} color={C.mute}>
        왼쪽
      </Txt>
      <path d="M 270 160 L 140 80" stroke={C.ink} strokeWidth={2.5} strokeDasharray="5 5" markerEnd="url(#rv-arr)" />
      <Txt x={200} y={16} size={13} color={C.mute}>
        서브하는 쪽 점수로 정해요 · 대각선으로
      </Txt>
    </Svg>
  )
}

function Kitchen() {
  return (
    <Svg label="키친에서는 발리 금지">
      <rect x={20} y={40} width={360} height={180} fill={C.court} />
      <rect x={140} y={40} width={60} height={180} fill={C.orange} opacity={0.45} />
      <rect x={200} y={40} width={60} height={180} fill={C.orange} opacity={0.45} />
      <line x1={200} y1={30} x2={200} y2={230} stroke={C.ink} strokeWidth={4} />
      <Txt x={200} y={20} size={14} color={C.orange}>
        키친 (네트에서 2.13 m)
      </Txt>
      <Person x={170} y={150} color={C.blue} />
      <Ball x={187} y={112} />
      <Cross x={170} y={78} s={28} />
      <Person x={70} y={150} color={C.blue} />
      <Ball x={88} y={112} />
      <Check x={70} y={78} s={28} />
      <Txt x={70} y={196} size={13} color={C.green}>
        밖에서 바로 치기
      </Txt>
      <Txt x={170} y={240} size={13} color={C.red}>
        키친 안에서 바로 치기
      </Txt>
      <Txt x={320} y={120} size={13} color={C.mute}>
        튄 공은
      </Txt>
      <Txt x={320} y={140} size={13} color={C.mute}>
        키친에서도 OK
      </Txt>
    </Svg>
  )
}

function TwoBounce() {
  return (
    <Svg label="투 바운스">
      <line x1={200} y1={60} x2={200} y2={230} stroke={C.ink} strokeWidth={4} />
      <line x1={20} y1={230} x2={380} y2={230} stroke={C.mute} strokeWidth={2} />
      <path d="M 40 150 Q 200 30 300 230" stroke={C.orange} strokeWidth={3} fill="none" />
      <circle cx={300} cy={228} r={7} fill={C.yellow} />
      <Txt x={300} y={212} size={14} w={900} color={C.yellow}>
        ①
      </Txt>
      <path d="M 300 228 Q 330 140 350 170" stroke={C.orange} strokeWidth={3} fill="none" />
      <path d="M 350 170 Q 220 40 110 230" stroke={C.blue} strokeWidth={3} fill="none" strokeDasharray="7 5" />
      <circle cx={110} cy={228} r={7} fill={C.yellow} />
      <Txt x={110} y={212} size={14} w={900} color={C.yellow}>
        ②
      </Txt>
      <Txt x={200} y={30} size={17} w={900}>
        서브 한 번 튀고 · 리턴 한 번 튀고
      </Txt>
      <Txt x={200} y={250} size={13} color={C.mute}>
        그다음부터 바로 치기(발리) 가능
      </Txt>
    </Svg>
  )
}

function Underhand() {
  return (
    <Svg label="언더핸드 서브">
      <line x1={60} y1={150} x2={340} y2={150} stroke={C.yellow} strokeWidth={2} strokeDasharray="8 6" />
      <Txt x={345} y={136} size={14} color={C.yellow} anchor="end">
        허리
      </Txt>
      <path d="M 120 220 Q 160 230 210 175" stroke={C.green} strokeWidth={5} fill="none" markerEnd="url(#rv-arr)" />
      <circle cx={215} cy={170} r={8} fill={C.orange} />
      <Check x={160} y={110} s={30} />
      <Txt x={160} y={250} size={14} color={C.green}>
        아래에서 위로 · 허리 아래
      </Txt>
      <path d="M 300 60 Q 330 100 300 140" stroke={C.red} strokeWidth={4} fill="none" strokeDasharray="6 6" />
      <circle cx={300} cy={56} r={8} fill={C.orange} />
      <Cross x={340} y={60} s={26} />
      <Txt x={300} y={30} size={14} color={C.red}>
        위에서 내려치기
      </Txt>
    </Svg>
  )
}

function Toss() {
  return (
    <Svg label="16 cm 이상 던져 올리기">
      <rect x={40} y={190} width={320} height={14} fill="#1d4e89" />
      <line x1={200} y1={170} x2={200} y2={204} stroke={C.ink} strokeWidth={3} />
      <ellipse cx={90} cy={170} rx={26} ry={8} fill={C.mute} />
      <line x1={90} y1={162} x2={90} y2={64} stroke={C.orange} strokeWidth={3} strokeDasharray="5 5" markerEnd="url(#rv-arr)" />
      <circle cx={90} cy={56} r={9} fill={C.ink} />
      <line x1={55} y1={162} x2={55} y2={90} stroke={C.yellow} strokeWidth={2} markerStart="url(#rv-arr)" markerEnd="url(#rv-arr)" />
      <Txt x={48} y={126} size={15} w={900} color={C.yellow} anchor="end">
        16cm
      </Txt>
      <path d="M 110 150 Q 140 210 150 196 Q 210 120 280 196" stroke={C.blue} strokeWidth={3} fill="none" />
      <circle cx={150} cy={194} r={5} fill={C.yellow} />
      <circle cx={280} cy={194} r={5} fill={C.yellow} />
      <Txt x={215} y={235} size={14}>
        내 코트 한 번 → 상대 코트 한 번
      </Txt>
      <Txt x={260} y={50} size={14} color={C.mute}>
        손바닥 펴고 · 회전 없이 · 거의 똑바로
      </Txt>
    </Svg>
  )
}

function KinCall() {
  return (
    <Svg label="옴니킨 부르기">
      <circle cx={110} cy={150} r={62} fill="#f3d34a" />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <circle key={i} cx={110 + Math.cos(a) * 75} cy={150 + Math.sin(a) * 75} r={13} fill={C.blue} />
      })}
      <rect x={200} y={66} width={184} height={74} rx={14} fill={C.ink} />
      <Txt x={292} y={92} size={20} w={900} color="#000">
        옴니킨 — 그리!
      </Txt>
      <Txt x={292} y={120} size={13} color="#333">
        (옴니킨 + 받을 팀 색)
      </Txt>
      <rect x={240} y={190} width={130} height={36} rx={10} fill="#6b7280" />
      <Txt x={305} y={208} size={15} w={900}>
        회색 팀이 받기
      </Txt>
    </Svg>
  )
}

function AllTouch() {
  return (
    <Svg label="4명 모두 공에 닿기">
      <circle cx={200} cy={125} r={70} fill="#f3d34a" />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        const x = 200 + Math.cos(a) * 95
        const y = 125 + Math.sin(a) * 85
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={200 + Math.cos(a) * 66} y2={125 + Math.sin(a) * 60} stroke={C.ink} strokeWidth={4} />
            <Person x={x} y={y} color={C.blue} label={String(i + 1)} r={15} />
          </g>
        )
      })}
      <Txt x={200} y={125} size={18} w={900} color="#000">
        4명 모두!
      </Txt>
      <Txt x={200} y={243} size={14} color={C.mute}>
        한 명이라도 떨어져 있으면 반칙(접촉 빠짐)
      </Txt>
    </Svg>
  )
}

function ThreeTeams() {
  const t = [
    ['#2563eb', '파랑', '반칙'],
    ['#6b7280', '회색', '+1'],
    ['#3a3a3c', '검정', '+1'],
  ] as const
  return (
    <Svg label="반칙하면 나머지 두 팀이 1점">
      {t.map(([c, name, mark], i) => (
        <g key={name}>
          <rect x={25 + i * 122} y={60} width={106} height={120} rx={14} fill={c} stroke={i === 2 ? C.mute : 'none'} />
          <Txt x={78 + i * 122} y={100} size={20} w={900}>
            {name}
          </Txt>
          <Txt x={78 + i * 122} y={145} size={30} w={900} color={i === 0 ? C.red : C.green}>
            {mark}
          </Txt>
        </g>
      ))}
      <Txt x={200} y={30} size={16} w={900}>
        세 팀이 함께 · 한 팀 4명
      </Txt>
      <Txt x={200} y={214} size={15}>
        반칙한 팀 말고 두 팀이 1점씩
      </Txt>
    </Svg>
  )
}

function HighStick() {
  return (
    <Svg label="스틱은 허리 아래">
      <line x1={40} y1={130} x2={360} y2={130} stroke={C.yellow} strokeWidth={2} strokeDasharray="8 6" />
      <Txt x={355} y={116} size={14} color={C.yellow} anchor="end">
        허리
      </Txt>
      <Person x={110} y={200} color={C.blue} />
      <line x1={110} y1={200} x2={160} y2={225} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
      <Ball x={172} y={228} r={7} color={C.ink} />
      <Check x={110} y={150} s={28} />
      <Txt x={110} y={250} size={13} color={C.green}>
        낮게 치기
      </Txt>
      <Person x={290} y={200} color={C.blue} />
      <line x1={290} y1={200} x2={320} y2={80} stroke={C.red} strokeWidth={5} strokeLinecap="round" />
      <Cross x={340} y={60} s={26} />
      <Txt x={290} y={250} size={13} color={C.red}>
        허리 위로 휘두르기
      </Txt>
      <Txt x={200} y={28} size={15}>
        상대 스틱 · 몸을 치지 않아요
      </Txt>
    </Svg>
  )
}

export default function RuleVisual({ v }: { v: Visual }) {
  switch (v.kind) {
    case 'timer':
      return <Timer n={v.n} unit={v.unit} label={v.label} />
    case 'zones':
      return <Zones pos={v.pos} />
    case 'distance':
      return <Distance label={v.label} note={v.note} />
    case 'noContact':
      return <NoContact />
    case 'noDribble':
      return <NoDribble />
    case 'travel':
      return <Travel />
    case 'points':
      return <Points items={v.items} />
    case 'fouls':
      return <Fouls n={v.n} label={v.label} />
    case 'offside':
      return <Offside />
    case 'noOffside':
      return <Offside cross />
    case 'handsGK':
      return <HandsGK />
    case 'cards':
      return <Cards />
    case 'kickIn':
      return <KickIn />
    case 'rebound':
      return <Rebound />
    case 'pivot':
      return <Pivot />
    case 'spirit':
      return <Spirit />
    case 'turnover':
      return <Turnover />
    case 'touches':
      return <Touches n={v.n} />
    case 'noDouble':
      return <NoDouble />
    case 'rotation':
      return <Rotation />
    case 'serveHeight':
      return <ServeHeight />
    case 'serveSide':
      return <ServeSide />
    case 'kitchen':
      return <Kitchen />
    case 'twoBounce':
      return <TwoBounce />
    case 'underhand':
      return <Underhand />
    case 'toss':
      return <Toss />
    case 'kinCall':
      return <KinCall />
    case 'allTouch':
      return <AllTouch />
    case 'threeTeams':
      return <ThreeTeams />
    case 'highStick':
      return <HighStick />
  }
}
