import { useState, type ReactNode } from 'react'
import Icon from './Icon'

/**
 * 자주 안 쓰는 메뉴를 접어 두는 칸 (⋯ 더 보기 · 고급 설정).
 * 제목 줄 전체가 48px 이상 버튼이라 체육관에서 엄지로 누르기 쉽다.
 */
export default function Collapse({
  title,
  sub,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: ReactNode
  sub?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={className}>
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-2 rounded-2xl px-2 text-left text-ink-2 active:bg-fill-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1">
          <b className="block">{title}</b>
          {sub && <span className="hint block">{sub}</span>}
        </span>
        <Icon name="chevronRight" className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}
