import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/db'

/** 세특 키워드 태그 고르기. 기본은 접혀 있어 빠른 기록을 방해하지 않는다. */
export default function KeywordPicker({ value, onChange, defaultOpen = false }: { value: string[]; onChange: (ids: string[]) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const keywords = useLiveQuery(() => db.keywords.orderBy('sortOrder').filter((k) => k.isActive).toArray(), [])
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const byCat = new Map<string, typeof keywords>()
  for (const k of keywords ?? []) byCat.set(k.category, [...(byCat.get(k.category) ?? []), k])

  return (
    <div>
      <button type="button" className="btn btn-ghost -ml-2 px-2 text-brand" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        🏷️ 세특 키워드 {value.length > 0 ? `${value.length}개 선택` : '붙이기'} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          {[...byCat.entries()].map(([cat, list]) => (
            <div key={cat}>
              <p className="hint mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {list!.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={value.includes(k.id)}
                    className={`min-h-[40px] rounded-full border-2 px-3 text-[0.9rem] font-bold ${
                      value.includes(k.id) ? 'border-brand bg-brand text-white' : 'border-zinc-300 bg-white text-zinc-800'
                    }`}
                    onClick={() => toggle(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
