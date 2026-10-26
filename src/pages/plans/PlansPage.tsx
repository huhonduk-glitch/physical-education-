import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { todayStr } from '../../lib/dates'
import { groupProgress, meetings, schedule } from '../../lib/progressPlan'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 교과 진도표 목록 (6-5) */
export default function PlansPage() {
  const { settings, readOnly } = useApp()
  const plans = useLiveQuery(() => db.progressPlans.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const { groups } = useGroups(true)
  const today = todayStr()
  // 수업반 메뉴에서 왔으면(?g=) 그 반 진도표만. 하나뿐이면 바로 그 반 날짜 화면으로
  const [sp] = useSearchParams()
  const only = sp.get('g')
  const mine = only ? (plans ?? []).filter((p) => p.groupIds.includes(only)) : (plans ?? [])
  if (only && plans && mine.length === 1) return <Navigate to={`/plans/${mine[0].id}?t=dates&g=${only}`} replace />
  const sorted = [...mine].sort((a, b) => a.semester - b.semester || (a.grade ?? 0) - (b.grade ?? 0) || a.title.localeCompare(b.title))

  return (
    <>
      <PageHeader
        title="교과 진도표"
        sub={`${settings.schoolYear}학년도`}
        back
        right={
          !readOnly && (
            <Link to="/plans/new" className="btn btn-primary">
              <Icon name="plus" /> 새 진도표
            </Link>
          )
        }
      />
      <div className="page space-y-4 pb-8">
        {only && plans && mine.length === 0 && plans.length > 0 && (
          <p className="rounded-2xl bg-caution-light p-4 font-bold text-caution">이 수업반을 고른 진도표가 없어요. 진도표를 열어 [설정]에서 수업반을 고르세요.</p>
        )}
        {only && mine.length !== (plans ?? []).length && (
          <Link to="/plans" className="btn btn-soft w-full">
            모든 진도표 보기
          </Link>
        )}
        {plans && plans.length === 0 && (
          <section className="card space-y-3">
            <p className="card-title">학기 진도를 차시마다 계획해 두세요</p>
            <ul className="hint list-disc space-y-1 pl-5">
              <li>주당 시간만 고르면 목표 차시(×17주)가 정해져요.</li>
              <li>시간표로 각 차시가 몇 월 며칠 몇 교시인지 저절로 채워요.</li>
              <li>행사로 한 시간 빠지면 [빠짐]만 누르세요. 뒤 차시가 모두 한 칸씩 밀려요.</li>
              <li>같은 과목을 맡은 반이 여럿이면 진도표 하나로 반마다 진도를 비교해요.</li>
            </ul>
            {!readOnly && (
              <Link to="/plans/new" className="btn btn-primary w-full">
                <Icon name="plus" /> 첫 진도표 만들기
              </Link>
            )}
          </section>
        )}
        {sorted.map((p) => {
          const gs = (groups ?? []).filter((g) => p.groupIds.includes(g.id))
          const prog = gs.map((g) => {
            const sched = schedule(p.items, meetings(g.id, settings.timetable, p, p.skips[g.id]))
            return { g, ...groupProgress(sched, p.done[g.id] ?? [], today) }
          })
          return (
            <Link key={p.id} to={`/plans/${p.id}`} className="card block space-y-2 active:bg-fill">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="card-title truncate">{p.title}</p>
                  <p className="hint">
                    {p.grade ? `${p.grade}학년 · ` : ''}
                    {p.semester}학기 · 주 {p.weeklyHours}시간 · {p.items.length}/{p.target}차시
                  </p>
                </div>
                {p.items.length !== p.target && <span className="badge bg-caution-light text-caution">차시 {p.items.length > p.target ? '많음' : '모자람'}</span>}
                <Icon name="chevronRight" className="text-ink-3" />
              </div>
              {prog.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {prog.map((x) => (
                    <span key={x.g.id} className={`badge ${x.diff < 0 ? 'bg-danger-light text-danger' : 'bg-fill text-ink-2'}`}>
                      {x.g.name} {x.lastDone}차시{x.diff < 0 ? ` · ${-x.diff} 늦음` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="hint">연결한 수업반이 없어요</p>
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
