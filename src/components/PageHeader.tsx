import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex min-h-[60px] items-center gap-2 border-b-2 border-zinc-200 bg-white px-2 pt-[env(safe-area-inset-top)]">
      {back && (
        <button type="button" className="btn btn-ghost px-2 text-2xl" aria-label="뒤로" onClick={() => navigate(-1)}>
          ‹
        </button>
      )}
      <h1 className={`flex-1 text-xl font-extrabold ${back ? '' : 'pl-2'}`}>{title}</h1>
      {right}
    </header>
  )
}
