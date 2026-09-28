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
      className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-2 text-white shadow-xl lg:bottom-6 lg:left-64"
    >
      <p className="flex-1 font-bold">{message}</p>
      <button type="button" className="btn bg-white text-black" onClick={onUndo}>
        되돌리기 ({left})
      </button>
    </div>
  )
}
