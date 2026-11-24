import { Link } from 'react-router-dom'
import type { FeatureId } from '../../db/settings'
import type { TodoTile } from '../../lib/brief'
import { featureOn } from '../../lib/features'
import { useApp } from '../../state/AppContext'
import { useBrief } from '../../state/useBrief'

/** 칸마다 켜져 있어야 보이는 기능 (끈 기능의 칸은 숨긴다) */
const FEATURE_OF: Record<TodoTile['id'], FeatureId | null> = { neis: 'records', grading: 'assess', behind: 'plans', events: null }

/**
 * 홈 '처리할 일' (2026-11-25, 슈퍼스쿨 홈 '처리할 업무' 칸 참고 — 문구 · 코드는 새로 씀).
 * 땅콩이 오늘 브리핑과 같은 셈(useBrief)을 숫자 칸으로: 나이스에 옮길 출결 · 남은 채점 · 진도 늦은 반 · 업무 일정 7일.
 * 학생 이름은 넣지 않는다(홈은 학생이 볼 수도 있음). 누르면 그 화면.
 */
export default function TodoCard() {
  const { settings } = useApp()
  const brief = useBrief(true)
  if (!brief) return null
  const tiles = brief.tiles.filter((t) => {
    const f = FEATURE_OF[t.id]
    return !f || featureOn(settings.features, f)
  })
  if (!tiles.length) return null
  const all = tiles.every((t) => t.value === 0)
  return (
    <section className="space-y-2" aria-label="처리할 일">
      <div className="flex items-end justify-between px-1">
        <h2 className="text-[1.05rem] font-extrabold">처리할 일</h2>
        {all && <span className="text-sm font-bold text-ok">모두 끝났어요</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {tiles.map((t) => {
          const hot = t.value > 0 && t.id !== 'events'
          return (
            <Link
              key={t.id}
              to={t.to}
              className={`card flex min-h-[96px] flex-col justify-between gap-0.5 p-3.5 transition-transform active:scale-[0.98] ${hot ? 'border-2 border-caution/30 bg-caution-light' : ''}`}
            >
              <span className={`text-[0.84rem] leading-snug font-bold ${hot ? 'text-caution' : 'text-ink-2'}`}>{t.label}</span>
              <b className={`text-[1.7rem] leading-none font-black tabular-nums ${t.value ? 'text-ink' : 'text-ink-3'}`}>
                {t.value}
                <span className="ml-0.5 text-sm font-bold text-ink-3">{t.unit}</span>
              </b>
              <span className="truncate text-[0.8rem] font-semibold text-ink-3">{t.sub}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
