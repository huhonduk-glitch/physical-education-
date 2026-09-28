import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName; end: boolean }[] = [
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:inset-y-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r lg:bg-white lg:pb-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pt-7 pb-6 lg:flex">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
          <Icon name="class" size={20} />
        </span>
        <span className="text-[1.05rem] font-extrabold tracking-tight">체육수업 누가기록</span>
      </div>
      <ul className="mx-auto flex max-w-3xl lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-[62px] flex-col items-center justify-center gap-1 text-[0.72rem] font-bold transition-colors lg:min-h-[50px] lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-4 lg:text-[0.98rem] ${
                  isActive ? 'text-ink lg:bg-fill' : 'text-ink-3 hover:text-ink-2 lg:hover:bg-fill'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid place-items-center rounded-full transition-colors ${isActive ? 'text-brand' : ''}`}>
                    <Icon name={t.icon} size={26} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
