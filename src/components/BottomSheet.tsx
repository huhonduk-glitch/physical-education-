import { useEffect, type ReactNode } from 'react'

/** 화면 아래에서 올라오는 창. 폰에서 엄지로 누르기 쉬운 위치에 버튼을 모은다. PC에서는 가운데 창처럼 보인다. */
export default function BottomSheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl lg:rounded-2xl">
        <div className="flex items-center gap-2 border-b-2 border-zinc-200 px-4 py-2">
          <div className="flex-1 text-lg font-extrabold">{title}</div>
          <button type="button" className="btn btn-ghost px-3 text-2xl" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
