import { weatherEmoji } from '../../lib/dash'
import { hourWarn, lessonHour, type HourWx } from '../../lib/weather'
import { useApp } from '../../state/AppContext'

/**
 * 교시별 날씨 (2026-11-25, 슈퍼스쿨 시간별 날씨 칸 참고): 오늘 내 수업 교시마다 그 시간 예보.
 * 홈 날씨 칸이 받아 둔 기상청 단기예보(settings.weatherCache.hours)만 쓴다 — 따로 인터넷을 쓰지 않음.
 * 위치를 안 정했거나 오늘 예보가 없으면 null.
 */
export function useLessonWx(): (period: number) => HourWx | null {
  const { settings } = useApp()
  const c = settings.weatherCache
  const today = ymd(new Date())
  const hours = settings.weatherLoc && c?.hoursDate === today ? (c.hours ?? []) : []
  return (period) => lessonHour(settings.periodStarts[period - 1], settings.periodMinutes, hours)
}

const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

/** 날씨 칩: ☀️ 3° (강수확률 30% 이상이면 ☔) · 주의면 노랑 + 한마디. tone=onBrand는 파란 카드 위 */
export default function LessonWx({ h, tone = 'plain' }: { h: HourWx; tone?: 'plain' | 'onBrand' }) {
  const warn = hourWarn(h)
  const emoji = weatherEmoji(h.pty, h.sky, Number(h.time.slice(0, 2)))
  const base = tone === 'onBrand' ? 'bg-white/20 text-white' : warn ? 'bg-caution-light text-caution' : 'bg-fill text-ink-2'
  const label = `${h.time.slice(0, 2)}시 예보 ${h.tmp !== undefined ? `${h.tmp}도` : ''}${h.pop !== undefined ? ` 강수확률 ${h.pop}%` : ''}${warn ? ` ${warn}` : ''}`
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.8rem] font-extrabold tabular-nums ${base}`} aria-label={label} title={label}>
      <span aria-hidden>{emoji}</span>
      {h.tmp !== undefined && <span>{h.tmp}°</span>}
      {warn ? <span>{warn}</span> : (h.pop ?? 0) >= 30 && <span>☔{h.pop}%</span>}
    </span>
  )
}
