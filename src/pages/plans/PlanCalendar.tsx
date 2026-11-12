import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { weekDates } from '../../lib/dash'
import { addDays, addMonths, monthOf, shortDateLabel } from '../../lib/dates'
import type { Meeting, Scheduled } from '../../lib/progressPlan'
import { monthGrid } from '../../lib/workCal'

/**
 * 진도표 주간 · 월간 보기 (2026-11-12 교사 요청 '진도표도 일간 · 월간처럼 골라 보기').
 * 날짜는 저장하지 않고 계산한 것(sched)을 그대로 쓴다. 끝냄 · 빠짐은 목록 보기와 같은 동작.
 */
interface Props {
  sched: readonly Scheduled[]
  done: ReadonlySet<string>
  today: string
  readOnly: boolean
  onDone: (itemId: string, on: boolean) => void
  onSkip: (m: Meeting) => void
}

const WD = ['월', '화', '수', '목', '금']
const HEAD = ['월', '화', '수', '목', '금', '토', '일']

function byDate(sched: readonly Scheduled[]): Map<string, Scheduled[]> {
  const m = new Map<string, Scheduled[]>()
  for (const s of sched) {
    if (!s.meeting) continue
    const a = m.get(s.meeting.date)
    if (a) a.push(s)
    else m.set(s.meeting.date, [s])
  }
  for (const a of m.values()) a.sort((x, y) => x.meeting!.period - y.meeting!.period)
  return m
}

function Nav({ title, onPrev, onNext, onNow, nowLabel }: { title: string; onPrev: () => void; onNext: () => void; onNow?: () => void; nowLabel: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-2" aria-label="앞으로" onClick={onPrev}>
        <Icon name="chevronLeft" size={20} />
      </button>
      <b className="min-w-[8.5rem] text-center text-[1.15rem] font-black tracking-tight tabular-nums">{title}</b>
      <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-2" aria-label="뒤로" onClick={onNext}>
        <Icon name="chevronRight" size={20} />
      </button>
      {onNow && (
        <button type="button" className="rounded-full bg-fill px-3 py-1.5 text-sm font-bold text-ink-2" onClick={onNow}>
          {nowLabel}
        </button>
      )}
    </div>
  )
}

/** 수업 한 번: 차시 · 단원 · 내용 + [끝냄] [빠짐] */
function Lesson({ s, done, today, readOnly, onDone, onSkip }: { s: Scheduled } & Omit<Props, 'sched' | 'done'> & { done: boolean }) {
  const isToday = s.meeting?.date === today
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 ${isToday ? 'bg-brand-light' : 'bg-fill'}`}>
      <button
        type="button"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${done ? 'bg-ok text-white' : 'bg-white text-ink-3'}`}
        aria-pressed={done}
        aria-label={`${s.no}차시 ${done ? '끝냄 취소' : '끝냄'}`}
        disabled={readOnly}
        onClick={() => onDone(s.item.id, !done)}
      >
        <Icon name="check" size={20} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8rem] font-bold text-ink-3">
          {s.meeting!.period}교시 · {s.item.unit}
          {s.item.lockedDate ? ' · 고정' : ''}
        </span>
        <span className="block font-bold">
          <b className="tabular-nums">{s.no}차시</b> {s.item.content || s.item.unit}
        </span>
        {(s.item.method || s.item.evalNote) && <span className="block truncate text-[0.8rem] font-semibold text-ink-3">{[s.item.method, s.item.evalNote].filter(Boolean).join(' · ')}</span>}
      </span>
      {!s.item.lockedDate && !readOnly && (
        <button type="button" className="btn btn-ghost shrink-0 px-3 text-sm" onClick={() => onSkip(s.meeting!)}>
          빠짐
        </button>
      )}
    </div>
  )
}

/** 주간: 월~금 하루씩, 그날 이 반 수업의 차시 */
export function PlanWeek(p: Props) {
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => weekDates(addDays(p.today, offset * 7)), [p.today, offset])
  const map = useMemo(() => byDate(p.sched), [p.sched])
  const n = days.reduce((t, d) => t + (map.get(d)?.length ?? 0), 0)
  return (
    <section className="space-y-2.5">
      <Nav
        title={`${shortDateLabel(days[0]).replace(/\(.*\)/, '')} ~ ${shortDateLabel(days[4]).replace(/\(.*\)/, '')}`}
        onPrev={() => setOffset(offset - 1)}
        onNext={() => setOffset(offset + 1)}
        onNow={offset ? () => setOffset(0) : undefined}
        nowLabel="이번 주"
      />
      {n === 0 && <p className="card text-center font-bold text-ink-3">이 주에는 이 반 수업이 없어요</p>}
      {days.map((d, i) => {
        const list = map.get(d) ?? []
        if (!list.length) return null
        return (
          <div key={d} className="card space-y-2 p-3">
            <p className="flex items-center gap-2 px-1">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${d === p.today ? 'bg-brand text-white' : 'bg-fill text-ink-2'}`}>{WD[i]}</span>
              <b className="tabular-nums">{shortDateLabel(d)}</b>
              {d === p.today && <span className="badge bg-brand-light text-brand">오늘</span>}
            </p>
            {list.map((s) => (
              <Lesson key={s.item.id} s={s} done={p.done.has(s.item.id)} today={p.today} readOnly={p.readOnly} onDone={p.onDone} onSkip={p.onSkip} />
            ))}
          </div>
        )
      })}
    </section>
  )
}

/** 월간: 달력 칸에 차시 번호(끝낸 차시는 초록), 날짜를 누르면 아래에 그날 수업 */
export function PlanMonth(p: Props) {
  const [month, setMonth] = useState(() => monthOf(p.today))
  const [picked, setPicked] = useState(p.today)
  const weeks = useMemo(() => monthGrid(month), [month])
  const map = useMemo(() => byDate(p.sched), [p.sched])
  const [y, m] = month.split('-').map(Number)
  const sel = map.get(picked) ?? []
  const move = (n: number) => {
    const next = addMonths(month, n)
    setMonth(next)
    setPicked(next === monthOf(p.today) ? p.today : `${next}-01`)
  }
  return (
    <section className="space-y-2.5">
      <Nav
        title={`${y}년 ${m}월`}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        onNow={
          month !== monthOf(p.today)
            ? () => {
                setMonth(monthOf(p.today))
                setPicked(p.today)
              }
            : undefined
        }
        nowLabel="이번 달"
      />
      <div className="card space-y-2 p-3">
        <div className="grid grid-cols-7 text-center text-[0.78rem] font-extrabold">
          {HEAD.map((d, i) => (
            <span key={d} className={i === 5 ? 'text-[#2a78d6]' : i === 6 ? 'text-danger' : 'text-ink-3'}>
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line">
          {weeks.flat().map((c, i) => {
            const list = map.get(c.date) ?? []
            const isToday = c.date === p.today
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => setPicked(c.date)}
                aria-pressed={c.date === picked}
                aria-label={`${shortDateLabel(c.date)}${list.length ? ` ${list.map((s) => `${s.no}차시`).join(' ')}` : ''}`}
                className={`flex min-h-[58px] flex-col items-center gap-0.5 p-1 sm:min-h-[72px] ${c.out ? 'bg-[#fafbfc]' : 'bg-white'} ${c.date === picked ? 'ring-2 ring-brand ring-inset' : ''}`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[0.84rem] font-extrabold tabular-nums ${
                    isToday ? 'bg-brand text-white' : c.out ? 'text-ink-3/50' : i % 7 === 6 ? 'text-danger' : i % 7 === 5 ? 'text-[#2a78d6]' : 'text-ink'
                  }`}
                >
                  {c.day}
                </span>
                {list.slice(0, 2).map((s) => (
                  <span key={s.item.id} className={`w-full rounded px-0.5 text-center text-[0.7rem] leading-[1.4] font-extrabold tabular-nums ${p.done.has(s.item.id) ? 'bg-ok-light text-ok' : 'bg-brand-light text-brand'}`}>
                    {s.no}
                    <span className="hidden sm:inline">차시</span>
                  </span>
                ))}
              </button>
            )
          })}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 px-1 text-[0.78rem] font-bold text-ink-3">
          <span>
            <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-light align-middle ring-1 ring-brand/40" />
            할 차시
          </span>
          <span>
            <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-ok-light align-middle ring-1 ring-ok/40" />
            끝낸 차시
          </span>
        </p>
      </div>
      <div className="card space-y-2 p-3">
        <p className="px-1 text-[0.86rem] font-extrabold text-ink-3">{picked === p.today ? `오늘 · ${shortDateLabel(picked)}` : shortDateLabel(picked)}</p>
        {sel.length ? sel.map((s) => <Lesson key={s.item.id} s={s} done={p.done.has(s.item.id)} today={p.today} readOnly={p.readOnly} onDone={p.onDone} onSkip={p.onSkip} />) : <p className="px-1 text-sm font-semibold text-ink-3">이날은 이 반 수업이 없어요</p>}
      </div>
    </section>
  )
}
