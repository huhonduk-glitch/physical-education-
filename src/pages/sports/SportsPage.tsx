import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { SPORTS, sportOf } from '../../data/sports'
import { useApp } from '../../state/AppContext'

/** 종목 수업자료 · 리그전 (6-5 ④): 종목 카드 → 규칙 요약(공식 규칙서 조항 · 출처), 아래에 이 학년도 리그전 */
export default function SportsPage() {
  const { settings } = useApp()
  const leagues = useLiveQuery(() => db.leagues.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const active = (leagues ?? []).filter((l) => !l.archived).sort((a, b) => b.updatedAt - a.updatedAt)
  const old = (leagues ?? []).filter((l) => l.archived)

  return (
    <>
      <PageHeader title="종목 · 리그전" sub="공식 규칙 요약 · 수업 리그전" back />
      <div className="page space-y-4 pb-10">
        <section className="space-y-2">
          <p className="label px-1">종목 수업자료</p>
          <div className="grid grid-cols-2 gap-3">
            {SPORTS.map((s) => (
              <Link key={s.id} to={`/sports/${s.id}`} className="card flex min-h-[112px] flex-col gap-1 p-4 transition-transform active:scale-[0.98]">
                <span className="text-3xl" aria-hidden>
                  {s.emoji}
                </span>
                <b>{s.name}</b>
                <span className="text-xs font-semibold text-ink-3">{s.summary}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <p className="label flex-1">리그전</p>
            <Link to="/leagues/new" className="btn btn-primary min-h-[44px] px-4 text-sm">
              <Icon name="plus" size={18} /> 새 리그전
            </Link>
          </div>
          {leagues && active.length === 0 && <p className="hint card">아직 리그전이 없어요. 팀을 정하면 모든 팀이 한 번씩 겨루는 대진표와 순위표를 만들어 줘요.</p>}
          {active.map((l) => {
            const done = l.matches.filter((m) => m.done).length
            return (
              <Link key={l.id} to={`/leagues/${l.id}`} className="card flex min-h-[72px] items-center gap-3 p-4 active:scale-[0.99]">
                <span className="text-2xl" aria-hidden>
                  {sportOf(l.sport)?.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{l.name}</b>
                  <span className="text-xs font-semibold text-ink-3">
                    {sportOf(l.sport)?.name} · {l.teams.length}팀 · 경기 {done}/{l.matches.length}
                  </span>
                </span>
                <Icon name="chevronRight" className="text-ink-3" />
              </Link>
            )
          })}
          {old.length > 0 && (
            <details className="px-1">
              <summary className="hint cursor-pointer py-2">숨긴 리그전 {old.length}개</summary>
              {old.map((l) => (
                <Link key={l.id} to={`/leagues/${l.id}`} className="block py-2 font-bold text-ink-2 underline">
                  {l.name}
                </Link>
              ))}
            </details>
          )}
        </section>
      </div>
    </>
  )
}
