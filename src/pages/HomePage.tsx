import { useState } from 'react'
import { Link } from 'react-router-dom'
import BackupWarning from '../components/BackupWarning'
import { Logo } from '../components/Brand'
import FeatureSheet from '../components/FeatureSheet'
import Icon from '../components/Icon'
import { longDateLabel, shortDateLabel, todayStr } from '../lib/dates'
import { dday as ddayOf, upcomingEvents } from '../lib/neisOpenApi'
import { FEATURES, featureOn } from '../lib/features'
import { GROUP_COLORS, SEMESTER_LABEL } from '../lib/groups'
import { currentPeriod, todaysLessons } from '../lib/timetable'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/** 홈: 오늘 수업 · 내 수업반 · 내가 고른 기능 */
export default function HomePage() {
  const { settings } = useApp()
  const { groups, students, membersOf } = useGroups()
  const [pick, setPick] = useState(false)
  const now = new Date()
  const lessons = todaysLessons(now, settings.timetable)
  const period = currentPeriod(now, settings.periodStarts, settings.periodMinutes)
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))
  const features = FEATURES.filter((f) => featureOn(settings.features, f.id))
  const noRoster = students !== undefined && students.length === 0
  const recordsOn = featureOn(settings.features, 'records')
  const today = todayStr()
  const upcoming = upcomingEvents(settings.neisSchedule?.events ?? [], today)
  const dday = (d: string) => ddayOf(d, today)

  return (
    <>
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="page flex items-center gap-3 pt-5 pb-2">
          <Logo size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-3">{longDateLabel(todayStr())}</p>
            <h1 className="truncate text-[1.5rem] leading-tight font-black tracking-tight">{settings.schoolName || '오늘의 체육 수업'}</h1>
          </div>
          <Link to="/more/settings" className="btn btn-ghost px-2 text-ink-3" aria-label="설정">
            <Icon name="settings" />
          </Link>
        </div>
      </header>

      <div className="page space-y-6 pt-2 pb-8">
        <BackupWarning hasData={(students?.length ?? 0) > 0} />

        {noRoster && (
          <section className="card space-y-4">
            <div>
              <p className="text-lg font-extrabold">시작해 볼까요?</p>
              <p className="hint">쓰고 싶은 기능만 골라 쓰면 돼요. 타이머처럼 명렬 없이 바로 되는 기능도 있어요.</p>
            </div>
            <ol className="space-y-2">
              <li>
                <Link to="/students/import" className="list-row rounded-2xl bg-fill">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand font-black text-white">1</span>
                  <span className="flex-1">
                    <b className="block">학생 명렬 올리기</b>
                    <span className="hint">나이스 명렬 파일 또는 복사·붙여넣기</span>
                  </span>
                  <Icon name="chevronRight" className="text-ink-3" />
                </Link>
              </li>
              <li>
                <Link to="/groups" className="list-row rounded-2xl bg-fill">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand font-black text-white">2</span>
                  <span className="flex-1">
                    <b className="block">수업반 만들기</b>
                    <span className="hint">학적반 그대로 · 수강반(여러 반 학생)</span>
                  </span>
                  <Icon name="chevronRight" className="text-ink-3" />
                </Link>
              </li>
              <li>
                <Link to="/more/settings/neis" className="list-row rounded-2xl bg-fill">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-ok font-black text-white">+</span>
                  <span className="flex-1">
                    <b className="block">나이스에서 학급·시간표 불러오기</b>
                    <span className="hint">선택 · 학교 이름만 넣으면 내 체육 시간표가 채워져요</span>
                  </span>
                  <Icon name="chevronRight" className="text-ink-3" />
                </Link>
              </li>
            </ol>
          </section>
        )}

        {recordsOn && lessons.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-lg font-extrabold">오늘 수업</h2>
            <div className="card overflow-hidden p-0">
              {lessons.map((l) => {
                const g = groupById.get(l.groupId)
                if (!g) return null
                const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                const live = period === l.period
                return (
                  <Link key={`${l.day}-${l.period}`} to={`/groups/${g.id}`} className={`list-row min-h-[64px] hover:bg-fill ${live ? 'bg-brand-light' : ''}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-black tabular-nums" style={{ background: c.bg, color: c.fg }}>
                      {l.period}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{g.name}</b>
                      <span className="hint">
                        {l.period}교시 · {settings.periodStarts[l.period - 1] ?? ''}
                      </span>
                    </span>
                    {live && <span className="badge bg-brand text-white">지금</span>}
                    <Icon name="chevronRight" className="text-ink-3" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-lg font-extrabold">다가오는 학사일정</h2>
            <div className="card overflow-hidden p-0">
              {upcoming.map((e) => (
                <div key={`${e.date}-${e.name}`} className="list-row min-h-[52px]">
                  <span className="w-20 shrink-0 font-bold text-ink-2 tabular-nums">{shortDateLabel(e.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                  {e.grades.length > 0 && e.grades.length < 3 && <span className="hint">{e.grades.join('·')}학년</span>}
                  <span className="badge bg-fill text-ink-3">{dday(e.date)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {recordsOn && groups && groups.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-end justify-between px-1">
              <h2 className="text-lg font-extrabold">내 수업반</h2>
              <Link to="/groups" className="text-sm font-bold text-brand">
                전체 보기
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {groups.slice(0, 8).map((g) => {
                const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                return (
                  <Link key={g.id} to={`/groups/${g.id}`} className="card flex min-h-[96px] flex-col justify-between gap-2 p-4 transition-transform active:scale-[0.98]">
                    <span className="flex items-center gap-2">
                      <i className="h-3 w-3 rounded-full" style={{ background: c.fg }} aria-hidden />
                      <span className="truncate text-xs font-bold text-ink-3">
                        {g.kind === 'elective' ? '수강반' : '학적반'} · {SEMESTER_LABEL[g.semester]}
                      </span>
                    </span>
                    <b className="line-clamp-2 text-[1.05rem] leading-snug">{g.name}</b>
                    <span className="text-sm font-semibold text-ink-3">{membersOf(g).length}명</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-lg font-extrabold">내 기능</h2>
            <button type="button" className="text-sm font-bold text-brand" onClick={() => setPick(true)}>
              기능 고르기
            </button>
          </div>
          {features.length === 0 ? (
            <button type="button" className="card w-full text-center font-bold text-brand" onClick={() => setPick(true)}>
              쓸 기능을 골라 주세요
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {features.map((f) => (
                <Link key={f.id} to={f.to} className="card flex min-h-[112px] flex-col gap-2 p-4 transition-transform active:scale-[0.98]">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${f.tone}`}>
                    <Icon name={f.icon} size={21} />
                  </span>
                  <b className="text-[1.02rem]">{f.label}</b>
                  <span className="line-clamp-2 text-xs font-semibold text-ink-3">{f.desc}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      {pick && <FeatureSheet onClose={() => setPick(false)} />}
    </>
  )
}
