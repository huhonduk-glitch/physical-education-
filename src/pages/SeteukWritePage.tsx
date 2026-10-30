import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Collapse from '../components/Collapse'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { loadGroupBasis } from '../db/seteukLevelRepo'
import { applyAi } from '../db/seteukRepo'
import type { SeteukDraft } from '../db/types'
import { AiError, draftPrompt, runAi } from '../lib/aiPolish'
import { copyText, saveXlsx } from '../lib/download'
import { memberNo, readLastGroup } from '../lib/groups'
import { countText } from '../lib/seteukCheck'
import { assignLevels, frameFor, frameInstruction, levelScores } from '../lib/seteukLevel'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'
import AiSetupCard, { aiSettingsOf } from './seteuk/AiSetupCard'
import LevelSheet from './seteuk/LevelSheet'
import SeteukEditor from './seteuk/SeteukEditor'
import { aiEvidence, basisKeyFor, LEVEL_TONE } from './seteuk/seteukShared'

/**
 * 세특 쓰기 (6-5 ③ + 6-7 수준별): ① 수준 나누기(수행평가 · 칭찬·관찰 · PAPS · 지도) → ② 학생마다 수준 틀로 초안
 * → 선생님이 고침 → (선택) AI 초안 · 다듬기(이름 가림) → 다시 고치고 확인 → 확정 → 복사 · 엑셀.
 * 기재요령(2026 고등학교) 총칙 5-다: AI 생성 글을 그대로 입력 금지, 윤문 보조는 최종 입력 전 확인.
 */
export default function SeteukWritePage() {
  const { settings, standards, readOnly } = useApp()
  const [sp, setSp] = useSearchParams()
  const { groups, membersOf } = useGroups()
  const want = sp.get('g') ?? readLastGroup()
  const group = groups?.find((g) => g.id === want) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const drafts = useLiveQuery(() => (group ? db.seteukDrafts.where('groupId').equals(group.id).toArray() : []), [group?.id])
  const byStudent = useMemo(() => new Map((drafts ?? []).map((d) => [d.studentId, d])), [drafts])
  const basis = useLiveQuery(
    () => (group ? loadGroupBasis(db, group, members, { schoolYear: settings.schoolYear, standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }) : []),
    [group?.id, members, settings.schoolYear, standards, settings.schoolLevel, settings.papsFlexMode],
  )
  const count = settings.seteukLevelCount
  const scoreList = useMemo(() => levelScores((basis ?? []).map((b) => b.signals), settings.seteukWeights), [basis, settings.seteukWeights])
  const scores = useMemo(() => new Map(scoreList.map((s) => [s.studentId, s])), [scoreList])
  const auto = useMemo(() => assignLevels(scoreList, count), [scoreList, count])
  const levelOf = (id: string) => Math.min(count, byStudent.get(id)?.level ?? auto.get(id) ?? 1)
  const names = useMemo(() => members.map((s) => s.name), [members])

  const [openId, setOpenId] = useState<string | null>(null)
  const [levelSheet, setLevelSheet] = useState(false)
  const [filter, setFilter] = useState<number | 0>(0)
  const [msg, setMsg] = useState('')

  const confirmed = members.filter((s) => byStudent.get(s.id)?.status === 'confirmed')
  const shown = members.filter((s) => !filter || levelOf(s.id) === filter)
  const dist = Array.from({ length: count }, (_, i) => count - i).map((k) => ({ k, n: members.filter((s) => levelOf(s.id) === k).length }))
  const thin = scoreList.filter((s) => s.thin).length

  // 여러 명 AI 초안 (살핌의 '여러 학생 한 번에 + 공통 요청'을 참고): 빈칸 · 초안 학생만, 한 명씩 차례로
  const ai$ = aiSettingsOf(settings)
  const aiReady = ai$.provider === 'claude' ? !!ai$.claudeApiKey : ai$.provider === 'openrouter' ? !!(ai$.openrouterApiKey && ai$.openrouterModel) : false
  const [pick, setPick] = useState<Set<string>>(new Set())
  const [batchReq, setBatchReq] = useState('')
  const [batch, setBatch] = useState<{ done: number; total: number; fail: number } | null>(null)
  const stop = useRef(false)
  const runBatch = async () => {
    if (!group || !basis) return
    const list = basis.filter((b) => pick.has(b.student.id))
    stop.current = false
    let fail = 0
    setBatch({ done: 0, total: list.length, fail })
    for (const [i, b] of list.entries()) {
      if (stop.current) break
      const d = byStudent.get(b.student.id)
      const ev = aiEvidence(b, { important: d?.important ?? [], excluded: d?.excluded ?? [], names })
      if (ev.length) {
        try {
          const r = await runAi(ai$, draftPrompt({ evidence: ev, subject: group.subject || undefined, styleExamples: ai$.styleExamples, frame: frameInstruction(frameFor(levelOf(b.student.id), count, settings.seteukFrames)), request: batchReq }))
          await applyAi(db, { schoolYear: settings.schoolYear, groupId: group.id, studentId: b.student.id }, r.text, basisKeyFor(b, d?.excluded ?? []))
        } catch (e) {
          fail++
          if (e instanceof AiError && /키|크레딧|권한/.test(e.message)) {
            setMsg(e.message)
            break
          }
        }
      } else fail++
      setBatch({ done: i + 1, total: list.length, fail })
    }
    setPick(new Set())
    setBatch(null)
    setMsg((m) => m || `AI 초안을 넣었어요${fail ? ` (못 한 학생 ${fail}명 — 근거가 없거나 요청이 실패했어요)` : ''}. 학생마다 열어 선생님 문장으로 고친 뒤 확정해 주세요.`)
  }

  const exportXlsx = async () => {
    if (!group) return
    await saveXlsx(`세특_${group.name.replace(/\s+/g, '')}_${settings.schoolYear}.xlsx`, [
      {
        name: '세특',
        rows: [
          ['번호', '학번', '이름', '세부능력 및 특기사항', '글자 수', '바이트'],
          ...confirmed.map((s) => {
            const t = byStudent.get(s.id)!.confirmedText ?? ''
            const c = countText(t)
            return [memberNo(group, s), s.studentCode, s.name, t, c.chars, c.bytes]
          }),
        ],
        widths: [5, 8, 8, 90, 7, 7],
      },
    ])
  }
  const copyAll = async () => {
    if (!group) return
    const ok = await copyText(confirmed.map((s) => `${memberNo(group, s)} ${s.name}\n${byStudent.get(s.id)!.confirmedText ?? ''}`).join('\n\n'))
    setMsg(ok ? `확정한 ${confirmed.length}명의 글을 복사했어요.` : '복사하지 못했어요. 엑셀로 받아 주세요.')
  }

  const openBasis = basis?.find((b) => b.student.id === openId)

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

        <Collapse title="기재요령 AI 규정 (꼭 읽어 주세요)" sub="AI 글을 그대로 입력하면 안 돼요" defaultOpen={!settings.claudeApiKey && !settings.openrouterApiKey}>
          <div className="space-y-2 text-sm text-ink-2">
            <p>
              <b>2026학년도 학교생활기록부 기재요령(고등학교) 총칙 5-다</b>: &ldquo;AI를 활용하여 생성한 자료를 학교생활기록부의 서술형 항목에 그대로 입력하는 행위&rdquo;는 금지돼요. 윤문 등 보조로 쓸 때는 최종 입력 전에 허위·과장 여부와 기재요령 유의사항을 꼭 확인해야 해요.
            </p>
            <p>그래서 이 화면은 ① 수준 나누기 → ② 선생님 기록으로 수준 틀 초안 → ③ 선생님이 고쳐 씀 → ④ (선택) AI 초안 · 다듬기 → ⑤ 다시 선생님이 고치고 확인 4개 체크 → 확정 순서로만 확정돼요. AI 글을 한 글자도 안 고치면 확정할 수 없어요.</p>
            <p>[AI 초안] · [AI로 다듬기]를 누르면 그 학생의 <b>과목 · 근거 기록 또는 초안</b>이 고른 AI 회사로 보내져요. 학생 이름은 &lsquo;학생&rsquo;으로 가리고, 수준 · 점수는 보내지 않아요. 학교·교육청 개인정보 지침을 먼저 확인해 주세요.</p>
            <p className="font-bold text-danger">AI 도움을 받아 쓴 생기부의 책임은 작성한 선생님 본인에게 있어요.</p>
            <Link to="/seteuk/ai-guide" className="btn btn-soft w-full">
              <Icon name="info" /> AI 연결 방법 · 주의사항 자세히 보기
            </Link>
          </div>
        </Collapse>

        <AiSetupCard readOnly={readOnly} />

        {group && members.length > 0 && (
          <section className="card space-y-3">
            <div className="flex items-center gap-2">
              <p className="card-title flex-1">① 수준 나누기 · {count}수준</p>
              <button type="button" className="btn btn-primary" onClick={() => setLevelSheet(true)} disabled={!basis}>
                수준 정하기
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="수준으로 보기">
              <button type="button" role="radio" aria-checked={filter === 0} className="chip" onClick={() => setFilter(0)}>
                전체 {members.length}
              </button>
              {dist.map(({ k, n }) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} className="chip" onClick={() => setFilter(k)}>
                  <b className={LEVEL_TONE(k, count)}>{k}</b> {frameFor(k, count, settings.seteukFrames).name} {n}
                </button>
              ))}
            </div>
            <p className="hint">
              수행평가 · 칭찬·관찰 · PAPS · 지도 기록으로 반 안에서 나눈 <b>제안</b>이에요. 수준마다 글 분량과 짜임이 달라요.
              {thin > 0 && <b className="text-caution"> 근거가 적은 학생 {thin}명 — 수업 중 관찰 메모를 더 남겨 주세요.</b>}
            </p>
          </section>
        )}

        {group && (
          <section className="card overflow-hidden p-0">
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <p className="card-title flex-1">
                ② 쓰기 · 확정 {confirmed.length}/{members.length}명
              </p>
              <button type="button" className="btn btn-soft" onClick={copyAll} disabled={!confirmed.length}>
                <Icon name="copy" /> 확정 글 복사
              </button>
            </div>
            {msg && <p className="px-5 pb-2 font-bold text-ok">{msg}</p>}
            <ul>
              {shown.map((s) => {
                const d = byStudent.get(s.id)
                const t = d?.text ?? ''
                const lv = levelOf(s.id)
                const canPick = aiReady && !readOnly && d?.status !== 'confirmed'
                return (
                  <li key={s.id} className="flex items-center">
                    {aiReady && !readOnly && (
                      <label className="grid h-12 w-11 shrink-0 place-items-center pl-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          aria-label={`${s.name} 여러 명 AI 초안에 넣기`}
                          disabled={!canPick || !!batch}
                          checked={pick.has(s.id)}
                          onChange={() => setPick((p) => (p.has(s.id) ? new Set([...p].filter((x) => x !== s.id)) : new Set([...p, s.id])))}
                        />
                      </label>
                    )}
                    <button type="button" className="list-row min-w-0 flex-1 text-left hover:bg-fill" onClick={() => setOpenId(s.id)}>
                      <span className="w-10 shrink-0 font-extrabold tabular-nums">{memberNo(group, s)}</span>
                      <span className={`w-7 shrink-0 text-center text-lg font-black ${LEVEL_TONE(lv, count)}`} title="수준">
                        {lv}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block">
                          {s.name}
                          {scores.get(s.id)?.thin && <span className="ml-1 badge bg-caution-light text-caution">근거 부족</span>}
                        </b>
                        <span className="hint block truncate">{t || '아직 안 씀'}</span>
                      </span>
                      <StatusBadge d={d} stale={!!(d?.basisKey && openBasisKey(basis, s.id, d) !== d.basisKey)} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {aiReady && !readOnly && group && (
          <section className="card space-y-2">
            <p className="card-title">여러 명 AI 초안</p>
            <p className="hint">위 목록에서 학생을 체크하면 학생마다 그 수준의 분량 · 짜임으로 AI 초안을 넣어요(이름 가림). 넣은 뒤 학생마다 열어 선생님 문장으로 고쳐야 확정할 수 있어요.</p>
            <input className="field text-sm" value={batchReq} onChange={(e) => setBatchReq(e.target.value)} placeholder="(선택) 모두에게 줄 요청 — 예: 협력한 장면을 앞에" aria-label="공통 요청" />
            {batch ? (
              <div className="space-y-1" role="status">
                <div className="h-2 overflow-hidden rounded-full bg-fill-2">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(batch.done / Math.max(1, batch.total)) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <p className="hint flex-1 tabular-nums">
                    {batch.done}/{batch.total}명 쓰는 중…
                  </p>
                  <button type="button" className="btn btn-soft text-sm" onClick={() => (stop.current = true)}>
                    멈추기
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setPick(new Set(shown.filter((s) => !byStudent.get(s.id)?.text.trim()).map((s) => s.id)))}
                >
                  빈칸 학생 모두
                </button>
                <button type="button" className="btn btn-primary" disabled={!pick.size} onClick={runBatch}>
                  {pick.size}명 AI 초안
                </button>
              </div>
            )}
          </section>
        )}
        <p className="hint px-1">나이스에는 확정한 글을 학생마다 [복사]해서 붙여 넣거나, 엑셀로 받아 옮겨 주세요. 나이스 화면에 자동으로 입력하지 않아요.</p>
      </div>

      {levelSheet && group && basis && <LevelSheet group={group} basis={basis} scores={scores} auto={auto} drafts={byStudent} onClose={() => setLevelSheet(false)} />}
      {openBasis && group && (
        <SeteukEditor
          group={group}
          basis={openBasis}
          draft={byStudent.get(openBasis.student.id)}
          level={levelOf(openBasis.student.id)}
          autoLevel={auto.get(openBasis.student.id) ?? 1}
          levelCount={count}
          frame={frameFor(levelOf(openBasis.student.id), count, settings.seteukFrames)}
          names={names}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}

function openBasisKey(basis: Awaited<ReturnType<typeof loadGroupBasis>> | undefined, id: string, d: SeteukDraft): string | undefined {
  const b = basis?.find((x) => x.student.id === id)
  return b ? basisKeyFor(b, d.excluded ?? []) : d.basisKey
}

function StatusBadge({ d, stale }: { d?: SeteukDraft; stale: boolean }) {
  if (!d || !d.text.trim()) return <span className="badge bg-fill text-ink-3">빈칸</span>
  if (d.status === 'confirmed') return <span className="badge bg-ok-light text-ok">확정</span>
  if (stale) return <span className="badge bg-caution-light text-caution">근거 바뀜</span>
  if (d.aiUsed) return <span className="badge bg-caution-light text-caution">AI · 고쳐 쓰기</span>
  return <span className="badge bg-brand-light text-brand">초안</span>
}
