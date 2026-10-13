import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import type { FeatureId } from '../db/settings'
import { featureOn } from '../lib/features'
import { useApp } from '../state/AppContext'

/** 평가마다 하는 순서를 보여 주고, 단계마다 바로 갈 수 있게 한다 */
const FLOWS: { id: FeatureId; title: string; sub: string; icon: IconName; tone: string; to: string; steps: { label: string; to: string }[] }[] = [
  {
    id: 'paps',
    title: '학생건강체력평가 (PAPS)',
    sub: '측정 입력 → 자동 등급 → 나이스 업로드 파일',
    icon: 'paps',
    tone: 'bg-ok-light text-ok',
    to: '/paps',
    steps: [
      { label: '측정 종목', to: '/paps/setup' },
      { label: '기록 입력', to: '/paps' },
      { label: '결과 보기', to: '/paps/results' },
      { label: '나이스 파일', to: '/paps/export' },
    ],
  },
  {
    id: 'assess',
    title: '수행평가',
    sub: '평가 만들기 → 수업반 채점 → 나이스 일괄입력',
    icon: 'clipboard',
    tone: 'bg-caution-light text-caution',
    to: '/more/assessments',
    steps: [
      { label: '루브릭', to: '/more/assessments/rubric' },
      { label: '평가 만들기', to: '/more/assessments/new' },
      { label: '채점', to: '/more/assessments' },
      { label: '나이스 파일', to: '/more/assessments/export' },
    ],
  },
]

/** 평가 탭: PAPS · 수행평가 */
export default function EvalPage() {
  const { settings } = useApp()
  const items = FLOWS.filter((f) => featureOn(settings.features, f.id))
  return (
    <>
      <PageHeader title="평가" />
      <div className="page space-y-4 pb-8">
        {items.map((f) => (
          <section key={f.id} className="card space-y-4">
            <Link to={f.to} className="flex items-center gap-3">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${f.tone}`}>
                <Icon name={f.icon} size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[1.1rem]">{f.title}</b>
                <span className="hint block">{f.sub}</span>
              </span>
              <Icon name="chevronRight" className="text-ink-3" />
            </Link>
            <ol className="grid grid-cols-4 gap-1.5">
              {f.steps.map((s, i) => (
                <li key={s.label}>
                  <Link to={s.to} className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-fill px-1 py-2 text-center active:bg-fill-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-ink-2">{i + 1}</span>
                    <span className="text-[0.78rem] leading-tight font-bold text-ink-2">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {items.length === 0 && <p className="card hint">평가 기능을 모두 꺼 두었어요. 홈의 [기능 고르기]에서 켤 수 있어요.</p>}
      </div>
    </>
  )
}
