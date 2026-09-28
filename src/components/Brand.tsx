import logo from '../assets/deok-tt-logo.png'

/** 앱 이름 (SPORTS BRACKET · K-TacticBoard Studio와 같은 DEOK TT 브랜드) */
export const APP_NAME = 'PE LOG'
export const APP_SUB = '체육수업 누가기록'
export const MAKER = 'DEOK TT'

export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt={`${MAKER} 로고`}
      width={size}
      height={size}
      className={`shrink-0 rounded-[28%] shadow-[0_6px_16px_rgb(2_21_54/0.25)] ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/** 로고 + 앱 이름 한 줄 */
export function BrandLine({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="leading-tight">
        <span className="block text-[1.1rem] font-black tracking-[0.04em] text-ink">{APP_NAME}</span>
        <span className="block text-[0.72rem] font-bold text-ink-3">{APP_SUB}</span>
      </span>
    </span>
  )
}

/** 화면 아래쪽 제작자 표시 */
export function MakerCredit({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 text-center ${className}`}>
      <Logo size={36} className="shadow-none" />
      <p className="text-[0.78rem] font-semibold text-ink-3">만든 사람</p>
      <p className="text-[0.95rem] font-black tracking-[0.12em] text-ink">{MAKER}</p>
      <p className="text-[0.75rem] text-ink-3">
        {APP_NAME} · {APP_SUB} ⓒ 2026 {MAKER}
      </p>
    </div>
  )
}
