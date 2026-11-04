import { BrandLine } from './Brand'
import { Link, useLocation } from 'react-router-dom'
import { activeItem, sectionOf, visibleGroups, visibleSections } from '../lib/nav'
import { useApp } from '../state/AppContext'
import Icon from './Icon'

/**
 * 큰 메뉴 (CLAUDE.md 6-12, 메뉴 표 src/lib/nav.ts): 홈 · 수업 · PAPS · 평가 · 업무 · 설정.
 * - 폰 · 태블릿: 화면 맨 아래 탭 6개 → 누르면 그 큰 메뉴 화면(하위 기능 칸)
 * - PC(1024px 이상): 왼쪽 세로 메뉴. 지금 큰 메뉴가 펼쳐져 하위 메뉴가 늘 보인다(파이스처럼 두 단계)
 * 끈 기능은 숨긴다(자료는 그대로).
 */
export default function BottomNav() {
  const { settings } = useApp()
  const { pathname, search } = useLocation()
  const sections = visibleSections(settings.features)
  const current = sectionOf(pathname)

  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden lg:inset-y-0 lg:right-auto lg:flex lg:w-60 lg:flex-col lg:border-t-0 lg:border-r lg:bg-white lg:pb-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pt-7 pb-5 lg:flex">
        <BrandLine />
      </div>

      {/* 폰: 아래 탭 */}
      <ul className="mx-auto flex max-w-3xl lg:hidden">
        {sections.map((s) => {
          const active = current === s.id
          return (
            <li key={s.id} className="flex-1">
              <Link
                to={s.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[62px] flex-col items-center justify-center gap-1 text-[0.72rem] font-bold transition-colors ${active ? 'text-ink' : 'text-ink-3'}`}
              >
                <Icon name={s.icon} size={25} strokeWidth={active ? 2.5 : 2} className={active ? 'text-brand' : ''} />
                {s.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* PC: 두 단계 메뉴 — 지금 큰 메뉴만 펼친다 */}
      <ul className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6 lg:flex">
        {sections.map((s) => {
          const active = current === s.id
          const groups = visibleGroups(s, settings.features)
          const item = active ? activeItem(pathname, search, groups.flatMap((g) => g.items)) : undefined
          return (
            <li key={s.id}>
              <Link
                to={s.to}
                aria-current={active && !item ? 'page' : undefined}
                className={`flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-[0.98rem] font-bold transition-colors ${active ? 'bg-fill text-ink' : 'text-ink-3 hover:bg-fill hover:text-ink-2'}`}
              >
                <Icon name={s.icon} size={22} strokeWidth={active ? 2.5 : 2} className={active ? 'text-brand' : ''} />
                <span className="flex-1">{s.label}</span>
                {groups.length > 0 && <Icon name="chevronDown" size={16} className={`text-ink-3 transition-transform ${active ? '' : '-rotate-90'}`} />}
              </Link>
              {active && groups.length > 0 && (
                <div className="mt-1 mb-2 ml-[1.35rem] border-l border-line pl-3">
                  {groups.map((g) => (
                    <div key={g.title} className="py-1">
                      <p className="px-2 pt-1 pb-0.5 text-xs font-bold text-ink-3">{g.title}</p>
                      {g.items.map((i) => {
                        const on = item === i
                        return (
                          <Link
                            key={i.to}
                            to={i.to}
                            aria-current={on ? 'page' : undefined}
                            className={`block truncate rounded-lg px-2 py-1.5 text-[0.9rem] font-semibold ${on ? 'bg-brand-light text-brand' : 'text-ink-2 hover:bg-fill'}`}
                          >
                            {i.label}
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
