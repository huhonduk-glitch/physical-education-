import { useState, type ReactNode } from 'react'
import Icon from './Icon'

const KEY = 'pelog.tipsSeen'
const seenList = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/**
 * 화면별 첫 방문 안내 (2026-11-26, 슈퍼스쿨 화면마다 '이렇게 사용해 보세요' 카드 참고 — 문구 · 코드는 새로 씀).
 * 처음 한 번만 화면 위에 보이고 [알겠어요]를 누르면 다시 안 보인다(이 기기 기억). 떠 있는 창이 아니라 땅콩이를 가리지 않는다.
 * manual = 웹 설명서 절 id (#class · #paps · #eval · #seteuk …)
 */
export default function FirstTip({ id, manual, children }: { id: string; manual?: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(() => seenList().includes(id))
  if (hidden) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...new Set([...seenList(), id])]))
    } catch {
      /* 저장이 막힌 브라우저: 이번만 */
    }
    setHidden(true)
  }
  return (
    <aside className="anim-pop flex gap-3 rounded-2xl bg-brand-light px-4 py-3 text-[0.94rem]" aria-label="이렇게 써 보세요">
      <span aria-hidden className="text-lg leading-6">💡</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <b className="block text-brand">이렇게 써 보세요</b>
        <div className="leading-relaxed text-ink-2">{children}</div>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          {manual && (
            <a href={`${import.meta.env.BASE_URL}manual/#${manual}`} target="_blank" rel="noopener" className="text-sm font-bold text-brand underline">
              설명서에서 자세히
            </a>
          )}
          <button type="button" className="text-sm font-bold text-ink-3" onClick={close}>
            알겠어요 · 다시 안 보기
          </button>
        </div>
      </div>
      <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/60" aria-label="안내 닫기" onClick={close}>
        <Icon name="close" size={16} />
      </button>
    </aside>
  )
}
