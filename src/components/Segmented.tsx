/**
 * 보기 고르기 (2026-11-12): [일간 | 월간]처럼 둘 · 셋 가운데 하나. 회색 바탕 위 흰 알약.
 */
export default function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-2xl bg-fill-2 p-1" role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`min-h-[40px] min-w-[4.5rem] rounded-xl px-4 text-[0.95rem] font-extrabold transition-colors ${on ? 'bg-white text-brand shadow-[var(--shadow-card)]' : 'text-ink-3'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
