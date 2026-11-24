import { useState } from 'react'
import type { HomeMemo } from '../../db/settings'
import { MEMO_TONES, memoTone, removeMemo, saveMemo, splitMemo } from '../../lib/memo'
import { useApp } from '../../state/AppContext'
import BottomSheet from '../BottomSheet'
import Icon from '../Icon'

const HIDE_KEY = 'pelog.memoHidden'
const readHidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `memo-${Date.now()}`)
const dateText = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 홈 메모 (2026-11-25, 슈퍼스쿨 홈 메모 참고 — 문구 · 코드는 새로 씀): 수업 · 업무 중 떠오른 일을 색 메모로.
 * 이 기기에 저장(백업 · 구글 동기화에 함께). 홈은 학생이 볼 수도 있어서 [가리기]로 내용을 가린다(이 기기만 기억).
 */
export default function MemoCard() {
  const { settings, updateSettings } = useApp()
  const memos = settings.homeMemos ?? []
  const [hidden, setHidden] = useState(readHidden)
  const [edit, setEdit] = useState<{ id: string; text: string; tone: number; isNew: boolean } | null>(null)

  const toggleHidden = () => {
    const next = !hidden
    setHidden(next)
    try {
      localStorage.setItem(HIDE_KEY, next ? '1' : '0')
    } catch {
      /* 저장이 막힌 브라우저: 이번만 */
    }
  }
  const open = (m?: HomeMemo) => setEdit(m ? { id: m.id, text: m.text, tone: m.tone, isNew: false } : { id: newId(), text: '', tone: 0, isNew: true })

  return (
    <section className="space-y-2" aria-label="메모">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[1.05rem] font-extrabold">메모{memos.length > 0 && <span className="ml-1 text-ink-3">{memos.length}</span>}</h2>
        <div className="flex items-center gap-1">
          {memos.length > 0 && (
            <button type="button" className="flex min-h-[40px] items-center gap-1 rounded-full px-2.5 text-sm font-bold text-ink-3 hover:bg-fill" aria-pressed={hidden} onClick={toggleHidden}>
              <Icon name="eye" size={16} /> {hidden ? '보이기' : '가리기'}
            </button>
          )}
          <button type="button" className="flex min-h-[40px] items-center gap-1 rounded-full px-2.5 text-sm font-bold text-brand hover:bg-brand-light" onClick={() => open()}>
            <Icon name="plus" size={16} /> 새 메모
          </button>
        </div>
      </div>
      {memos.length === 0 ? (
        <button type="button" className="card flex min-h-[56px] w-full items-center gap-3 text-left" onClick={() => open()}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff4d6] text-[#8a5a00]">
            <Icon name="note" size={18} />
          </span>
          <span className="hint flex-1">수업 · 업무 중 떠오른 일을 적어 두세요</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
          {memos.map((m) => {
            const t = memoTone(m.tone)
            const { title, body } = splitMemo(m.text)
            return (
              <button
                key={m.id}
                type="button"
                className="flex min-h-[112px] flex-col gap-1 rounded-2xl p-3.5 text-left transition-transform active:scale-[0.98]"
                style={{ background: t.bg }}
                onClick={() => open(m)}
                aria-label={hidden ? `가려 둔 메모 (${dateText(m.updatedAt)})` : `메모: ${title}`}
              >
                <span className="flex items-start gap-1.5">
                  <i className="mt-[0.45rem] h-2 w-2 shrink-0 rounded-full" style={{ background: t.fg }} aria-hidden />
                  <b className={`line-clamp-2 min-w-0 flex-1 leading-snug ${hidden ? 'blur-[5px] select-none' : ''}`}>{title}</b>
                </span>
                {body && <span className={`line-clamp-3 text-[0.86rem] leading-snug whitespace-pre-line text-ink-2 ${hidden ? 'blur-[5px] select-none' : ''}`}>{body}</span>}
                <span className="mt-auto text-[0.76rem] font-semibold tabular-nums text-ink-3">{dateText(m.updatedAt)}</span>
              </button>
            )
          })}
        </div>
      )}
      {edit && <MemoSheet edit={edit} onClose={() => setEdit(null)} onSave={(e) => void updateSettings({ homeMemos: saveMemo(memos, e, Date.now()) }).then(() => setEdit(null))} onRemove={(id) => void updateSettings({ homeMemos: removeMemo(memos, id) }).then(() => setEdit(null))} />}
    </section>
  )
}

function MemoSheet({
  edit,
  onClose,
  onSave,
  onRemove,
}: {
  edit: { id: string; text: string; tone: number; isNew: boolean }
  onClose: () => void
  onSave: (m: { id: string; text: string; tone: number }) => void
  onRemove: (id: string) => void
}) {
  const [text, setText] = useState(edit.text)
  const [tone, setTone] = useState(edit.tone)
  const [sure, setSure] = useState(false)
  return (
    <BottomSheet title={edit.isNew ? '새 메모' : '메모 고치기'} sub="첫 줄이 제목이 돼요" onClose={onClose}>
      <div className="space-y-3">
        <textarea
          className="field min-h-[160px] w-full resize-y py-3 leading-relaxed"
          style={{ background: memoTone(tone).bg }}
          value={text}
          autoFocus
          placeholder={'예: 체육대회 물품 확인\n줄넘기 30개 · 조끼 4색'}
          aria-label="메모 내용"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2" role="radiogroup" aria-label="메모 색">
          {MEMO_TONES.map((t, i) => (
            <button
              key={t.name}
              type="button"
              role="radio"
              aria-checked={tone === i}
              aria-label={t.name}
              className={`grid h-11 w-11 place-items-center rounded-full border-2 ${tone === i ? 'border-ink' : 'border-transparent'}`}
              style={{ background: t.bg }}
              onClick={() => setTone(i)}
            >
              <i className="h-3 w-3 rounded-full" style={{ background: t.fg }} aria-hidden />
            </button>
          ))}
        </div>
        <p className="hint">홈은 학생이 볼 수도 있어요. 학생 이름 같은 개인정보는 되도록 적지 말고, 필요하면 [가리기]를 눌러 두세요.</p>
        <div className="flex gap-2">
          {!edit.isNew && (
            <button type="button" className={`btn flex-1 ${sure ? 'btn-danger' : 'btn-danger-soft'}`} onClick={() => (sure ? onRemove(edit.id) : setSure(true))}>
              <Icon name="trash" size={18} /> {sure ? '한 번 더 누르면 지워요' : '지우기'}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" disabled={!text.trim() && edit.isNew} onClick={() => onSave({ id: edit.id, text, tone })}>
            저장
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
