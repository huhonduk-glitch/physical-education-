import type { ReactNode } from 'react'

/** 아직 만들지 않은 화면 자리 */
export default function ComingSoon({ phase, items, children }: { phase: number; items: string[]; children?: ReactNode }) {
  return (
    <div className="page py-4">
      <div className="card">
        <p className="card-title">{phase}단계에서 만들어요</p>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-ink-2">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  )
}
