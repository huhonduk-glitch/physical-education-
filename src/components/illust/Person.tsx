/**
 * 삽화용 사람 (2026-11-03 교사 요청 "그림이 너무 허접해 — 전문적으로").
 * 옆에서 본 납작한(flat) 그림체: 관절 각도(pose)로 자세를 정하고, 뒤쪽 팔다리는 한 톤 어둡게 그려 깊이를 준다.
 * 키 100 단위(scale 1 = 키 약 100). 각도는 도(°), 팔다리 0 = 똑바로 아래, + = 바라보는 쪽(앞)으로. 몸통 0 = 똑바로 위, + = 앞으로 숙임.
 * 남의 그림을 쓰지 않고 PE LOG가 직접 그린다.
 */
export interface Pose {
  torso: number
  head?: number
  /** 앞 팔: 위팔 · 아래팔 */
  armF: [number, number]
  /** 뒤 팔 */
  armB: [number, number]
  /** 앞 다리: 허벅지 · 정강이 */
  legF: [number, number]
  legB: [number, number]
}

export const POSES = {
  stand: { torso: 2, armF: [12, 6], armB: [-10, -4], legF: [4, 2], legB: [-4, -2] },
  run: { torso: 14, armF: [-40, 40], armB: [45, 110], legF: [40, 0], legB: [-30, -80] },
  holdBall: { torso: 4, armF: [40, 95], armB: [30, 90], legF: [8, 0], legB: [-8, -2] },
  pass: { torso: 10, armF: [80, 88], armB: [55, 80], legF: [26, 4], legB: [-18, -10] },
  shoot: { torso: -2, armF: [165, 170], armB: [150, 175], legF: [4, 2], legB: [-4, -2] },
  defendArms: { torso: 6, armF: [130, 150], armB: [110, 140], legF: [18, 2], legB: [-18, -4] },
  defendLow: { torso: 22, armF: [70, 80], armB: [-50, -30], legF: [30, -6], legB: [-24, -40] },
  push: { torso: 26, armF: [78, 82], armB: [70, 78], legF: [34, 0], legB: [-34, -20] },
  pushed: { torso: -18, armF: [-30, 10], armB: [40, 70], legF: [20, 6], legB: [-20, -10] },
  bounce: { torso: 14, armF: [36, 10], armB: [-20, 10], legF: [24, 0], legB: [-24, -30] },
  catchHigh: { torso: -4, armF: [160, 170], armB: [150, 165], legF: [14, -4], legB: [-14, -30] },
  pivot: { torso: 8, armF: [50, 100], armB: [40, 95], legF: [30, 6], legB: [-6, -2] },
  wait: { torso: 4, armF: [20, 60], armB: [10, 40], legF: [10, 4], legB: [-10, -4] },
  cheer: { torso: 0, armF: [150, 170], armB: [-150, -170], legF: [6, 2], legB: [-6, -2] },
} satisfies Record<string, Pose>
export type PoseName = keyof typeof POSES

export interface Look {
  jersey: string
  shorts?: string
  skin?: string
  hair?: string
  /** 머리 모양: 짧은 머리 · 묶은 머리 */
  hairStyle?: 'short' | 'pony'
  shoe?: string
  /** 조끼 · 등번호 글자 (예: GS, 7) */
  bib?: string
}

const SKINS = ['#f2c9a0', '#e0ac7e', '#c68a5c']
export const skinOf = (i: number) => SKINS[i % SKINS.length]

const rad = (d: number) => (d * Math.PI) / 180
/** 색을 어둡게 (뒤쪽 팔다리) */
export function shade(hex: string, k = 0.82): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (s: number) => Math.round(((n >> s) & 255) * k)
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`
}

const THIGH = 24
const SHIN = 25
const TORSO = 29
const UPPER = 17
const FORE = 16

type P = [number, number]
const seg = (from: P, ang: number, len: number, f: number): P => [from[0] + Math.sin(rad(ang)) * len * f, from[1] + Math.cos(rad(ang)) * len]

/** 자세 → 관절 좌표 (발바닥 기준 0, 위가 −) */
export function joints(pose: Pose, f = 1) {
  const legPts = (l: [number, number], hip: P) => {
    const knee = seg(hip, l[0], THIGH, f)
    const foot = seg(knee, l[1], SHIN, f)
    return { knee, foot }
  }
  const hip0: P = [0, 0]
  const F = legPts(pose.legF, hip0)
  const B = legPts(pose.legB, hip0)
  const low = Math.max(F.foot[1], B.foot[1])
  const lift = (p: P): P => [p[0], p[1] - low]
  const hip = lift(hip0)
  const neck: P = [hip[0] + Math.sin(rad(pose.torso)) * TORSO * f, hip[1] - Math.cos(rad(pose.torso)) * TORSO]
  const sh: P = [neck[0] - 1 * f, neck[1] + 3]
  const arm = (a: [number, number]) => {
    const elbow = seg(sh, a[0], UPPER, f)
    return { elbow, hand: seg(elbow, a[1], FORE, f) }
  }
  const head: P = [neck[0] + Math.sin(rad(pose.torso + (pose.head ?? 0))) * 13 * f, neck[1] - Math.cos(rad(pose.torso + (pose.head ?? 0))) * 13]
  return {
    hip,
    neck,
    sh,
    head,
    legF: { knee: lift(F.knee), foot: lift(F.foot) },
    legB: { knee: lift(B.knee), foot: lift(B.foot) },
    armF: arm(pose.armF),
    armB: arm(pose.armB),
  }
}

const pt = (p: P) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`

interface Props {
  x: number
  y: number
  pose: Pose | PoseName
  look: Look
  /** 1 = 오른쪽을 봄, −1 = 왼쪽 */
  face?: 1 | -1
  scale?: number
  /** 공중에 뜸(점프) — 그림자는 땅에 */
  air?: number
  shadow?: boolean
}

/** 사람 한 명. (x, y) = 발밑 가운데 */
export default function Person({ x, y, pose, look, face = 1, scale = 1, air = 0, shadow = true }: Props) {
  const p = typeof pose === 'string' ? POSES[pose] : pose
  const j = joints(p, face)
  const skin = look.skin ?? SKINS[0]
  const shorts = look.shorts ?? '#1f2937'
  const shoe = look.shoe ?? '#ffffff'
  const hair = look.hair ?? '#2b1d14'
  const LW = 7.4
  const AW = 6
  const limb = (a: P, b: P, c: P, color: string, w: number, top?: string) => (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M${pt(a)} L${pt(b)} L${pt(c)}`} stroke={color} strokeWidth={w} />
      {top && <path d={`M${pt(a)} L${pt([a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55])}`} stroke={top} strokeWidth={w + 1.6} />}
    </g>
  )
  const shoeAt = (foot: P, color: string) => (
    <path d={`M${pt([foot[0] - 3.5 * face, foot[1] - 3.2])} q${(5 * face).toFixed(1)} -1.2 ${(9.5 * face).toFixed(1)} 1.2 q${(1.5 * face).toFixed(1)} 1.6 0 2.4 h${(-11 * face).toFixed(1)} z`} fill={color} stroke={shade(color, 0.7)} strokeWidth={0.8} />
  )
  const leg = (L: { knee: P; foot: P }, back: boolean) => (
    <g>
      {limb(j.hip, L.knee, L.foot, back ? shade(skin) : skin, LW, back ? shade(shorts) : shorts)}
      <path d={`M${pt([L.foot[0] + (L.knee[0] - L.foot[0]) * 0.28, L.foot[1] + (L.knee[1] - L.foot[1]) * 0.28])} L${pt(L.foot)}`} stroke={back ? '#d9dde3' : '#ffffff'} strokeWidth={LW + 0.4} strokeLinecap="round" />
      {shoeAt(L.foot, back ? shade(shoe) : shoe)}
    </g>
  )
  const arm = (A: { elbow: P; hand: P }, back: boolean) => (
    <g>
      {limb(j.sh, A.elbow, A.hand, back ? shade(skin) : skin, AW, back ? shade(look.jersey) : look.jersey)}
      <circle cx={A.hand[0]} cy={A.hand[1]} r={3.6} fill={back ? shade(skin) : skin} />
    </g>
  )
  // 몸통: 어깨 폭 · 엉덩이 폭을 몸통 방향에 수직으로
  const dx = j.neck[0] - j.hip[0]
  const dy = j.neck[1] - j.hip[1]
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const tp = (c: P, w: number, s: number): P => [c[0] + nx * w * s, c[1] + ny * w * s]
  const neckIn: P = [j.neck[0] - dx * 0.06, j.neck[1] - dy * 0.06]
  const torso = [tp(neckIn, 9.6, 1), tp(neckIn, 9.6, -1), tp([j.hip[0] + dx * 0.04, j.hip[1] + dy * 0.04], 8, -1), tp(j.hip, 8.2, 1)]
  const mid: P = [j.hip[0] + dx * 0.55, j.hip[1] + dy * 0.55]
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const h = j.head
  const sw = face === 1 ? 1 : 0
  const hairPath =
    look.hairStyle === 'pony'
      ? `M${h[0] - 11.2 * face} ${h[1] + 2} a11.4 11.4 0 0 ${sw} ${22 * face} -3.4 q${-5 * face} -2.6 ${-12 * face} -1.4 q${-5 * face} 4.4 ${-10 * face} 4.8 z M${h[0] - 9 * face} ${h[1] - 5} q${-11 * face} 0 ${-12 * face} 13 q${5 * face} -4 ${11 * face} -6 z`
      : `M${h[0] - 11.4 * face} ${h[1] + 3} a11.5 11.5 0 0 ${sw} ${22.6 * face} -4.2 q${-7 * face} -2.4 ${-13.6 * face} -0.4 q${-3.6 * face} 3 ${-9 * face} 4.6 z`
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {shadow && <ellipse cx={(j.legF.foot[0] + j.legB.foot[0]) / 2} cy={1.5} rx={17} ry={3.4} fill="#0b2545" opacity={0.18} />}
      <g transform={`translate(0 ${-air})`}>
        {arm(j.armB, true)}
        {leg(j.legB, true)}
        {/* 반바지 */}
        <path d={`M${pt(tp(j.hip, 8.2, 1))} L${pt(tp(j.hip, 8.2, -1))} L${pt([j.hip[0] + (j.legF.knee[0] - j.hip[0]) * 0.35 + 3 * face, j.hip[1] + (j.legF.knee[1] - j.hip[1]) * 0.45])} z`} fill={shorts} />
        {leg(j.legF, false)}
        <path d={`M${torso.map(pt).join(' L')} z`} fill={look.jersey} stroke={look.jersey} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M${pt(tp(neckIn, 9.6, -1))} L${pt(tp([j.hip[0] + dx * 0.04, j.hip[1] + dy * 0.04], 8, -1))}`} stroke={shade(look.jersey, 0.86)} strokeWidth={3} strokeLinecap="round" />
        {look.bib && (
          <g transform={`translate(${pt(mid)}) rotate(${ang})`}>
            <rect x={-6.6} y={-5.6} width={13.2} height={11.2} rx={2.4} fill="#ffffff" />
            <text x={0} y={0.4} textAnchor="middle" dominantBaseline="middle" fontSize={look.bib.length > 1 ? 6.8 : 8.4} fontWeight={900} fill="#0b2545">
              {look.bib}
            </text>
          </g>
        )}
        {/* 목 · 머리 */}
        <path d={`M${pt(j.neck)} L${pt([j.neck[0] + (h[0] - j.neck[0]) * 0.4, j.neck[1] + (h[1] - j.neck[1]) * 0.4])}`} stroke={skin} strokeWidth={5.4} strokeLinecap="round" />
        <circle cx={h[0]} cy={h[1]} r={11} fill={skin} />
        <path d={hairPath} fill={hair} />
        <circle cx={h[0] + 5.8 * face} cy={h[1] + 0.4} r={1.4} fill="#1b1b1b" />
        <circle cx={h[0] + 7.6 * face} cy={h[1] + 3.6} r={1.6} fill="#f29a8a" opacity={0.55} />
        <path d={`M${h[0] + 3.8 * face} ${h[1] + 5.6} q${1.8 * face} 1.2 ${3.6 * face} 0`} stroke="#9a4b3a" strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}

/** 손 위치 (공 놓을 자리) */
export function handOf(pose: Pose | PoseName, which: 'F' | 'B' | 'both', face: 1 | -1 = 1, scale = 1): [number, number] {
  const p = typeof pose === 'string' ? POSES[pose] : pose
  const j = joints(p, face)
  const a = j.armF.hand
  const b = j.armB.hand
  const h = which === 'F' ? a : which === 'B' ? b : ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as P)
  return [h[0] * scale, h[1] * scale]
}

export type BallKind = 'netball' | 'basketball' | 'volleyball' | 'soccer' | 'shuttle' | 'tennis' | 'plain'
/** 공 */
export function Ball({ x, y, r = 7, kind = 'netball' }: { x: number; y: number; r?: number; kind?: BallKind }) {
  if (kind === 'basketball')
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill="#f08a24" stroke="#7a3d0c" strokeWidth={r * 0.1} />
        <path d={`M${x - r} ${y} H${x + r} M${x} ${y - r} V${y + r} M${x - r * 0.7} ${y - r * 0.7} q${r * 0.6} ${r * 0.7} 0 ${r * 1.4} M${x + r * 0.7} ${y - r * 0.7} q${-r * 0.6} ${r * 0.7} 0 ${r * 1.4}`} stroke="#7a3d0c" strokeWidth={r * 0.09} fill="none" />
      </g>
    )
  const seam = kind === 'soccer' ? '#1b1b1b' : '#9aa3ad'
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={kind === 'netball' ? '#fff7d6' : '#ffffff'} stroke="#7d8793" strokeWidth={r * 0.09} />
      {kind === 'soccer' ? (
        <path d={`M${x} ${y - r * 0.35} l${r * 0.34} ${r * 0.25} l${-r * 0.13} ${r * 0.4} h${-r * 0.42} l${-r * 0.13} ${-r * 0.4} z`} fill="#1b1b1b" />
      ) : (
        <path d={`M${x - r} ${y - r * 0.15} q${r} ${r * 0.6} ${r * 2} 0 M${x - r * 0.4} ${y - r * 0.92} q${r * 0.5} ${r} ${r * 0.1} ${r * 1.9} M${x + r * 0.5} ${y - r * 0.85} q${-r * 0.2} ${r * 0.8} ${r * 0.45} ${r * 1.5}`} stroke={kind === 'netball' ? '#e0b43a' : seam} strokeWidth={r * 0.11} fill="none" />
      )}
    </g>
  )
}
