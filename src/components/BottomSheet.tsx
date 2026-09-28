import { useEffect, type ReactNode } from 'react'
import Icon from './Icon'

/** 화면 아래에서 올라오는 창. 폰에서 엄지로 누르기 쉬운 위치에 버튼을 모은다. PC에서는 가운데 창으로 보인다. */
export default function BottomSheet({ title, sub, onClose, children }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode }) {
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="anim-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-float)] lg:anim-pop lg:rounded-[28px]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-fill-2 lg:hidden" aria-hidden />
        <div className="flex items-start gap-2 px-5 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <div className="text-[1.3rem] font-extrabold tracking-tight">{title}</div>
            {sub && <div className="hint">{sub}</div>}
          </div>
          <button type="button" className="btn btn-soft h-11 min-h-0 w-11 rounded-full p-0" aria-label="닫기" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
      </div>
    </div>
  )
}
