import { useEffect, useState } from 'react'

/** 기록 직후 5초 동안 뜨는 되돌리기 알림 (CLAUDE.md 4-2) */
export default function UndoToast({ message, onUndo, onDone, seconds = 5 }: { message: string; onUndo: () => void; onDone: () => void; seconds?: number }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const started = Date.now()
    const t = setInterval(() => {
      const l = seconds - Math.floor((Date.now() - started) / 1000)
      if (l <= 0) {
        clearInterval(t)
        onDone()
      } else setLeft(l)
    }, 200)
    return () => clearInterval(t)
  }, [seconds, onDone])

  return (
    <div
      role="status"
      className="anim-pop fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink px-4 py-2 text-white shadow-[var(--shadow-float)] lg:bottom-6 lg:left-64"
    >
      <p className="flex-1 font-bold">{message}</p>
      <button type="button" className="btn min-h-[44px] bg-white/15 text-white" onClick={onUndo}>
        되돌리기 ({left})
      </button>
    </div>
  )
}
