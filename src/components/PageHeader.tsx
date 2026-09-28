import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/** 화면 제목 줄. 스크롤해도 위에 붙어 있고, 뒤 배경이 살짝 비친다. */
export default function PageHeader({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="page flex min-h-[64px] items-center gap-1 px-2">
        {back && (
          <button type="button" className="btn btn-ghost -ml-1 px-2" aria-label="뒤로" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className={`min-w-0 flex-1 ${back ? '' : 'pl-2'}`}>
          <h1 className="truncate text-[1.4rem] leading-tight font-extrabold tracking-tight">{title}</h1>
          {sub && <p className="truncate text-sm font-semibold text-ink-3">{sub}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2 pr-1">{right}</div>}
      </div>
    </header>
  )
}
