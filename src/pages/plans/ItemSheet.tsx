import { useMemo, useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import Icon from '../../components/Icon'
import type { PlanItem } from '../../db/types'
import { findStandards, STANDARDS } from '../../lib/standards'

const norm = (s: string) => s.replace(/\s+/g, '')

/** 이 과목의 성취기준 (과목 이름 띄어쓰기 무시) */
export function subjectStandards(subject: string, school: string) {
  const s = STANDARDS.subjects.find((x) => x.school === school && norm(x.subject) === norm(subject))
  return s ? findStandards(STANDARDS, { school, subject: s.subject }) : []
}

export const METHOD_CHOICES = ['강의식', '시범·연습', '모둠별', '협동학습', '탐구학습', '게임·경기', '실기평가', '프로젝트']

/** 차시 하나 고치기 */
export default function ItemSheet({
  item,
  no,
  subject,
  school,
  units,
  readOnly,
  onSave,
  onClose,
  onMove,
  onInsertAfter,
  onDelete,
}: {
  item: PlanItem
  no: number
  subject: string
  school: string
  units: string[]
  readOnly: boolean
  onSave: (it: PlanItem) => void
  onClose: () => void
  onMove: (dir: -1 | 1) => void
  onInsertAfter: () => void
  onDelete: () => void
}) {
  const [f, setF] = useState<PlanItem>(item)
  const [code, setCode] = useState('')
  const stds = useMemo(() => subjectStandards(subject, school), [subject, school])
  const toggleStd = (c: string) => setF((cur) => ({ ...cur, standards: cur.standards.includes(c) ? cur.standards.filter((x) => x !== c) : [...cur.standards, c] }))
  const save = () => {
    onSave({ ...f, unit: f.unit.trim(), content: f.content.trim(), method: f.method?.trim() || undefined, evalNote: f.evalNote?.trim() || undefined, lockedDate: f.lockedDate || undefined })
    onClose()
  }

  return (
    <BottomSheet title={`${no}차시`} sub={item.unit || '단원 없음'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="label">단원</span>
          <input className="field" list="plan-units" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} disabled={readOnly} placeholder="예: 배드민턴 이해하기" />
          <datalist id="plan-units">
            {units.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">학습 내용 · 활동</span>
          <textarea className="field min-h-[80px] py-3" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} disabled={readOnly} placeholder="예: 하이클리어 시범 → 2인 1조 연습 → 랠리 게임" />
        </label>

        <div>
          <span className="label">성취기준</span>
          {stds.length > 0 ? (
            <div className="space-y-1.5">
              {stds.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${f.standards.includes(s.code) ? 'bg-brand-light ring-2 ring-brand' : 'bg-fill'}`}
                  onClick={() => toggleStd(s.code)}
                  disabled={readOnly}
                  aria-pressed={f.standards.includes(s.code)}
                >
                  <b className="tabular-nums">{s.code}</b> {s.text}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">진도표 설정의 과목 이름이 성취기준 목록과 맞지 않아요. 코드를 직접 넣어도 돼요.</p>
          )}
          <div className="mt-2 flex gap-2">
            <input className="field flex-1" value={code} placeholder="[12스생2-01-01]" onChange={(e) => setCode(e.target.value)} disabled={readOnly} />
            <button
              type="button"
              className="btn btn-soft"
              disabled={readOnly || !code.trim()}
              onClick={() => {
                const c = code.trim()
                if (!f.standards.includes(c)) setF({ ...f, standards: [...f.standards, c] })
                setCode('')
              }}
            >
              <Icon name="plus" />
            </button>
          </div>
          {f.standards.filter((c) => !stds.some((s) => s.code === c)).map((c) => (
            <button key={c} type="button" className="badge mt-2 mr-1 bg-fill text-ink-2" onClick={() => toggleStd(c)} disabled={readOnly}>
              {c} ✕
            </button>
          ))}
        </div>

        <div>
          <span className="label">수업 방법</span>
          <div className="flex flex-wrap gap-1.5">
            {METHOD_CHOICES.map((m) => (
              <button key={m} type="button" className="chip min-h-[40px] px-3 text-sm" aria-pressed={f.method === m} onClick={() => setF({ ...f, method: f.method === m ? undefined : m })} disabled={readOnly}>
                {m}
              </button>
            ))}
          </div>
          <input className="field mt-2" value={f.method ?? ''} placeholder="직접 적기" onChange={(e) => setF({ ...f, method: e.target.value })} disabled={readOnly} />
        </div>
        <label className="block">
          <span className="label">평가 연계 · 메모</span>
          <input className="field" value={f.evalNote ?? ''} onChange={(e) => setF({ ...f, evalNote: e.target.value })} disabled={readOnly} placeholder="예: 스트로크 실기평가 1회차" />
        </label>
        <label className="block">
          <span className="label">이 날짜에 고정 (평가일 등, 밀기를 해도 안 움직임)</span>
          <input className="field" type="date" value={f.lockedDate ?? ''} onChange={(e) => setF({ ...f, lockedDate: e.target.value || undefined })} disabled={readOnly} />
        </label>

        {!readOnly && (
          <>
            <button type="button" className="btn btn-primary w-full" onClick={save}>
              저장
            </button>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" className="btn btn-soft" onClick={() => onMove(-1)} aria-label="앞으로">
                <Icon name="up" />
              </button>
              <button type="button" className="btn btn-soft" onClick={() => onMove(1)} aria-label="뒤로">
                <Icon name="down" />
              </button>
              <button type="button" className="btn btn-soft" onClick={onInsertAfter} aria-label="아래에 차시 더하기">
                <Icon name="plus" />
              </button>
              <button type="button" className="btn btn-danger-soft" onClick={onDelete} aria-label="이 차시 지우기">
                <Icon name="trash" />
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
