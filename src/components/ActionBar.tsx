import type { ReactNode } from 'react'

/**
 * 화면 아래에 붙는 "다음 / 저장" 버튼 줄. 내용이 길어도 스크롤 끝까지 내리지 않고 엄지로 바로 누른다.
 * - 기본: 하단 탭 바로 위에 붙는다 (넓은 화면에서는 탭이 왼쪽으로 가므로 맨 아래)
 * - edge: 하단 탭이 없는 화면(처음 이용 안내·PIN 설정)에서 화면 맨 아래
 * 문서 흐름 안에 있는 sticky라서 마지막 내용을 가리지 않는다.
 */
export default function ActionBar({ edge = false, children }: { edge?: boolean; children: ReactNode }) {
  return (
    <div
      className={`sticky z-20 -mx-1 mt-4 print:hidden ${
        edge ? 'bottom-0 pb-[env(safe-area-inset-bottom)]' : 'bottom-[calc(62px+env(safe-area-inset-bottom))] lg:bottom-0'
      }`}
    >
      <div className={`space-y-2 rounded-t-3xl border-t border-line bg-white/95 px-4 pt-3 pb-3 shadow-[var(--shadow-float)] backdrop-blur-md ${edge ? 'mx-auto max-w-md' : ''}`}>
        {children}
      </div>
    </div>
  )
}
