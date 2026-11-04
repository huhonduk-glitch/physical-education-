import { type IconName } from '../components/Icon'
import { GroupTitle, HeroLink, MenuTile } from '../components/MenuTile'
import PageHeader from '../components/PageHeader'
import { useTimer } from '../state/TimerContext'

type Tool = { to: string; icon: IconName; title: string; desc: string }

/** 하는 일로 묶는다 (2026-11-04 레이아웃 정리). 종목 수업자료는 하단 탭에 있어 여기서 뺐다 */
const GROUPS: { title: string; items: Tool[] }[] = [
  {
    title: '수업 진행',
    items: [
      { to: '/tools/pick', icon: 'dice', title: '뽑기', desc: '발표 · 순서' },
      { to: '/tools/teams', icon: 'team', title: '팀 나누기', desc: '남녀 · 실력 고르게' },
      { to: '/referee', icon: 'flag', title: '보조심판', desc: '판정 · 점수 · 팀 파울' },
      { to: '/tools/video', icon: 'eye', title: '동작 영상', desc: '지연 재생 · 슬로모션' },
    ],
  },
  {
    title: 'PAPS 측정',
    items: [
      { to: '/timer?tab=paps&aid=shuttle', icon: 'flag', title: '왕복오래달리기', desc: '신호마다 한 번 누르기' },
      { to: '/timer?tab=paps', icon: 'volume', title: 'PAPS 신호음', desc: '윗몸말아올리기 · 스텝' },
    ],
  },
  {
    title: '다른 앱으로',
    items: [{ to: '/tools/apps', icon: 'share', title: '팀 편성 · 전술 보드', desc: '반 명단 보내기' }],
  },
]

function Group({ g, cols }: { g: (typeof GROUPS)[number]; cols: string }) {
  return (
    <section className="space-y-2">
      <GroupTitle>{g.title}</GroupTitle>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {g.items.map((x) => (
          <MenuTile key={x.to} {...x} />
        ))}
      </div>
    </section>
  )
}

/** 도구 탭: 가장 많이 쓰는 타이머 하나만 크게, 나머지는 같은 모양 칸 */
export default function ToolsPage() {
  const t = useTimer()
  return (
    <>
      <PageHeader title="수업 도구" sub={t.running ? '타이머가 돌고 있어요' : undefined} />
      <div className="page space-y-3 pb-8">
        <HeroLink to="/timer" icon="timer" title="타이머 · 스톱워치" desc="카운트다운 · 인터벌 · 랩 기록" />
        <Group g={GROUPS[0]} cols="md:grid-cols-4" />
        {/* 칸이 적은 두 묶음은 넓은 화면에서 한 줄에 나란히 (빈 자리가 크지 않게) */}
        <div className="space-y-3 md:grid md:grid-cols-4 md:gap-3 md:space-y-0">
          <div className="md:col-span-2">
            <Group g={GROUPS[1]} cols="md:grid-cols-2" />
          </div>
          <div className="md:col-span-2">
            <Group g={GROUPS[2]} cols="md:grid-cols-2" />
          </div>
        </div>
      </div>
    </>
  )
}
