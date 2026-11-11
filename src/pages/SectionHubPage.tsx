import { Link } from 'react-router-dom'
import HubStats from '../components/HubStats'
import Icon from '../components/Icon'
import { GroupPanel, PanelItem, toneOf } from '../components/MenuTile'
import PageHeader from '../components/PageHeader'
import { GROUP_COLORS, SEMESTER_LABEL } from '../lib/groups'
import { featureOn } from '../lib/features'
import { NAV, visibleGroups, type SectionId } from '../lib/nav'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'
import { useNewMarks } from '../state/useNewMarks'

const SUB: Partial<Record<SectionId, string>> = {
  class: '수업 준비부터 수업 중 도구까지',
  eval: '수행평가 · 세특 · 학생 기록',
  work: '나이스 업무 · 규정 · 예산',
}

/**
 * 큰 메뉴 화면 (6-12): 그 묶음의 모든 기능을 같은 모양 칸으로 한눈에. 메뉴 표는 src/lib/nav.ts.
 * 수업 화면은 맨 위에 내 수업반(누가기록 바로 시작)을 둔다.
 */
export default function SectionHubPage({ section }: { section: SectionId }) {
  const { settings } = useApp()
  const s = NAV.find((x) => x.id === section)!
  const groups = visibleGroups(s, settings.features)
  const fresh = useNewMarks()
  const showClasses = section === 'class' && featureOn(settings.features, 'records')
  // 수업 화면은 '수업반' 묶음 대신 반 카드를 바로 보여 준다
  const rest = showClasses ? groups.filter((g) => g.id !== 'classes') : groups

  return (
    <>
      <PageHeader title={s.label} sub={SUB[section]} wide="xl" />
      <div className="page space-y-4 pb-8 lg:max-w-[72rem]">
        <HubStats section={section} />
        {showClasses && <MyClasses />}
        {rest.map((g) => {
          const tone = toneOf(groups.indexOf(g))
          return (
            <GroupPanel key={g.title} title={g.title} icon={g.icon} tone={tone} count={g.items.length}>
              {g.items.map((i) => (
                <PanelItem key={i.to} to={i.to} icon={i.icon} title={i.label} desc={i.desc} tone={tone} fresh={fresh.has(i.to)} />
              ))}
            </GroupPanel>
          )
        })}
        {rest.length === 0 && !showClasses && <p className="card hint">이 메뉴의 기능을 모두 꺼 두었어요. [설정 → 기능 고르기]에서 켤 수 있어요.</p>}
      </div>
    </>
  )
}

/** 내 수업반: 누르면 바로 누가기록 */
function MyClasses() {
  const { groups, membersOf } = useGroups()
  if (!groups) return null
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between px-1 pt-2">
        <h2 className="text-sm font-bold text-ink-3">내 수업반 · 누르면 누가기록</h2>
        <Link to="/groups" className="text-sm font-bold text-ink-3">
          수업반 관리 ›
        </Link>
      </div>
      {groups.length === 0 ? (
        <Link to="/groups" className="card flex min-h-[64px] items-center gap-3">
          <Icon name="plus" className="text-brand" />
          <b className="flex-1">수업반 만들기</b>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {groups.map((g) => {
            const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
            return (
              <Link key={g.id} to={`/groups/${g.id}`} className="card flex min-h-[96px] flex-col justify-between gap-1 p-4 transition-transform active:scale-[0.98]">
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.fg }} aria-hidden />
                  <span className="truncate text-xs font-bold text-ink-3">
                    {g.kind === 'elective' ? '수강반' : '학적반'} · {SEMESTER_LABEL[g.semester]}
                  </span>
                </span>
                <b className="line-clamp-2 leading-snug">{g.name}</b>
                <span className="text-xs font-semibold text-ink-3">{membersOf(g).length}명</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
