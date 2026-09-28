import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 border-b-2 border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
      {/* 제목 줄도 본문과 같은 너비로 맞춰 PC에서 제목과 내용이 한 줄로 정렬되게 한다 */}
      <div className="page flex min-h-[60px] items-center gap-2 px-2">
        {back && (
          <button type="button" className="btn btn-ghost px-2 text-2xl" aria-label="뒤로" onClick={() => navigate(-1)}>
            ‹
          </button>
        )}
        <h1 className={`flex-1 text-xl font-extrabold ${back ? '' : 'pl-2'}`}>{title}</h1>
        {right}
      </div>
    </header>
  )
}
