import { useState } from 'react'
import { addDays, addMonths, longDateLabel, monthGrid, monthOf, todayStr } from '../lib/dates'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

/**
 * 기록할 날짜 고르기: ‹ 하루 전 · 날짜(누르면 달력) · 하루 뒤 ›
 * 오늘보다 뒤 날짜는 고를 수 없다. marked 날짜에는 달력에 점이 찍힌다(기록이 있는 날).
 */
export default function DateBar({ value, onChange, marked }: { value: string; onChange: (d: string) => void; marked?: Set<string> }) {
  const today = todayStr()
  const [open, setOpen] = useState(false)
  const isToday = value === today
  return (
    <>
      <div className="flex items-center gap-1 rounded-2xl bg-white p-1 shadow-[var(--shadow-card)]">
        <button type="button" className="btn btn-ghost px-3" aria-label="하루 전" onClick={() => onChange(addDays(value, -1))}>
          <Icon name="chevronLeft" />
        </button>
        <button type="button" className="btn btn-ghost flex-1 gap-2 px-2" onClick={() => setOpen(true)} aria-label={`날짜 ${longDateLabel(value)} · 달력 열기`}>
          <Icon name="calendar" size={20} className="text-brand" />
          <span className="text-[1.05rem] font-extrabold tabular-nums">{longDateLabel(value)}</span>
          {isToday && <span className="badge bg-brand-light text-brand">오늘</span>}
        </button>
        <button type="button" className="btn btn-ghost px-3" aria-label="하루 뒤" disabled={isToday || value > today} onClick={() => onChange(addDays(value, 1))}>
          <Icon name="chevronRight" />
        </button>
      </div>
      {!isToday && (
        <div className="anim-pop mt-2 flex items-center gap-2 rounded-2xl bg-caution-light px-4 py-2 text-caution">
          <Icon name="calendar" size={18} />
          <p className="flex-1 text-[0.92rem] font-bold">지난 날짜에 기록하고 있어요</p>
          <button type="button" className="btn min-h-[40px] bg-white px-3 text-caution" onClick={() => onChange(today)}>
            오늘로
          </button>
        </div>
      )}
      {open && (
        <CalendarSheet
          value={value}
          marked={marked}
          onClose={() => setOpen(false)}
          onPick={(d) => {
            onChange(d)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function CalendarSheet({ value, marked, onPick, onClose }: { value: string; marked?: Set<string>; onPick: (d: string) => void; onClose: () => void }) {
  const today = todayStr()
  const [month, setMonth] = useState(monthOf(value))
  const [y, m] = month.split('-').map(Number)
  return (
    <BottomSheet title="날짜 고르기" sub="점이 있는 날은 이 반에 기록이 있는 날이에요" onClose={onClose}>
      <div className="flex items-center justify-between pb-2">
        <button type="button" className="btn btn-soft px-3" aria-label="이전 달" onClick={() => setMonth(addMonths(month, -1))}>
          <Icon name="chevronLeft" />
        </button>
        <p className="text-lg font-extrabold tabular-nums">
          {y}년 {m}월
        </p>
        <button type="button" className="btn btn-soft px-3" aria-label="다음 달" disabled={month >= monthOf(today)} onClick={() => setMonth(addMonths(month, 1))}>
          <Icon name="chevronRight" />
        </button>
      </div>
      <table className="w-full table-fixed text-center">
        <thead>
          <tr>
            {'일월화수목금토'.split('').map((d, i) => (
              <th key={d} className={`pb-1 text-sm font-bold ${i === 0 ? 'text-danger' : i === 6 ? 'text-brand' : 'text-ink-3'}`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) =>
                d ? (
                  <td key={d} className="p-0.5">
                    <button
                      type="button"
                      disabled={d > today}
                      aria-pressed={d === value}
                      aria-label={`${Number(d.slice(8))}일${marked?.has(d) ? ' 기록 있음' : ''}`}
                      onClick={() => onPick(d)}
                      className={`relative mx-auto grid h-12 w-full max-w-12 place-items-center rounded-full text-[1.02rem] font-bold tabular-nums transition-colors disabled:opacity-30 ${
                        d === value ? 'bg-brand text-white' : d === today ? 'bg-brand-light text-brand' : 'hover:bg-fill'
                      }`}
                    >
                      {Number(d.slice(8))}
                      {marked?.has(d) && (
                        <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${d === value ? 'bg-white' : 'bg-brand'}`} aria-hidden />
                      )}
                    </button>
                  </td>
                ) : (
                  <td key={`e${wi}-${di}`} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline mt-3 w-full" onClick={() => onPick(today)}>
        오늘로 가기
      </button>
    </BottomSheet>
  )
}
