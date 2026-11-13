import type { ReactNode } from 'react'
import { BrandLine } from './Brand'
import { Link, useLocation } from 'react-router-dom'
import { NAV, activeItem, sectionOf, visibleGroups, visibleSections, type NavGroup } from '../lib/nav'
import { useGroups } from '../state/useGroups'
import { useFolded, useSideOpen } from '../state/sidebar'
import { useApp } from '../state/AppContext'
import { NEW_LABEL, useNewMarks } from '../state/useNewMarks'
import Icon from './Icon'
import { toneOf } from './MenuTile'

/**
 * 큰 메뉴 (CLAUDE.md 6-12, 메뉴 표 src/lib/nav.ts): 홈 · 수업 · PAPS · 평가 · 업무 · 설정.
 * - 폰 · 태블릿: 화면 맨 아래 탭 6개 → 누르면 그 큰 메뉴 화면(하위 기능 칸)
 * - PC(1024px 이상, 2026-11-05 교사 선택): 맨 위 가로 메뉴에 큰 메뉴, 왼쪽에는 지금 큰 메뉴의 하위 메뉴만(홈은 없음),
 *   제목 위에 '수업 › 종목 수업자료' 위치 표시(PageHeader). 교사가 만드는 다른 앱 · 파이스와 같은 방식
 * 끈 기능은 숨긴다(자료는 그대로).
 */
export default function BottomNav() {
  const { settings } = useApp()
  const { pathname, search } = useLocation()
  const sections = visibleSections(settings.features)
  const current = sectionOf(pathname)
  const sec = NAV.find((s) => s.id === current)!
  const groups = useSideGroups(sec.id)
  const item = activeItem(pathname, search, groups.flatMap((g) => g.items))
  const [open, setOpen] = useSideOpen()
  const [folded, toggleFold] = useFolded()
  // 새 기능 점: 업데이트 소식의 화면 주소. 지금 화면은 본 것으로 표시
  const fresh = useNewMarks(pathname)
  const sectionFresh = (s: (typeof NAV)[number]) => fresh.size > 0 && visibleGroups(s, settings.features).some((g) => g.items.some((i) => fresh.has(i.to)))

  return (
    <>
      {/* 폰: 아래 탭 */}
      <nav aria-label="주요 화면" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden lg:hidden">
        <ul className="mx-auto flex max-w-3xl">
          {sections.map((s) => {
            const active = current === s.id
            return (
              <li key={s.id} className="flex-1">
                <Link
                  to={s.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[62px] flex-col items-center justify-center gap-1 text-[0.72rem] font-bold transition-colors ${active ? 'text-ink' : 'text-ink-3'}`}
                >
                  <span className="relative">
                    <Icon name={s.icon} size={25} strokeWidth={active ? 2.5 : 2} className={active ? 'text-brand' : ''} />
                    {sectionFresh(s) && <i className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-danger" aria-label="새 기능" />}
                  </span>
                  {s.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* PC: 맨 위 가로 메뉴 */}
      <nav aria-label="주요 화면" className="fixed inset-x-0 top-0 z-30 hidden h-14 items-center gap-6 border-b border-line bg-white px-5 print:hidden lg:flex">
        {groups.length > 0 && (
          <button
            type="button"
            className="-mr-3 grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-fill"
            aria-label={open ? '왼쪽 메뉴 접기' : '왼쪽 메뉴 펼치기'}
            aria-expanded={open}
            title={open ? '왼쪽 메뉴 접기 (본문 넓게)' : '왼쪽 메뉴 펼치기'}
            onClick={() => setOpen(!open)}
          >
            <Icon name="list" size={22} />
          </button>
        )}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <BrandLine />
        </Link>
        <ul className="flex h-full items-stretch gap-1">
          {sections.map((s) => {
            const active = current === s.id
            return (
              <li key={s.id} className="flex">
                <Link
                  to={s.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center border-b-[3px] px-3 text-[0.98rem] font-bold transition-colors ${active ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'}`}
                >
                  <span className="relative">
                    {s.label}
                    {sectionFresh(s) && <i className="absolute -top-0.5 -right-2 h-1.5 w-1.5 rounded-full bg-danger" aria-label="새 기능" />}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <span className="ml-auto truncate text-sm font-bold text-ink-3">{settings.schoolName}</span>
      </nav>

      {/* PC: 왼쪽 하위 메뉴 (지금 큰 메뉴만). 묶음 이름 = 아이콘 + 굵은 검정, 하위 메뉴 = 들여 쓴 보통 글씨 + 세로 안내선 */}
      {groups.length > 0 && open && (
        <aside aria-label={`${sec.label} 메뉴`} className="fixed top-14 bottom-0 left-0 z-20 hidden w-60 overflow-y-auto border-r border-line bg-white px-3 py-5 print:hidden lg:block">
          <Link to={sec.to} className="mb-3 block px-2 text-xs font-bold text-ink-3 hover:text-brand">
            {sec.label} 메뉴
          </Link>
          {groups.map((g, gi) => {
            const key = `${sec.id}/${g.title}`
            // 업무별 묶음(compact)은 지금 보는 업무만 펼친다 — 누르면 펼침/접힘. 다른 묶음은 접어 둔 것만 접힘
            const here = g.items.includes(item!)
            const shut = g.compact ? !(here || folded.has(key)) : folded.has(key) && !here
            if (g.solo && g.items.length === 1) {
              const i = g.items[0]
              const on = item === i
              return (
                <Link
                  key={g.title}
                  to={i.to}
                  aria-current={on ? 'page' : undefined}
                  className={`mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.95rem] font-extrabold ${on ? 'bg-brand-light text-brand' : 'text-ink hover:bg-fill'}`}
                >
                  <Icon name={g.icon} size={18} style={{ color: toneOf(gi).fg }} />
                  <span className="flex-1">{g.title}</span>
                  {fresh.has(i.to) && <span className="rounded-full bg-danger px-1.5 py-px text-[0.62rem] font-extrabold text-white">{NEW_LABEL}</span>}
                </Link>
              )
            }
            return (
            <div key={g.title} className="mb-3">
              <button
                type="button"
                aria-expanded={!shut}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.95rem] font-extrabold text-ink hover:bg-fill"
                onClick={() => toggleFold(key)}
              >
                <Icon name={g.icon} size={18} style={{ color: toneOf(gi).fg }} />
                <span className="flex-1">{g.title}</span>
                <Icon name="chevronDown" size={16} className={`text-ink-3 transition-transform ${shut ? '-rotate-90' : ''}`} />
              </button>
              {!shut && (
              <div className="mt-0.5 ml-[1.05rem] border-l-2 border-line pl-2">
                {g.items.map((i) => {
                  const on = item === i
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      aria-current={on ? 'page' : undefined}
                      className={`-ml-[0.6rem] block truncate border-l-2 py-1.5 pr-2 pl-3 text-[0.9rem] ${on ? 'border-brand bg-brand-light font-bold text-brand' : 'border-transparent font-medium text-ink-2 hover:bg-fill hover:text-ink'}`}
                    >
                      {i.label}
                      {fresh.has(i.to) && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-px align-middle text-[0.62rem] font-extrabold text-white">{NEW_LABEL}</span>}
                    </Link>
                  )
                })}
              </div>
              )}
            </div>
            )
          })}
        </aside>
      )}
    </>
  )
}

/** 내용 칸: 폰은 아래 탭만큼 띄우고, PC는 위 메뉴 · 왼쪽 하위 메뉴만큼 띄운다 */
export function ContentFrame({ children }: { children: ReactNode }) {
  const { settings } = useApp()
  const { pathname } = useLocation()
  const sec = NAV.find((s) => s.id === sectionOf(pathname))!
  const [open] = useSideOpen()
  const side = open && visibleGroups(sec, settings.features).length > 0
  return <div className={`min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom))] print:p-0 lg:pt-14 lg:pb-0 ${side ? 'lg:pl-60' : ''}`}>{children}</div>
}

/** PC 제목 위 위치 표시: '수업 › 종목 수업자료' (폰에서는 숨김) */
export function useCrumb(): string[] {
  const { pathname, search } = useLocation()
  const sec = NAV.find((s) => s.id === sectionOf(pathname))!
  const groups = useSideGroups(sec.id)
  if (pathname === '/') return []
  const item = activeItem(pathname, search, groups.flatMap((g) => g.items))
  if (!item) return [sec.label]
  // 업무별 묶음은 '업무 › 학교운동부 › 나이스 할 일'처럼 업무 이름을 넣는다
  const g = groups.find((x) => x.compact && x.items.includes(item))
  return g ? [sec.label, g.title, item.label] : [sec.label, item.label]
}

/** 왼쪽 하위 메뉴 묶음: '내 수업반'은 실제 반 이름으로 채운다 */
export function useSideGroups(id: (typeof NAV)[number]['id']): NavGroup[] {
  const { settings } = useApp()
  const { groups: classes } = useGroups()
  const sec = NAV.find((s) => s.id === id)!
  return visibleGroups(sec, settings.features).map((g) =>
    g.id === 'classes' && classes && classes.length > 0
      ? { ...g, items: [...classes.map((c) => ({ to: `/groups/${c.id}`, label: c.name, icon: 'class' as const })), { to: '/groups', label: '수업반 관리', icon: 'settings' as const }] }
      : g,
  )
}
