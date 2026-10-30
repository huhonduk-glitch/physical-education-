import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { REF_BOARDS, searchCalls, type CallKind, type RefCall } from '../../data/refCalls'
import { SPORTS, sportOf } from '../../data/sports'
import { AiError, manualPromptText, maskNames, runAi } from '../../lib/aiPolish'
import { copyText } from '../../lib/download'
import { knownRefs, parseRefAnswer, refPrompt, ruleDigest, type RefAnswer } from '../../lib/refAi'
import { useApp } from '../../state/AppContext'
import { aiSettingsOf } from '../seteuk/AiSetupCard'

/** 경기 상태 (탭을 닫을 때까지 기억) */
interface Match {
  names: [string, string]
  score: [number, number]
  fouls: [number, number]
  /** 남은 시간(초) · 돌고 있으면 시작 시각 */
  left: number
  runningSince: number | null
  log: { at: number; name: string; team?: 0 | 1 }[]
}
const fresh = (min = 10): Match => ({ names: ['청', '백'], score: [0, 0], fouls: [0, 0], left: min * 60, runningSince: null, log: [] })
const KEY = (sport: string) => `pe.referee.${sport}`
const load = (sport: string): Match => {
  try {
    const raw = sessionStorage.getItem(KEY(sport))
    return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh()
  } catch {
    return fresh()
  }
}

const KIND: Record<CallKind, { label: string; cls: string }> = {
  foul: { label: '반칙', cls: 'bg-danger-light text-danger' },
  violation: { label: '바이얼레이션', cls: 'bg-caution-light text-caution' },
  card: { label: '카드 · 벌칙', cls: 'bg-danger text-white' },
  score: { label: '점수', cls: 'bg-ok-light text-ok' },
  restart: { label: '다시 시작', cls: 'bg-brand-light text-brand' },
}
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.floor(s)) % 60).padStart(2, '0')}`

/**
 * 보조심판 (2026-10-30): ① 빠른 판정판(인터넷 없이) ② 점수 · 시간 · 팀 파울 ③ 우리 반 규칙 ④ AI에게 묻기(선택).
 * 영상으로 반칙을 판정하지 않는다(교사 승인). 판정은 규칙서 요약 · 조항으로, 마지막 결정은 선생님.
 */
export default function RefereePage() {
  const { sport = '' } = useParams()
  const g = sportOf(sport)
  const board = REF_BOARDS[sport]
  const { settings, updateSettings, readOnly } = useApp()
  const [m, setM] = useState<Match>(() => load(sport))
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<RefCall | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY(sport), JSON.stringify(m))
    } catch {
      /* 무시 */
    }
  }, [m, sport])
  useEffect(() => {
    if (m.runningSince === null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [m.runningSince])
  const left = m.runningSince === null ? m.left : m.left - (now - m.runningSince) / 1000
  useEffect(() => {
    if (m.runningSince !== null && left <= 0) {
      setM((x) => ({ ...x, left: 0, runningSince: null }))
      try {
        navigator.vibrate?.([300, 120, 300])
      } catch {
        /* 무시 */
      }
    }
  }, [left, m.runningSince])

  if (!g || !board) return <Navigate to="/sports" replace />
  const shown = searchCalls(board, q)
  const house = settings.refHouseRules[sport] ?? ''
  const alert = board.teamFoulAlert
  const set = (f: (x: Match) => Match) => setM((x) => f(x))
  const bump = (arr: [number, number], t: 0 | 1, d: number): [number, number] => (t === 0 ? [Math.max(0, arr[0] + d), arr[1]] : [arr[0], Math.max(0, arr[1] + d)])
  const call = (c: RefCall, team?: 0 | 1) => {
    set((x) => ({ ...x, fouls: team !== undefined && c.teamFoul ? bump(x.fouls, team, 1) : x.fouls, log: [{ at: Date.now(), name: c.name, team }, ...x.log].slice(0, 30) }))
    setOpen(null)
  }

  return (
    <>
      <PageHeader title={`${g.emoji} ${g.name} 보조심판`} sub="판정 · 다시 시작 · 조항" back />
      <div className="page space-y-3 pb-10">
        {/* 점수판 */}
        <section className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((t) => (
              <div key={t} className={`rounded-2xl p-3 text-center ${t === 0 ? 'bg-brand-light' : 'bg-fill'}`}>
                <input
                  className="w-full bg-transparent text-center text-lg font-extrabold outline-none"
                  value={m.names[t]}
                  aria-label={`${t + 1}팀 이름`}
                  onChange={(e) => set((x) => ({ ...x, names: (t === 0 ? [e.target.value, x.names[1]] : [x.names[0], e.target.value]) as [string, string] }))}
                />
                <p className="text-6xl leading-none font-black tabular-nums">{m.score[t]}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {board.scoreSteps.map((n) => (
                    <button key={n} type="button" className="h-12 min-w-[46px] rounded-xl bg-brand px-2 text-lg font-extrabold text-white active:scale-95" onClick={() => set((x) => ({ ...x, score: bump(x.score, t, n), log: [{ at: Date.now(), name: `+${n}점`, team: t }, ...x.log].slice(0, 30) }))}>
                      +{n}
                    </button>
                  ))}
                  <button type="button" className="h-12 min-w-[46px] rounded-xl bg-fill-2 px-2 text-lg font-extrabold active:scale-95" aria-label="1점 빼기" onClick={() => set((x) => ({ ...x, score: bump(x.score, t, -1) }))}>
                    −
                  </button>
                </div>
                {alert && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-bold">
                    <span className={m.fouls[t] >= alert.at ? 'text-danger' : 'text-ink-2'}>팀 파울 {m.fouls[t]}</span>
                    <button type="button" className="chip min-h-[36px] px-2.5" aria-label="팀 파울 더하기" onClick={() => set((x) => ({ ...x, fouls: bump(x.fouls, t, 1) }))}>
                      +
                    </button>
                    <button type="button" className="chip min-h-[36px] px-2.5" aria-label="팀 파울 빼기" onClick={() => set((x) => ({ ...x, fouls: bump(x.fouls, t, -1) }))}>
                      −
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {alert && m.fouls.some((f) => f >= alert.at - 1) && (
            <p className={`rounded-xl px-3 py-2 text-sm font-bold ${m.fouls.some((f) => f >= alert.at) ? 'bg-danger-light text-danger' : 'bg-caution-light text-caution'}`}>
              {m.fouls.some((f) => f >= alert.at) ? '⚠ ' : '곧 '}
              {alert.text} [{alert.ref}]
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <p className={`w-full text-center text-5xl font-black whitespace-nowrap tabular-nums ${left <= 10 && m.runningSince !== null ? 'text-danger' : ''}`}>{mmss(left)}</p>
            {m.runningSince === null ? (
              <button type="button" className="btn btn-primary flex-1" onClick={() => set((x) => ({ ...x, runningSince: Date.now() }))} disabled={left <= 0}>
                <Icon name="play" /> <span className="whitespace-nowrap">시작</span>
              </button>
            ) : (
              <button type="button" className="btn btn-soft flex-1" onClick={() => set((x) => ({ ...x, left: Math.max(0, left), runningSince: null }))}>
                <Icon name="pause" /> <span className="whitespace-nowrap">멈춤</span>
              </button>
            )}
            {[5, 7, 10].map((min) => (
              <button key={min} type="button" className="chip" disabled={m.runningSince !== null} onClick={() => set((x) => ({ ...x, left: min * 60 }))}>
                {min}분
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost w-full text-sm"
            onClick={() => confirm('점수 · 팀 파울 · 시간을 처음으로 할까요?') && setM({ ...fresh(), names: m.names })}
          >
            <Icon name="reset" /> 새 경기
          </button>
        </section>

        {house.trim() && (
          <p className="rounded-2xl bg-caution-light px-4 py-3 text-sm font-bold whitespace-pre-wrap text-caution">
            우리 반 규칙: {house.trim()}
          </p>
        )}

        {/* 빠른 판정판 */}
        <section className="space-y-2">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상황 찾기 — 예: 공 들고 걸음, 드리블, 밀었어" aria-label="상황 찾기" />
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((c) => (
              <li key={c.id}>
                <button type="button" className="flex min-h-[72px] w-full flex-col items-start justify-center rounded-2xl bg-white px-3 py-2 text-left shadow-[var(--shadow-card)] active:scale-[0.98]" onClick={() => setOpen(c)}>
                  <span className={`badge mb-1 ${KIND[c.kind].cls}`}>{KIND[c.kind].label}</span>
                  <b className="text-[1.05rem] leading-tight">{c.name}</b>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="hint px-1">찾는 상황이 없어요. 아래 [AI에게 묻기]를 써 보세요.</p>}
        </section>

        <Collapse title="우리 반 규칙" sub={house.trim() ? '적어 둠' : '수업에서 줄여 쓰는 규칙'}>
          <HouseRules sport={sport} value={house} readOnly={readOnly} onSave={(v) => updateSettings({ refHouseRules: { ...settings.refHouseRules, [sport]: v } })} />
        </Collapse>

        <Collapse title="AI에게 묻기" sub="버튼에 없는 애매한 상황 (인터넷 필요)">
          <AskAi sport={sport} house={house} />
        </Collapse>

        {m.log.length > 0 && (
          <Collapse title={`이번 경기 기록 ${m.log.length}`} sub="이 탭을 닫으면 지워져요">
            <ul className="space-y-1 text-sm">
              {m.log.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-14 shrink-0 text-ink-3 tabular-nums">{new Date(l.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <b>{l.name}</b>
                  {l.team !== undefined && <span className="text-ink-3">{m.names[l.team]}</span>}
                </li>
              ))}
            </ul>
          </Collapse>
        )}
        <p className="hint px-1">
          판정은 <Link to={`/sports/${sport}`} className="font-bold text-brand underline">{g.name} 규칙 요약</Link>의 조항을 따라요. 마지막 판단은 선생님이 해요. 영상으로 반칙을 자동 판정하지는 않아요.
        </p>
      </div>

      {open && (
        <BottomSheet title={open.name} sub={KIND[open.kind].label} onClose={() => setOpen(null)}>
          <div className="space-y-3">
            <p className="rounded-2xl bg-ink px-4 py-4 text-2xl leading-snug font-black text-white">{open.verdict}</p>
            <div className="space-y-2 text-[1.05rem]">
              <p>
                <b className="mr-2 text-ink-3">다시 시작</b>
                {open.restart}
              </p>
              {open.signal && (
                <p>
                  <b className="mr-2 text-ink-3">심판 신호</b>
                  {open.signal}
                </p>
              )}
              {open.tell && (
                <p className="rounded-xl bg-brand-light px-3 py-2 font-bold text-brand-ink">
                  <b className="mr-2">학생에게</b>
                  {open.tell}
                </p>
              )}
              <p className="text-sm font-bold text-ink-3">[{open.ref}]</p>
            </div>
            {open.teamFoul && alert ? (
              <div className="grid grid-cols-2 gap-2">
                {([0, 1] as const).map((t) => (
                  <button key={t} type="button" className="btn btn-primary" onClick={() => call(open, t)}>
                    {m.names[t]} 팀 파울 +1
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="btn btn-primary w-full" onClick={() => call(open)}>
                <Icon name="check" /> 기록하고 닫기
              </button>
            )}
          </div>
        </BottomSheet>
      )}
    </>
  )
}

function HouseRules({ sport, value, readOnly, onSave }: { sport: string; value: string; readOnly: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value, sport])
  return (
    <div className="space-y-2">
      <textarea className="field min-h-[110px] py-3 text-sm" value={v} disabled={readOnly} onChange={(e) => setV(e.target.value)} placeholder={'예: 쿼터 7분 · 4초 규칙은 보지 않음 · 서브는 언더핸드만'} />
      <button type="button" className="btn btn-primary w-full" disabled={readOnly || v === value} onClick={() => onSave(v)}>
        저장
      </button>
      <p className="hint">판정판 위에 늘 보이고, AI에게 물을 때도 같이 보내요. 이 기기에만 저장돼요.</p>
    </div>
  )
}

function AskAi({ sport, house }: { sport: string; house: string }) {
  const { settings } = useApp()
  const g = sportOf(sport)!
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ans, setAns] = useState<RefAnswer | null>(null)
  const [paste, setPaste] = useState<string | null>(null)
  // 상황 글에 학생 이름을 적어도 AI로 보내기 전에 가린다
  const names = useLiveQuery(async () => (await db.students.where('schoolYear').equals(settings.schoolYear).toArray()).map((s) => s.name), [settings.schoolYear])
  const known = useMemo(() => knownRefs(g), [g])
  const ai = aiSettingsOf(settings)
  const manual = ai.provider === 'manual'
  const ready = ai.provider === 'claude' ? !!ai.claudeApiKey : ai.provider === 'openrouter' ? !!(ai.openrouterApiKey && ai.openrouterModel) : true
  const prompt = () => refPrompt({ sportName: g.name, digest: ruleDigest(g), situation: maskNames(text, names ?? []), houseRules: house })
  const read = (raw: string) => {
    const a = parseRefAnswer(raw, known)
    if (!a) setErr('AI 답을 읽지 못했어요. 다시 해 보세요.')
    setAns(a)
  }
  const ask = async () => {
    setErr('')
    setAns(null)
    if (manual) {
      const ok = await copyText(manualPromptText(prompt()))
      setPaste('')
      if (!ok) setErr('복사하지 못했어요.')
      return
    }
    setBusy(true)
    try {
      read((await runAi(ai, prompt())).text)
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'AI 요청 중 문제가 생겼어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <textarea className="field min-h-[90px] py-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 슛하는 순간 수비 손이 공에 닿았는데 공이 들어갔어요" aria-label="상황" />
      <button type="button" className="btn btn-primary w-full" disabled={busy || !ready || text.trim().length < 4} onClick={ask}>
        <Icon name="bolt" /> {busy ? 'AI가 판단하는 중…' : manual ? '요청문 복사 (무료 챗봇에 붙여 넣기)' : 'AI에게 묻기'}
      </button>
      {!ready && (
        <p className="hint">
          AI 연결은 <Link to="/seteuk/write" className="font-bold text-brand underline">세특 쓰기 → AI 연결</Link>과 같이 써요.
        </p>
      )}
      <p className="hint">보내는 것: 상황 글(학생 이름은 가림) · {g.name} 규칙 요약 · 우리 반 규칙. 앱의 규칙 요약에 없는 내용은 &lsquo;판단 어려움&rsquo;으로 답하게 해요.</p>
      {paste !== null && !ans && (
        <div className="space-y-2 rounded-2xl bg-fill p-3">
          <p className="text-sm font-bold">요청문을 복사했어요. 챗봇의 답을 여기에 붙여 넣으세요.</p>
          <textarea className="field min-h-[90px] py-3 text-sm" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!paste.trim()}
            onClick={() => {
              read(paste)
              setPaste(null)
            }}
          >
            확인
          </button>
        </div>
      )}
      {err && <p className="font-bold text-danger">{err}</p>}
      {ans && (
        <section className="space-y-2 rounded-2xl bg-ink p-4 text-white">
          {ans.unsure && <p className="rounded-lg bg-caution px-2 py-1 text-sm font-bold text-white">규칙 요약만으로는 판단이 어려워요 — 선생님이 정해 주세요</p>}
          <p className="text-xl font-black">{ans.verdict}</p>
          {ans.reason && <p className="text-white/85">{ans.reason}</p>}
          {ans.restart && (
            <p>
              <b className="mr-2 text-white/60">다시 시작</b>
              {ans.restart}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {ans.refs.map((r) => (
              <span key={r} className={`rounded-full px-2.5 py-0.5 font-bold ${ans.unknownRefs.includes(r) ? 'bg-caution text-white' : 'bg-white/15'}`}>
                [{r}]{ans.unknownRefs.includes(r) ? ' 확인 필요' : ''}
              </span>
            ))}
            <span className="ml-auto text-white/60">확신: {ans.confidence}</span>
          </div>
          {ans.unknownRefs.length > 0 && <p className="text-sm text-white/70">&lsquo;확인 필요&rsquo; 조항은 앱의 규칙 요약에 없어요. AI가 잘못 댔을 수 있어요.</p>}
          <p className="text-xs text-white/50">AI 판단은 참고용이에요. 마지막 판정은 선생님이 해요.</p>
        </section>
      )}
    </div>
  )
}

/** 보조심판 종목 고르기 (도구 탭에서 들어올 때) */
export function RefereePick() {
  return (
    <>
      <PageHeader title="보조심판" sub="종목을 고르세요" back />
      <div className="page space-y-2 pb-10">
        <ul className="grid grid-cols-2 gap-2">
          {SPORTS.filter((s) => REF_BOARDS[s.id]).map((s) => (
            <li key={s.id}>
              <Link to={`/sports/${s.id}/referee`} className="card flex min-h-[64px] items-center gap-2 p-3 active:scale-[0.99]">
                <span className="text-2xl" aria-hidden>
                  {s.emoji}
                </span>
                <b>{s.name}</b>
              </Link>
            </li>
          ))}
        </ul>
        <p className="hint px-1">판정 버튼 · 점수 · 시간 · 팀 파울 · 우리 반 규칙 · AI에게 묻기. 다른 종목은 규칙 자료를 만든 뒤 더해요.</p>
      </div>
    </>
  )
}
