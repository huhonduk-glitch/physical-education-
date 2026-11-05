import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { SPORT_GROUPS, SPORTS, UPCOMING, sportOf } from '../../data/sports'
import { useApp } from '../../state/AppContext'

/**
 * 종목 수업자료 (6-5 ④, 하단 탭 '종목'): 2022 교육과정 경쟁 유형 4개(영역 · 네트 · 필드 · 기술형)로 묶은 종목 카드.
 * 리그전 · 토너먼트는 SPORTS BRACKET으로 (2026-10-27 교사 결정) — 종목마다 그 앱에서 고를 설정을 안내한다.
 */
export default function SportsPage() {
  const { settings } = useApp()
  const leagues = useLiveQuery(() => db.leagues.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])

  return (
    <>
      <PageHeader title="종목 수업자료" sub="규칙 · 경기 방법 · 슬라이드" />
      <div className="page space-y-5 pb-10">
        {/* 이 화면의 주인공은 종목 카드라 리그전은 조용한 한 줄로 (2026-11-04 레이아웃 정리) */}
        <Link to="/tools/apps" className="card flex min-h-[60px] items-center gap-3 px-4 py-3 active:scale-[0.99]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
            <Icon name="medal" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block">리그전 · 토너먼트</b>
            <span className="block truncate text-sm text-ink-3">반 명단을 SPORTS BRACKET으로 보내기</span>
          </span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>

        {SPORT_GROUPS.map((g) => {
          const ready = SPORTS.filter((s) => s.group === g.id)
          const soon = UPCOMING.filter((s) => s.group === g.id)
          return (
            <section key={g.id} className="space-y-2">
              <div className="px-1">
                <p className="text-lg font-extrabold">{g.name}</p>
                <p className="hint">{g.desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {ready.map((s) => (
                  <Link key={s.id} to={`/sports/${s.id}`} className="card flex min-h-[104px] flex-col gap-1 p-4 transition-transform active:scale-[0.98]">
                    <span className="text-3xl" aria-hidden>
                      {s.emoji}
                    </span>
                    <b>{s.name}</b>
                    <span className="line-clamp-2 text-xs font-semibold text-ink-3">{s.summary}</span>
                  </Link>
                ))}
                {soon.map((s) => (
                  <div key={s.id} className="card flex min-h-[104px] flex-col gap-1 p-4 opacity-60" aria-disabled="true">
                    <span className="text-3xl grayscale" aria-hidden>
                      {s.emoji}
                    </span>
                    <b>{s.name}</b>
                    <span className="text-xs font-semibold text-ink-3">자료 준비 중{s.note ? ` · ${s.note}` : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {leagues && leagues.length > 0 && (
          <section className="space-y-2">
            <p className="label px-1">예전에 만든 리그전 (보기만)</p>
            {leagues.map((l) => (
              <Link key={l.id} to={`/leagues/${l.id}`} className="card flex min-h-[60px] items-center gap-3 p-4">
                <span className="text-xl" aria-hidden>
                  {sportOf(l.sport)?.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{l.name}</span>
                <Icon name="chevronRight" className="text-ink-3" />
              </Link>
            ))}
          </section>
        )}
      </div>
    </>
  )
}
