import { useMemo, useState } from 'react'
import type { ClassGroup, Student } from '../../db/types'
import type { CheckItem } from '../../lib/checkBoard'
import { memberNo } from '../../lib/groups'
import { actionLabel, parseSay, type SayAction, type SayMember } from '../../lib/quickSay'

const OPEN_KEY = 'pe.quickSay.open'
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

interface Props {
  group: ClassGroup
  list: Student[]
  items: CheckItem[]
  readOnly: boolean
  /** 확인한 뒤 저장. 화면에 보여 줄 결과 글을 돌려준다 */
  onApply: (studentIds: string[], action: SayAction) => Promise<string>
}

/**
 * 빠른 입력 (2026-11-11): "3 7 체육복" · "12 견학 부상" · "5 지각"처럼 적으면 읽은 내용을 보여 주고,
 * [기록]을 눌러야 저장한다. 정해진 규칙으로만 읽는다(AI · 인터넷 없음). 기본은 접혀 있다.
 */
export function QuickSay({ group, list, items, readOnly, onApply }: Props) {
  const [open, setOpenState] = useState(readOpen)
  const [text, setText] = useState('')
  const [asked, setAsked] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const members: SayMember[] = useMemo(() => list.map((s) => ({ id: s.id, no: memberNo(group, s), name: s.name })), [group, list])
  const result = useMemo(() => (asked ? parseSay(asked, members, items) : null), [asked, members, items])

  const setOpen = (v: boolean) => {
    setOpenState(v)
    try {
      localStorage.setItem(OPEN_KEY, v ? '1' : '0')
    } catch {
      /* 무시 */
    }
  }
  const apply = async () => {
    if (!result?.ok || busy) return
    setBusy(true)
    try {
      setDone(
        await onApply(
          result.students.map((s) => s.id),
          result.action,
        ),
      )
      setText('')
      setAsked('')
    } finally {
      setBusy(false)
    }
  }

  if (readOnly) return null
  if (!open)
    return (
      <button type="button" className="block px-1 text-sm font-bold text-brand" onClick={() => setOpen(true)}>
        빠른 입력 열기 — “3 7 체육복”처럼 적어서 기록 ›
      </button>
    )
  return (
    <section className="card space-y-2" aria-label="빠른 입력">
      <div className="flex items-center gap-2">
        <p className="card-title flex-1">빠른 입력</p>
        <button type="button" className="text-sm font-bold text-ink-3" onClick={() => setOpen(false)}>
          접기
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setDone('')
          setAsked(text.trim())
        }}
      >
        <input className="field min-h-[48px] flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 3 7 체육복 · 12 견학 부상 · 5 지각" aria-label="빠른 입력 글" enterKeyHint="done" />
        <button type="submit" className="btn btn-soft px-4" disabled={!text.trim()}>
          읽기
        </button>
      </form>
      {result && !result.ok && (
        <p className="rounded-xl bg-danger-light px-3 py-2 text-sm font-bold text-danger" role="alert">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <div className="space-y-2 rounded-2xl bg-brand-light p-3">
          <p className="font-extrabold text-brand">{actionLabel(result.action)}</p>
          <p className="leading-relaxed font-bold">{result.students.map((s) => `${s.no} ${s.name}`).join(' · ')}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline flex-1" onClick={() => setAsked('')}>
              취소
            </button>
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void apply()}>
              {result.students.length}명 기록
            </button>
          </div>
        </div>
      )}
      {done && <p className="text-sm font-bold text-ok">{done}</p>}
      {!result && !done && <p className="hint">학생 번호(또는 이름) 여러 개 + 할 일 하나. 항목 이름 · 견학(부상 · 생리 · 질병) · 결석 · 지각 · 조퇴 · 결과. 읽은 내용을 확인한 뒤 저장해요.</p>}
    </section>
  )
}
