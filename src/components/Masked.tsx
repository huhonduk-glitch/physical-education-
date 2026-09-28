import { useState } from 'react'

/** 건강 정보(견학 사유)는 기본으로 가리고, 눌러야 보인다 (CLAUDE.md 4-6) */
export default function Masked({ text, label = '사유 보기' }: { text: string; label?: string }) {
  const [show, setShow] = useState(false)
  return show ? (
    <button type="button" className="min-h-[40px] rounded-lg bg-fill px-2 text-left font-bold" onClick={() => setShow(false)}>
      {text}
    </button>
  ) : (
    <button type="button" className="min-h-[40px] rounded-lg bg-fill-2 px-3 text-sm font-bold text-ink-2" onClick={() => setShow(true)}>
      🔒 {label}
    </button>
  )
}
