import Person, { Ball, handOf, skinOf, type Look } from './Person'
import { K, Mark, Pill, Scene } from './Scene'

/**
 * 넷볼 핵심 규칙 삽화 (World Netball Rules 2024). 내용은 sportKeys.ts 넷볼 항목 그대로 — 그림만 새로.
 * 주황 = 공격 팀, 파랑 = 수비 팀. 조끼 글자는 포지션.
 */
const A = (bib: string, i = 0, pony = true): Look => ({ jersey: K.teamA, bib, skin: skinOf(i), hairStyle: pony ? 'pony' : 'short', hair: i === 2 ? '#111' : '#3b2416' })
const B = (bib: string, i = 1, pony = false): Look => ({ jersey: K.teamB, bib, skin: skinOf(i), hairStyle: pony ? 'pony' : 'short', shorts: '#111827' })
const S = 1.62 // 사람 크기
const GY = 238 // 발 닿는 줄

/** 1 몸싸움 없음 [규칙 17] */
export function NbNoContact() {
  const h = handOf('holdBall', 'both', 1, S)
  return (
    <Scene label="몸싸움 없음: 밀기 · 잡기 · 공 치기는 반칙">
      <Person x={150} y={GY} pose="pushed" look={A('WA')} scale={S} />
      <Ball x={150 + h[0] - 22} y={GY + h[1] + 18} r={11} />
      <Person x={238} y={GY} pose="push" look={B('WD')} face={-1} scale={S} />
      <path d="M170 112 l-12 -8 M168 126 l-15 -2 M172 140 l-13 5" stroke={K.red} strokeWidth={4} strokeLinecap="round" />
      <Mark x={318} y={52} ok={false} r={20} />
      <Pill x={110} y={34} text="밀기 · 잡기 · 공 치기" size={15} />
    </Scene>
  )
}

/** 2 0.9 m 떨어져 막기 [규칙 16] */
export function NbDistance() {
  const h = handOf('holdBall', 'both', 1, S)
  return (
    <Scene label="공 가진 선수의 착지한 발에서 0.9 m 떨어져 막기">
      <Post x={392} top={40} />
      <Person x={104} y={GY} pose="holdBall" look={A('GA')} scale={S} />
      <Ball x={104 + h[0]} y={GY + h[1]} r={11} />
      <Person x={296} y={GY} pose="defendArms" look={B('GD')} face={-1} scale={S} />
      {/* 착지한 발 표시 */}
      <ellipse cx={110} cy={GY + 1} rx={15} ry={5} fill="none" stroke={K.yellow} strokeWidth={3} />
      <path d={`M126 ${GY + 12} H270`} stroke={K.navy} strokeWidth={3} markerStart="url(#sc-arr-y)" markerEnd="url(#sc-arr-y)" />
      <Pill x={198} y={GY + 12} text="0.9 m" bg={K.yellow} size={17} />
      <Mark x={354} y={44} ok r={18} />
      <Pill x={196} y={36} text="떨어져서 팔 뻗기는 OK" size={14} />
    </Scene>
  )
}

/** 3 드리블 없음 [규칙 11.6 · 13] */
export function NbNoDribble() {
  const s = 1.42
  const g = 240
  const hp = handOf('pass', 'F', 1, s)
  return (
    <Scene label="드리블 없음: 혼자 튕기며 가지 않고 패스로만">
      <rect x={198} y={0} width={4} height={260} fill="#ffffff" opacity={0.9} />
      {/* 왼쪽: 튕기기 ✕ */}
      <Person x={84} y={g} pose="bounce" look={A('C')} scale={s} />
      <Ball x={128} y={g - 12} r={11} />
      <path d="M118 150 q8 34 10 74" stroke={K.navy} strokeWidth={2} strokeDasharray="4 4" fill="none" />
      <Mark x={160} y={42} ok={false} r={17} />
      <Pill x={84} y={34} text="튕기며 가기" size={14} />
      {/* 오른쪽: 패스 ✓ */}
      <Person x={240} y={g} pose="pass" look={A('C', 1)} scale={s} />
      <Person x={360} y={g} pose="catchHigh" look={A('WA', 2, false)} face={-1} scale={s} />
      <path d={`M${240 + hp[0] + 8} ${g + hp[1] - 4} Q300 70 ${352} 92`} stroke={K.green} strokeWidth={3.5} strokeDasharray="7 6" fill="none" markerEnd="url(#sc-arr-g)" />
      <Ball x={300} y={96} r={11} />
      <Mark x={378} y={40} ok r={17} />
      <Pill x={290} y={34} text="패스로만" size={14} />
    </Scene>
  )
}

/** 4 포지션마다 구역 [규칙 3 · 9 · 14] — 코트를 위에서 본 띠 + 포지션마다 들어갈 수 있는 칸 막대 */
const ZONES: [string, number[], string][] = [
  ['GS', [1, 2], '#e5383b'],
  ['GA', [1, 2, 3], '#f97316'],
  ['WA', [2, 3], '#eab308'],
  ['C', [2, 3, 4], '#1f9d55'],
  ['WD', [3, 4], '#38bdf8'],
  ['GD', [3, 4, 5], '#2563eb'],
  ['GK', [4, 5], '#7c3aed'],
]
export function NbZones() {
  // 코트 x 70 ~ 380: 5칸(골 서클 1 · 서드 2 · 3 · 4 · 골 서클 5)
  const X0 = 70
  const W = 310
  const third = W / 3
  const circ = third * 0.45
  const cols: [number, number][] = [
    [X0, X0 + circ],
    [X0 + circ, X0 + third],
    [X0 + third, X0 + 2 * third],
    [X0 + 2 * third, X0 + W - circ],
    [X0 + W - circ, X0 + W],
  ]
  return (
    <Scene label="포지션마다 들어갈 수 있는 구역" plain wall="#f4f8fc">
      {/* 위: 코트 */}
      <rect x={X0} y={14} width={W} height={60} rx={4} fill={K.floor} stroke="#fff" strokeWidth={2} />
      <path d={`M${X0 + third} 14 V74 M${X0 + 2 * third} 14 V74`} stroke="#fff" strokeWidth={2} />
      <path d={`M${X0} 16 A${circ} ${circ * 1.25} 0 0 1 ${X0} 72`} fill="#ffffff33" stroke="#fff" strokeWidth={2} transform={`translate(0 0)`} />
      <path d={`M${X0 + W} 16 A${circ} ${circ * 1.25} 0 0 0 ${X0 + W} 72`} fill="#ffffff33" stroke="#fff" strokeWidth={2} />
      <circle cx={X0 + W / 2} cy={62} r={4} fill="none" stroke="#fff" strokeWidth={2} />
      {cols.map((c, i) => (
        <text key={i} x={(c[0] + c[1]) / 2} y={42} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fff">
          {i + 1}
        </text>
      ))}
      <text x={X0} y={88} fontSize={10.5} fontWeight={800} fill={K.navy}>
        ← 우리가 넣는 골
      </text>
      <text x={X0 + W} y={88} textAnchor="end" fontSize={10.5} fontWeight={800} fill={K.navy}>
        우리가 막는 골 →
      </text>
      {/* 아래: 포지션 막대 */}
      {ZONES.map(([pos, areas, color], r) => {
        const y = 98 + r * 22.5
        const a = cols[areas[0] - 1][0]
        const b = cols[areas[areas.length - 1] - 1][1]
        return (
          <g key={pos}>
            <circle cx={36} cy={y + 9} r={10.5} fill={color} />
            <text x={36} y={y + 9.5} textAnchor="middle" dominantBaseline="middle" fontSize={pos.length > 1 ? 9.5 : 11} fontWeight={900} fill="#fff">
              {pos}
            </text>
            <rect x={X0} y={y + 2} width={W} height={14} rx={7} fill="#dde6ee" />
            <rect x={a + 1} y={y + 2} width={b - a - 2} height={14} rx={7} fill={color} />
          </g>
        )
      })}
    </Scene>
  )
}

/** 넷볼 골대 (백보드 없음, 링 + 그물) */
function Post({ x, top = 40, ground = GY }: { x: number; top?: number; ground?: number }) {
  return (
    <g>
      <rect x={x - 3} y={top} width={6} height={ground - top} rx={3} fill="#9aa8b6" />
      <path d={`M${x} ${top + 4} h-14`} stroke="#9aa8b6" strokeWidth={4} />
      <ellipse cx={x - 26} cy={top + 4} rx={13} ry={4} fill="none" stroke={K.red} strokeWidth={3} />
      <path d={`M${x - 38} ${top + 5} l5 20 h16 l5 -20 M${x - 32} ${top + 6} l3 18 M${x - 20} ${top + 6} l-3 18`} stroke="#ffffff" strokeWidth={1.5} fill="none" />
    </g>
  )
}

/** 5 잡으면 3초 [규칙 11.4 · 12] */
export function NbThreeSec() {
  const h = handOf('holdBall', 'both', 1, S)
  return (
    <Scene label="공을 잡으면 3초 안에 패스 · 슛">
      <Post x={60} top={46} />
      <Person x={130} y={GY} pose="holdBall" look={A('WA', 1)} scale={S} />
      <Ball x={130 + h[0]} y={GY + h[1]} r={11} />
      {/* 초시계 */}
      <g transform="translate(284 104)">
        <rect x={-8} y={-74} width={16} height={12} rx={3} fill={K.navy} />
        <circle r={62} fill="#ffffff" stroke={K.navy} strokeWidth={7} />
        <circle r={50} fill="none" stroke="#e6edf3" strokeWidth={10} />
        <circle r={50} fill="none" stroke={K.red} strokeWidth={10} strokeDasharray={`${2 * Math.PI * 50 * 0.75} 999`} transform="rotate(-90)" strokeLinecap="round" />
        <text y={8} textAnchor="middle" dominantBaseline="middle" fontSize={56} fontWeight={900} fill={K.navy}>
          3
        </text>
        <text y={40} textAnchor="middle" fontSize={14} fontWeight={900} fill={K.navy}>
          초
        </text>
      </g>
      <Pill x={284} y={196} text="패스 · 슛!" bg={K.yellow} size={16} />
    </Scene>
  )
}
