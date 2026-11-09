import { FEATURES, featureOn, featuresForRoles, ROLES, rolesOf } from '../lib/features'
import { useApp } from '../state/AppContext'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

/** 쓸 기능 고르기. 끈 기능은 숨기기만 하고 자료는 지우지 않는다. */
export default function FeatureSheet({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useApp()
  const toggle = (id: (typeof FEATURES)[number]['id']) => updateSettings({ features: { ...settings.features, [id]: !featureOn(settings.features, id) } })
  const roles = rolesOf(settings.features)
  // 역할을 누르면 고른 역할들의 기능만 켠다 (하나는 남겨 둔다)
  const toggleRole = (id: string) => {
    const next = roles.includes(id) ? roles.filter((r) => r !== id) : [...roles, id]
    if (next.length === 0) return
    updateSettings({ features: featuresForRoles(next) })
  }
  return (
    <BottomSheet title="쓸 기능 고르기" sub="끈 기능은 화면에서만 숨겨요. 저장된 기록은 그대로 남아요." onClose={onClose}>
      <section className="mb-4 space-y-2" aria-label="업무 역할로 고르기">
        <p className="font-bold">내 업무 역할로 한 번에</p>
        <p className="hint">맡은 일을 고르면 그 일에 쓰는 기능만 켜져요. 아래 스위치로 더 고칠 수 있어요.</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => {
            const on = roles.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                className={`min-h-[64px] rounded-2xl border-2 px-3 py-2 text-left transition-colors ${on ? 'border-brand bg-brand-light' : 'border-line bg-white'}`}
                onClick={() => toggleRole(r.id)}
              >
                <span className={`block font-bold ${on ? 'text-brand' : ''}`}>
                  {on ? '✓ ' : ''}
                  {r.label}
                </span>
                <span className="hint block text-[0.78rem] leading-snug">{r.desc}</span>
              </button>
            )
          })}
        </div>
      </section>
      <p className="mb-2 font-bold">기능별로</p>
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
