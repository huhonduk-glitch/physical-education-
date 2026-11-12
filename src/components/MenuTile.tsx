import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

/**
 * 메뉴 칸 · 묶음 판 (2026-11-04 레이아웃 정리, 11-05 교사: "본 내용이 단조롭고 구분이 안 된다")
 * - 묶음마다 색 하나(GROUP_TONES): 파랑 · 청록 · 보라 · 주황 · 남색. 빨강은 지도 · 위험에만 남겨 둔다
 * - 꽉 찬 파란 카드는 화면의 주된 일 하나에만(HeroLink)
 */
export const GROUP_TONES = [
  { fg: '#1d5fd6', bg: '#e8f0fe' },
  { fg: '#0f8a7e', bg: '#e3f5f2' },
  { fg: '#7442d6', bg: '#f0eafd' },
  { fg: '#c46a06', bg: '#fdf1e0' },
  { fg: '#334e8a', bg: '#e9edf6' },
] as const
export type Tone = (typeof GROUP_TONES)[number]
export const toneOf = (i: number): Tone => GROUP_TONES[i % GROUP_TONES.length]

export function MenuTile({ to, icon, title, desc, badge, tone = GROUP_TONES[0] }: { to: string; icon: IconName; title: string; desc?: string; badge?: string; tone?: Tone }) {
  return (
    <Link to={to} className="card flex min-h-[96px] flex-col justify-between gap-3 p-4 transition-transform active:scale-[0.98]">
      <span className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}>
          <Icon name={icon} size={20} />
        </span>
        {badge && <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-bold text-ink-2">{badge}</span>}
      </span>
      <span className="min-w-0">
        <b className="line-clamp-2 block leading-snug break-keep">{title}</b>
        {desc && <span className="block truncate text-sm text-ink-3">{desc}</span>}
      </span>
    </Link>
  )
}

/** 묶음 판: 색 머리 + 그 안의 기능 줄들. 묶음끼리 테두리로 확실히 나뉜다 */
export function GroupPanel({ title, icon, tone, count, children }: { title: string; icon: IconName; tone: Tone; count?: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-3 px-5 py-3.5" style={{ background: tone.bg }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: tone.fg }}>
          <Icon name={icon} size={19} />
        </span>
        <h2 className="flex-1 text-[1.1rem] font-extrabold" style={{ color: tone.fg }}>
          {title}
        </h2>
        {count !== undefined && <span className="text-sm font-bold" style={{ color: tone.fg }}>{count}개</span>}
      </header>
      <div className="overflow-hidden">
        <div className="-mr-px -mb-px grid md:grid-cols-2 xl:grid-cols-3">{children}</div>
      </div>
    </section>
  )
}

/** 묶음 판 안의 기능 한 줄 */
export function PanelItem({ to, icon, title, desc, tone, fresh }: { to: string; icon: IconName; title: string; desc?: string; tone: Tone; fresh?: boolean }) {
  return (
    <Link to={to} className="flex min-h-[68px] items-center gap-3 border-r border-b border-line bg-white px-5 py-3 transition-colors hover:bg-fill active:bg-fill-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}>
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1.5 text-[1.02rem]">
          <span className="truncate">{title}</span>
          {fresh && <span className="shrink-0 rounded-full bg-danger px-1.5 py-px text-[0.62rem] font-extrabold text-white">NEW</span>}
        </b>
        {desc && <span className="block truncate text-sm text-ink-3">{desc}</span>}
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}

/**
 * 업무 하나 카드 (2026-11-12): 머리(업무 이름 · 한 줄 설명) + 하위 메뉴 칩.
 * 업무가 여럿이고 하위 메뉴가 4~6개라 줄 목록으로 그리면 폰에서 너무 길어진다. 첫 칩(흐름도)은 색을 채운다
 */
export function ChipPanel({
  title,
  icon,
  tone,
  desc,
  items,
  fresh,
}: {
  title: string
  icon: IconName
  tone: Tone
  desc?: string
  items: { to: string; label: string }[]
  fresh?: (to: string) => boolean
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)]">
      <Link to={items[0]?.to ?? '#'} className="flex items-center gap-3 px-5 py-3.5" style={{ background: tone.bg }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: tone.fg }}>
          <Icon name={icon} size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[1.1rem] font-extrabold" style={{ color: tone.fg }}>
            {title}
          </b>
          {desc && <span className="block truncate text-sm font-semibold text-ink-3">{desc}</span>}
        </span>
        <Icon name="chevronRight" size={18} style={{ color: tone.fg }} />
      </Link>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {items.map((i, k) => (
          <Link
            key={i.to}
            to={i.to}
            className="relative rounded-xl px-3 py-2 text-[0.95rem] font-bold active:opacity-70"
            style={k === 0 ? { background: tone.fg, color: '#fff' } : { background: tone.bg, color: tone.fg }}
          >
            {i.label}
            {fresh?.(i.to) && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" aria-label="새 기능" />}
          </Link>
        ))}
      </div>
    </section>
  )
}

/** 화면의 주된 일 하나 (꽉 찬 파란 카드). 한 화면에 하나만 */
export function HeroLink({ to, icon, title, desc }: { to: string; icon: IconName; title: string; desc?: string }) {
  return (
    <Link to={to} className="flex min-h-[96px] items-center gap-4 rounded-3xl bg-brand p-5 text-white shadow-[var(--shadow-float)] transition-transform active:scale-[0.99]">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
        <Icon name={icon} size={26} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-xl">{title}</b>
        {desc && <span className="block truncate text-sm font-semibold text-white/85">{desc}</span>}
      </span>
      <Icon name="chevronRight" />
    </Link>
  )
}

/** 묶음 제목 (작은 회색 글자). 위에 설명 칸을 따로 달지 않는다 */
export function GroupTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pt-2 text-sm font-bold text-ink-3">{children}</h2>
}
