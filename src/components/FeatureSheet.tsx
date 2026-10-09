import { FEATURES, featureOn } from '../lib/features'
import { useApp } from '../state/AppContext'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

/** 쓸 기능 고르기. 끈 기능은 숨기기만 하고 자료는 지우지 않는다. */
export default function FeatureSheet({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useApp()
  const toggle = (id: (typeof FEATURES)[number]['id']) => updateSettings({ features: { ...settings.features, [id]: !featureOn(settings.features, id) } })
  return (
    <BottomSheet title="쓸 기능 고르기" sub="끈 기능은 화면에서만 숨겨요. 저장된 기록은 그대로 남아요." onClose={onClose}>
      <ul className="space-y-2">
        {FEATURES.map((f) => {
          const on = featureOn(settings.features, f.id)
          return (
            <li key={f.id}>
              <button type="button" role="switch" aria-checked={on} className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-fill px-3 text-left" onClick={() => toggle(f.id)}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${f.tone}`}>
                  <Icon name={f.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{f.label}</span>
                  <span className="hint block truncate">{f.desc}</span>
                </span>
                <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-fill-2'}`} aria-hidden>
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${on ? 'left-7' : 'left-1'}`} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn-primary mt-4 w-full" onClick={onClose}>
        다 골랐어요
      </button>
    </BottomSheet>
  )
}
