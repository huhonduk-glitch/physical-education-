import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import type { ChangeKind, TimetableChange } from '../db/settings'
import { weekDates } from '../lib/dash'
import { addDays, shortDateLabel, todayStr } from '../lib/dates'
import { changeKindFor, lessonsOnDate, upsertChange } from '../lib/timetable'
import { applyCandidates, comciChanges, type ChangeCandidate } from '../lib/timetableChanges'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const DAYS = ['월', '화', '수', '목', '금']
const KINDS: ChangeKind[] = ['교환', '보강', '결강', '행사', '기타']
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
const short = (name: string) => {
  const m = /^(\d)학년\s*(\d+)반$/.exec(name.trim())
  return m ? `${m[1]}-${m[2]}` : name
}

/**
 * 이번 주만 바꾸기 (2026-11-26, 슈퍼스쿨 '수업 변경 · 교환 · 변동 내역' 참고 — 코드는 새로 씀).
 * 날짜 · 교시 하나만 요일 시간표 대신 다른 수업반(교환 · 보강) 또는 내 수업 없음(결강 · 행사)으로.
 * 홈 지금 수업 · 오늘 수업 · 이번 주 시간표 · 타이머 · 기록표 수업일 · 출석률 수업 횟수 · 진도표 날짜가 모두 이것을 따른다(결강이면 진도표 차시가 저절로 밀림).
 */
export default function TimetableChangesPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const { groups } = useGroups()
  const today = todayStr()
  const wd = new Date(`${today}T00:00:00`).getDay()
  // 주말에 열면 다음 주
  const [monday, setMonday] = useState(() => weekDates(wd === 0 || wd === 6 ? addDays(today, 2) : today)[0])
  const dates = weekDates(monday)
  const changes = settings.timetableChanges ?? []
  const periods = Math.max(settings.periodStarts.length, ...settings.timetable.map((t) => t.period), ...changes.map((c) => c.period))
  const nameOf = (id: string | null) => (id ? (groups?.find((g) => g.id === id)?.name ?? '(지운 수업반)') : null)
  const [edit, setEdit] = useState<{ date: string; period: number } | null>(null)
  const [msg, setMsg] = useState('')
  const weekChanges = changes.filter((c) => c.date >= dates[0] && c.date <= dates[4])

  const save = async (next: TimetableChange[], note: string) => {
    await updateSettings({ timetableChanges: next })
    setMsg(note)
  }

  return (
    <>
      <PageHeader title="이번 주만 바꾸기" sub="교환 · 보강 · 결강 · 행사" back />
      <div className="page space-y-4 pb-10">
        <p className="hint px-1">
          칸을 눌러 그 날짜 · 교시만 다른 반이나 &lsquo;내 수업 없음&rsquo;으로 바꿔요. 요일 시간표는 그대로예요. 홈 오늘 수업 · 기록표 수업일 · 출석률 수업 횟수 · 진도표 날짜가 함께 바뀌고, 결강이면 진도표 차시가 다음 수업으로 밀려요.
        </p>
        {msg && <p className="anim-pop rounded-2xl bg-ok-light px-4 py-3 font-bold text-ok">{msg}</p>}

        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost h-11 min-h-0 px-2" aria-label="앞 주" onClick={() => setMonday(addDays(monday, -7))}>
            <Icon name="chevronLeft" />
          </button>
          <b className="flex-1 text-center tabular-nums">
            {shortDateLabel(dates[0])} ~ {shortDateLabel(dates[4])}
          </b>
          <button type="button" className="btn btn-ghost h-11 min-h-0 px-2" aria-label="다음 주" onClick={() => setMonday(addDays(monday, 7))}>
            <Icon name="chevronRight" />
          </button>
          {!dates.includes(today) && (
            <button type="button" className="rounded-full bg-fill px-3 py-1.5 text-sm font-bold text-ink-2" onClick={() => setMonday(weekDates(today)[0])}>
              이번 주
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white p-1 shadow-[var(--shadow-card)]">
          <table className="w-full table-fixed border-separate border-spacing-1 text-center text-[0.86rem]">
            <thead>
              <tr>
                <th className="w-8" />
                {DAYS.map((d, i) => (
                  <th key={d} className={`font-extrabold ${dates[i] === today ? 'text-brand' : 'text-ink-3'}`}>
                    {d}
                    <span className="block text-[0.7rem] font-bold tabular-nums">
                      {Number(dates[i].slice(5, 7))}/{Number(dates[i].slice(8))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                <tr key={p}>
                  <th className="font-bold text-ink-3 tabular-nums">{p}</th>
                  {dates.map((date) => {
                    const l = lessonsOnDate(date, settings.timetable, changes).find((x) => x.period === p)
                    const ch = changes.find((c) => c.date === date && c.period === p)
                    const name = l ? nameOf(l.groupId) : null
                    return (
                      <td key={date} className="p-0">
                        <button
                          type="button"
                          disabled={readOnly}
                          aria-label={`${shortDateLabel(date)} ${p}교시 ${name ?? '빈 교시'}${ch ? ` (${ch.kind})` : ''} 바꾸기`}
                          className={`flex h-12 w-full flex-col items-center justify-center rounded-lg px-0.5 leading-tight ${ch ? 'border-2 border-caution/60 bg-caution-light' : name ? 'bg-brand-light' : 'bg-fill/70'}`}
                          onClick={() => setEdit({ date, period: p })}
                        >
                          {ch && <span className="text-[0.62rem] font-extrabold text-caution">{ch.kind}</span>}
                          <span className={`line-clamp-2 w-full font-bold break-all ${name ? 'text-ink' : 'text-ink-3'}`}>{name ? short(name) : ch ? '없음' : ''}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {weekChanges.length > 0 && (
          <section className="card space-y-2" aria-label="이 주에 바꾼 수업">
            <b className="block">이 주에 바꾼 수업 {weekChanges.length}</b>
            <ul className="space-y-1.5">
              {weekChanges.map((c) => {
                const before = settings.timetable.find((t) => t.day === new Date(`${c.date}T00:00:00`).getDay() && t.period === c.period)?.groupId ?? null
                return (
                  <li key={c.id} className="flex items-center gap-2 text-[0.95rem]">
                    <span className="badge bg-caution-light text-caution">{c.kind}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
                      {shortDateLabel(c.date)} {c.period}교시 · {nameOf(before) ?? '빈 교시'} → <b>{nameOf(c.groupId) ?? '내 수업 없음'}</b>
                      {c.note && <span className="text-ink-3"> · {c.note}</span>}
                    </span>
                    {!readOnly && (
                      <button type="button" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-ink-3 hover:bg-fill" onClick={() => void save(changes.filter((x) => x.id !== c.id), '원래 시간표로 돌렸어요.')}>
                        원래대로
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {!readOnly && <ComciImport onApply={(next, n) => void save(next, `컴시간 변경 ${n}개를 넣었어요.`)} />}

        <Link to="/more/settings/timetable" className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-white px-4 font-bold shadow-[var(--shadow-card)]">
          <Icon name="calendar" className="text-brand" />
          <span className="flex-1">요일 시간표 고치기 (매주 같은 수업)</span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
      </div>

      {edit && (
        <EditSheet
          key={`${edit.date}|${edit.period}`}
          date={edit.date}
          period={edit.period}
          onClose={() => setEdit(null)}
          onSave={(next, note) => {
            setEdit(null)
            void save(next, note)
          }}
        />
      )}
    </>
  )
}

function EditSheet({ date, period, onClose, onSave }: { date: string; period: number; onClose: () => void; onSave: (next: TimetableChange[], note: string) => void }) {
  const { settings } = useApp()
  const { groups } = useGroups()
  const changes = settings.timetableChanges ?? []
  const day = new Date(`${date}T00:00:00`).getDay()
  const before = settings.timetable.find((t) => t.day === day && t.period === period)?.groupId ?? null
  const cur = changes.find((c) => c.date === date && c.period === period)
  const [pick, setPick] = useState<string | null>(cur ? cur.groupId : before)
  const [kind, setKind] = useState<ChangeKind>(cur?.kind ?? changeKindFor(before, cur ? cur.groupId : before))
  const [note, setNote] = useState(cur?.note ?? '')
  const choose = (id: string | null) => {
    setPick(id)
    setKind(changeKindFor(before, id))
  }
  const beforeName = before ? (groups?.find((g) => g.id === before)?.name ?? '(지운 수업반)') : '빈 교시'
  const same = pick === before
  const list = useMemo(() => (groups ?? []).filter((g) => !g.archived), [groups])
  return (
    <BottomSheet title={`${shortDateLabel(date)} ${period}교시`} sub={`요일 시간표: ${beforeName}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="이 교시 수업">
          {list.map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={pick === g.id} className={`min-h-[52px] rounded-2xl px-3 text-left font-bold ${pick === g.id ? 'bg-brand text-white' : 'bg-fill'}`} onClick={() => choose(g.id)}>
              {g.name}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={pick === null} className={`min-h-[52px] rounded-2xl px-3 text-left font-bold ${pick === null ? 'bg-ink text-white' : 'bg-fill text-ink-2'}`} onClick={() => choose(null)}>
            내 수업 없음
          </button>
        </div>
        {!same && (
          <>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="바뀐 까닭">
              {KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${kind === k ? 'bg-caution text-white' : 'bg-fill text-ink-2'}`} onClick={() => setKind(k)}>
                  {k}
                </button>
              ))}
            </div>
            <input className="field w-full" value={note} placeholder="메모 (선택, 예: 김 선생님과 교환)" aria-label="메모" onChange={(e) => setNote(e.target.value)} />
          </>
        )}
        {pick === null && before && <p className="hint">결강이면 이 반 진도표의 이 차시부터 다음 수업으로 밀려요.</p>}
        <div className="flex gap-2">
          {cur && (
            <button type="button" className="btn btn-soft flex-1" onClick={() => onSave(changes.filter((x) => x.id !== cur.id), '원래 시간표로 돌렸어요.')}>
              원래대로
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() =>
              same
                ? onSave(cur ? changes.filter((x) => x.id !== cur.id) : changes, cur ? '원래 시간표로 돌렸어요.' : '바뀐 것이 없어요.')
                : onSave(upsertChange(changes, { id: cur?.id ?? newId(), date, period, groupId: pick, kind, ...(note.trim() ? { note: note.trim() } : {}) }), `${shortDateLabel(date)} ${period}교시를 바꿨어요.`)
            }
          >
            저장
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

/** 컴시간에서 이번 주 변경 가져오기 (받아 둔 컴시간 한 주와 비교 → 고른 것만 넣기) */
function ComciImport({ onApply }: { onApply: (next: TimetableChange[], n: number) => void }) {
  const { settings } = useApp()
  const { groups } = useGroups(true)
  const w = settings.comciWeek
  const [list, setList] = useState<ChangeCandidate[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const key = (c: ChangeCandidate) => `${c.date}|${c.period}`
  const nameOf = (id: string | null) => (id ? (groups?.find((g) => g.id === id)?.name ?? '?') : null)

  if (!w || !w.myNo)
    return (
      <Link to="/timetable/pe" className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-4 shadow-[var(--shadow-card)]">
        <Icon name="download" className="text-brand" />
        <span className="min-w-0 flex-1">
          <b className="block">컴시간에서 변경 가져오기</b>
          <span className="hint">먼저 [전체 체육 시간표 → 컴시간]에서 내 이름으로 이번 주를 받아 주세요</span>
        </span>
        <Icon name="chevronRight" className="text-ink-3" />
      </Link>
    )

  const find = () => {
    const c = comciChanges({ data: w.data, myNo: w.myNo!, label: w.label, timetable: settings.timetable, groups: groups ?? [] })
    setList(c)
    setSel(new Set(c.filter((x) => x.flagged && !x.unmapped).map(key)))
  }
  return (
    <section className="card space-y-3" aria-label="컴시간에서 변경 가져오기">
      <div className="flex items-center gap-3">
        <Icon name="download" className="text-brand" />
        <div className="min-w-0 flex-1">
          <b className="block">컴시간에서 변경 가져오기</b>
          <span className="hint">받아 둔 컴시간 {w.label || '한 주'}의 내 수업과 요일 시간표를 비교해요</span>
        </div>
        <button type="button" className="btn btn-outline min-h-[44px] shrink-0 px-4" onClick={find}>
          비교하기
        </button>
      </div>
      {list &&
        (list.length === 0 ? (
          <p className="font-bold text-ok">요일 시간표와 같아요. 바뀐 수업이 없어요.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {list.map((c) => (
                <li key={key(c)}>
                  <label className={`flex min-h-[48px] items-center gap-3 rounded-xl px-2 ${c.unmapped ? 'opacity-60' : 'hover:bg-fill'}`}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[var(--color-brand)]"
                      disabled={!!c.unmapped}
                      checked={sel.has(key(c))}
                      onChange={(e) => setSel((s) => (e.target.checked ? new Set([...s, key(c)]) : new Set([...s].filter((x) => x !== key(c)))))}
                    />
                    <span className="min-w-0 flex-1 text-[0.95rem]">
                      <span className="badge mr-1 bg-caution-light text-caution">{c.kind}</span>
                      {shortDateLabel(c.date)} {c.period}교시 · {nameOf(c.before) ?? '빈 교시'} → <b>{c.unmapped ? `${c.unmapped} (수업반 없음)` : (nameOf(c.after) ?? '내 수업 없음')}</b>
                      {!c.flagged && !c.unmapped && <span className="block text-[0.8rem] text-ink-3">컴시간 변경 표시 없음 — 요일 시간표가 컴시간과 다를 수 있어요</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={sel.size === 0}
              onClick={() => {
                const picked = list.filter((c) => sel.has(key(c)))
                onApply(applyCandidates(settings.timetableChanges ?? [], picked, newId), picked.length)
                setList(null)
              }}
            >
              고른 {sel.size}개 넣기
            </button>
          </>
        ))}
    </section>
  )
}
