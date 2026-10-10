import { BrandLine } from './Brand'
import { Link, useLocation } from 'react-router-dom'
import { featureOn } from '../lib/features'
import { useApp } from '../state/AppContext'
import Icon, { type IconName } from './Icon'

interface Tab {
  to: string
  label: string
  icon: IconName
  /** 이 주소들로 시작하면 이 탭이 켜진 것으로 본다 */
  match: string[]
  show?: (f: Parameters<typeof featureOn>[0]) => boolean
}

const TABS: Tab[] = [
  { to: '/', label: '홈', icon: 'home', match: [] },
  { to: '/groups', label: '수업반', icon: 'class', match: ['/groups', '/students'] },
  { to: '/eval', label: '평가', icon: 'paps', match: ['/eval', '/paps', '/more/assessments'], show: (f) => featureOn(f, 'paps') || featureOn(f, 'assess') },
  { to: '/tools', label: '도구', icon: 'timer', match: ['/timer', '/tools'], show: (f) => featureOn(f, 'tools') },
  { to: '/more', label: '더보기', icon: 'more', match: ['/more'] },
]

function isActive(t: Tab, path: string): boolean {
  if (t.to === '/') return path === '/'
  const hits = TABS.flatMap((x) => x.match.filter((m) => path === m || path.startsWith(`${m}/`)).map((m) => ({ x, m })))
  // 더 길게 맞는 탭이 이긴다 (/more/assessments는 평가 탭)
  const best = hits.sort((a, b) => b.m.length - a.m.length)[0]
  return best?.x === t
}

/**
 * 하단 탭 (CLAUDE.md 5장): 홈 · 수업반 · 평가 · 도구 · 더보기. 끈 기능의 탭은 숨긴다.
 * 폰·태블릿에서는 화면 맨 아래, 교무실 PC처럼 넓은 화면(1024px 이상)에서는 왼쪽 세로 메뉴로 바뀐다.
 */
export default function BottomNav() {
  const { settings } = useApp()
  const { pathname } = useLocation()
  const tabs = TABS.filter((t) => !t.show || t.show(settings.features))
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:inset-y-0 lg:right-auto lg:w-60 lg:border-t-0 lg:border-r lg:bg-white lg:pb-0"
    >
      <div className="hidden items-center gap-2.5 px-5 pt-7 pb-6 lg:flex">
        <BrandLine />
      </div>
      <ul className="mx-auto flex max-w-3xl lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {tabs.map((t) => {
          const active = isActive(t, pathname)
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[62px] flex-col items-center justify-center gap-1 text-[0.72rem] font-bold transition-colors lg:min-h-[50px] lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-4 lg:text-[0.98rem] ${
                  active ? 'text-ink lg:bg-fill' : 'text-ink-3 hover:text-ink-2 lg:hover:bg-fill'
                }`}
              >
                <span className={`grid place-items-center rounded-full transition-colors ${active ? 'text-brand' : ''}`}>
                  <Icon name={t.icon} size={26} strokeWidth={active ? 2.5 : 2} />
                </span>
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
