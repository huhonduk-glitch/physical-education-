import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import type { PlanItem } from '../../db/types'
import { fitToTarget, newItemId } from '../../lib/progressPlan'

/**
 * 진도표 바로 입력: 차시마다 단원 · 내용 두 칸을 표처럼 적는다.
 * 칸을 벗어나면 저장, Enter는 다음 차시 내용 칸으로. 단원을 비워 두면 윗 차시 단원을 이어 쓴다.
 */
export default function DirectEdit({ items, target, readOnly, onSave }: { items: PlanItem[]; target: number; readOnly: boolean; onSave: (next: PlanItem[]) => void }) {
  const [rows, setRows] = useState(items)
  const dirty = useRef(false)
  const refs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [focusId, setFocusId] = useState<string | null>(null)

  // 다른 화면에서 바뀌면 다시 읽는다 (적는 중이 아닐 때만)
  useEffect(() => {
    if (!dirty.current) setRows(items)
  }, [items])
  useEffect(() => {
    if (focusId) refs.current.get(focusId)?.focus()
  }, [focusId, rows.length])

  const commit = (next = rows) => {
    // 비운 단원은 윗 차시 단원으로
    const filled = next.map((r, i, a) => (r.unit.trim() || i === 0 ? r : { ...r, unit: a.slice(0, i).reverse().find((x) => x.unit.trim())?.unit ?? '' }))
    dirty.current = false
    setRows(filled)
    onSave(filled)
  }
  const edit = (i: number, p: Partial<PlanItem>) => {
    dirty.current = true
    setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...p } : r)))
  }
  const add = () => {
    const last = rows[rows.length - 1]
    const it: PlanItem = { id: newItemId(), unit: last?.unit ?? '', content: '', standards: [...(last?.standards ?? [])] }
    commit([...rows, it])
    setFocusId(`c-${it.id}`)
  }
  const nextRow = (i: number) => {
    commit()
    if (i + 1 < rows.length) setFocusId(`c-${rows[i + 1].id}`)
    else add()
  }

  return (
    <section className="space-y-2">
      {rows.length < target && !readOnly && (
        <button type="button" className="btn btn-soft w-full" onClick={() => commit(fitToTarget(rows, target).items)}>
          <Icon name="plus" /> 빈 차시 {target - rows.length}개 만들어 목표 {target}차시 채우기
        </button>
      )}
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-[2.5rem_minmax(0,0.9fr)_minmax(0,1.4fr)] gap-2 bg-fill px-3 py-2 text-sm font-extrabold text-ink-2">
          <span className="text-center">차시</span>
          <span>단원</span>
          <span>학습 내용</span>
        </div>
        <ul>
          {rows.map((r, i) => {
            const prevUnit = rows.slice(0, i).reverse().find((x) => x.unit.trim())?.unit ?? ''
            return (
              <li key={r.id} className="grid grid-cols-[2.5rem_minmax(0,0.9fr)_minmax(0,1.4fr)] items-center gap-2 border-t border-line px-3 py-1.5">
                <span className="text-center font-extrabold text-ink-2 tabular-nums">{i + 1}</span>
                <input
                  ref={(el) => void (el ? refs.current.set(`u-${r.id}`, el) : refs.current.delete(`u-${r.id}`))}
                  className="field h-11 min-h-0 px-2 py-1 text-sm"
                  value={r.unit}
                  placeholder={prevUnit || '단원'}
                  list="direct-units"
                  onChange={(e) => edit(i, { unit: e.target.value })}
                  onBlur={() => dirty.current && commit()}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), refs.current.get(`c-${r.id}`)?.focus())}
                  disabled={readOnly}
                  aria-label={`${i + 1}차시 단원`}
                />
                <input
                  ref={(el) => void (el ? refs.current.set(`c-${r.id}`, el) : refs.current.delete(`c-${r.id}`))}
                  className="field h-11 min-h-0 px-2 py-1 text-sm"
                  value={r.content}
                  placeholder="예: 하이클리어 연습"
                  onChange={(e) => edit(i, { content: e.target.value })}
                  onBlur={() => dirty.current && commit()}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), nextRow(i))}
                  enterKeyHint="next"
                  disabled={readOnly}
                  aria-label={`${i + 1}차시 학습 내용`}
                />
              </li>
            )
          })}
        </ul>
        <datalist id="direct-units">
          {[...new Set(rows.map((r) => r.unit).filter(Boolean))].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      {!readOnly && (
        <button type="button" className="btn btn-soft w-full" onClick={add}>
          <Icon name="plus" /> 차시 더하기
        </button>
      )}
      <p className="hint px-1">칸을 벗어나면 저장돼요. 내용 칸에서 Enter를 누르면 다음 차시로 가요. 단원을 비워 두면 윗 차시 단원을 이어 써요. 성취기준·평가 연계는 [목록]에서 차시를 눌러 넣어요.</p>
    </section>
  )
}
