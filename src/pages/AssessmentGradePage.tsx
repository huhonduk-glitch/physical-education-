import ShareSheet from '../components/ShareSheet'
import { packAssessment } from '../lib/share'
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
import { areaTotal, directProblem, gradingProgress, directWarn, fmtNum, itemMax, itemPoints, itemsOf, levelOf, NON_PART, toggleCheck } from '../lib/assessScore'
import { readPaste, type PasteRow } from '../lib/assessPaste'
import { circled, criteriaLines, recordSheet, sheetStudents } from '../lib/assessSheet'
import { todayStr } from '../lib/dates'
import { copyText, saveXlsx } from '../lib/download'
import { memberNo } from '../lib/groups'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const SUM = '__sum__'
const EXTRA = '__extra__'

type ScorePatch = Partial<Pick<AssessmentScore, 'scores' | 'checks' | 'status' | 'texts'>>

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
  const hasExtra = !!(a?.specials?.length || a?.texts?.length)
  const curTab = tab === SUM || (tab === EXTRA && hasExtra) || items.some((i) => i.id === tab) ? tab : (items[0]?.id ?? SUM)
  const scores = useLiveQuery(() => db.assessmentScores.where('assessmentId').equals(id).toArray(), [id])
  const byStudent = useMemo(() => new Map((scores ?? []).map((s) => [s.studentId, s])), [scores])
  const absences = useLiveQuery(() => (list.length ? db.absences.where('studentId').anyOf(list.map((s) => s.id)).toArray() : []), [list.map((s) => s.id).join(',')])
  const [note, setNote] = useState<Student | null>(null)
  const [pasting, setPasting] = useState(false)
  const [sharing, setSharing] = useState(false)

  if (!a) return <PageHeader title="불러오는 중…" back />
  const maxTotal = items.reduce((n, it) => n + itemMax(it), 0)
  const doneCount = list.filter((s) => areaTotal(a, byStudent.get(s.id), s.gender, items).complete).length
  const label = (s: Student) => (group ? memberNo(group, s) : String(s.number))
  const altIds = new Map((absences ?? []).filter((x) => x.altTaskId === a.id).map((x) => [x.studentId, x.altTaskDone]))

  /** 학생 채점 한 줄 고치기 (없으면 새로) */
  const patch = async (s: Student, p: ScorePatch) => {
    const cur = byStudent.get(s.id)
    if (cur) await db.assessmentScores.update(cur.id, p)
    else await db.assessmentScores.add({ id: newId(), assessmentId: a.id, studentId: s.id, scores: {}, ...p })
  }
  const setScore = async (s: Student, itemId: string, v: string | number) => {
    const cur = byStudent.get(s.id)
    const next = { ...(cur?.scores ?? {}), [itemId]: v }
    if (v === '') delete next[itemId]
    const checks = { ...(cur?.checks ?? {}) }
    // 개수를 직접 넣거나 지우면 체크 표시는 맞지 않으니 뺀다
    if (checks[itemId] && checks[itemId].length !== v) delete checks[itemId]
    await patch(s, { scores: next, checks })
  }
  /** 체크리스트 항목 켜고 끄기 → 체크 목록 + 만족 수(점수 칸) */
  const setCheck = async (s: Student, itemId: string, idx: number) => {
    const cur = byStudent.get(s.id)
    const { list: on, count } = toggleCheck(cur?.checks?.[itemId], idx)
    const scores = { ...(cur?.scores ?? {}), [itemId]: count }
    const checks = { ...(cur?.checks ?? {}), [itemId]: on }
    if (count === 0) {
      delete scores[itemId]
      delete checks[itemId]
    }
    await patch(s, { scores, checks })
  }

  const exportXlsx = async () => {
    if (!group) return
    const rows = recordSheet(a, items, sheetStudents(list, label, byStudent, altIds))
    const crit = criteriaLines(a, items).flatMap((c) => [[c.title], ...c.lines.map((l) => ['', l]), []])
    await saveXlsx(`수행평가_${a.title}_${group.name}.xlsx`, [
      { name: '기록표', rows },
      { name: '채점 기준', rows: [[`${a.title} 채점 기준`], [], ...crit], widths: [28, 80] },
    ])
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
            <Link to={`/more/assessments/${a.id}/sheet${gid ? `?g=${gid}` : ''}`} className="btn btn-soft px-3" aria-label="기록지 인쇄">
              <Icon name="file" size={20} />
            </Link>
            <button type="button" className="btn btn-soft px-3" onClick={() => setSharing(true)} aria-label="다른 선생님께 보내기" title="다른 선생님께 보내기">
              <Icon name="share" size={20} />
            </button>
            <button type="button" className="btn btn-soft px-3" onClick={exportXlsx} disabled={list.length === 0} aria-label="기록표 엑셀">
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
        {list.length > 0 && <ProgressStrip a={a} list={list} label={label} byStudent={byStudent} items={items} />}
        {!readOnly && list.length > 0 && (
          <button type="button" className="btn btn-soft w-full justify-start gap-2" onClick={() => setPasting(true)}>
            <Icon name="copy" size={18} /> 구글 시트 · 엑셀에서 붙여넣기
            <span className="ml-auto hidden text-xs font-semibold text-ink-3 sm:inline">이미 채점한 표를 그대로</span>
          </button>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="채점 요소">
          {items.map((it) => {
            const n = list.filter((s) => itemPoints(it, byStudent.get(s.id)?.scores[it.id], s.gender) !== null).length
            return (
              <button key={it.id} type="button" role="tab" aria-selected={curTab === it.id} className="chip shrink-0 gap-1.5" onClick={() => setTab(it.id)}>
                {it.label || '(이름 없음)'}
                <span className="text-xs opacity-70 tabular-nums">
                  {n}/{list.length}
                </span>
              </button>
            )
          })}
          {hasExtra && (
            <button type="button" role="tab" aria-selected={curTab === EXTRA} className="chip shrink-0" onClick={() => setTab(EXTRA)}>
              {[a.texts?.length ? a.texts.join(' · ') : '', a.specials?.length ? '제출 구분' : ''].filter(Boolean).join(' · ')}
            </button>
          )}
          <button type="button" role="tab" aria-selected={curTab === SUM} className="chip shrink-0" onClick={() => setTab(SUM)}>
            <Icon name="list" size={18} /> 합계
          </button>
        </div>

        {curTab === SUM ? (
          <SumTable a={a} items={items} list={list} byStudent={byStudent} memberLabel={label} onNote={setNote} readOnly={readOnly} />
        ) : curTab === EXTRA ? (
          <ExtraColumn key={gid} a={a} list={list} byStudent={byStudent} memberLabel={label} readOnly={readOnly} onPatch={patch} />
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
                memberLabel={label}
                absentIds={new Set((absences ?? []).map((x) => x.studentId))}
                altIds={altIds}
                readOnly={readOnly}
                onSet={setScore}
                onCheck={setCheck}
              />
            )
          })()
        )}
      </div>
      {note && <NoteSheet a={a} s={note} score={byStudent.get(note.id)} onClose={() => setNote(null)} />}
      {pasting && (
        <PasteSheet
          a={a}
          items={items}
          list={list}
          byStudent={byStudent}
          onApply={async (rows) => {
            for (const r of rows) {
              const st = list.find((x) => x.id === r.studentId)
              if (!st) continue
              const cur = byStudent.get(st.id)
              const p = r.patch
              await patch(st, {
                scores: { ...(cur?.scores ?? {}), ...p.scores },
                checks: { ...(cur?.checks ?? {}), ...p.checks },
                texts: { ...(cur?.texts ?? {}), ...p.texts },
                ...(p.status === undefined ? {} : { status: p.status || undefined }),
              })
              if (p.note !== undefined) {
                const now = byStudent.get(st.id)
                if (now) await db.assessmentScores.update(now.id, { note: p.note })
                else {
                  const again = await db.assessmentScores.where('assessmentId').equals(a.id).filter((x) => x.studentId === st.id).first()
                  if (again) await db.assessmentScores.update(again.id, { note: p.note })
                }
              }
            }
            setPasting(false)
          }}
          onClose={() => setPasting(false)}
        />
      )}
      {sharing && <ShareSheet pack={packAssessment(a)} onClose={() => setSharing(false)} />}
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
  onCheck,
}: {
  item: AssessItem
  list: Student[]
  byStudent: Map<string, AssessmentScore>
  memberLabel: (s: Student) => string
  absentIds: Set<string>
  altIds: Map<string, boolean>
  readOnly: boolean
  onSet: (s: Student, itemId: string, v: string | number) => Promise<void>
  onCheck: (s: Student, itemId: string, idx: number) => Promise<void>
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  return (
    <ul className="card divide-y divide-line p-0">
      <li className="px-4 py-2.5 text-sm font-bold text-ink-3">
        {item.method === 'level'
          ? '등급을 누르세요 (다시 누르면 지워져요)'
          : item.method === 'record'
            ? item.checks?.length
              ? `만족한 평가 요소 번호를 누르세요 (다시 누르면 풀려요). 만족 수로 점수가 정해져요 · 하나도 없으면 [0개]`
              : `기록(${item.unit ?? ''})을 넣으면 점수가 정해져요${item.bandsF?.length ? ' · 남녀 기준이 달라요' : ''} · 엔터 → 다음 학생`
            : `점수를 넣으세요 (0~${item.max ?? 0}점) · 엔터 → 다음 학생`}
        {item.checks?.length ? (
          <details className="mt-1 font-normal text-ink-2">
            <summary className="cursor-pointer font-bold text-brand">평가 요소 {item.checks.length}개 보기</summary>
            <ul className="mt-1 space-y-0.5">
              {item.checks.map((c, k) => (
                <li key={k}>
                  <b className="text-ink">{circled(k)}</b> {c}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
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
        const sc = byStudent.get(s.id)
        const raw = sc?.scores[item.id]
        const pts = itemPoints(item, raw, s.gender)
        const alt = altIds.get(s.id)
        const on = sc?.checks?.[item.id] ?? []
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5">
            <span className="min-w-7 shrink-0 font-extrabold tabular-nums">{memberLabel(s)}</span>
            <span className="min-w-[3.5rem] flex-1 font-semibold">
              {s.name}
              {absentIds.has(s.id) && <span className="ml-1 badge bg-fill-2 text-ink-3">견학</span>}
              {alt !== undefined && <span className={`ml-1 badge ${alt ? 'bg-ok-light text-ok' : 'bg-caution-light text-caution'}`}>대체과제</span>}
              {sc?.status && <span className="ml-1 badge bg-ink text-white">{sc.status}</span>}
            </span>
            {item.checks?.length ? (
              <div className="flex w-full flex-wrap gap-1">
                {item.checks.map((c, k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={on.includes(k)}
                    aria-label={`${s.name} ${k + 1}번 ${c}`}
                    title={c}
                    className={`h-11 min-w-11 rounded-xl px-2 text-lg font-extrabold ${on.includes(k) ? 'bg-brand text-white' : 'bg-fill text-ink'}`}
                    onClick={() => onCheck(s, item.id, k)}
                  >
                    {circled(k)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={readOnly}
                  aria-pressed={raw === 0}
                  className={`h-11 rounded-xl px-2 text-sm font-bold ${raw === 0 ? 'bg-ink text-white' : 'bg-fill text-ink-3'}`}
                  onClick={() => onSet(s, item.id, raw === 0 ? '' : 0)}
                >
                  0개
                </button>
                <span className="ml-auto self-center text-right tabular-nums">
                  {raw !== undefined && raw !== NON_PART && <span className="mr-1.5 text-sm font-bold text-ink-3">{raw}개</span>}
                  <span className={`font-extrabold ${pts === null ? 'text-ink-3' : 'text-brand'}`}>{pts === null ? '—' : `${fmtNum(pts)}점`}</span>
                </span>
              </div>
            ) : (
              // 폰에서는 이름 아래 한 줄에 [등급 버튼 · 기록 칸] [미참여] … [점수] — 점수가 따로 한 줄을 차지하지 않게
              <div className="flex basis-full items-center gap-1 sm:basis-auto">
                {item.method === 'level' ? (
                  <div className="flex flex-wrap gap-1">
                    {(item.levels ?? []).map((l) => (
                      <button
                        key={l.label}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={raw === l.label}
                        aria-label={`${s.name} ${item.label} ${l.label}`}
                        className={`h-11 min-w-11 rounded-xl px-2 text-[1rem] font-extrabold ${raw === l.label ? 'bg-brand text-white' : 'bg-fill text-ink'}`}
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
                {item.nonPartPoints !== undefined && !readOnly && <NonPartButton item={item} raw={raw} onToggle={() => onSet(s, item.id, raw === NON_PART ? '' : NON_PART)} />}
                {item.method !== 'direct' && (
                  <span className={`ml-auto w-12 shrink-0 text-right font-extrabold tabular-nums ${pts === null ? 'text-ink-3' : 'text-brand'}`}>{pts === null ? '—' : `${fmtNum(pts)}점`}</span>
                )}
              </div>
            )}
            {item.checks?.length && item.nonPartPoints !== undefined && !readOnly ? (
              <NonPartButton item={item} raw={raw} onToggle={() => onSet(s, item.id, raw === NON_PART ? '' : NON_PART)} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** '미참여' 점수 버튼 (자발적 미참여 · 장기 미인정 결석) */
function NonPartButton({ item, raw, onToggle }: { item: AssessItem; raw: string | number | undefined; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={raw === NON_PART}
      className={`h-11 shrink-0 rounded-xl px-2 text-sm font-bold ${raw === NON_PART ? 'bg-ink text-white' : 'bg-fill text-ink-3'}`}
      onClick={onToggle}
      title={`자발적 미참여 · 장기 미인정 결석 (${fmtNum(item.nonPartPoints ?? 0)}점)`}
    >
      미참여
    </button>
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
  const problem = text.trim() === NON_PART ? null : item.method === 'direct' ? directProblem(item, text.trim()) : text.trim() && !Number.isFinite(Number(text)) ? '숫자가 아니에요' : null
  const warn = problem || text.trim() === NON_PART ? null : directWarn(item, text.trim())
  const commit = () => {
    const t = text.trim()
    if (t === '') return onCommit('')
    if (t === NON_PART) return onCommit(NON_PART)
    if (problem) return
    onCommit(Number(t))
  }
  return (
    <span className="flex items-center gap-1">
      <input
        ref={inputRef}
        className={`field min-h-[44px] w-20 text-center font-bold ${problem ? 'border-danger bg-danger-light' : warn ? 'border-caution bg-caution-light' : ''}`}
        title={problem ?? warn ?? undefined}
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
      {!problem && warn && <span className="w-full text-xs font-bold text-caution">{warn}</span>}
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
            {a.specials?.length ? <th className="px-2 py-2 text-sm text-ink-2">제출 구분</th> : null}
            <th className="px-2 py-2 text-sm font-extrabold">합계</th>
            {a.levelCuts?.length ? <th className="px-2 py-2 text-sm font-extrabold">수준</th> : null}
            <th className="px-2 py-2 text-sm text-ink-3">메모</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const sc = byStudent.get(s.id)
            const t = areaTotal(a, sc, s.gender, items)
            const max = items.reduce((n, it) => n + itemMax(it), 0)
            return (
              <tr key={s.id}>
                <th className="sticky left-0 z-10 border-t border-line bg-white px-2 py-2 text-left text-sm font-semibold whitespace-nowrap">
                  <span className="mr-1 font-extrabold tabular-nums">{memberLabel(s)}</span>
                  {s.name}
                </th>
                {items.map((it) => {
                  const p = itemPoints(it, sc?.scores[it.id], s.gender)
                  return (
                    <td key={it.id} className="border-t border-line px-1 tabular-nums">
                      {p === null ? <span className="text-ink-3">—</span> : fmtNum(p)}
                    </td>
                  )
                })}
                {a.specials?.length ? <td className="border-t border-line px-2 text-sm font-bold whitespace-nowrap">{sc?.status ?? ''}</td> : null}
                <td className={`border-t border-line px-2 font-extrabold tabular-nums ${t.complete ? 'text-brand' : 'text-caution'}`}>{t.done ? fmtNum(t.total) : '—'}</td>
                {a.levelCuts?.length ? <td className="border-t border-line px-2 font-extrabold">{t.complete ? levelOf(a.levelCuts, t.total, max) : ''}</td> : null}
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

/** 글 칸(탐구주제 등) · 제출 구분(백지 제출 · 미응시 → 평가 전체 점수)을 학생마다 */
function ExtraColumn({
  a,
  list,
  byStudent,
  memberLabel,
  readOnly,
  onPatch,
}: {
  a: Assessment
  list: Student[]
  byStudent: Map<string, AssessmentScore>
  memberLabel: (s: Student) => string
  readOnly: boolean
  onPatch: (s: Student, p: ScorePatch) => Promise<void>
}) {
  return (
    <ul className="card divide-y divide-line p-0">
      <li className="px-4 py-2.5 text-sm font-bold text-ink-3">
        {a.specials?.length ? `제출 구분을 고르면 요소 점수 대신 그 점수가 평가 점수가 돼요 (${a.specials.map((x) => `${x.label} ${fmtNum(x.points)}점`).join(' · ')}). 다시 누르면 풀려요.` : ''}
        {a.texts?.length ? ` 글 칸은 적고 다른 곳을 누르면 저장돼요.` : ''}
      </li>
      {list.map((s) => {
        const sc = byStudent.get(s.id)
        return (
          <li key={s.id} className="space-y-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-7 font-extrabold tabular-nums">{memberLabel(s)}</span>
              <span className="flex-1 font-semibold whitespace-nowrap">{s.name}</span>
              {a.specials?.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={sc?.status === x.label}
                  aria-label={`${s.name} ${x.label}`}
                  className={`h-11 rounded-xl px-2.5 text-sm font-bold ${sc?.status === x.label ? 'bg-ink text-white' : 'bg-fill text-ink-2'}`}
                  onClick={() => onPatch(s, { status: sc?.status === x.label ? undefined : x.label })}
                >
                  {x.label}
                </button>
              ))}
            </div>
            {a.texts?.map((t) => (
              <TextCell key={t} label={t} name={s.name} value={sc?.texts?.[t] ?? ''} readOnly={readOnly} onCommit={(v) => onPatch(s, { texts: { ...(sc?.texts ?? {}), [t]: v } })} />
            ))}
          </li>
        )
      })}
    </ul>
  )
}

function TextCell({ label, name, value, readOnly, onCommit }: { label: string; name: string; value: string; readOnly: boolean; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <label className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-sm font-bold text-ink-3">{label}</span>
      <input
        className="field min-h-[44px] flex-1"
        value={text}
        disabled={readOnly}
        aria-label={`${name} ${label}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value && onCommit(text.trim())}
      />
    </label>
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

/** 구글 시트 · 엑셀에서 복사한 채점 결과 붙여넣기 (2026-11-02): 머리글 이름으로 열을 맞추고, 미리 보고 넣는다 */
function PasteSheet({
  a,
  items,
  list,
  byStudent,
  onApply,
  onClose,
}: {
  a: Assessment
  items: AssessItem[]
  list: Student[]
  byStudent: Map<string, AssessmentScore>
  onApply: (rows: PasteRow[]) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const res = useMemo(() => (text.trim() ? readPaste(text, a, items, list.map((s) => ({ id: s.id, name: s.name, no: String(s.number) }))) : null), [text, a, items, list])
  const overwrite = res ? res.rows.filter((r) => {
    const cur = byStudent.get(r.studentId)
    return !!cur && (Object.keys(cur.scores).length > 0 || !!cur.status || Object.keys(cur.texts ?? {}).length > 0)
  }).length : 0
  return (
    <BottomSheet title="시트에서 붙여넣기" sub={a.title} onClose={onClose}>
      <div className="space-y-3">
        <p className="hint">
          구글 시트나 엑셀에서 <b>머리글 줄(번호 · 이름 …)부터</b> 학생 줄까지 골라 복사한 뒤 아래에 붙여 넣으세요. 머리글 이름으로 칸을 맞춰요: 이름 · 번호, 글 칸(예: 탐구주제), 요소 이름(예: ①융합성), ①~⑦ 체크(TRUE · O = 만족), 제출구분, 비고. 만족 수 · 점수 · 합계 · 수준은 앱이 다시 계산해요.
        </p>
        <textarea className="field min-h-[8rem] py-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="시트에서 복사한 표를 여기에 붙여 넣기 (머리글 줄부터)" aria-label="붙여넣을 표" />
        {res && (
          <div className="space-y-2 rounded-xl bg-fill p-3 text-sm">
            {res.columns.length > 0 && (
              <ul className="space-y-0.5 text-ink-2">
                {res.columns.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            )}
            <p className="font-bold">
              학생 {res.rows.length}명을 찾았어요{overwrite ? ` · 이미 채점한 ${overwrite}명은 덮어써요` : ''}.
            </p>
            {res.problems.length > 0 && (
              <ul className="space-y-0.5 font-semibold text-danger">
                {res.problems.slice(0, 12).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {res.problems.length > 12 && <li>… 외 {res.problems.length - 12}개</li>}
              </ul>
            )}
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!res || res.rows.length === 0 || busy}
          onClick={async () => {
            if (!res) return
            setBusy(true)
            await onApply(res.rows)
            setBusy(false)
          }}
        >
          {busy ? '넣는 중…' : `${res?.rows.length ?? 0}명 넣기`}
        </button>
      </div>
    </BottomSheet>
  )
}

/**
 * 채점 · 제출 현황 (2026-11-09): 진행 막대 · 제출 구분별 수 · 남은 학생 [명단 복사].
 * 학생 이름은 복사할 때만 — 화면에는 수만 보여 수업 중 띄워도 된다.
 */
function ProgressStrip({ a, list, label, byStudent, items }: { a: Assessment; list: Student[]; label: (s: Student) => string; byStudent: Map<string, AssessmentScore>; items: AssessItem[] }) {
  const [copied, setCopied] = useState(false)
  const g = gradingProgress(a, list, (id) => byStudent.get(id), items)
  const pct = g.total ? Math.round((g.done / g.total) * 100) : 0
  const copy = async () => {
    const text = g.remaining.map((s) => `${label(s)}번 ${s.name}`).join('\n')
    if (await copyText(`${a.title} · 아직 채점 안 된 학생 ${g.remaining.length}명\n${text}`)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <section className="card space-y-2 py-3" aria-label="채점 현황">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
        <span className="flex-1 whitespace-nowrap">
          채점 끝 <b className="text-brand tabular-nums">{g.done}</b>/{g.total}명 ({pct}%)
        </span>
        {g.bySpecial.map((x) => (
          <span key={x.label} className="badge bg-fill text-ink-2">
            {x.label} {x.count}
          </span>
        ))}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-fill" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {g.remaining.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="hint flex-1">
            남은 학생 {g.remaining.length}명{g.started.length ? ` (채점 중 ${g.started.length}명)` : ''} — 미제출 · 미응시 확인용
          </span>
          <button type="button" className="btn btn-soft shrink-0 px-3 text-sm" onClick={copy}>
            <Icon name="copy" size={16} /> {copied ? '복사했어요' : '명단 복사'}
          </button>
        </div>
      )}
    </section>
  )
}
