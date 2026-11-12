import { useEffect, useState } from 'react'
import type { TimetableEntry } from '../../db/settings'
import { leftText } from '../../lib/dash'
import { lessonClock } from '../../lib/timetable'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 홈 시계 (2026-11-12): 큰 시각 + 날짜 + 지금 수업 끝까지 / 다음 수업까지 남은 시간.
 * 1초마다 이 칸만 다시 그린다(홈 전체는 그대로).
 */
export default function ClockTile({
  timetable,
  periodStarts,
  periodMinutes,
  nameOf,
}: {
  timetable: readonly TimetableEntry[]
  periodStarts: readonly string[]
  periodMinutes: number
  nameOf: (groupId: string) => string | undefined
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const p2 = (n: number) => String(n).padStart(2, '0')
  const lc = lessonClock(now, timetable, periodStarts, periodMinutes)
  const name = lc ? nameOf(lc.groupId) : undefined
  return (
    <section className="dash-tile flex flex-col items-center justify-center bg-gradient-to-br from-[#eef4ff] to-[#f6f0ff] text-center" aria-label="지금 시각">
      <p className="text-[0.82rem] font-bold text-ink-3">
        {now.getMonth() + 1}월 {now.getDate()}일 ({DAYS[now.getDay()]})
      </p>
      <p className="font-black tracking-tight whitespace-nowrap tabular-nums" aria-live="off">
        <span className="text-[2.05rem] leading-none sm:text-[2.3rem] xl:text-[2.7rem]">
          {p2(now.getHours())}:{p2(now.getMinutes())}
        </span>
        <span className="ml-1 text-[1rem] text-ink-3 sm:text-[1.15rem]">{p2(now.getSeconds())}</span>
      </p>
      {lc && name ? (
        <p className={`mt-1.5 max-w-full truncate rounded-full px-2.5 py-0.5 text-[0.8rem] font-bold ${lc.kind === 'now' ? 'bg-brand text-white' : 'bg-white text-ink-2'}`}>
          {lc.kind === 'now' ? `${lc.period}교시 ${name} · 끝까지 ${leftText(lc.seconds)}` : `${lc.period}교시 ${name}까지 ${leftText(lc.seconds)}`}
        </p>
      ) : (
        <p className="mt-1.5 text-[0.8rem] font-semibold text-ink-3">{now.getDay() === 0 || now.getDay() === 6 ? '주말이에요' : timetable.length ? '오늘 남은 수업이 없어요' : ' '}</p>
      )}
    </section>
  )
}
