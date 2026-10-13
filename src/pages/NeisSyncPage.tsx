import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { addHomeroomGroups } from '../db/groupsRepo'
import { applyNeisTimetable, combinedName, type SlotPick } from '../db/neisRepo'
import { todayStr } from '../lib/dates'
import { homeroomName } from '../lib/groups'
import {
  fetchClasses,
  fetchSchedule,
  fetchWeekTimetable,
  looksLikePe,
  searchSchools,
  slotGroups,
  weekOf,
  type NeisClass,
  type NeisSchool,
  type SlotGroup,
} from '../lib/neisOpenApi'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const DAYS = ['', '월', '화', '수', '목', '금']
const errText = (e: unknown) => `⚠ ${e instanceof Error ? e.message : '나이스에서 자료를 받지 못했어요'}`
const msgTone = (m: string) => (m.startsWith('⚠') ? 'text-danger' : 'text-ok')

/**
 * 나이스에서 불러오기 (2026-10-10 교사 승인): 학교 → 학급 → 내 체육 시간표 → 학사일정.
 * 학교 이름·코드만 보내고 학생 정보는 보내지 않는다. 버튼을 누를 때만 인터넷을 쓴다.
 */
export default function NeisSyncPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const school = settings.neisSchool
  return (
    <>
      <PageHeader title="나이스에서 불러오기" sub="학급 · 시간표 · 학사일정" back />
      <div className="page space-y-4 pb-10">
        <section className="rounded-2xl bg-brand-light p-4 text-sm font-semibold text-brand">
          나이스 교육정보 개방 포털의 <b>학교 공개 자료</b>만 받아 와요. 보내는 것은 학교 이름·학교 코드뿐이고, 학생 정보는 보내지 않아요. 담당 교사 이름은 공개 자료에 없어서, 내 수업 칸은 한 번 골라 주셔야 해요.
        </section>
        <SchoolCard school={school} onPick={(s) => updateSettings({ neisSchool: s, schoolName: settings.schoolName || s.name, schoolLevel: s.kind === '중' ? '중' : '고' })} apiKey={settings.neisApiKey} />
        <KeyCard value={settings.neisApiKey} onSave={(k) => updateSettings({ neisApiKey: k })} />
        {school && !readOnly && (
          <>
            <ClassesCard school={school} />
            <TimetableCard school={school} />
            <ScheduleCard school={school} />
          </>
        )}
        {readOnly && <p className="card hint">지난 학년도는 읽기 전용이에요.</p>}
      </div>
    </>
  )
}

function SchoolCard({ school, onPick, apiKey }: { school: NeisSchool | null; onPick: (s: NeisSchool) => void; apiKey: string }) {
  const [editing, setEditing] = useState(!school)
  const [q, setQ] = useState('')
  const [list, setList] = useState<NeisSchool[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const search = async () => {
    if (q.trim().length < 2) return setErr('학교 이름을 두 글자 이상 적어 주세요')
    setBusy(true)
    setErr('')
    try {
      setList(await searchSchools(q, { key: apiKey }))
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card space-y-3">
      <p className="card-title">① 우리 학교</p>
      {school && !editing ? (
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <b className="block">{school.name}</b>
            <span className="hint">
              {school.officeName} · {school.kind === '고' ? '고등학교' : '중학교'}
            </span>
          </span>
          <button type="button" className="btn btn-soft" onClick={() => setEditing(true)}>
            바꾸기
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              className="field min-w-0 flex-1"
              value={q}
              placeholder="학교 이름 (예: 가나고등학교)"
              aria-label="학교 이름"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <button type="button" className="btn btn-primary" onClick={search} disabled={busy}>
              {busy ? '찾는 중' : '찾기'}
            </button>
          </div>
          {err && <p className="font-bold text-danger">{err.replace(/^⚠ /, '')}</p>}
          {list && list.length === 0 && <p className="hint">찾는 학교가 없어요. 이름을 줄여서(예: '가나고') 다시 찾아보세요.</p>}
          {list && list.length >= 5 && !apiKey && <p className="hint">인증키가 없으면 5곳까지만 보여요. 찾는 학교가 없으면 이름을 더 자세히 적어 주세요.</p>}
          {list && list.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-fill">
              {list.map((s) => (
                <li key={s.schoolCode}>
                  <button
                    type="button"
                    className="list-row w-full text-left hover:bg-fill-2"
                    onClick={() => {
                      onPick(s)
                      setEditing(false)
                      setList(null)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block">{s.name}</b>
                      <span className="hint block truncate">
                        {s.officeName} · {s.address}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function KeyCard({ value, onSave }: { value: string; onSave: (k: string) => void }) {
  const [v, setV] = useState(value)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    setMsg('')
    try {
      if (v) await searchSchools('고등학교', { key: v }) // 인증키가 맞는지 한 번 확인
      onSave(v)
      setMsg(v ? '인증키를 확인하고 저장했어요.' : '인증키를 지웠어요.')
    } catch (e) {
      setMsg(errText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card space-y-2">
      <p className="card-title">
        인증키 {value ? <span className="badge ml-1 bg-ok-light text-ok">넣음</span> : <span className="badge ml-1 bg-caution-light text-caution">필요</span>}
      </p>
      <p className="hint">
        인증키가 없으면 나이스가 맛보기 5줄만 줘서 학교 찾기만 돼요. 학급·시간표·학사일정을 받으려면 인증키가 필요해요. 무료이고, 회원가입 뒤 바로 나와요:
        <a className="ml-1 font-bold text-brand underline" href="https://open.neis.go.kr/portal/guide/actKeyPage.do" target="_blank" rel="noopener noreferrer">
          나이스 교육정보 개방 포털 → 인증키 신청
        </a>
      </p>
      <div className="flex gap-2">
        <input className="field min-w-0 flex-1 font-mono text-sm" value={v} placeholder="인증키 붙여넣기" aria-label="인증키" onChange={(e) => setV(e.target.value.trim())} />
        <button type="button" className="btn btn-soft" onClick={save} disabled={v === value || busy}>
          {busy ? '확인 중' : '저장'}
        </button>
      </div>
      {msg && <p className={`font-bold ${msgTone(msg)}`}>{msg}</p>}
      <p className="hint">인증키는 이 기기에만 저장돼요.</p>
    </section>
  )
}

function NeedKey() {
  return <p className="rounded-2xl bg-caution-light p-3 text-sm font-bold text-caution">위의 [인증키]를 먼저 넣어 주세요.</p>
}

function Progress({ p }: { p: { done: number; total: number } | null }) {
  if (!p || !p.total) return null
  return (
    <div className="space-y-1" role="status">
      <div className="h-2 overflow-hidden rounded-full bg-fill-2">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.min(100, (p.done / p.total) * 100)}%` }} />
      </div>
      <p className="hint tabular-nums">
        {p.done}/{p.total}줄 받는 중…
      </p>
    </div>
  )
}

function ClassesCard({ school }: { school: NeisSchool }) {
  const { settings } = useApp()
  const { groups } = useGroups(true)
  const [classes, setClasses] = useState<NeisClass[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const [msg, setMsg] = useState('')
  const have = useMemo(() => new Set((groups ?? []).filter((g) => g.kind === 'homeroom').map((g) => `${g.grade}-${g.classNo}`)), [groups])
  const load = async () => {
    setBusy(true)
    setMsg('')
    try {
      setClasses(await fetchClasses(school, settings.schoolYear, { key: settings.neisApiKey, onProgress: (done, total) => setProg({ done, total }) }))
    } catch (e) {
      setMsg(errText(e))
    } finally {
      setBusy(false)
      setProg(null)
    }
  }
  const add = async () => {
    const list = (classes ?? []).filter((c) => picked.has(`${c.grade}-${c.classNo}`))
    const ids = await addHomeroomGroups(db, settings.schoolYear, list)
    setPicked(new Set())
    setMsg(`${ids.length}개 반을 수업반으로 추가했어요. 학생 명렬은 [수업반 → 명렬 올리기]로 넣어 주세요.`)
  }
  const grades = [...new Set((classes ?? []).map((c) => c.grade))]
  return (
    <section className="card space-y-3">
      <p className="card-title">② 학급 → 수업반</p>
      <p className="hint">{settings.schoolYear}학년도 학급 목록을 받아 내가 수업하는 반을 수업반으로 만들어요. 시간표를 불러오면(③) 필요한 반은 저절로 만들어지니 건너뛰어도 돼요.</p>
      {!settings.neisApiKey ? (
        <NeedKey />
      ) : !classes ? (
        <button type="button" className="btn btn-soft w-full" onClick={load} disabled={busy}>
          {busy ? '받는 중…' : '학급 목록 불러오기'}
        </button>
      ) : (
        <>
          {grades.map((gr) => (
            <div key={gr} className="space-y-1.5">
              <p className="text-sm font-bold text-ink-3">{gr}학년</p>
              <div className="flex flex-wrap gap-2">
                {classes
                  .filter((c) => c.grade === gr)
                  .map((c) => {
                    const k = `${c.grade}-${c.classNo}`
                    const exists = have.has(k)
                    return (
                      <button
                        key={k}
                        type="button"
                        className="chip"
                        aria-pressed={picked.has(k)}
                        disabled={exists}
                        onClick={() => setPicked((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])))}
                      >
                        {c.classNo}반{exists ? ' ✓' : ''}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
          {classes.length === 0 && <p className="hint">이 학년도 학급 자료가 아직 없어요.</p>}
          <button type="button" className="btn btn-primary w-full" onClick={add} disabled={picked.size === 0}>
            {picked.size}개 반 수업반으로 추가
          </button>
        </>
      )}
      <Progress p={prog} />
      {msg && <p className={`font-bold ${msgTone(msg)}`}>{msg}</p>}
    </section>
  )
}

type Choice = 'skip' | 'all' | string // string = 'grade-classNo' 한 반만

function TimetableCard({ school }: { school: NeisSchool }) {
  const { settings, updateSettings } = useApp()
  const [date, setDate] = useState(todayStr())
  const [grade, setGrade] = useState<number | null>(null)
  const [slots, setSlots] = useState<SlotGroup[] | null>(null)
  const [peOnly, setPeOnly] = useState(true)
  const [choice, setChoice] = useState<Record<string, Choice>>({})
  const [replaceAll, setReplaceAll] = useState(true)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [from, to] = weekOf(date)

  const load = async () => {
    setBusy(true)
    setMsg('')
    try {
      const lessons = await fetchWeekTimetable(school, date, { key: settings.neisApiKey, grade: grade ?? undefined, onProgress: (done, total) => setProg({ done, total }) })
      const all = slotGroups(lessons)
      setSlots(all)
      setChoice({})
      if (all.length === 0) setMsg('⚠ 이 주의 시간표가 없어요. 방학·시험 기간이면 수업하는 주를 골라 주세요.')
    } catch (e) {
      setMsg(errText(e))
    } finally {
      setBusy(false)
      setProg(null)
    }
  }

  const shown = (slots ?? []).filter((s) => !peOnly || looksLikePe(s.subject))
  const subjects = [...new Set(shown.map((s) => s.subject))]
  const picks: SlotPick[] = shown.flatMap((s) => {
    const c = choice[s.key] ?? 'skip'
    if (c === 'skip') return []
    const classes = c === 'all' ? s.classes : s.classes.filter((x) => `${x.grade}-${x.classNo}` === c)
    return [{ day: s.day, period: s.period, subject: s.subject, classes }]
  })
  const clash = new Set<string>()
  const seen = new Set<string>()
  for (const p of picks) {
    const k = `${p.day}|${p.period}`
    if (seen.has(k)) clash.add(k)
    seen.add(k)
  }

  const apply = async () => {
    const r = await applyNeisTimetable(db, { schoolYear: settings.schoolYear, picks, current: settings.timetable, replaceAll })
    await updateSettings({ timetable: r.timetable })
    setMsg(
      `시간표 ${r.slots}칸을 넣었어요.${r.createdHomerooms ? ` 새 학적반 ${r.createdHomerooms}개.` : ''}${
        r.createdElectives.length ? ` 합반 수강반 ${r.createdElectives.length}개(${r.createdElectives.join(', ')}) — 선택과목이라 일부 학생만 듣는다면 수업반에서 학생을 고쳐 주세요.` : ''
      }`,
    )
  }

  return (
    <section className="card space-y-3">
      <p className="card-title">③ 내 체육 시간표</p>
      <p className="hint">한 주 시간표를 받아 체육 과목 칸만 보여 줘요. 내가 수업하는 칸을 고르면 앱 시간표와 수업반이 채워져요.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="label">이 날짜가 든 주</span>
          <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">학년</span>
          <select className="field" value={grade ?? ''} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
            <option value="">전체</option>
            {[1, 2, 3].map((g) => (
              <option key={g} value={g}>
                {g}학년
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">
        {from} ~ {to}
      </p>
      {settings.neisApiKey ? (
        <button type="button" className="btn btn-soft w-full" onClick={load} disabled={busy}>
          {busy ? '받는 중…' : '시간표 불러오기'}
        </button>
      ) : (
        <NeedKey />
      )}
      <Progress p={prog} />

      {slots && slots.length > 0 && (
        <>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={peOnly} onChange={(e) => setPeOnly(e.target.checked)} />
            <span>
              <b>체육 과목만 보기</b>
              <span className="hint block">{peOnly ? `찾은 과목: ${subjects.join(', ') || '없음'}` : '모든 과목이 보여요'}</span>
            </span>
          </label>
          <ul className="space-y-2">
            {shown.map((s) => {
              const c = choice[s.key] ?? 'skip'
              const multi = s.classes.length > 1
              const bad = c !== 'skip' && clash.has(`${s.day}|${s.period}`)
              return (
                <li key={s.key} className={`rounded-2xl p-3 ${c === 'skip' ? 'bg-fill' : bad ? 'bg-danger-light' : 'bg-brand-light'}`}>
                  <div className="flex items-center gap-2">
                    <b className="w-16 shrink-0 tabular-nums">
                      {DAYS[s.day]} {s.period}교시
                    </b>
                    <span className="min-w-0 flex-1 truncate font-bold">{s.subject}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${DAYS[s.day]} ${s.period}교시 ${s.subject}`}>
                    <button type="button" role="radio" aria-checked={c === 'skip'} className="chip" onClick={() => setChoice({ ...choice, [s.key]: 'skip' })}>
                      내 수업 아님
                    </button>
                    {s.classes.map((x) => {
                      const k = `${x.grade}-${x.classNo}`
                      return (
                        <button key={k} type="button" role="radio" aria-checked={c === k} className="chip" onClick={() => setChoice({ ...choice, [s.key]: k })}>
                          {homeroomName(x.grade, x.classNo)}
                        </button>
                      )
                    })}
                    {multi && (
                      <button type="button" role="radio" aria-checked={c === 'all'} className="chip" onClick={() => setChoice({ ...choice, [s.key]: 'all' })}>
                        합반 ({combinedName(s.subject, s.classes).replace(`${s.subject} `, '')})
                      </button>
                    )}
                  </div>
                  {bad && <p className="mt-1 text-sm font-bold text-danger">같은 시간에 두 칸을 골랐어요. 하나만 고르세요.</p>}
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && <p className="hint">체육 과목을 찾지 못했어요. [체육 과목만 보기]를 끄고 골라 주세요.</p>}
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
            <span>
              <b>지금 시간표를 비우고 새로 채우기</b>
              <span className="hint block">끄면 고른 칸만 바꾸고 나머지는 그대로 둬요.</span>
            </span>
          </label>
          <button type="button" className="btn btn-primary w-full" onClick={apply} disabled={picks.length === 0 || clash.size > 0}>
            {picks.length}칸 시간표에 넣기
          </button>
        </>
      )}
      {msg && (
        <p className={`font-bold ${msgTone(msg)}`} role="status">
          {msg}{' '}
          {msg.startsWith('시간표') && (
            <Link to="/more/settings/timetable" className="text-brand underline">
              시간표 보기
            </Link>
          )}
        </p>
      )}
    </section>
  )
}

function ScheduleCard({ school }: { school: NeisSchool }) {
  const { settings, updateSettings } = useApp()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const y = settings.schoolYear
  const load = async () => {
    setBusy(true)
    setMsg('')
    try {
      const events = await fetchSchedule(school, `${y}-03-01`, `${y + 1}-02-28`, { key: settings.neisApiKey })
      await updateSettings({ neisSchedule: { fetchedAt: Date.now(), events } })
      setMsg(`학사일정 ${events.length}개를 받았어요. 홈에 다가오는 일정이 보여요.`)
    } catch (e) {
      setMsg(errText(e))
    } finally {
      setBusy(false)
    }
  }
  const sch = settings.neisSchedule
  return (
    <section className="card space-y-3">
      <p className="card-title">④ 학사일정</p>
      <p className="hint">시험·행사·방학을 받아 홈에 다가오는 일정을 보여 줘요. 인터넷이 없어도 보이도록 기기에 둬요.</p>
      {sch && <p className="hint">마지막으로 받은 때: {new Date(sch.fetchedAt).toLocaleString('ko-KR')} · {sch.events.length}개</p>}
      {settings.neisApiKey ? (
        <button type="button" className="btn btn-soft w-full" onClick={load} disabled={busy}>
          {busy ? '받는 중…' : sch ? '학사일정 다시 받기' : '학사일정 불러오기'}
        </button>
      ) : (
        <NeedKey />
      )}
      {msg && <p className={`font-bold ${msgTone(msg)}`}>{msg}</p>}
    </section>
  )
}
