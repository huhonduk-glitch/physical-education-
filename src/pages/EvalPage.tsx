import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { FEATURES, featureOn } from '../lib/features'
import { useApp } from '../state/AppContext'

/** 평가 탭: PAPS · 수행평가 */
export default function EvalPage() {
  const { settings } = useApp()
  const items = FEATURES.filter((f) => (f.id === 'paps' || f.id === 'assess') && featureOn(settings.features, f.id))
  return (
    <>
      <PageHeader title="평가" />
      <div className="page space-y-3 pb-8">
        {items.map((f) => (
          <Link key={f.id} to={f.to} className="card flex min-h-[96px] items-center gap-4 transition-transform active:scale-[0.99]">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${f.tone}`}>
              <Icon name={f.icon} size={28} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-lg">{f.id === 'paps' ? '학생건강체력평가 (PAPS)' : '수행평가'}</b>
              <span className="hint block">{f.desc}</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        ))}
        {items.length === 0 && <p className="card hint">평가 기능을 모두 꺼 두었어요. 홈의 [기능 고르기]에서 켤 수 있어요.</p>}
      </div>
    </>
  )
}
