import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useTimer } from '../state/TimerContext'

const TOOLS: { to: string; icon: IconName; title: string; desc: string; tone: string }[] = [
  { to: '/timer', icon: 'timer', title: '타이머 · 스톱워치', desc: '카운트다운 · 인터벌 · 랩 기록 → PAPS·수행평가', tone: 'bg-brand-light text-brand' },
  { to: '/tools/pick', icon: 'dice', title: '뽑기', desc: '발표 · 시범 · 순서 정하기', tone: 'bg-caution-light text-caution' },
  { to: '/tools/teams', icon: 'team', title: '팀 나누기', desc: '무작위 · 남녀 고르게 · 실력 고르게', tone: 'bg-ok-light text-ok' },
  { to: '/timer?tab=paps', icon: 'volume', title: 'PAPS 신호음', desc: '윗몸말아올리기 · 스텝검사 · 왕복오래달리기', tone: 'bg-fill-2 text-ink-2' },
]

/** 도구 탭: 수업 중에 쓰는 도구 모음 */
export default function ToolsPage() {
  const t = useTimer()
  return (
    <>
      <PageHeader title="수업 도구" sub={t.running ? '타이머가 돌고 있어요' : undefined} />
      <div className="page grid gap-3 pb-8 sm:grid-cols-2">
        {TOOLS.map((x) => (
          <Link key={x.to} to={x.to} className="card flex min-h-[96px] items-center gap-4 transition-transform active:scale-[0.99]">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${x.tone}`}>
              <Icon name={x.icon} size={28} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-lg">{x.title}</b>
              <span className="hint block">{x.desc}</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        ))}
      </div>
    </>
  )
}
