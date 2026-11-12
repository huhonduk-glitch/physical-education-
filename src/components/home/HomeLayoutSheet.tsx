import { HOME_WIDGETS, moveWidget, resolveLayout, type HomeWidgetId } from '../../lib/dash'
import { useApp } from '../../state/AppContext'
import BottomSheet from '../BottomSheet'
import Icon from '../Icon'

/**
 * 홈 화면 배치 바꾸기 (2026-11-12): 칸 순서를 위 · 아래로 옮기고, 안 쓰는 칸은 숨긴다.
 * 누르는 즉시 저장(settings.homeLayout)되어 뒤의 홈 화면이 바로 바뀐다. 자료는 지우지 않는다.
 */
export default function HomeLayoutSheet({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useApp()
  const { order, hidden } = resolveLayout(settings.homeLayout)
  const label = new Map<string, string>(HOME_WIDGETS.map((w) => [w.id, w.label]))
  const save = (o: HomeWidgetId[], h: Set<HomeWidgetId>) => void updateSettings({ homeLayout: { order: o, hidden: [...h] } })
  const toggle = (id: HomeWidgetId) => {
    const h = new Set(hidden)
    if (h.has(id)) h.delete(id)
    else h.add(id)
    save(order, h)
  }
  return (
    <BottomSheet title="홈 화면 배치" sub="위에 있는 칸부터 보여요. 넓은 화면에서는 두 단에 고르게 나뉘어요. 맨 위 시계 · 날씨 · D-day는 늘 그 자리예요." onClose={onClose}>
      <div className="space-y-2 overflow-y-auto px-5 pb-5">
        <ol className="space-y-1.5">
          {order.map((id, i) => {
            const off = hidden.has(id)
            return (
              <li key={id} className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 ${off ? 'bg-fill text-ink-3' : 'bg-brand-light'}`}>
                <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums">{i + 1}</span>
                <b className={`min-w-0 flex-1 truncate ${off ? 'line-through' : ''}`}>{label.get(id)}</b>
                <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-0" aria-label={`${label.get(id)} 위로`} disabled={i === 0} onClick={() => save(moveWidget(order, id, -1), hidden)}>
                  <Icon name="up" size={18} />
                </button>
                <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-0" aria-label={`${label.get(id)} 아래로`} disabled={i === order.length - 1} onClick={() => save(moveWidget(order, id, 1), hidden)}>
                  <Icon name="down" size={18} />
                </button>
                <button type="button" className={`h-9 shrink-0 rounded-full px-3 text-sm font-bold ${off ? 'bg-white text-ink-2' : 'bg-brand text-white'}`} aria-pressed={!off} onClick={() => toggle(id)}>
                  {off ? '숨김' : '보임'}
                </button>
              </li>
            )
          })}
        </ol>
        <p className="hint">시작 준비 · 오늘 수업처럼 보여 줄 것이 없는 칸은 켜 두어도 나타나지 않아요.</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" className="btn btn-outline" onClick={() => void updateSettings({ homeLayout: null })}>
            처음 배치로
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            다 됐어요
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
