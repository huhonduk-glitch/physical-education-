import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GroupPanel, PanelItem, toneOf } from '../components/MenuTile'
import PageHeader from '../components/PageHeader'
import WorkFlowChart, { AuthorDocsCard } from '../components/WorkFlowChart'
import WorkTopicSwitch from '../components/WorkTopicSwitch'
import type { IconName } from '../components/Icon'
import { AUTHOR_DOCS } from '../data/authorDocs'
import { SPORTSDAY_SAFETY, workFlow } from '../data/peFlows'
import { srcLabel } from '../data/peWork'

type Tab = 'flow' | 'tools' | 'safety' | 'docs'
const TABS: { id: Tab; label: string }[] = [
  { id: 'flow', label: '흐름도' },
  { id: 'tools', label: '준비 도구' },
  { id: 'safety', label: '안전' },
  { id: 'docs', label: '현장 양식' },
]

/** 체육대회 준비에 쓰는 PE LOG 도구 */
const TOOLS: { to: string; icon: IconName; title: string; desc: string }[] = [
  { to: '/sports', icon: 'book', title: '종목 수업자료', desc: '경기 규칙 · 한 장 그림으로 학생 안내' },
  { to: '/tools/teams', icon: 'team', title: '팀 나누기', desc: '남녀 · 실력 고르게, 견학 학생 빼고' },
  { to: '/tools/apps', icon: 'grid', title: '대진표 · 팀 편성', desc: 'SPORTS BRACKET 리그 · 토너먼트, 전술 보드' },
  { to: '/referee', icon: 'flag', title: 'AI 보조심판', desc: '점수 · 경기 시간 · 판정' },
  { to: '/timer', icon: 'timer', title: '타이머 · 스톱워치', desc: '경기 시간 · 큰 숫자 화면' },
  { to: '/tools/pick', icon: 'dice', title: '뽑기', desc: '순서 · 대표 정하기' },
  { to: '/work/quote', icon: 'clipboard', title: '견적서 → 품의', desc: '물품 · 시상품 품의 초안, 예산 잔액' },
  { to: '/work/calendar', icon: 'calendar', title: '업무 달력', desc: '일정 · D-day' },
]

/**
 * 체육대회 · 학교체육행사 (2026-11-12 교사 요청): 업무 하나 = 하위 메뉴 흐름도 · 준비 도구 · 안전 · 현장 양식.
 * 공식 서식이 없는 계획 · 정산은 흐름도에 '학교마다 달라요'로, 안전은 운영방향 원문 92~94쪽만.
 */
export default function SportsDayPage() {
  const { tab: tabParam } = useParams()
  const navigate = useNavigate()
  const flow = workFlow('sportsday')!
  const tabs = TABS.filter((t) => t.id !== 'docs' || AUTHOR_DOCS.sportsday.length > 0)
  const tab = (tabParam ?? 'flow') as Tab
  if (!tabs.some((t) => t.id === tab)) return <Navigate to="/work/sportsday" replace />
  const tone = toneOf(3)

  return (
    <>
      <PageHeader title="체육대회 · 학교체육행사" sub={`학교체육 업무 · ${tabs.find((t) => t.id === tab)!.label}`} back />
      <div className="page space-y-4 pb-10">
        <p className="hint px-1">학교장은 학교체육행사를 정기적으로 열고, 필요한 경비를 학교 예산에서 확보해야 해요(학교체육 진흥법 제6조). 계획 · 운영 방식은 학교마다 달라요.</p>
        <WorkTopicSwitch current="sportsday" />
        <div className="segment overflow-x-auto [scrollbar-width:none] [&>button]:shrink-0 [&>button]:px-3 [&>button]:whitespace-nowrap" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => navigate(t.id === 'flow' ? '/work/sportsday' : `/work/sportsday/${t.id}`, { replace: true })}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'flow' && <WorkFlowChart flow={flow} />}

        {tab === 'tools' && (
          <GroupPanel title="체육대회 준비 도구" icon="timer" tone={tone} count={TOOLS.length}>
            {TOOLS.map((t) => (
              <PanelItem key={t.to} to={t.to} icon={t.icon} title={t.title} desc={t.desc} tone={tone} />
            ))}
          </GroupPanel>
        )}

        {tab === 'safety' && (
          <div className="space-y-3">
            {SPORTSDAY_SAFETY.map((g) => (
              <section key={g.title} className="card space-y-2">
                <p className="font-extrabold">{g.title}</p>
                <ul className="space-y-2">
                  {g.lines.map((l) => (
                    <li key={l.text} className="text-[0.95rem] leading-relaxed">
                      {l.text}
                      {l.local && <span className="ml-1 rounded-md bg-caution-light px-1.5 py-0.5 text-xs font-bold text-ink-2">제주</span>}
                      <span className="ml-1 text-xs font-semibold whitespace-nowrap text-ink-3">({srcLabel(l.src)})</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="hint px-1">제주교육청 2026 학교체육 운영방향 기준이에요. 다른 시도는 자기 교육청 안전 지침을 확인하세요.</p>
          </div>
        )}

        {tab === 'docs' && <AuthorDocsCard id="sportsday" title="체육대회" />}
      </div>
    </>
  )
}
