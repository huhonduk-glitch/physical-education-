import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import ClassPicker, { classesOf, type ClassKey } from '../components/ClassPicker'
import Icon from '../components/Icon'
import KeywordPicker from '../components/KeywordPicker'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import { addRecords } from '../db/recordsRepo'
import type { Assessment, AssessmentScore, Student } from '../db/types'
import { todayStr } from '../lib/dates'
import { saveXlsx } from '../lib/download'
import { scoreTotal } from '../lib/seteuk'
import { useApp } from '../state/AppContext'

const AE = ['A', 'B', 'C', 'D', 'E']

/** 반별 채점 그리드 (CLAUDE.md 4-8): 행은 학생, 열은 평가 요소. 폰에서도 입력 가능 */
export default function AssessmentGradePage() {
  const { id = '' } = useParams()
  const { settings, readOnly } = useApp()
  const a = useLiveQuery(() => db.assessments.get(id), [id])
  const students = useLiveQuery(
    () => (a ? db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.grade === a.grade && s.status !== '전출').toArray() : []),
    [a?.grade, settings.schoolYear],
  )
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const cur = cls ?? classes[0] ?? null
  const list = useMemo(() => (students ?? []).filter((s) => cur && s.classNo === cur.classNo).sort((x, y) => x.number - y.number), [students, cur])
  const scores = useLiveQuery(() => db.assessmentScores.where('assessmentId').equals(id).toArray(), [id])
  const byStudent = useMemo(() => new Map((scores ?? []).map((s) => [s.studentId, s])), [scores])
  const absences = useLiveQuery(() => (list.length ? db.absences.where('studentId').anyOf(list.map((s) => s.id)).toArray() : []), [list.map((s) => s.id).join(',')])
  const [note, setNote] = useState<Student | null>(null)

  if (!a) return <PageHeader title="불러오는 중…" back />

  const setScore = async (s: Student, itemId: string, v: string | number) => {
    const cur = byStudent.get(s.id)
    const next = { ...(cur?.scores ?? {}), [itemId]: v }
    if (v === '') delete next[itemId]
    if (cur) await db.assessmentScores.update(cur.id, { scores: next })
    else await db.assessmentScores.add({ id: newId(), assessmentId: a.id, studentId: s.id, scores: next })
  }

  const exportXlsx = async () => {
    const head = ['학번', '번호', '이름', ...a.rubric.map((r) => (r.scale === 'score' ? `${r.label}(${r.maxScore}점)` : r.label)), ...(a.rubric.some((r) => r.scale === 'score') ? ['합계'] : []), '비고']
    const body = list.map((s) => {
      const sc = byStudent.get(s.id)
      const alt = absences?.find((x) => x.studentId === s.id && x.altTaskId === a.id)
      const vals = a.rubric.map((r) => {
        const v = sc?.scores[r.id]
        return v === undefined ? '' : r.scale === 'score' ? Number(v) : String(v)
      })
      const total = a.rubric.some((r) => r.scale === 'score') ? [scoreTotal(a.rubric, sc?.scores ?? {}) ?? ''] : []
      const memo = [alt ? `대체과제${alt.altTaskDone ? '(제출)' : '(미제출)'}` : '', sc?.note ?? ''].filter(Boolean).join(' / ')
      return [s.studentCode, s.number, s.name, ...vals, ...total, memo]
    })
    await saveXlsx(`수행평가_${a.title}_${cur ? `${cur.grade}-${cur.classNo}반` : ''}.xlsx`, [{ name: a.title || '수행평가', rows: [head, ...body] }])
  }

  return (
    <>
      <PageHeader
        title={a.title}
        sub={`${a.grade}학년 · 요소 ${a.rubric.length}개`}
        back
        right={
          <button type="button" className="btn btn-soft" onClick={exportXlsx} disabled={list.length === 0}>
            <Icon name="download" /> 엑셀
          </button>
        }
      />
      <div className="page space-y-3 pb-8">
        <ClassPicker classes={classes} value={cur} onChange={setCls} />
        {list.length === 0 && <p className="card">이 학년 학생이 없어요.</p>}
        <ul className="space-y-2">
          {list.map((s) => {
            const sc = byStudent.get(s.id)
            const abs = absences?.filter((x) => x.studentId === s.id) ?? []
            const alt = abs.find((x) => x.altTaskId === a.id)
            const total = scoreTotal(a.rubric, sc?.scores ?? {})
            return (
              <li key={s.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-fill font-extrabold tabular-nums">{s.number}</span>
                  <span className="flex-1 font-bold">{s.name}</span>
                  {abs.length > 0 && <span className="badge bg-fill-2 text-ink-2">견학 {abs.length}회</span>}
                  {alt && <span className={`badge ${alt.altTaskDone ? 'bg-ok-light text-ok' : 'bg-caution-light text-caution'}`}>대체과제 {alt.altTaskDone ? '제출' : '미제출'}</span>}
                  {total !== null && <span className="badge bg-ink text-white">합계 {total}</span>}
                  <button type="button" className="btn btn-soft min-h-[40px] px-3 text-sm" disabled={readOnly} onClick={() => setNote(s)}>
                    <Icon name="tag" size={16} /> 메모·키워드
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {a.rubric.map((r) => {
                    const v = sc?.scores[r.id]
                    return (
                      <div key={r.id} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[0.9rem] font-bold text-ink-2">{r.label}</span>
                        {r.scale === 'AE' ? (
                          <div className="flex gap-1">
                            {AE.map((g) => (
                              <button
                                key={g}
                                type="button"
                                disabled={readOnly}
                                aria-pressed={v === g}
                                className={`h-10 w-9 rounded-lg text-[0.95rem] font-extrabold ${v === g ? 'bg-brand text-white' : 'bg-white text-ink-2'}`}
                                onClick={() => setScore(s, r.id, v === g ? '' : g)}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <label className="flex items-center gap-1">
                            <input
                              className="field min-h-[42px] w-20 bg-white text-center font-bold"
                              inputMode="decimal"
                              disabled={readOnly}
                              defaultValue={v ?? ''}
                              aria-label={`${s.name} ${r.label} 점수`}
                              onBlur={(e) => {
                                const t = e.target.value.trim()
                                const n = Number(t)
                                if (t === '') return setScore(s, r.id, '')
                                if (!Number.isFinite(n) || n < 0 || (r.maxScore && n > r.maxScore)) {
                                  alert(`0~${r.maxScore}점 사이로 넣어 주세요`)
                                  e.target.value = v === undefined ? '' : String(v)
                                  return
                                }
                                void setScore(s, r.id, n)
                              }}
                            />
                            <span className="text-sm text-ink-3">/{r.maxScore}</span>
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
                {sc?.note && <p className="text-[0.9rem] text-ink-2">📝 {sc.note}</p>}
              </li>
            )
          })}
        </ul>
      </div>
      {note && <NoteSheet a={a} s={note} score={byStudent.get(note.id)} onClose={() => setNote(null)} />}
    </>
  )
}

/** 채점 메모 + 세특 키워드 (키워드는 관찰 기록으로 남겨 세특 내보내기에 들어간다) */
function NoteSheet({ a, s, score, onClose }: { a: Assessment; s: Student; score?: AssessmentScore; onClose: () => void }) {
  const { settings } = useApp()
  const [text, setText] = useState(score?.note ?? '')
  const [kw, setKw] = useState<string[]>([])
  const save = async () => {
    if (score) await db.assessmentScores.update(score.id, { note: text.trim() || undefined })
    else await db.assessmentScores.add({ id: newId(), assessmentId: a.id, studentId: s.id, scores: {}, note: text.trim() || undefined })
    if (kw.length || text.trim()) {
      await addRecords(db, { schoolYear: settings.schoolYear, studentIds: [s.id], date: todayStr(), type: 'observation', category: `수행평가 · ${a.title}`, note: text, keywordIds: kw })
    }
    onClose()
  }
  return (
    <BottomSheet title={`${s.number}번 ${s.name}`} sub={a.title} onClose={onClose}>
      <div className="space-y-3">
        <textarea className="field min-h-[6rem] py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="채점 메모 (예: 드리블 후 스텝 정확)" aria-label="채점 메모" />
        <KeywordPicker value={kw} onChange={setKw} defaultOpen />
        <p className="hint">키워드를 붙이면 관찰 기록으로도 남아 세특 키워드 엑셀에 들어가요.</p>
        <button type="button" className="btn btn-primary w-full" onClick={save}>
          저장
        </button>
      </div>
    </BottomSheet>
  )
}
