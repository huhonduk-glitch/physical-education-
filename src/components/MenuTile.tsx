import { Link } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

/**
 * 메뉴 칸 하나 (2026-11-04 레이아웃 정리): 아이콘 + 이름 + 짧은 설명 한 줄.
 * 도구 · 홈 바로가기 · 목록 화면이 모두 이 모양 하나를 쓴다 — 화면마다 카드 모양이 달라 헷갈리지 않게.
 * 설명은 한 줄로 자른다(길면 …). 꽉 찬 파란 카드는 화면의 주된 일 하나에만 쓴다(HeroLink).
 */
export function MenuTile({ to, icon, title, desc, badge }: { to: string; icon: IconName; title: string; desc?: string; badge?: string }) {
  return (
    <Link to={to} className="card flex min-h-[96px] flex-col justify-between gap-3 p-4 transition-transform active:scale-[0.98]">
      <span className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
          <Icon name={icon} size={20} />
        </span>
        {badge && <span className="rounded-full bg-fill px-2 py-0.5 text-xs font-bold text-ink-2">{badge}</span>}
      </span>
      <span className="min-w-0">
        <b className="block truncate leading-snug">{title}</b>
        {desc && <span className="block truncate text-sm text-ink-3">{desc}</span>}
      </span>
    </Link>
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
