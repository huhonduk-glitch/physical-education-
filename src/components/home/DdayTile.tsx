import { Link } from 'react-router-dom'
import { ddayText, type Dday } from '../../lib/dash'
import { shortDateLabel } from '../../lib/dates'

const TONE: Record<Dday['kind'], string> = {
  work: 'from-[#e8f0fe] to-[#f3f7ff] text-[#1d5fd6]',
  exam: 'from-[#fdeee6] to-[#fff6f0] text-[#d9541e]',
  off: 'from-[#fdecea] to-[#fff5f4] text-[#d0342c]',
  school: 'from-[#eef0f3] to-[#f8f9fa] text-ink',
}

/** 홈 D-day (2026-11-12): 가장 가까운 고사 · 업무 일정 하나를 크게, 그 뒤 일정 두 개를 작게 */
export default function DdayTile({ list }: { list: Dday[] }) {
  const main = list[0]
  if (!main)
    return (
      <Link to="/work/calendar" className="dash-tile flex flex-col items-center justify-center bg-white text-center">
        <p className="text-[1.6rem] leading-none font-black text-ink-3">D-day</p>
        <p className="mt-1.5 text-[0.82rem] font-semibold text-ink-3">업무 달력에 일정을 넣거나 학사일정을 불러오면 여기에 떠요</p>
      </Link>
    )
  return (
    <Link to="/work/calendar" className={`dash-tile flex flex-col items-center justify-center bg-gradient-to-br text-center ${TONE[main.kind]}`} aria-label={`${main.title} ${ddayText(main.days)}`}>
      <p className="text-[2.1rem] leading-none font-black tracking-tight tabular-nums xl:text-[2.4rem]">{ddayText(main.days)}</p>
      <p className="mt-1 line-clamp-2 max-w-full text-[0.98rem] leading-snug font-extrabold text-ink">{main.title}</p>
      <p className="text-[0.8rem] font-bold opacity-80">{shortDateLabel(main.date)}</p>
      {list.length > 1 && (
        <p className="mt-1 hidden max-w-full truncate text-[0.74rem] font-semibold text-ink-3 xl:block">
          {list
            .slice(1, 3)
            .map((d) => `${ddayText(d.days)} ${d.title}`)
            .join(' · ')}
        </p>
      )}
    </Link>
  )
}
