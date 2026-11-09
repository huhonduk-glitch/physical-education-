import { Link } from 'react-router-dom'
import { deltaLabel, sumCounts, type Counts } from '../lib/weekly'
import { useWeekly } from '../state/useWeekly'
import Icon from './Icon'

const ITEMS: { key: keyof Counts; label: string }[] = [
  { key: 'praise', label: '칭찬' },
  { key: 'guide', label: '지도' },
  { key: 'absence', label: '견학' },
  { key: 'absent', label: '결석' },
]

/**
 * 홈 '이번 주 수업' 카드 (2026-11-09): 숫자만(학생 이름은 요약 화면에서 — 홈은 수업 중 화면에 띄울 수 있어서).
 * 이번 주 · 지난주 기록이 하나도 없으면 숨긴다.
 */
export default function WeeklyCard() {
  const { summary } = useWeekly()
  if (!summary) return null
  const now = sumCounts(summary.groups.map((g) => g.thisWeek))
  const last = sumCounts(summary.groups.map((g) => g.lastWeek))
  const anyCount = (c: Counts) => c.praise + c.guide + c.absence + c.absent
  if (anyCount(now) + anyCount(last) === 0) return null
  const watch = summary.groups.reduce((n, g) => n + g.guideRepeat.length, 0)
  return (
    <Link to="/weekly" className="card block space-y-2.5 transition-transform active:scale-[0.99]" aria-label="이번 주 수업 요약 보기">
      <div className="flex items-center gap-2">
        <b className="flex-1 text-[1.05rem]">이번 주 수업</b>
        <span className="text-sm font-bold text-ink-3">지난주 같은 때와 비교</span>
        <Icon name="chevronRight" className="text-ink-3" />
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {ITEMS.map((i) => (
          <div key={i.key} className="rounded-xl bg-fill px-1 py-2">
            <p className="text-[0.75rem] font-bold text-ink-3">{i.label}</p>
            <p className="text-[1.25rem] leading-tight font-black tabular-nums">{now[i.key]}</p>
            <p className="text-[0.72rem] font-semibold text-ink-3 tabular-nums">{deltaLabel(now[i.key], last[i.key])}</p>
          </div>
        ))}
      </div>
      {watch > 0 && <p className="text-sm font-bold text-danger">지도가 쌓이는 학생 {watch}명 · 눌러서 보기</p>}
    </Link>
  )
}
