import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import KeywordPicker from '../components/KeywordPicker'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import { addRecords } from '../db/recordsRepo'
import type { AssessItem, Assessment, AssessmentScore, Student } from '../db/types'
import { directProblem, fmtNum, itemMax, itemPoints, itemsOf, totalOf } from '../lib/assessScore'
import { todayStr } from '../lib/dates'
import { saveXlsx } from '../lib/download'
import { memberNo } from '../lib/groups'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const SUM = '__sum__'

/** 수업반 채점표 (재설계 3단계): 요소를 고르고 학생마다 입력 → 합계 자동 */
export default function AssessmentGradePage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const { readOnly } = useApp()
  const a = useLiveQuery(() => db.assessments.get(id), [id])
  const { groups, membersOf } = useGroups(true)
  const items = useMemo(() => (a ? itemsOf(a) : []), [a])
  const linked = useMemo(
    () => (groups ?? []).filter((g) => (a?.groupIds ? a.groupIds.includes(g.id) : g.kind === 'homeroom' && g.grade === a?.grade)),
    [groups, a],
  )
  const gid = sp.get('g') && linked.some((g) => g.id === sp.get('g')) ? sp.get('g')! : linked[0]?.id
  const group = linked.find((g) => g.id === gid)
  const list = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const [tab, setTab] = useState<string>('')
  const curTab = tab === SUM || items.some((i) => i.id === tab) ? tab : (items[0]?.id ?? SUM)
  const scores = useLiveQuery(() => db.assessmentScores.where('assessmentId').equals(id).toArray(), [id])
  const byStudent = useMemo(() => new Map((scores ?? []).map((s) => [s.studentId, s])), [scores])
  const absences = useLiveQuery(() => (list.length ? db.absences.where('studentId').anyOf(list.map((s) => s.id)).toArray() : []), [list.map((s) => s.id).join(',')])
  const [note, setNote] = useState<Student | null>(null)

  if (!a) return <PageHeader title="불러오는 중…" back />
  const maxTotal = items.reduce((n, it) => n + itemMax(it), 0)
  const doneCount = list.filter((s) => totalOf(items, byStudent.get(s.id)?.scores).complete).length

  const setScore = async (s: Student, itemId: string, v: string | number) => {
    const cur = byStudent.get(s.id)
    const next = { ...(cur?.scores ?? {}), [itemId]: v }
    if (v === '') delete next[itemId]
    if (cur) await db.assessmentScores.update(cur.id, { scores: next })
    else await db.assessmentScores.add({ id: newId(), assessmentId: a.id, studentId: s.id, scores: next })
  }

  const exportXlsx = async () => {
    if (!group) return
    const head = ['번호', '학번', '이름', ...items.map((it) => `${it.label}(${itemMax(it)}점)`), `합계(${maxTotal}점)`, '비고']
    const body = list.map((s) => {
      const sc = byStudent.get(s.id)?.scores
      const t = totalOf(items, sc)
      const alt = absences?.find((x) => x.studentId === s.id && x.altTaskId === a.id)
      const memo = [alt ? `대체과제${alt.altTaskDone ? '(제출)' : '(미제출)'}` : '', byStudent.get(s.id)?.note ?? ''].filter(Boolean).join(' / ')
      return [memberNo(group, s), s.studentCode, s.name, ...items.map((it) => itemPoints(it, sc?.[it.id]) ?? ''), t.done ? t.total : '', memo]
    })
    await saveXlsx(`수행평가_${a.title}_${group.name}.xlsx`, [{ name: '채점표', rows: [head, ...body] }])
  }

  return (
    <>
      <PageHeader
        title={a.title}
        sub={`만점 ${maxTotal}점 · 채점 끝 ${doneCount}/${list.length}명`}
        back
        right={
          <>
            {!readOnly && (
              <Link to={`/more/assessments/${a.id}/edit`} className="btn btn-soft px-3" aria-label="평가 고치기">
                <Icon name="edit" size={20} />
              </Link>
            )}
            <button type="button" className="btn btn-soft px-3" onClick={exportXlsx} disabled={list.length === 0} aria-label="채점표 엑셀">
              <Icon name="download" size={20} />
            </button>
          </>
        }
      />
      <div className="page space-y-3 pb-8">
        {!a.items && (
          <Link to={`/more/assessments/${a.id}/edit`} className="block rounded-2xl bg-caution-light px-4 py-3 font-bold text-caution">
            예전 방식 평가예요. 여기를 눌러 수업반과 등급 점수를 정해 주세요 →
          </Link>
        )}
        {linked.length > 1 && <GroupPicker groups={linked} value={gid ?? null} onChange={(g) => setSp({ g }, { replace: true })} />}
        {linked.length === 0 && <p className="card">이 평가에 연결된 수업반이 없어요. [고치기]에서 수업반을 골라 주세요.</p>}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="채점 요소">
          {items.map((it) => {
            const n = list.filter((s) => itemPoints(it, byStudent.get(s.id)?.scores[it.id]) !== null).length
            return (
              <button key={it.id} type="button" role="tab" aria-selected={curTab === it.id} className="chip shrink-0 gap-1.5" onClick={() => setTab(it.id)}>
                {it.label || '(이름 없음)'}
                <span className="text-xs opacity-70 tabular-nums">
                  {n}/{list.length}
                </span>
              </button>
            )
          })}
          <button type="button" role="tab" aria-selected={curTab === SUM} className="chip shrink-0" onClick={() => setTab(SUM)}>
            <Icon name="list" size={18} /> 합계
          </button>
        </div>

        {curTab === SUM ? (
          <SumTable a={a} items={items} list={list} byStudent={byStudent} memberLabel={(s) => (group ? memberNo(group, s) : String(s.number))} onNote={setNote} readOnly={readOnly} />
        ) : (
          (() => {
            const it = items.find((x) => x.id === curTab)
            if (!it) return null
            return (
              <ItemColumn
                key={`${it.id}-${gid}`}
                item={it}
                list={list}
                byStudent={byStudent}
                memberLabel={(s) => (group ? memberNo(group, s) : String(s.number))}
                absentIds={new Set((absences ?? []).map((x) => x.studentId))}
                altIds={new Map((absences ?? []).filter((x) => x.altTaskId === a.id).map((x) => [x.studentId, x.altTaskDone]))}
                readOnly={readOnly}
                onSet={setScore}
              />
            )
          })()
        )}
      </div>
      {note && <NoteSheet a={a} s={note} score={byStudent.get(note.id)} onClose={() => setNote(null)} />}
    </>
  )
}

/** 요소 하나를 반 전체 학생에게 차례로 입력 (엔터 → 다음 학생) */
function ItemColumn({
  item,
  list,
  byStudent,
  memberLabel,
  absentIds,
  altIds,
  readOnly,
  onSet,
}: {
  item: AssessItem
  list: Student[]
  byStudent: Map<string, AssessmentScore>
  memberLabel: (s: Student) => string
  absentIds: Set<string>
  altIds: Map<string, boolean>
  readOnly: boolean
  onSet: (s: Student, itemId: string, v: string | number) => Promise<void>
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  return (
    <ul className="card divide-y divide-line p-0">
      <li className="px-4 py-2.5 text-sm font-bold text-ink-3">
        {item.method === 'level' ? '등급을 누르세요 (다시 누르면 지워져요)' : item.method === 'record' ? `기록(${item.unit ?? ''})을 넣으면 점수가 정해져요 · 엔터 → 다음 학생` : `점수를 넣으세요 (0~${item.max ?? 0}점) · 엔터 → 다음 학생`}
        {item.method === 'level' && item.levels?.some((l) => l.desc) && (
          <details className="mt-1 font-normal text-ink-2">
            <summary className="cursor-pointer font-bold text-brand">등급 기준 보기</summary>
            <ul className="mt-1 space-y-0.5">
              {item.levels.map((l) => (
                <li key={l.label}>
                  <b className="text-ink">{l.label}</b> ({fmtNum(l.points)}점) {l.desc}
                </li>
              ))}
            </ul>
          </details>
        )}
      </li>
      {list.map((s, i) => {
        const raw = byStudent.get(s.id)?.scores[item.id]
        const pts = itemPoints(item, raw)
        const alt = altIds.get(s.id)
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5">
            <span className="min-w-7 shrink-0 font-extrabold tabular-nums">{memberLabel(s)}</span>
            <span className="min-w-[3.5rem] flex-1 font-semibold">
              {s.name}
              {absentIds.has(s.id) && <span className="ml-1 badge bg-fill-2 text-ink-3">견학</span>}
              {alt !== undefined && <span className={`ml-1 badge ${alt ? 'bg-ok-light text-ok' : 'bg-caution-light text-caution'}`}>대체과제</span>}
            </span>
            {item.method === 'level' ? (
              <div className="flex flex-wrap gap-1">
                {(item.levels ?? []).map((l) => (
                  <button
                    key={l.label}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={raw === l.label}
                    aria-label={`${s.name} ${item.label} ${l.label}`}
                    className={`h-11 min-w-11 rounded-xl px-2 text-[0.95rem] font-extrabold ${raw === l.label ? 'bg-brand text-white' : 'bg-fill text-ink-2'}`}
                    onClick={() => onSet(s, item.id, raw === l.label ? '' : l.label)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            ) : (
              <ScoreInput
                inputRef={(el) => (refs.current[i] = el)}
                item={item}
                raw={raw}
                label={`${s.name} ${item.label}`}
                readOnly={readOnly}
                onCommit={(v) => onSet(s, item.id, v)}
                onNext={() => refs.current[i + 1]?.focus()}
              />
            )}
            {item.method !== 'direct' && (
              <span className={`w-12 shrink-0 text-right font-extrabold tabular-nums ${pts === null ? 'text-ink-3' : 'text-brand'}`}>{pts === null ? '—' : `${fmtNum(pts)}점`}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ScoreInput({
  item,
  raw,
  label,
  readOnly,
  onCommit,
  onNext,
  inputRef,
}: {
  item: AssessItem
  raw: string | number | undefined
  label: string
  readOnly: boolean
  onCommit: (v: string | number) => void
  onNext: () => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const [text, setText] = useState(raw === undefined ? '' : String(raw))
  useEffect(() => setText(raw === undefined ? '' : String(raw)), [raw])
  const problem = item.method === 'direct' ? directProblem(item, text.trim()) : text.trim() && !Number.isFinite(Number(text)) ? '숫자가 아니에요' : null
  const commit = () => {
    const t = text.trim()
    if (t === '') return onCommit('')
    if (problem) return
    onCommit(Number(t))
  }
  return (
    <span className="flex items-center gap-1">
      <input
        ref={inputRef}
        className={`field min-h-[44px] w-20 text-center font-bold ${problem ? 'border-danger bg-danger-light' : ''}`}
        inputMode="decimal"
        enterKeyHint="next"
        value={text}
        disabled={readOnly}
        aria-label={label}
        aria-invalid={!!problem}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            onNext()
          }
        }}
      />
      <span className="w-10 text-sm text-ink-3">{item.method === 'record' ? item.unit : `/${item.max ?? 0}`}</span>
      {problem && <span className="w-full text-xs font-bold text-danger">{problem}</span>}
    </span>
  )
}

function SumTable({
  a,
  items,
  list,
  byStudent,
  memberLabel,
  onNote,
  readOnly,
}: {
  a: Assessment
  items: AssessItem[]
  list: Student[]
  byStudent: Map<string, AssessmentScore>
  memberLabel: (s: Student) => string
  onNote: (s: Student) => void
  readOnly: boolean
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-max min-w-full border-separate border-spacing-0 rounded-2xl bg-white text-center shadow-[var(--shadow-card)]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 rounded-tl-2xl bg-white px-2 py-2 text-left text-sm text-ink-3">학생</th>
            {items.map((it) => (
              <th key={it.id} className="min-w-[64px] px-1 py-2 text-[0.75rem] leading-tight font-bold text-ink-2">
                {it.label}
                <span className="block font-semibold text-ink-3">{itemMax(it)}점</span>
              </th>
            ))}
            <th className="px-2 py-2 text-sm font-extrabold">합계</th>
            <th className="px-2 py-2 text-sm text-ink-3">메모</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const sc = byStudent.get(s.id)
            const t = totalOf(items, sc?.scores)
            return (
              <tr key={s.id}>
                <th className="sticky left-0 z-10 border-t border-line bg-white px-2 py-2 text-left text-sm font-semibold whitespace-nowrap">
                  <span className="mr-1 font-extrabold tabular-nums">{memberLabel(s)}</span>
                  {s.name}
                </th>
                {items.map((it) => {
                  const p = itemPoints(it, sc?.scores[it.id])
                  return (
                    <td key={it.id} className="border-t border-line px-1 tabular-nums">
                      {p === null ? <span className="text-ink-3">—</span> : fmtNum(p)}
                    </td>
                  )
                })}
                <td className={`border-t border-line px-2 font-extrabold tabular-nums ${t.complete ? 'text-brand' : 'text-caution'}`}>{t.done ? fmtNum(t.total) : '—'}</td>
                <td className="border-t border-line px-1">
                  <button type="button" className="btn btn-ghost min-h-[40px] px-2 text-ink-3" disabled={readOnly} onClick={() => onNote(s)} aria-label={`${s.name} 메모`}>
                    <Icon name={sc?.note ? 'note' : 'tag'} size={18} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint mt-2 px-1">주황 합계는 아직 채점하지 않은 요소가 있는 학생이에요. ({a.title})</p>
    </div>
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
    <BottomSheet title={s.name} sub={a.title} onClose={onClose}>
      <div className="space-y-3">
        <textarea className="field min-h-[6rem] py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="채점 메모 (예: 낙법 동작 정확)" aria-label="채점 메모" />
        <KeywordPicker value={kw} onChange={setKw} defaultOpen />
        <p className="hint">키워드를 붙이면 관찰 기록으로도 남아 세특 키워드 엑셀에 들어가요.</p>
        <button type="button" className="btn btn-primary w-full" onClick={save}>
          저장
        </button>
      </div>
    </BottomSheet>
  )
}
