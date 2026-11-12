import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { monthMarks, type DayMark } from '../../lib/dash'
import { addMonths, monthOf, shortDateLabel } from '../../lib/dates'
import type { NeisEvent } from '../../lib/neisOpenApi'
import { monthGrid, type WorkEvent } from '../../lib/workCal'
import Icon from '../Icon'

const HEAD = ['월', '화', '수', '목', '금', '토', '일']

/**
 * 홈 달력 (2026-11-12): 이번 달 한 장에 학사일정 · 업무 일정을 바로 보여 준다.
 * 넓은 화면은 칸 안에 일정 이름, 폰은 점 → 날짜를 누르면 아래에 그날 일정.
 */
export default function MonthCalendar({ today, school, work }: { today: string; school: readonly NeisEvent[]; work: readonly WorkEvent[] }) {
  const [month, setMonth] = useState(() => monthOf(today))
  const [picked, setPicked] = useState(today)
  const weeks = useMemo(() => monthGrid(month), [month])
  const marks = useMemo(() => monthMarks(weeks.flat().map((c) => c.date), school, work), [weeks, school, work])
  const [y, m] = month.split('-').map(Number)
  const sel = marks.get(picked) ?? []
  const move = (n: number) => {
    const next = addMonths(month, n)
    setMonth(next)
    setPicked(next === monthOf(today) ? today : `${next}-01`)
  }
  const empty = school.length === 0 && work.length === 0

  return (
    <section className="card space-y-2 p-3 sm:p-4" aria-label="달력 · 학사일정">
      <div className="flex items-center gap-1">
        <h2 className="flex-1 pl-1 text-[1.15rem] font-black tracking-tight tabular-nums">
          {y}년 {m}월
        </h2>
        {month !== monthOf(today) && (
          <button type="button" className="rounded-full bg-fill px-3 py-1.5 text-sm font-bold text-ink-2" onClick={() => move(0 - diff(month, monthOf(today)))}>
            오늘
          </button>
        )}
        <button type="button" className="btn btn-ghost h-10 min-h-0 min-w-10 px-2" aria-label="앞 달" onClick={() => move(-1)}>
          <Icon name="chevronLeft" size={20} />
        </button>
        <button type="button" className="btn btn-ghost h-10 min-h-0 min-w-10 px-2" aria-label="다음 달" onClick={() => move(1)}>
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[0.78rem] font-extrabold">
        {HEAD.map((d, i) => (
          <span key={d} className={i === 5 ? 'text-[#2a78d6]' : i === 6 ? 'text-danger' : 'text-ink-3'}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line">
        {weeks.flat().map((c, i) => {
          const list = marks.get(c.date) ?? []
          const off = i % 7 === 6 || list.some((x) => x.kind === 'off')
          const isToday = c.date === today
          const isPicked = c.date === picked
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => setPicked(c.date)}
              aria-label={`${shortDateLabel(c.date)}${list.length ? ` 일정 ${list.length}개` : ''}`}
              aria-pressed={isPicked}
              className={`flex min-h-[52px] flex-col items-stretch gap-0.5 p-1 text-left sm:min-h-[68px] ${c.out ? 'bg-[#fafbfc]' : 'bg-white'} ${isPicked ? 'ring-2 ring-brand ring-inset' : ''}`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center self-center rounded-full text-[0.86rem] font-extrabold tabular-nums sm:self-start ${
                  isToday ? 'bg-brand text-white' : c.out ? 'text-ink-3/50' : off ? 'text-danger' : i % 7 === 5 ? 'text-[#2a78d6]' : 'text-ink'
                }`}
              >
                {c.day}
              </span>
              {/* 넓은 화면: 일정 이름 두 줄까지 */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {list.slice(0, 2).map((x) => (
                  <span key={x.label} className="overflow-hidden rounded px-0.5 text-[0.68rem] leading-[1.35] font-bold tracking-tighter whitespace-nowrap" style={{ color: x.fg, background: x.bg }}>
                    {x.label}
                  </span>
                ))}
                {list.length > 2 && <span className="px-1 text-[0.64rem] font-bold text-ink-3">+{list.length - 2}</span>}
              </span>
              {/* 폰: 점 */}
              <span className="flex justify-center gap-0.5 sm:hidden">
                {list.slice(0, 3).map((x) => (
                  <i key={x.label} className="h-1.5 w-1.5 rounded-full" style={{ background: x.fg }} aria-hidden />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-1 px-1 pt-1">
        <p className="text-[0.82rem] font-extrabold text-ink-3">{picked === today ? `오늘 · ${shortDateLabel(picked)}` : shortDateLabel(picked)}</p>
        {sel.length ? (
          <ul className="space-y-1">
            {sel.map((x) => (
              <Mark key={x.label} x={x} />
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-ink-3">{empty ? '아직 일정이 없어요' : '이날은 일정이 없어요'}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-1 pt-2 text-sm font-bold">
        <Link to="/work/calendar" className="text-brand">
          + 업무 일정 넣기
        </Link>
        {school.length === 0 && (
          <Link to="/more/settings/neis" className="text-brand">
            학사일정 불러오기
          </Link>
        )}
      </div>
    </section>
  )
}

function Mark({ x }: { x: DayMark }) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.95rem] font-bold" style={{ background: x.bg, color: x.fg }}>
      <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: x.fg }} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{x.label}</span>
      <span className="shrink-0 text-xs opacity-80">{x.kind === 'work' ? '업무' : x.kind === 'exam' ? '고사' : x.kind === 'off' ? '쉬는 날' : '학사'}</span>
    </li>
  )
}

/** 두 달 사이 개월 수 (a − b) */
function diff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (ay - by) * 12 + (am - bm)
}
