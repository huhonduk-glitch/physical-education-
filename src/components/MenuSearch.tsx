import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { menuEntries, searchMenu, type MenuEntry } from '../lib/menuSearch'
import { visibleSections } from '../lib/nav'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'
import Icon from './Icon'

/** 어디서든 메뉴 찾기 창을 연다 (홈 돋보기 · PC 위 메뉴 · Ctrl+K) */
export const MENU_SEARCH_EVENT = 'pelog:menu-search'
export const openMenuSearch = () => window.dispatchEvent(new Event(MENU_SEARCH_EVENT))

/**
 * 메뉴 찾기 (2026-11-25, 슈퍼스쿨 '전체 메뉴' 참고 — 코드는 새로 씀).
 * 빈칸이면 큰 메뉴별 전체 목록(한 줄 설명), 적으면 이름 · 비슷한 말 · 설명으로 찾는다. 내 수업반 이름도 찾는다.
 */
export default function MenuSearch({ onClose }: { onClose: () => void }) {
  const { settings } = useApp()
  const { groups } = useGroups()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const entries = useMemo<MenuEntry[]>(
    () => [
      ...(groups ?? []).map((g) => ({ to: `/groups/${g.id}`, label: g.name, desc: g.subject ? `${g.subject} 수업반` : '수업반', icon: 'class', where: '수업 › 내 수업반', section: '수업' })),
      ...menuEntries(visibleSections(settings.features), settings.features),
    ],
    [groups, settings.features],
  )
  const hits = searchMenu(entries, q)
  const go = (to: string) => {
    onClose()
    nav(to)
  }

  useEffect(() => {
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // 빈칸: 큰 메뉴별로 전부 (반 이름은 빼고 — 너무 길어져서)
  const bySection = useMemo(() => {
    const m = new Map<string, MenuEntry[]>()
    for (const e of entries.slice((groups ?? []).length)) m.set(e.section, [...(m.get(e.section) ?? []), e])
    return [...m.entries()]
  }, [entries, groups])

  const row = (e: MenuEntry) => (
    <li key={e.to}>
      <button type="button" className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-fill active:bg-fill-2" onClick={() => go(e.to)}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
          <Icon name={e.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate">{e.label}</b>
          {e.desc && <span className="block truncate text-[0.84rem] text-ink-3">{e.desc}</span>}
        </span>
        <span className="hidden shrink-0 text-[0.78rem] font-semibold text-ink-3 sm:block">{e.where}</span>
      </button>
    </li>
  )

  return (
    <div className="fixed inset-0 z-[80] flex justify-center md:items-start md:pt-[10vh]" role="dialog" aria-modal="true" aria-label="메뉴 찾기">
      <button type="button" aria-label="닫기" className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="anim-pop relative flex h-full w-full flex-col bg-white pt-[env(safe-area-inset-top)] md:h-auto md:max-h-[78vh] md:max-w-2xl md:rounded-3xl md:shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Icon name="search" className="shrink-0 text-ink-3" />
          <input
            ref={input}
            className="min-h-[52px] min-w-0 flex-1 bg-transparent text-[1.1rem] font-semibold outline-none"
            value={q}
            placeholder="메뉴 찾기 — 예: 출결, 세특, 팀, 1학년 1반"
            aria-label="메뉴 찾기"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) go(hits[0].to)
            }}
          />
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-fill" aria-label="닫기" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {q.trim() ? (
            hits.length ? (
              <ul aria-label="찾은 메뉴">{hits.map(row)}</ul>
            ) : (
              <p className="px-3 py-8 text-center text-ink-3">
                &lsquo;{q.trim()}&rsquo;에 맞는 메뉴가 없어요. 오른쪽 아래 땅콩이에게 물어보세요.
              </p>
            )
          ) : (
            bySection.map(([sec, list]) => (
              <section key={sec} className="mb-2">
                <h2 className="px-3 pt-2 pb-1 text-sm font-extrabold text-ink-3">{sec}</h2>
                <ul>{list.map(row)}</ul>
              </section>
            ))
          )}
        </div>
        <p className="hidden border-t border-line px-4 py-2 text-[0.8rem] text-ink-3 md:block">Enter = 맨 위 메뉴 열기 · Esc = 닫기 · 어디서든 Ctrl + K</p>
      </div>
    </div>
  )
}
