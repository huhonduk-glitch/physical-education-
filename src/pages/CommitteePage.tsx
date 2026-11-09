import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import {
  AGENDA_PRESETS,
  EMPTY_COMMITTEE,
  MEETING_STEPS,
  memberProblems,
  minutesText,
  noticeBy,
  passed,
  passNeeded,
  quorum,
  yearStatus,
  type AgendaItem,
  type CommitteeMeeting,
  type CommitteeMember,
  type CommitteeYear,
  type Decision,
  type MeetingKind,
  type MemberKind,
} from '../lib/committee'
import { shortDateLabel, todayStr } from '../lib/dates'
import { copyText } from '../lib/download'
import { useApp } from '../state/AppContext'

const KINDS: MeetingKind[] = ['1학기 정기', '2학기 정기', '임시', '서면결의']
const DECISIONS: Decision[] = ['원안 가결', '수정 가결', '부결', '보고(의결 없음)']
const MEMBER_KINDS: MemberKind[] = ['당연직', '위촉', '외부']
const POSTS = ['', '위원장', '부위원장', '간사'] as const
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
// 붙은 쪽은 범위(23~24쪽), 떨어진 쪽은 따로(19 · 156쪽)
const pageLabel = (p: number | [number, number]) => (Array.isArray(p) ? `${p[0]}${p[1] - p[0] > 3 ? " · " : "~"}${p[1]}쪽` : `${p}쪽`)

/**
 * 학교체육소위원회 회의 기록 (2026-11-09): 절차 · 위원 명단 · 학기별 정기회의 현황 · 회의 기록 · 회의록(인쇄 · 복사).
 * 회의록은 공식 서식이 없어 '학교 자체 양식 예시'. 계산 src/lib/committee.ts
 */
export default function CommitteePage() {
  const { settings, updateSettings, readOnly } = useApp()
  const year = settings.schoolYear
  const data: CommitteeYear = settings.committee?.[year] ?? EMPTY_COMMITTEE
  const save = (next: CommitteeYear) => updateSettings({ committee: { ...(settings.committee ?? {}), [year]: next } })
  const [editing, setEditing] = useState<CommitteeMeeting | null>(null)
  const [printing, setPrinting] = useState<CommitteeMeeting | null>(null)
  const [copied, setCopied] = useState('')
  const status = yearStatus(data.meetings, year)
  const problems = memberProblems(data.members)

  const setMember = (id: string, patch: Partial<CommitteeMember>) => void save({ ...data, members: data.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const saveMeeting = (m: CommitteeMeeting) => {
    const rest = data.meetings.filter((x) => x.id !== m.id)
    void save({ ...data, meetings: [...rest, m].sort((a, b) => a.date.localeCompare(b.date)) })
    setEditing(null)
  }
  const newMeeting = (): CommitteeMeeting => {
    const today = todayStr()
    const kind: MeetingKind = status[0].ok ? '2학기 정기' : '1학기 정기'
    return { id: newId(), kind, date: today, time: '16:00', place: '', present: data.members.map((m) => m.id), agenda: [], note: '' }
  }
  const copyMinutes = async (m: CommitteeMeeting) => {
    if (await copyText(minutesText(m, data.members, settings.schoolName))) {
      setCopied(m.id)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  if (printing) return <MinutesPrint m={printing} members={data.members} school={settings.schoolName} onClose={() => setPrinting(null)} />

  return (
    <>
      <PageHeader title="소위원회 회의 · 회의록" sub={`${year}학년도 학교체육소위원회`} back />
      <div className="page space-y-4 pb-10">
        <section className="grid grid-cols-2 gap-2" aria-label="정기회의 현황">
          {status.map((s) => (
            <div key={s.sem} className={`card p-3.5 ${s.ok ? '' : 'ring-2 ring-caution/40'}`}>
              <p className="text-[0.8rem] font-bold text-ink-3">{s.sem}학기 정기회의 (의무)</p>
              <p className={`mt-0.5 text-[1.15rem] font-black ${s.ok ? 'text-ok' : 'text-caution'}`}>{s.ok ? `✓ ${shortDateLabel(s.held[0].date)}` : '아직'}</p>
              <p className="text-[0.75rem] text-ink-3">{s.ok ? `회의록 ${s.held.some((h) => h.approvedOn) ? '결재함' : '결재 전'}` : '학기마다 1번 · 연 2회'}</p>
            </div>
          ))}
        </section>
        <p className="hint px-1">교육청 점검표(서식 11)는 소위원회 개최일자와 회의록 작성 여부를 봐요.</p>

        <section className="card space-y-2">
          <p className="card-title">회의 절차</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-[0.92rem]">
            {MEETING_STEPS.map((s) => (
              <li key={s.text}>
                {s.text} <span className="text-xs font-semibold whitespace-nowrap text-ink-3">(운영방향 {pageLabel(s.page)})</span>
              </li>
            ))}
          </ol>
          <Link to="/work/committee" className="text-sm font-bold text-brand">
            구성 · 심의 사항 · 운영 규정 예시 보기 ›
          </Link>
        </section>

        <section className="card space-y-2">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">위원 명단 {data.members.length}명</p>
            {!readOnly && (
              <button type="button" className="btn btn-soft shrink-0 px-3" onClick={() => void save({ ...data, members: [...data.members, { id: newId(), name: '', role: '', kind: '위촉' }] })}>
                + 위원
              </button>
            )}
          </div>
          {problems.length > 0 && (
            <ul className="space-y-0.5 rounded-xl bg-caution-light px-3 py-2 text-sm font-semibold text-caution">
              {problems.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          )}
          {data.members.length === 0 && <p className="hint">당연직(교감 · 체육 업무 부장) · 위촉(학부모 위원 등) · 외부위원을 넣어 주세요. 5~7명.</p>}
          <ul className="space-y-2">
            {data.members.map((m) => (
              <li key={m.id} className="space-y-1.5 rounded-xl bg-fill p-2.5">
                <div className="flex gap-1.5">
                  <input className="field min-w-0 flex-1" placeholder="이름" defaultValue={m.name} disabled={readOnly} onBlur={(e) => e.target.value !== m.name && setMember(m.id, { name: e.target.value })} />
                  <input className="field min-w-0 flex-1" placeholder="직위 (교감 · 학부모위원 …)" defaultValue={m.role} disabled={readOnly} onBlur={(e) => e.target.value !== m.role && setMember(m.id, { role: e.target.value })} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {MEMBER_KINDS.map((k) => (
                    <button key={k} type="button" className="chip" aria-pressed={m.kind === k} disabled={readOnly} onClick={() => setMember(m.id, { kind: k })}>
                      {k}
                    </button>
                  ))}
                  <select className="field h-10 min-h-0 w-28 py-0 text-sm" aria-label="직책" value={m.post ?? ''} disabled={readOnly} onChange={(e) => setMember(m.id, { post: (e.target.value || undefined) as CommitteeMember['post'] })}>
                    {POSTS.map((p) => (
                      <option key={p} value={p}>
                        {p || '직책 없음'}
                      </option>
                    ))}
                  </select>
                  {!readOnly && (
                    <button type="button" className="btn btn-ghost ml-auto h-9 min-h-0 px-2 text-ink-3" aria-label="위원 빼기" onClick={() => confirm('이 위원을 뺄까요?') && void save({ ...data, members: data.members.filter((x) => x.id !== m.id) })}>
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-2">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">회의 기록 {data.meetings.length}</p>
            {!readOnly && (
              <button type="button" className="btn btn-primary shrink-0 px-3" disabled={data.members.length === 0} onClick={() => setEditing(newMeeting())}>
                + 회의
              </button>
            )}
          </div>
          {data.meetings.length === 0 && <p className="hint">회의를 열면 여기에 적어요. 회의록은 인쇄(PDF)하거나 복사해 결재 시스템에 붙여 넣어요.</p>}
          <ul className="divide-y divide-line">
            {data.meetings.map((m) => {
              const q = quorum(data.members.length, m.present.length)
              return (
                <li key={m.id} className="space-y-1.5 py-2.5">
                  <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setEditing(m)}>
                    <span className="badge shrink-0 bg-brand-light text-brand">{m.kind}</span>
                    <b className="min-w-0 flex-1 truncate">
                      {shortDateLabel(m.date)} · 안건 {m.agenda.length}개
                    </b>
                    <span className={`shrink-0 text-sm font-bold ${q.ok ? 'text-ok' : 'text-danger'}`}>
                      {m.present.length}/{data.members.length}명
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="btn btn-soft h-10 min-h-0 px-3 text-sm" onClick={() => setPrinting(m)}>
                      <Icon name="file" size={16} /> 회의록 인쇄
                    </button>
                    <button type="button" className="btn btn-soft h-10 min-h-0 px-3 text-sm" onClick={() => void copyMinutes(m)}>
                      <Icon name="copy" size={16} /> {copied === m.id ? '복사했어요' : '회의록 복사'}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className={`btn h-10 min-h-0 px-3 text-sm ${m.approvedOn ? 'btn-soft text-ok' : 'btn-outline'}`}
                        onClick={() => saveMeeting({ ...m, approvedOn: m.approvedOn ? undefined : todayStr() })}
                      >
                        {m.approvedOn ? `✓ 결재 ${shortDateLabel(m.approvedOn)}` : '학교장 결재함'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="hint">회의록은 운영방향 · 서식에 정해진 양식이 없어 규정 예시(성원 · 의결 기준)에 맞춘 학교 자체 양식 예시예요. 학교 양식이 있으면 그 양식에 옮겨 쓰세요.</p>
        </section>
      </div>
      {editing && <MeetingSheet m={editing} members={data.members} readOnly={readOnly} onSave={saveMeeting} onDelete={() => (void save({ ...data, meetings: data.meetings.filter((x) => x.id !== editing.id) }), setEditing(null))} onClose={() => setEditing(null)} />}
    </>
  )
}

function MeetingSheet({ m: init, members, readOnly, onSave, onDelete, onClose }: { m: CommitteeMeeting; members: CommitteeMember[]; readOnly: boolean; onSave: (m: CommitteeMeeting) => void; onDelete: () => void; onClose: () => void }) {
  const [m, setM] = useState(init)
  const set = (p: Partial<CommitteeMeeting>) => setM({ ...m, ...p })
  const setItem = (i: number, p: Partial<AgendaItem>) => set({ agenda: m.agenda.map((a, k) => (k === i ? { ...a, ...p } : a)) })
  const q = quorum(members.length, m.present.length)
  const need = passNeeded(m.present.length)
  return (
    <BottomSheet title={`${m.kind} 회의`} sub={`안건 통보: ${shortDateLabel(noticeBy(m.date))}까지 (회의 5일 전)`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={m.kind === k} onClick={() => set({ kind: k })}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="date" className="field w-40 shrink-0" value={m.date} onChange={(e) => set({ date: e.target.value })} />
          <input type="time" className="field w-28 shrink-0" value={m.time} onChange={(e) => set({ time: e.target.value })} />
          <input className="field min-w-0 flex-1" placeholder="장소" value={m.place} onChange={(e) => set({ place: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold">
            참석 위원 — <span className={q.ok ? 'text-ok' : 'text-danger'}>{q.ok ? `과반수(${q.needed}명) 출석, 개의 가능` : `과반수 ${q.needed}명이 필요해요`}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {members.map((x) => (
              <button
                key={x.id}
                type="button"
                className="chip"
                aria-pressed={m.present.includes(x.id)}
                onClick={() => set({ present: m.present.includes(x.id) ? m.present.filter((y) => y !== x.id) : [...m.present, x.id] })}
              >
                {x.name || '(이름 없음)'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold">안건 — 의결은 출석 {m.present.length}명 중 {need}명 이상 찬성</p>
          {m.agenda.map((a, i) => {
            const ok = passed(a, m.present.length)
            return (
              <div key={i} className="space-y-1.5 rounded-xl bg-fill p-2.5">
                <div className="flex gap-1.5">
                  <input className="field min-w-0 flex-1 font-bold" value={a.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                  <button type="button" className="btn btn-ghost h-11 min-h-0 shrink-0 px-2 text-ink-3" aria-label="안건 빼기" onClick={() => set({ agenda: m.agenda.filter((_, k) => k !== i) })}>
                    ✕
                  </button>
                </div>
                <textarea className="field min-h-[3.5rem]" placeholder="제안 설명 · 주요 논의" value={a.body} onChange={(e) => setItem(i, { body: e.target.value })} />
                <div className="flex flex-wrap items-center gap-1.5">
                  {DECISIONS.map((d) => (
                    <button key={d} type="button" className="chip" aria-pressed={a.decision === d} onClick={() => setItem(i, { decision: d, ...(d === '보고(의결 없음)' ? { yes: undefined, no: undefined } : {}) })}>
                      {d}
                    </button>
                  ))}
                </div>
                {a.decision && a.decision !== '보고(의결 없음)' && (
                  <div className="flex items-center gap-2 text-sm">
                    찬성
                    <input type="number" inputMode="numeric" min={0} className="field h-10 min-h-0 w-16" value={a.yes ?? ''} onChange={(e) => setItem(i, { yes: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    반대
                    <input type="number" inputMode="numeric" min={0} className="field h-10 min-h-0 w-16" value={a.no ?? ''} onChange={(e) => setItem(i, { no: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    {ok !== null && <b className={ok ? 'text-ok' : 'text-danger'}>{ok ? '의결 기준 넘음' : `기준(${need}명) 못 미침`}</b>}
                  </div>
                )}
              </div>
            )
          })}
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm font-bold text-brand">+ 안건 추천에서 고르기 (규정 예시 심의 사항)</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENDA_PRESETS.map((p) => (
                <button key={p.title} type="button" className="chip" onClick={() => set({ agenda: [...m.agenda, { title: p.title, body: '', decision: '' }] })}>
                  {p.when ? `[${p.when}] ` : ''}
                  {p.title}
                </button>
              ))}
            </div>
          </details>
          <button type="button" className="btn btn-soft w-full" onClick={() => set({ agenda: [...m.agenda, { title: '', body: '', decision: '' }] })}>
            + 빈 안건
          </button>
        </div>
        <textarea className="field min-h-[3rem]" placeholder="기타 · 다음 회의" value={m.note} onChange={(e) => set({ note: e.target.value })} />
        {!readOnly && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline" onClick={() => confirm('이 회의 기록을 지울까요?') && onDelete()}>
              지우기
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => onSave(m)}>
              저장
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** 회의록 인쇄 (A4 한 장, 브라우저 인쇄 → PDF) — 학교 자체 양식 예시 */
function MinutesPrint({ m, members, school, onClose }: { m: CommitteeMeeting; members: CommitteeMember[]; school: string; onClose: () => void }) {
  const present = members.filter((x) => m.present.includes(x.id))
  const absent = members.filter((x) => !m.present.includes(x.id))
  const q = quorum(members.length, present.length)
  const chair = members.find((x) => x.post === '위원장')
  const sec = members.find((x) => x.post === '간사')
  const cell = 'border border-ink/60 px-2 py-1.5 align-top'
  return (
    <div className="min-h-screen bg-white">
      <div className="page flex gap-2 py-3 print:hidden">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          ← 돌아가기
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={() => window.print()}>
          인쇄 · PDF로 저장
        </button>
      </div>
      <article className="mx-auto max-w-[190mm] px-4 pb-10 text-[11pt] leading-relaxed text-black">
        <h1 className="mb-1 text-center text-[17pt] font-black">학교체육소위원회 회의록</h1>
        <p className="mb-3 text-center text-[10pt]">
          {school} · {m.kind}
        </p>
        <table className="w-full border-collapse text-[10.5pt]">
          <tbody>
            <tr>
              <th className={`${cell} w-24 bg-gray-100`}>일시</th>
              <td className={cell}>
                {m.date} {m.time}
              </td>
              <th className={`${cell} w-20 bg-gray-100`}>장소</th>
              <td className={cell}>{m.place}</td>
            </tr>
            <tr>
              <th className={`${cell} bg-gray-100`}>참석 위원</th>
              <td className={cell} colSpan={3}>
                {present.map((x) => `${x.name}(${x.post ?? x.role})`).join(', ')} — {present.length}명
              </td>
            </tr>
            <tr>
              <th className={`${cell} bg-gray-100`}>불참 위원</th>
              <td className={cell} colSpan={3}>
                {absent.map((x) => x.name).join(', ') || '없음'}
              </td>
            </tr>
            <tr>
              <th className={`${cell} bg-gray-100`}>성원</th>
              <td className={cell} colSpan={3}>
                재적 {members.length}명 중 {present.length}명 출석 — {q.ok ? '과반수 출석으로 개의' : `과반수(${q.needed}명) 미달`} · 의결 기준: 출석 위원 3분의 2 이상({passNeeded(present.length)}명) 찬성
              </td>
            </tr>
            {m.agenda.map((a, i) => (
              <tr key={i}>
                <th className={`${cell} bg-gray-100`}>안건 {i + 1}</th>
                <td className={cell} colSpan={3}>
                  <b>{a.title}</b>
                  {a.body && <p className="whitespace-pre-wrap">{a.body}</p>}
                  <p className="mt-1">
                    결과: <b>{a.decision || '-'}</b>
                    {a.yes !== undefined ? ` (찬성 ${a.yes} · 반대 ${a.no ?? 0})` : ''}
                  </p>
                </td>
              </tr>
            ))}
            {m.note && (
              <tr>
                <th className={`${cell} bg-gray-100`}>기타</th>
                <td className={`${cell} whitespace-pre-wrap`} colSpan={3}>
                  {m.note}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-6 text-center">위 내용이 사실과 같음을 확인합니다.</p>
        <p className="mt-2 text-center">{m.date}</p>
        <div className="mt-6 flex justify-around text-[11pt]">
          <span>위원장 {chair?.name ?? '          '} (서명)</span>
          <span>간사 {sec?.name ?? '          '} (서명)</span>
        </div>
        <p className="mt-8 text-[8.5pt] text-gray-500 print:mt-4">학교 자체 양식 예시 (PE LOG) — 교육청 공식 서식이 아니에요. 근거: 학교체육소위원회 운영 규정(예시) 제5조, 2026 학교체육 운영방향 157쪽</p>
      </article>
    </div>
  )
}
