import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import type { ClassGroup, Student } from '../../db/types'
import type { CheckItem } from '../../lib/checkBoard'
import { memberNo } from '../../lib/groups'

interface Props {
  group: ClassGroup
  list: Student[]
  items: CheckItem[]
  /** 학생 id → (항목 key → 개수) */
  counts: Map<string, Map<string, number>>
  absentIds: Set<string>
  readOnly: boolean
  onToggle: (s: Student, item: CheckItem) => void
}

const tone = (item: CheckItem, on: boolean) =>
  on ? (item.type === 'unprepared' ? 'bg-danger text-white' : 'bg-brand text-white') : item.type === 'unprepared' ? 'bg-danger-light text-danger' : 'bg-brand-light text-brand'

const ITEM_KEY = 'pe.checkItem'

/** 항목 체크: 항목을 하나 고르고 해당 학생 카드를 누른다 (다시 누르면 풀림). 폰에서 가장 빠른 방법 */
export function ItemCheckView({ group, list, items, counts, absentIds, readOnly, onToggle }: Props) {
  const [key, setKey] = useState<string>(() => {
    try {
      return localStorage.getItem(ITEM_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const item = items.find((i) => i.key === key) ?? items[0]
  useEffect(() => {
    try {
      if (item) localStorage.setItem(ITEM_KEY, item.key)
    } catch {
      /* 무시 */
    }
  }, [item])

  if (!item) return <NoItems />
  const checked = list.filter((s) => (counts.get(s.id)?.get(item.key) ?? 0) > 0)

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="체크 항목">
        {items.map((i) => {
          const n = list.filter((s) => (counts.get(s.id)?.get(i.key) ?? 0) > 0).length
          const on = i.key === item.key
          return (
            <button key={i.key} type="button" role="tab" aria-selected={on} className={`chip shrink-0 gap-1.5 ${on ? '' : ''}`} onClick={() => setKey(i.key)}>
              <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full text-xs font-black ${tone(i, false)}`}>
                {i.type === 'unprepared' ? '−' : '+'}
              </span>
              {i.label}
              {n > 0 && <span className={`badge ${tone(i, true)}`}>{n}</span>}
            </button>
          )
        })}
      </div>
      <p className={`rounded-2xl px-4 py-2.5 text-[0.95rem] font-bold ${tone(item, false)}`}>
        {item.type === 'unprepared' ? '지도' : '칭찬'} · <b>{item.label}</b> — 해당 학생을 누르세요 ({checked.length}명){' '}
        <span className="font-semibold opacity-80">다시 누르면 풀려요</span>
      </p>
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label={`${item.label} 체크`}>
        {list.map((s) => {
          const n = counts.get(s.id)?.get(item.key) ?? 0
          const absent = absentIds.has(s.id)
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={n > 0}
                aria-label={`${memberNo(group, s)}번 ${s.name} ${item.label}`}
                disabled={readOnly}
                onClick={() => onToggle(s, item)}
                className={`relative flex min-h-[66px] w-full flex-col items-center justify-center rounded-2xl px-0.5 pt-1.5 pb-1 transition-[transform,background-color] active:scale-95 ${
                  n > 0 ? tone(item, true) + ' shadow-[var(--shadow-card)]' : absent ? 'bg-fill-2 text-ink-3' : 'bg-white text-ink shadow-[var(--shadow-card)]'
                }`}
              >
                <span className={`leading-none font-extrabold tabular-nums ${group.kind === 'elective' ? 'text-[0.95rem]' : 'text-[1.3rem]'}`}>{memberNo(group, s)}</span>
                <span className="mt-1 w-full truncate text-center text-[0.74rem] leading-tight font-semibold">{s.name}</span>
                {n > 0 && (
                  <span className="absolute top-1 right-1" aria-hidden>
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                )}
                {n > 1 && <span className="absolute bottom-0.5 right-1 text-[0.65rem] font-black">×{n}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 표: 행은 학생, 열은 항목. 출석부처럼 한눈에 (PC·태블릿에서 편함) */
export function TableCheckView({ group, list, items, counts, absentIds, readOnly, onToggle }: Props) {
  if (items.length === 0) return <NoItems />
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-max min-w-full border-separate border-spacing-0 rounded-2xl bg-white text-center shadow-[var(--shadow-card)]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[92px] rounded-tl-2xl bg-white px-2 py-2 text-left text-sm text-ink-3">학생</th>
            {items.map((i) => (
              <th key={i.key} className={`min-w-[58px] px-1 py-2 text-[0.75rem] leading-tight font-bold ${i.type === 'unprepared' ? 'text-danger' : 'text-brand'}`}>
                <span className="block text-[0.65rem] opacity-70">{i.type === 'unprepared' ? '지도' : '칭찬'}</span>
                {i.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className={absentIds.has(s.id) ? 'text-ink-3' : ''}>
              <th className="sticky left-0 z-10 border-t border-line bg-white px-2 py-1 text-left text-sm font-semibold whitespace-nowrap">
                <span className="mr-1 font-extrabold tabular-nums">{memberNo(group, s)}</span>
                {s.name}
                {absentIds.has(s.id) && <span className="ml-1 text-xs">(견학)</span>}
              </th>
              {items.map((i) => {
                const n = counts.get(s.id)?.get(i.key) ?? 0
                return (
                  <td key={i.key} className="border-t border-line p-0.5">
                    <button
                      type="button"
                      aria-pressed={n > 0}
                      aria-label={`${memberNo(group, s)}번 ${s.name} ${i.label}`}
                      disabled={readOnly}
                      onClick={() => onToggle(s, i)}
                      className={`grid h-11 w-full min-w-[52px] place-items-center rounded-lg font-black transition-colors ${n > 0 ? tone(i, true) : 'hover:bg-fill'}`}
                    >
                      {n > 1 ? `×${n}` : n === 1 ? <Icon name="check" size={18} strokeWidth={3} /> : ''}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <th className="sticky left-0 z-10 rounded-bl-2xl border-t-2 border-line bg-white px-2 py-2 text-left text-sm text-ink-3">합계</th>
            {items.map((i) => (
              <td key={i.key} className={`border-t-2 border-line py-2 font-extrabold tabular-nums ${i.type === 'unprepared' ? 'text-danger' : 'text-brand'}`}>
                {list.filter((s) => (counts.get(s.id)?.get(i.key) ?? 0) > 0).length || ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function NoItems() {
  return (
    <div className="card space-y-2 text-center">
      <p className="font-extrabold">체크할 항목이 없어요</p>
      <Link to="/more/settings/buttons" className="btn btn-primary w-full">
        체크 항목 만들기
      </Link>
    </div>
  )
}
