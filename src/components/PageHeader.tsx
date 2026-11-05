import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrumb } from './BottomNav'

/** 화면 제목 줄. 스크롤해도 위에 붙어 있고, 뒤 배경이 살짝 비친다. */
export default function PageHeader({ title, sub, back, right, wide }: { title: ReactNode; sub?: ReactNode; back?: boolean; right?: ReactNode; wide?: boolean | 'xl' }) {
  const navigate = useNavigate()
  // PC: 제목 위 위치 표시 (‘수업 › 종목 수업자료’). 마지막이 제목과 같으면 큰 메뉴만
  const crumb = useCrumb()
  const trail = crumb.length > 0 && crumb[crumb.length - 1] === title ? crumb.slice(0, -1) : crumb
  return (
    <header className="print:hidden sticky top-0 z-20 lg:top-14 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className={`page flex min-h-[64px] items-center gap-1 px-2 ${wide === 'xl' ? 'lg:max-w-[72rem]' : wide ? 'lg:max-w-[64rem]' : ''}`}>
        {back && (
          <button type="button" className="btn btn-ghost -ml-1 px-2" aria-label="뒤로" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className={`min-w-0 flex-1 ${back ? '' : 'pl-2'}`}>
          {trail.length > 0 && <p className="hidden truncate text-xs font-bold text-ink-3 lg:block">{trail.join(" › ")}</p>}
          <h1 className="truncate text-[1.4rem] leading-tight font-extrabold tracking-tight">{title}</h1>
          {sub && <p className="truncate text-sm font-semibold text-ink-3">{sub}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2 pr-1">{right}</div>}
      </div>
    </header>
  )
}
