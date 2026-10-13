import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useTimer } from '../state/TimerContext'

const TOOLS: { to: string; icon: IconName; title: string; desc: string; tone: string }[] = [
  { to: '/tools/pick', icon: 'dice', title: '뽑기', desc: '발표 · 시범 · 순서', tone: 'bg-caution-light text-caution' },
  { to: '/tools/teams', icon: 'team', title: '팀 나누기', desc: '남녀 · 실력 고르게', tone: 'bg-ok-light text-ok' },
  { to: '/tools/apps', icon: 'share', title: '팀 편성 · 전술 보드', desc: '반 명단 보내기', tone: 'bg-brand-light text-brand' },
  { to: '/timer?tab=paps', icon: 'volume', title: 'PAPS 신호음', desc: '윗몸 · 스텝 · 왕복', tone: 'bg-fill-2 text-ink-2' },
]

/** 도구 탭: 가장 많이 쓰는 타이머를 크게, 나머지는 두 칸씩 */
export default function ToolsPage() {
  const t = useTimer()
  return (
    <>
      <PageHeader title="수업 도구" sub={t.running ? '타이머가 돌고 있어요' : undefined} />
      <div className="page space-y-3 pb-8">
        <Link to="/timer" className="flex min-h-[112px] items-center gap-4 rounded-3xl bg-brand p-5 text-white shadow-[var(--shadow-float)] transition-transform active:scale-[0.99]">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
            <Icon name="timer" size={30} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-xl">타이머 · 스톱워치</b>
            <span className="block text-sm font-semibold text-white/85">카운트다운 · 인터벌 · 랩 기록 → PAPS·수행평가</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map((x) => (
            <Link key={x.to} to={x.to} className="card flex min-h-[124px] flex-col gap-2 p-4 transition-transform active:scale-[0.98]">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${x.tone}`}>
                <Icon name={x.icon} size={22} />
              </span>
              <b className="leading-snug">{x.title}</b>
              <span className="text-xs font-semibold text-ink-3">{x.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
