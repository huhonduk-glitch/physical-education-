import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const ICONS: Record<string, ReactNode> = {
  class: (
    <svg viewBox="0 0 24 24" width="28" height="28" {...stroke}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 9l2 2 4-4M8 16h8" />
    </svg>
  ),
  timer: (
    <svg viewBox="0 0 24 24" width="28" height="28" {...stroke}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  ),
  paps: (
    <svg viewBox="0 0 24 24" width="28" height="28" {...stroke}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" width="28" height="28" {...stroke}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.8 3.5 6" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="28" height="28" {...stroke}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  ),
}

const TABS = [
  { to: '/', label: '수업', icon: 'class', end: true },
  { to: '/timer', label: '타이머', icon: 'timer', end: false },
  { to: '/paps', label: 'PAPS', icon: 'paps', end: false },
  { to: '/students', label: '학생', icon: 'students', end: false },
  { to: '/more', label: '더보기', icon: 'more', end: false },
]

/**
 * 하단 탭 5개 (CLAUDE.md 5장). 폰·태블릿에서는 한 손 엄지로 누르기 쉽게 화면 맨 아래,
 * 교무실 PC처럼 넓은 화면(1024px 이상)에서는 왼쪽 세로 메뉴로 바뀐다.
 */
export default function BottomNav() {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-zinc-300 bg-white pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r-2 lg:pb-0"
    >
      <p className="hidden px-5 pt-6 pb-4 text-lg font-extrabold text-brand lg:block">체육수업 누가기록</p>
      <ul className="mx-auto flex max-w-3xl lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-[0.8rem] font-bold lg:min-h-[52px] lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-4 lg:text-base ${
                  isActive ? 'bg-brand-light text-brand' : 'text-zinc-700 hover:bg-zinc-100'
                }`
              }
            >
              {ICONS[t.icon]}
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
