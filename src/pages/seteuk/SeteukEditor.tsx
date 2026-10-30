import { useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import { db } from '../../db/db'
import type { StudentBasis } from '../../db/seteukLevelRepo'
import { applyAi, canConfirm, confirmDraft, saveDraftFromBasis, saveText, setAiConfirm, setLevel, toggleMark, unconfirm } from '../../db/seteukRepo'
import type { ClassGroup, SeteukDraft } from '../../db/types'
import { AiError, draftPrompt, manualPromptText, maskNames, polishPrompt, runAi } from '../../lib/aiPolish'
import { copyText } from '../../lib/download'
import { memberNo } from '../../lib/groups'
import { AI_CONFIRM_ITEMS, checkSeteuk, countText, SETEUK_MAX_BYTES } from '../../lib/seteukCheck'
import { draftText, partsForLevel } from '../../lib/seteukDraft'
import { frameInstruction, type LevelFrame } from '../../lib/seteukLevel'
import { useApp } from '../../state/AppContext'
import { aiSettingsOf } from './AiSetupCard'
import { aiEvidence, basisKeyFor, LEVEL_TONE } from './seteukShared'

interface Props {
  group: ClassGroup
  basis: StudentBasis
  draft?: SeteukDraft
  /** 지금 쓰는 수준 (교사가 정한 것 또는 앱 제안) */
  level: number
  autoLevel: number
  levelCount: number
  frame: LevelFrame
  /** 이 반 학생 이름 전부 (AI로 보낼 때 가린다) */
  names: string[]
  onClose: () => void
}

/**
 * 학생 한 명 세특 쓰기 (6-5 ③ + 6-7): 수준 → 근거(#번호 · 중요 · 빼기) → 수준 틀 초안 → 선생님이 고침 →
 * (선택) AI 초안 · 다듬기 · 추가 요청 → 다시 고치고 확인 4개 → 확정. 살핌의 학생별 완성 화면을 참고했다.
 */
export default function SeteukEditor({ group, basis, draft, level, autoLevel, levelCount, frame, names, onClose }: Props) {
  const { settings, readOnly } = useApp()
  const student = basis.student
  const key = { schoolYear: settings.schoolYear, groupId: group.id, studentId: student.id }
  const [text, setText] = useState(draft?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ai, setAi] = useState<string | null>(null)
  const [request, setRequest] = useState('')
  const [reasons, setReasons] = useState<string[]>([])
  const [pasteBox, setPasteBox] = useState<string | null>(null)

  const important = draft?.important ?? []
  const excluded = draft?.excluded ?? []
  // 근거 목록: 기록 · 수행평가 메모 + 받은 등급 기준 문장 (#번호는 이 순서)
  const items = [...basis.evidence.map((e) => ({ id: e.id, text: e.text })), ...basis.parts.filter((p) => p.kind === 'assess').map((p) => ({ id: p.id, text: p.text }))]
  const used = items.filter((i) => !excluded.includes(i.id))
  const curKey = basisKeyFor(basis, excluded)
  const stale = !!draft?.basisKey && draft.basisKey !== curKey && draft.status !== 'confirmed'
  const picked = partsForLevel(basis.parts, { maxParts: frame.maxParts, important, excluded })

  const hits = checkSeteuk(text, { schoolName: settings.schoolName })
  const cnt = countText(text)
  const inRange = cnt.bytes >= frame.minBytes && cnt.bytes <= frame.maxBytes
  const confirmedNow = draft?.status === 'confirmed' && draft.confirmedText === text.trim()
  const save = async () => {
    if (text !== (draft?.text ?? '')) await saveText(db, key, text)
  }
  const fillDraft = async () => {
    if (text.trim() && !confirm('지금 쓴 글을 지우고 수준 틀 초안으로 바꿀까요?')) return
    const t = draftText(picked)
    setText(t)
    await saveDraftFromBasis(db, key, t, curKey)
  }
  const ai$ = aiSettingsOf(settings)
  const manual = ai$.provider === 'manual'
  const ready = ai$.provider === 'claude' ? !!ai$.claudeApiKey : ai$.provider === 'openrouter' ? !!(ai$.openrouterApiKey && ai$.openrouterModel) : true
  const evidenceForAi = aiEvidence(basis, { important, excluded, names })
  const promptFor = (kind: 'draft' | 'polish') =>
    kind === 'draft'
      ? draftPrompt({ evidence: evidenceForAi, subject: group.subject || undefined, styleExamples: ai$.styleExamples, frame: frameInstruction(frame), request })
      : polishPrompt({ text: maskNames(text, names), evidence: request.trim() ? evidenceForAi : undefined, subject: group.subject || undefined, styleExamples: ai$.styleExamples, frame: frameInstruction(frame), request })
  const askAi = async (kind: 'draft' | 'polish') => {
    setErr('')
    await save()
    const p = promptFor(kind)
    if (manual) {
      const ok = await copyText(manualPromptText(p))
      setPasteBox('')
      if (!ok) setErr('복사하지 못했어요.')
      return
    }
    setBusy(true)
    try {
      setAi((await runAi(ai$, p)).text)
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'AI 요청 중 문제가 생겼어요.')
    } finally {
      setBusy(false)
    }
  }
  const useAi = async () => {
    if (ai === null) return
    await applyAi(db, key, ai, curKey)
    setText(ai)
    setAi(null)
    setRequest('')
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
        <section className="space-y-2 rounded-2xl bg-fill p-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="수준">
            <span className="mr-1 text-sm font-bold text-ink-3">수준</span>
            {Array.from({ length: levelCount }, (_, i) => levelCount - i).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={level === k} className="chip" disabled={readOnly} onClick={() => setLevel(db, key, k === autoLevel ? undefined : k)}>
                {k}
                {k === autoLevel ? ' · 제안' : ''}
              </button>
            ))}
          </div>
          <p className="text-sm">
            <b className={LEVEL_TONE(level, levelCount)}>{frame.name}</b> 틀 · 목표 {frame.minBytes.toLocaleString()}~{frame.maxBytes.toLocaleString()}바이트 · 초안 문장 {frame.maxParts}개까지
          </p>
          <p className="hint">{frame.guide}</p>
        </section>

        <Collapse title={`근거 ${used.length}/${items.length}개`} sub="#번호 · ☆중요 · 빼기 — AI에 '#2 강조'처럼 요청할 수 있어요" defaultOpen={!text.trim()}>
          {items.length ? (
            <ol className="space-y-1.5 text-sm">
              {items.map((e, i) => {
                const imp = important.includes(e.id)
                const ex = excluded.includes(e.id)
                return (
                  <li key={e.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${ex ? 'bg-fill text-ink-3 line-through' : imp ? 'bg-brand-light' : 'bg-fill'}`}>
                    <b className="shrink-0 rounded bg-brand px-1.5 text-xs text-white">#{i + 1}</b>
                    <span className="min-w-0 flex-1">{e.text}</span>
                    <button type="button" className="shrink-0 px-1 text-base" aria-pressed={imp} aria-label={`#${i + 1} 중요`} disabled={readOnly} onClick={() => toggleMark(db, key, 'important', e.id)}>
                      {imp ? '★' : '☆'}
                    </button>
                    <button type="button" className="shrink-0 text-xs font-bold text-ink-3 underline" aria-pressed={ex} disabled={readOnly} onClick={() => toggleMark(db, key, 'excluded', e.id)}>
                      {ex ? '되살리기' : '빼기'}
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="hint">근거 기록이 없어요. 수업 중 칭찬 · 관찰 메모를 남겨 두면 초안에 들어가요.</p>
          )}
        </Collapse>

        {stale && <p className="rounded-xl bg-caution-light px-3 py-2 text-sm font-bold text-caution">초안을 만든 뒤 근거가 바뀌었어요. 다시 만들거나 새 근거를 글에 더해 주세요.</p>}

        {!readOnly && (
          <button type="button" className={`btn w-full ${stale ? 'btn-primary' : 'btn-soft'}`} onClick={fillDraft} disabled={!picked.length}>
            <Icon name="note" /> 수준 틀로 초안 넣기 {picked.length ? `(${picked.length}문장 · 기기 안에서)` : '(기록 없음)'}
          </button>
        )}

        <label className="block">
          <span className="label flex items-baseline justify-between">
            <span>세부능력 및 특기사항 (선생님 문장으로)</span>
            <span className={`tabular-nums ${cnt.bytes > SETEUK_MAX_BYTES ? 'font-extrabold text-danger' : inRange ? 'font-bold text-ok' : 'text-ink-3'}`}>
              {cnt.bytes}/{SETEUK_MAX_BYTES}바이트 · {cnt.chars}자
            </span>
          </span>
          <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-fill-2" aria-hidden>
            <div className={`h-full rounded-full ${cnt.bytes > SETEUK_MAX_BYTES ? 'bg-danger' : inRange ? 'bg-ok' : 'bg-brand'}`} style={{ width: `${Math.min(100, (cnt.bytes / SETEUK_MAX_BYTES) * 100)}%` }} />
          </div>
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
          <>
            <input
              className="field text-sm"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="(선택) AI에 추가 요청 — 예: #2 강조, 조금 더 짧게"
              aria-label="AI 추가 요청"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-soft" onClick={() => askAi('draft')} disabled={busy || !ready || !used.length}>
                <Icon name="bolt" /> {manual ? 'AI 초안 요청문 복사' : 'AI 초안'}
              </button>
              <button type="button" className="btn btn-soft" onClick={() => askAi('polish')} disabled={busy || !ready || !text.trim()}>
                <Icon name="bolt" /> {busy ? 'AI가 쓰는 중…' : manual ? '다듬기 요청문 복사' : request.trim() ? '요청대로 고치기' : 'AI로 다듬기'}
              </button>
            </div>
            <p className="hint">AI에는 이름을 가린 근거와 분량 지시만 보내요. 학생 이름 · 수준은 보내지 않아요.</p>
          </>
        )}
        {!ready && <p className="hint">AI를 쓰려면 위 [AI 연결]에서 키(와 모델)를 넣어 주세요.</p>}
        {pasteBox !== null && ai === null && (
          <section className="space-y-2 rounded-2xl bg-fill p-3">
            <p className="text-sm font-bold">요청문을 복사했어요. 무료 챗봇에 붙여 넣고, 받은 답을 여기에 붙여 넣으세요.</p>
            <textarea className="field min-h-[100px] py-3 text-sm" value={pasteBox} onChange={(e) => setPasteBox(e.target.value)} placeholder="챗봇의 답 붙여 넣기" />
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={!pasteBox.trim()}
              onClick={() => {
                setAi(pasteBox.trim())
                setPasteBox(null)
              }}
            >
              확인
            </button>
          </section>
        )}
        {err && <p className="font-bold text-danger">{err}</p>}
        {ai !== null && (
          <section className="space-y-2 rounded-2xl bg-brand-light p-3">
            <p className="text-sm font-extrabold text-brand">AI가 쓴 글 (그대로 입력 금지 — 받아 쓴 뒤 선생님이 고쳐 주세요)</p>
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{ai}</p>
            <p className="hint tabular-nums">{countText(ai).bytes}바이트 · 목표 {frame.minBytes}~{frame.maxBytes}</p>
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
