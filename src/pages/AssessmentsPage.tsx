import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import type { Assessment, RubricItem } from '../db/types'
import { gradesFor } from '../lib/school'
import { useApp } from '../state/AppContext'

/** 수행평가 목록 + 만들기 (CLAUDE.md 4-8) */
export default function AssessmentsPage() {
  const { settings, readOnly } = useApp()
  const list = useLiveQuery(() => db.assessments.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const [editing, setEditing] = useState<Assessment | null>(null)
  const nav = useNavigate()
  const blank = (): Assessment => ({
    id: newId(),
    schoolYear: settings.schoolYear,
    title: '',
    grade: gradesFor(settings.schoolLevel)[0],
    rubric: [{ id: newId(), label: '', scale: 'AE' }],
    altTaskEnabled: true,
  })
  return (
    <>
      <PageHeader
        title="수행평가"
        back
        right={
          !editing && (
            <button type="button" className="btn btn-primary" disabled={readOnly} onClick={() => setEditing(blank())}>
              <Icon name="plus" /> 새 평가
            </button>
          )
        }
      />
      <div className="page space-y-4 pb-8">
        {editing ? (
          <Editor
            value={editing}
            onCancel={() => setEditing(null)}
            onSave={async (a) => {
              await db.assessments.put(a)
              setEditing(null)
              nav(`/more/assessments/${a.id}`)
            }}
          />
        ) : list && list.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-light text-brand">
              <Icon name="clipboard" size={28} />
            </span>
            <p className="card-title">아직 만든 평가가 없어요</p>
            <p className="hint">평가명, 대상 학년, 평가 요소, 척도(A~E 또는 점수)를 정해 채점표를 만들어요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list?.map((a) => (
              <li key={a.id} className="card flex items-center gap-3 p-4">
                <Link to={`/more/assessments/${a.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{a.title || '(이름 없음)'}</p>
                  <p className="hint">
                    {a.grade}학년 · 요소 {a.rubric.length}개 · {a.rubric.map((r) => r.label).join(', ')}
                  </p>
                </Link>
                <button type="button" className="btn btn-soft px-3" aria-label="평가 고치기" disabled={readOnly} onClick={() => setEditing(a)}>
                  <Icon name="edit" size={18} />
                </button>
                <Link to={`/more/assessments/${a.id}`} className="btn btn-outline">
                  채점
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function Editor({ value, onSave, onCancel }: { value: Assessment; onSave: (a: Assessment) => void; onCancel: () => void }) {
  const { settings } = useApp()
  const [a, setA] = useState(value)
  const setItem = (i: number, patch: Partial<RubricItem>) => setA({ ...a, rubric: a.rubric.map((r, k) => (k === i ? { ...r, ...patch } : r)) })
  const valid = a.title.trim() && a.rubric.length > 0 && a.rubric.every((r) => r.label.trim() && (r.scale === 'AE' || (r.maxScore ?? 0) > 0))
  return (
    <section className="card space-y-4">
      <p className="card-title">{value.title ? '평가 고치기' : '새 평가 만들기'}</p>
      <label className="block">
        <span className="label">평가명</span>
        <input className="field" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="예: 농구 레이업 슛" />
      </label>
      <div>
        <span className="label">대상 학년</span>
        <div className="segment">
          {gradesFor(settings.schoolLevel).map((g) => (
            <button key={g} type="button" aria-selected={a.grade === g} onClick={() => setA({ ...a, grade: g })}>
              {g}학년
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="label">평가 요소와 척도</span>
        {a.rubric.map((r, i) => (
          <div key={r.id} className="space-y-2 rounded-2xl bg-fill p-3">
            <div className="flex gap-2">
              <input className="field flex-1 bg-white" value={r.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder={`요소 ${i + 1} (예: 자세)`} aria-label={`요소 ${i + 1} 이름`} />
              <button type="button" className="btn btn-ghost px-2" aria-label="요소 빼기" disabled={a.rubric.length <= 1} onClick={() => setA({ ...a, rubric: a.rubric.filter((_, k) => k !== i) })}>
                <Icon name="trash" size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="segment flex-1 bg-white">
                <button type="button" aria-selected={r.scale === 'AE'} onClick={() => setItem(i, { scale: 'AE', maxScore: undefined })}>
                  A~E
                </button>
                <button type="button" aria-selected={r.scale === 'score'} onClick={() => setItem(i, { scale: 'score', maxScore: r.maxScore ?? 10 })}>
                  점수
                </button>
              </div>
              {r.scale === 'score' && (
                <label className="flex items-center gap-1 font-bold">
                  만점
                  <input className="field w-20 bg-white" inputMode="numeric" value={r.maxScore ?? ''} onChange={(e) => setItem(i, { maxScore: Number(e.target.value.replace(/\D/g, '')) || undefined })} aria-label="만점" />
                </label>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-soft w-full" onClick={() => setA({ ...a, rubric: [...a.rubric, { id: newId(), label: '', scale: a.rubric.at(-1)?.scale ?? 'AE', maxScore: a.rubric.at(-1)?.maxScore }] })}>
          <Icon name="plus" /> 요소 추가
        </button>
      </div>
      <label className="flex min-h-[48px] items-center gap-3">
        <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={a.altTaskEnabled} onChange={(e) => setA({ ...a, altTaskEnabled: e.target.checked })} />
        <span>
          <b>견학 학생 대체 과제 받기</b>
          <span className="hint block">[견학·열외]에서 이 평가를 대체 과제로 연결할 수 있어요.</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn btn-soft flex-1" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="btn btn-primary flex-[2]" disabled={!valid} onClick={() => onSave({ ...a, title: a.title.trim(), rubric: a.rubric.map((r) => ({ ...r, label: r.label.trim() })) })}>
          저장하고 채점하기
        </button>
      </div>
    </section>
  )
}
