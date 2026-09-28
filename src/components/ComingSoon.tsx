import type { ReactNode } from 'react'

/** 아직 만들지 않은 화면 자리. 몇 번째 단계에서 만드는지 알려 준다. */
export default function ComingSoon({ phase, items, children }: { phase: number; items: string[]; children?: ReactNode }) {
  return (
    <div className="p-4">
      <div className="card border-dashed">
        <p className="text-lg font-bold">{phase}단계에서 만들어요</p>
        <ul className="mt-2 list-disc pl-6 text-zinc-800">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  )
}
