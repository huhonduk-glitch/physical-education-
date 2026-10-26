import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import Collapse from '../components/Collapse'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { applyAi, canConfirm, confirmDraft, saveText, setAiConfirm, unconfirm } from '../db/seteukRepo'
import type { ClassGroup, SeteukDraft, Student } from '../db/types'
import { appliesTo, itemsOf } from '../lib/assessScore'
import { copyText, saveXlsx } from '../lib/download'
import { memberNo, readLastGroup } from '../lib/groups'
import { POLISH_MODEL, PolishError, polishSeteuk } from '../lib/aiPolish'
import { studentEvidence } from '../lib/seteuk'
import { AI_CONFIRM_ITEMS, checkSeteuk, countText, SETEUK_MAX_CHARS } from '../lib/seteukCheck'
import { draftParts, draftText } from '../lib/seteukDraft'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/**
 * 세특 쓰기 (6-5 ③): 근거 → 틀 초안(기기 안) → 교사가 고침 → (선택) AI 다듬기 → 교사가 고치고 확인 → 확정 → 복사 · 엑셀.
 * 기재요령(2026 고등학교) 총칙 5-다: AI 생성 글을 그대로 입력 금지, 윤문 보조는 최종 입력 전 확인.
 */
export default function SeteukWritePage() {
  const { settings, updateSettings, readOnly } = useApp()
  const [sp, setSp] = useSearchParams()
  const { groups, membersOf } = useGroups()
  const want = sp.get('g') ?? readLastGroup()
  const group = groups?.find((g) => g.id === want) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const drafts = useLiveQuery(() => (group ? db.seteukDrafts.where('groupId').equals(group.id).toArray() : []), [group?.id])
  const byStudent = useMemo(() => new Map((drafts ?? []).map((d) => [d.studentId, d])), [drafts])
  const [open, setOpen] = useState<Student | null>(null)
  const [msg, setMsg] = useState('')

  const confirmed = members.filter((s) => byStudent.get(s.id)?.status === 'confirmed')
  const exportXlsx = async () => {
    if (!group) return
    await saveXlsx(`세특_${group.name.replace(/\s+/g, '')}_${settings.schoolYear}.xlsx`, [
      {
        name: '세특',
        rows: [['번호', '학번', '이름', '세부능력 및 특기사항', '글자 수', '바이트'], ...confirmed.map((s) => {
          const t = byStudent.get(s.id)!.confirmedText ?? ''
          const c = countText(t)
          return [memberNo(group, s), s.studentCode, s.name, t, c.chars, c.bytes]
        })],
        widths: [5, 8, 8, 90, 7, 7],
      },
    ])
  }
  const copyAll = async () => {
    if (!group) return
    const ok = await copyText(confirmed.map((s) => `${memberNo(group, s)} ${s.name}\n${byStudent.get(s.id)!.confirmedText ?? ''}`).join('\n\n'))
    setMsg(ok ? `확정한 ${confirmed.length}명의 글을 복사했어요.` : '복사하지 못했어요. 엑셀로 받아 주세요.')
  }

  return (
    <>
      <PageHeader
        title="세특 쓰기"
        sub={group?.name}
        back
        right={
          <button type="button" className="btn btn-soft" onClick={exportXlsx} disabled={!confirmed.length} aria-label="확정한 글 엑셀로 받기">
            <Icon name="download" />
          </button>
        }
      />
      <div className="page space-y-4 pb-8">
        {groups && groups.length > 1 && <GroupPicker groups={groups} value={group?.id ?? null} onChange={(g) => setSp({ g }, { replace: true })} />}

        <Collapse title="기재요령 AI 규정 (꼭 읽어 주세요)" sub="AI 글을 그대로 입력하면 안 돼요" defaultOpen={!settings.claudeApiKey}>
          <div className="space-y-2 text-sm text-ink-2">
            <p>
              <b>2026학년도 학교생활기록부 기재요령(고등학교) 총칙 5-다</b>: &ldquo;AI를 활용하여 생성한 자료를 학교생활기록부의 서술형 항목에 그대로 입력하는 행위&rdquo;는 금지돼요. 윤문 등 보조로 쓸 때는 최종 입력 전에 허위·과장 여부와 기재요령 유의사항을 꼭 확인해야 해요.
            </p>
            <p>그래서 이 화면은 ① 선생님 기록으로 초안 → ② 선생님이 고쳐 씀 → ③ (선택) AI로 다듬기 → ④ 다시 선생님이 고치고 확인 4개 체크 → ⑤ 확정 순서로만 확정돼요. AI 글을 한 글자도 안 고치면 확정할 수 없어요.</p>
            <p>[AI로 다듬기]를 누르면 그 학생의 <b>이름 · 과목 · 초안 글</b>이 Anthropic(Claude)으로 보내져요. 학교·교육청 개인정보 지침을 먼저 확인해 주세요.</p>
          </div>
        </Collapse>

        <KeyCard value={settings.claudeApiKey} readOnly={readOnly} onSave={(k) => updateSettings({ claudeApiKey: k })} />

        {group && (
          <section className="card overflow-hidden p-0">
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <p className="card-title flex-1">
                확정 {confirmed.length}/{members.length}명
              </p>
              <button type="button" className="btn btn-soft" onClick={copyAll} disabled={!confirmed.length}>
                <Icon name="copy" /> 확정 글 복사
              </button>
            </div>
            {msg && <p className="px-5 pb-2 font-bold text-ok">{msg}</p>}
            <ul>
              {members.map((s) => {
                const d = byStudent.get(s.id)
                const t = d?.text ?? ''
                return (
                  <li key={s.id}>
                    <button type="button" className="list-row w-full text-left hover:bg-fill" onClick={() => setOpen(s)}>
                      <span className="w-10 shrink-0 font-extrabold tabular-nums">{memberNo(group, s)}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block">{s.name}</b>
                        <span className="hint block truncate">{t || '아직 안 씀'}</span>
                      </span>
                      <StatusBadge d={d} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <p className="hint px-1">나이스에는 확정한 글을 학생마다 [복사]해서 붙여 넣거나, 엑셀로 받아 옮겨 주세요. 나이스 화면에 자동으로 입력하지 않아요.</p>
      </div>
      {open && group && <Editor group={group} student={open} draft={byStudent.get(open.id)} onClose={() => setOpen(null)} />}
    </>
  )
}

function StatusBadge({ d }: { d?: SeteukDraft }) {
  if (!d || !d.text.trim()) return <span className="badge bg-fill text-ink-3">빈칸</span>
  if (d.status === 'confirmed') return <span className="badge bg-ok-light text-ok">확정</span>
  if (d.aiUsed) return <span className="badge bg-caution-light text-caution">AI 다듬음 · 확인 필요</span>
  return <span className="badge bg-brand-light text-brand">초안</span>
}

function KeyCard({ value, readOnly, onSave }: { value: string; readOnly: boolean; onSave: (k: string) => void }) {
  const [k, setK] = useState(value)
  useEffect(() => setK(value), [value])
  return (
    <Collapse title="AI 다듬기 설정 (선택)" sub={value ? `Claude API 키 넣음 · ${POLISH_MODEL}` : 'Claude API 키가 없어요 — 없으면 AI 다듬기만 빠져요'}>
      <div className="space-y-2">
        <input className="field font-mono text-sm" type="password" autoComplete="off" value={k} placeholder="sk-ant-…" onChange={(e) => setK(e.target.value)} disabled={readOnly} aria-label="Claude API 키" />
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary flex-1" onClick={() => onSave(k.trim())} disabled={readOnly || k.trim() === value}>
            저장
          </button>
          {value && (
            <button type="button" className="btn btn-danger-soft" onClick={() => onSave('')} disabled={readOnly}>
              지우기
            </button>
          )}
        </div>
        <p className="hint">Anthropic 콘솔(console.anthropic.com)에서 만든 키를 넣어 주세요. 쓴 만큼 선생님 계정에 요금이 나가요. 키는 이 기기에만 저장되고 백업 파일에도 들어가지 않아요.</p>
      </div>
    </Collapse>
  )
}

function Editor({ group, student, draft, onClose }: { group: ClassGroup; student: Student; draft?: SeteukDraft; onClose: () => void }) {
  const { settings, readOnly } = useApp()
  const key = { schoolYear: settings.schoolYear, groupId: group.id, studentId: student.id }
  const [text, setText] = useState(draft?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ai, setAi] = useState<string | null>(null)
  const [reasons, setReasons] = useState<string[]>([])

  const src = useLiveQuery(async () => {
    const [records, keywords, assessments, scores, captains, groupsAll] = await Promise.all([
      db.records.where('studentId').equals(student.id).toArray(),
      db.keywords.toArray(),
      db.assessments.where('schoolYear').equals(settings.schoolYear).toArray(),
      db.assessmentScores.where('studentId').equals(student.id).toArray(),
      db.captains.where('studentId').equals(student.id).toArray(),
      db.groups.where('schoolYear').equals(settings.schoolYear).toArray(),
    ])
    const recs = records.filter((r) => r.schoolYear === settings.schoolYear && (!r.groupId || r.groupId === group.id))
    const mine = assessments.filter((a) => appliesTo(a, student, groupsAll) && (!a.groupIds?.length || a.groupIds.includes(group.id)))
    return { recs, keywords, mine, scores, captains }
  }, [student.id, group.id, settings.schoolYear])

  const parts = useMemo(() => {
    if (!src) return []
    return draftParts({
      records: src.recs,
      keywords: src.keywords,
      captainRoles: src.captains.filter((c) => c.schoolYear === settings.schoolYear).map((c) => c.role),
      assessments: src.mine.map((a) => ({ a, items: itemsOf(a), scores: src.scores.find((x) => x.assessmentId === a.id)?.scores })),
    })
  }, [src, settings.schoolYear])
  const evidence = useMemo(() => {
    if (!src) return []
    const notes = src.scores.filter((x) => x.note).map((x) => ({ title: src.mine.find((a) => a.id === x.assessmentId)?.title ?? '수행평가', note: x.note! }))
    return studentEvidence(src.recs, src.keywords, notes, { includeNegative: false })
  }, [src])

  const hits = checkSeteuk(text, { schoolName: settings.schoolName })
  const cnt = countText(text)
  const confirmedNow = draft?.status === 'confirmed' && draft.confirmedText === text.trim()
  const save = async () => {
    if (text !== (draft?.text ?? '')) await saveText(db, key, text)
  }
  const fillDraft = () => {
    const t = draftText(parts)
    if (text.trim() && !confirm('지금 쓴 글을 지우고 틀 초안으로 바꿀까요?')) return
    setText(t)
  }
  const polish = async () => {
    setErr('')
    setBusy(true)
    try {
      await save()
      const r = await polishSeteuk({ apiKey: settings.claudeApiKey, text, studentName: student.name, subject: group.subject || undefined })
      setAi(r.text)
    } catch (e) {
      setErr(e instanceof PolishError ? e.message : 'AI 요청 중 문제가 생겼어요.')
    } finally {
      setBusy(false)
    }
  }
  const useAi = async () => {
    if (ai === null) return
    await applyAi(db, key, ai)
    setText(ai)
    setAi(null)
  }
  const doConfirm = async () => {
    await save()
    const c = await confirmDraft(db, key, { schoolName: settings.schoolName })
    setReasons(c.reasons)
  }
  const preview = canConfirm({ text, aiUsed: draft?.aiUsed, aiText: draft?.aiText, aiConfirm: draft?.aiConfirm }, { schoolName: settings.schoolName })

  return (
    <BottomSheet title={`${memberNo(group, student)} ${student.name}`} sub="세특 쓰기" onClose={() => (save(), onClose())}>
      <div className="space-y-3">
        <Collapse title={`근거 기록 ${evidence.length}개`} sub="칭찬 · 관찰 · 부장 활동 · 수행평가 메모">
          {evidence.length ? (
            <ul className="space-y-1 text-sm">
              {evidence.map((e, i) => (
                <li key={i} className="rounded-lg bg-fill px-2 py-1">
                  {e.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">근거 기록이 없어요. 수업 중 칭찬 · 관찰 메모를 남겨 두면 초안에 들어가요.</p>
          )}
        </Collapse>

        {!readOnly && (
          <button type="button" className="btn btn-soft w-full" onClick={fillDraft} disabled={!parts.length}>
            <Icon name="note" /> 기록으로 틀 초안 넣기 {parts.length ? `(${parts.length}문장)` : '(기록 없음)'}
          </button>
        )}

        <label className="block">
          <span className="label flex items-baseline justify-between">
            <span>세부능력 및 특기사항 (선생님 문장으로)</span>
            <span className={`tabular-nums ${cnt.chars > SETEUK_MAX_CHARS ? 'font-extrabold text-danger' : 'text-ink-3'}`}>
              {cnt.chars}/{SETEUK_MAX_CHARS}자 · {cnt.bytes}B
            </span>
          </span>
          <textarea className="field min-h-[180px] py-3 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} disabled={readOnly} placeholder="학생이 실제로 한 활동을 선생님이 관찰한 대로 적어 주세요." />
        </label>

        {hits.length > 0 && (
          <ul className="space-y-1.5">
            {hits.map((h) => (
              <li key={h.id} className={`rounded-xl px-3 py-2 text-sm ${h.level === 'error' ? 'bg-danger-light text-danger' : 'bg-caution-light text-caution'}`}>
                <b>{h.title}</b>
                {h.words.length > 0 && <span> — {h.words.map((w) => `'${w}'`).join(', ')}</span>}
                <span className="block text-[0.8rem] opacity-80">{h.basis}</span>
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <button type="button" className="btn btn-soft w-full" onClick={polish} disabled={busy || !text.trim() || !settings.claudeApiKey}>
            <Icon name="bolt" /> {busy ? 'AI가 다듬는 중…' : settings.claudeApiKey ? 'AI로 다듬기 (윤문)' : 'AI로 다듬기 — 위 설정에 API 키를 넣어 주세요'}
          </button>
        )}
        {err && <p className="font-bold text-danger">{err}</p>}
        {ai !== null && (
          <section className="space-y-2 rounded-2xl bg-brand-light p-3">
            <p className="text-sm font-extrabold text-brand">AI가 다듬은 글 (그대로 입력 금지 — 받아 쓴 뒤 선생님이 고쳐 주세요)</p>
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{ai}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-soft" onClick={() => setAi(null)}>
                버리기
              </button>
              <button type="button" className="btn btn-primary" onClick={useAi}>
                받아 쓰기
              </button>
            </div>
          </section>
        )}

        {draft?.aiUsed && (
          <section className="space-y-1.5 rounded-2xl bg-fill p-3">
            <p className="text-sm font-extrabold">AI 도움을 받았어요 — 최종 입력 전 확인 (기재요령 총칙 5-다)</p>
            {AI_CONFIRM_ITEMS.map((label, i) => (
              <label key={label} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={!!draft.aiConfirm?.[i]}
                  disabled={readOnly}
                  onChange={(e) => {
                    const next = AI_CONFIRM_ITEMS.map((_, k) => (k === i ? e.target.checked : !!draft.aiConfirm?.[k]))
                    setAiConfirm(db, key, next)
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </section>
        )}

        {(reasons.length > 0 || (!preview.ok && text.trim())) && (
          <ul className="space-y-1 text-sm font-bold text-danger">
            {(reasons.length ? reasons : preview.reasons).map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="grid grid-cols-2 gap-2">
            {confirmedNow ? (
              <button type="button" className="btn btn-soft" onClick={() => unconfirm(db, key)}>
                확정 풀기
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={doConfirm} disabled={!preview.ok}>
                <Icon name="check" /> 확정
              </button>
            )}
            <button type="button" className="btn btn-soft" disabled={!confirmedNow} onClick={() => copyText(draft?.confirmedText ?? '')}>
              <Icon name="copy" /> 나이스용 복사
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
