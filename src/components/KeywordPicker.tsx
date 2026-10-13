import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Keyword } from '../db/types'

/**
 * 세특 키워드 태그 고르기. 기본은 접혀 있어 빠른 기록을 방해하지 않는다.
 * 키워드가 많아서(100개 넘음) 카테고리를 하나씩 보여 주고, 찾기 칸에 적으면 전체에서 찾는다.
 */
export default function KeywordPicker({ value, onChange, defaultOpen = false }: { value: string[]; onChange: (ids: string[]) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const keywords = useLiveQuery(() => db.keywords.orderBy('sortOrder').filter((k) => k.isActive).toArray(), [])
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const cats = useMemo(() => [...new Set((keywords ?? []).map((k) => k.category))], [keywords])
  const current = cats.includes(cat) ? cat : (cats[0] ?? '')
  const selected = (keywords ?? []).filter((k) => value.includes(k.id))
  const query = q.trim().replace(/\s+/g, '')
  const shown = (keywords ?? []).filter((k) => (query ? (k.label + k.category).replace(/\s+/g, '').includes(query) : k.category === current))
  const countIn = (c: string) => selected.filter((k) => k.category === c).length

  const chip = (k: Keyword) => (
    <button
      key={k.id}
      type="button"
      aria-pressed={value.includes(k.id)}
      className={`min-h-[40px] rounded-full border-2 px-3 text-[0.9rem] font-bold ${
        value.includes(k.id) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'
      }`}
      onClick={() => toggle(k.id)}
    >
      {k.label}
    </button>
  )

  return (
    <div>
      <button type="button" className="btn btn-ghost -ml-2 px-2 text-brand" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        🏷️ 세특 키워드 {value.length > 0 ? `${value.length}개 선택` : '붙이기'} {open ? '▴' : '▾'}
      </button>
      {!open && selected.length > 0 && <p className="hint">{selected.map((k) => k.label).join(' · ')}</p>}
      {open && (
        <div className="mt-1 space-y-2">
          {selected.length > 0 && (
            <div>
              <p className="hint mb-1">고른 키워드 (누르면 빠짐)</p>
              <div className="flex flex-wrap gap-1.5">{selected.map(chip)}</div>
            </div>
          )}
          <input className="field" type="search" placeholder="키워드 찾기 (예: 협동, 전략)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="키워드 찾기" />
          {!query && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="키워드 카테고리">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={c === current}
                  className={`min-h-[36px] shrink-0 rounded-lg px-3 text-sm font-bold ${c === current ? 'bg-ink text-white' : 'bg-fill-2 text-ink-2'}`}
                  onClick={() => setCat(c)}
                >
                  {c}
                  {countIn(c) > 0 && ` ${countIn(c)}`}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">{shown.map(chip)}</div>
          {query && shown.length === 0 && <p className="hint">'{q.trim()}' 키워드가 없어요. 더보기 → 세특 키워드 → 키워드 사전에서 더할 수 있어요.</p>}
        </div>
      )}
    </div>
  )
}
