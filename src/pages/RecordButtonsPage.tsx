import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { DEFAULT_RECORD_BUTTONS, type RecordButtons } from '../db/settings'
import { useApp } from '../state/AppContext'

const GROUPS: { key: keyof RecordButtons; title: string }[] = [
  { key: 'unprepared', title: '❗ 준비물 미준비' },
  { key: 'exemplary', title: '⭐ 솔선수범' },
  { key: 'captain', title: '체육부장 활동' },
]

/** 기록 버튼 항목 편집: 추가 · 이름 바꾸기 · 순서 바꾸기 · 빼기 (CLAUDE.md 4-2, 4-12) */
export default function RecordButtonsPage() {
  const { settings, updateSettings } = useApp()
  const buttons = settings.recordButtons
  const save = (key: keyof RecordButtons, list: string[]) => updateSettings({ recordButtons: { ...buttons, [key]: list } })

  return (
    <>
      <PageHeader title="기록 버튼 편집" back />
      <div className="page space-y-4 py-4">
        <p className="hint">이미 저장한 기록은 바뀌지 않아요. 이름이 &lsquo;기타&rsquo;인 버튼은 누르면 메모를 받아요.</p>
        {GROUPS.map((g) => (
          <Group key={g.key} title={g.title} list={buttons[g.key]} onChange={(l) => save(g.key, l)} onReset={() => save(g.key, [...DEFAULT_RECORD_BUTTONS[g.key]])} />
        ))}
      </div>
    </>
  )
}

function Group({ title, list, onChange, onReset }: { title: string; list: string[]; onChange: (l: string[]) => void; onReset: () => void }) {
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState<{ i: number; text: string } | null>(null)
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const l = [...list]
    ;[l[i], l[j]] = [l[j], l[i]]
    onChange(l)
  }
  const add = () => {
    const t = adding.trim()
    if (!t || list.includes(t)) return
    onChange([...list, t])
    setAdding('')
  }

  return (
    <section className="card space-y-2">
      <div className="flex items-center">
        <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
        <button type="button" className="btn btn-ghost px-2 text-sm text-zinc-600" onClick={() => confirm('처음 버튼으로 되돌릴까요?') && onReset()}>
          처음대로
        </button>
      </div>
      <ul className="space-y-1">
        {list.map((b, i) => (
          <li key={b} className="flex items-center gap-1">
            {editing?.i === i ? (
              <>
                <input className="field flex-1" autoFocus value={editing.text} onChange={(e) => setEditing({ i, text: e.target.value })} aria-label="버튼 이름" />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!editing.text.trim() || list.some((x, k) => k !== i && x === editing.text.trim())}
                  onClick={() => {
                    const l = [...list]
                    l[i] = editing.text.trim()
                    onChange(l)
                    setEditing(null)
                  }}
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <span className="min-h-[48px] flex-1 content-center rounded-lg bg-zinc-50 px-3 font-bold">{b}</span>
                <button type="button" className="btn btn-ghost px-2" aria-label={`${b} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ▲
                </button>
                <button type="button" className="btn btn-ghost px-2" aria-label={`${b} 아래로`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  ▼
                </button>
                <button type="button" className="btn btn-ghost px-2" aria-label={`${b} 이름 바꾸기`} onClick={() => setEditing({ i, text: b })}>
                  ✏️
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2"
                  aria-label={`${b} 빼기`}
                  disabled={list.length <= 1}
                  onClick={() => confirm(`'${b}' 버튼을 뺄까요?`) && onChange(list.filter((_, k) => k !== i))}
                >
                  🗑️
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className="field flex-1" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="새 버튼 이름" aria-label="새 버튼 이름" />
        <button type="button" className="btn btn-primary" disabled={!adding.trim() || list.includes(adding.trim())} onClick={add}>
          추가
        </button>
      </div>
    </section>
  )
}
