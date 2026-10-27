import { useState } from 'react'
import { Link } from 'react-router-dom'
import AutoBackupNotice from '../components/AutoBackupNotice'
import BackupWarning from '../components/BackupWarning'
import { Logo } from '../components/Brand'
import FeatureSheet from '../components/FeatureSheet'
import Icon from '../components/Icon'
import InstallGuide from '../components/InstallGuide'
import { longDateLabel, shortDateLabel, todayStr } from '../lib/dates'
import { dday as ddayOf, upcomingEvents } from '../lib/neisOpenApi'
import { FEATURES, featureOn } from '../lib/features'
import { GROUP_COLORS, readLastGroup, SEMESTER_LABEL } from '../lib/groups'
import { lessonFocus, setupProgress, setupSteps } from '../lib/home'
import { currentPeriod, todaysLessons } from '../lib/timetable'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/** 홈: 시작 준비 → 지금 수업 → 오늘 시간표 → 내 수업반 → 바로가기 → 학사일정 (위에서 아래로 자주 쓰는 순서) */
export default function HomePage() {
  const { settings } = useApp()
  const { groups, students, membersOf } = useGroups()
  const [pick, setPick] = useState(false)
  const now = new Date()
  const lessons = todaysLessons(now, settings.timetable)
  const period = currentPeriod(now, settings.periodStarts, settings.periodMinutes)
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))
  // 아래 탭(수업반·평가·도구)과 겹치는 기능은 빼고, 탭에 없는 기능만 바로가기에 둔다
  const features = FEATURES.filter((f) => featureOn(settings.features, f.id) && !TAB_FEATURES.includes(f.id))
  const recordsOn = featureOn(settings.features, 'records')
  const today = todayStr()
  const upcoming = upcomingEvents(settings.neisSchedule?.events ?? [], today)
  const dday = (d: string) => ddayOf(d, today)

  const setup = setupSteps({
    students: students?.length ?? 0,
    groups: groups?.length ?? 0,
    timetable: settings.timetable.length,
    lastBackupAt: settings.lastBackupAt,
  })
  const progress = setupProgress(setup)
  const [setupHidden, setSetupHidden] = useState(readSetupHidden)
  const requiredDone = setup.filter((s) => !s.optional && s.id !== 'backup').every((s) => s.done)
  const showSetup = students !== undefined && groups !== undefined && progress.done < progress.total && !(requiredDone && setupHidden)
  const focus = recordsOn ? lessonFocus(now, settings.timetable, settings.periodStarts, settings.periodMinutes) : null
  const focusGroup = focus ? groupById.get(focus.entry.groupId) : undefined
  const lastGroup = (() => {
    const id = readLastGroup()
    return (id && groupById.get(id)) || groups?.[0]
  })()
  const hideSetup = () => {
    try {
      localStorage.setItem(SETUP_HIDE_KEY, '1')
    } catch {
      /* 저장이 막힌 브라우저: 이번만 숨긴다 */
    }
    setSetupHidden(true)
  }

  return (
    <>
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="page flex items-center gap-3 pt-5 pb-1">
          <Logo size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-3">{longDateLabel(today)}</p>
            <h1 className="truncate text-[1.4rem] leading-tight font-black tracking-tight">{settings.schoolName || 'PE LOG'}</h1>
          </div>
          <Link to="/help" className="btn btn-ghost px-2 text-ink-3" aria-label="사용법">
            <Icon name="info" />
          </Link>
          <Link to="/more/settings" className="btn btn-ghost px-2 text-ink-3" aria-label="설정">
            <Icon name="settings" />
          </Link>
        </div>
      </header>

      <div className="page space-y-5 pt-3 pb-8">
        <AutoBackupNotice />
        <InstallGuide place="home" />
        {/* 시작 준비에 '첫 백업'이 이미 보이면 겹치지 않게 */}
        {!showSetup && <BackupWarning hasData={(students?.length ?? 0) > 0} />}

        {/* ① 지금 수업 — 가장 자주 하는 일을 한 번에 */}
        {recordsOn && focus && focusGroup ? (
          <Link
            to={`/groups/${focusGroup.id}`}
            className="anim-pop block rounded-3xl bg-brand p-5 text-white shadow-[var(--shadow-float)] transition-transform active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-sm font-bold">
              {focus.status === 'now' ? '● 지금 수업' : '다음 수업'} · {focus.entry.period}교시 {focus.start}
            </span>
            <b className="mt-3 block text-[1.6rem] leading-tight font-black">{focusGroup.name}</b>
            <span className="mt-1 block font-semibold text-white/85">{membersOf(focusGroup).length}명</span>
            <span className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-extrabold text-brand">
              누가기록 시작
              <Icon name="chevronRight" />
            </span>
          </Link>
        ) : (
          recordsOn &&
          lastGroup && (
            <Link to={`/groups/${lastGroup.id}`} className="card flex min-h-[72px] items-center gap-3 transition-transform active:scale-[0.99]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
                <Icon name="class" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="hint block">이어서 기록하기</span>
                <b className="block truncate text-[1.1rem]">{lastGroup.name}</b>
              </span>
              <Icon name="chevronRight" className="text-ink-3" />
            </Link>
          )
        )}

        {/* 종목 수업자료 — 교사 요청으로 크게 (2026-10-27) */}
        {featureOn(settings.features, 'sports') && (
          <Link to="/sports" className="card flex min-h-[76px] items-center gap-3 transition-transform active:scale-[0.99]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-light text-brand">
              <Icon name="book" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[1.05rem]">종목 수업자료</b>
              <span className="text-sm font-semibold text-ink-3">영역 · 네트 · 필드 · 기술형 — 규칙 · 경기 방법 · 리그전 안내</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        )}

        {/* ② 시작 준비 — 처음 쓰는 사람이 순서대로 따라 하게 */}
        {showSetup && (
          <section className="card space-y-3" aria-label="시작 준비">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold">시작 준비</p>
                <p className="hint">순서대로 하면 바로 수업에 쓸 수 있어요</p>
              </div>
              <span className="text-lg font-black text-brand tabular-nums">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fill-2" aria-hidden>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            {progress.done > 0 && (
              <p className="flex items-center gap-1.5 text-sm font-bold text-ok">
                <Icon name="check" size={16} /> {setup.filter((x) => x.done).map((x) => x.label).join(' · ')}
              </p>
            )}
            <ol className="-mx-1">
              {setup.map((st, i) => {
                if (st.done) return null
                const isNext = progress.next?.id === st.id
                return (
                  <li key={st.id}>
                    <Link to={st.to} className={`flex min-h-[56px] items-center gap-3 rounded-xl px-1 py-1.5 ${isNext ? 'bg-brand-light' : ''}`}>
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${
                          st.done ? 'bg-ok text-white' : isNext ? 'bg-brand text-white' : 'bg-fill-2 text-ink-3'
                        }`}
                      >
                        {st.done ? <Icon name="check" size={16} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className={`block ${st.done ? 'text-ink-3 line-through decoration-ink-3/40' : ''}`}>
                          {st.label}
                          {st.optional && <span className="ml-1 text-xs font-bold text-ink-3">선택</span>}
                        </b>
                        {!st.done && <span className="hint block">{st.desc}</span>}
                      </span>
                      {!st.done && <Icon name="chevronRight" className="text-ink-3" />}
                    </Link>
                  </li>
                )
              })}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to="/more/settings/neis" className="text-sm font-bold text-ok">
                + 나이스에서 학급·시간표 불러오기
              </Link>
              {requiredDone && (
                <button type="button" className="text-sm font-bold text-ink-3" onClick={hideSetup}>
                  숨기기
                </button>
              )}
            </div>
          </section>
        )}

        {/* 오늘 시간표 — 짧은 줄 */}
        {recordsOn && lessons.length > 0 && (
          <section className="space-y-2">
            <SectionTitle title="오늘 수업" action={{ to: '/more/settings/timetable', label: '시간표' }} />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {lessons.map((l) => {
                const g = groupById.get(l.groupId)
                if (!g) return null
                const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                const live = period === l.period
                return (
                  <Link
                    key={`${l.day}-${l.period}`}
                    to={`/groups/${g.id}`}
                    className={`flex min-h-[64px] w-36 shrink-0 flex-col justify-center rounded-2xl px-3 py-2 ${live ? 'ring-2 ring-brand' : ''}`}
                    style={{ background: c.bg, color: c.fg }}
                  >
                    <span className="text-xs font-black">
                      {l.period}교시 {live && '· 지금'}
                    </span>
                    <b className="truncate text-[0.95rem] text-ink">{g.name}</b>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* 이번 주 내 시간표 — 요일 × 교시 표 (2026-10-26 교사 요청) */}
        {recordsOn && settings.timetable.length > 0 && (
          <section className="space-y-2">
            <SectionTitle title="이번 주 내 시간표" action={{ to: '/timetable/pe', label: '전체 체육' }} />
            <div className="card overflow-x-auto p-2">
              <table className="w-full table-fixed border-separate border-spacing-1 text-[0.78rem]">
                <thead>
                  <tr>
                    <th className="w-6" />
                    {['월', '화', '수', '목', '금'].map((d, i) => (
                      <th key={d} className={`py-0.5 font-extrabold ${now.getDay() === i + 1 ? 'text-brand' : 'text-ink-3'}`}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(6, ...settings.timetable.map((t) => t.period)) }, (_, i) => i + 1).map((p) => (
                    <tr key={p}>
                      <th className="text-center font-bold text-ink-3 tabular-nums">{p}</th>
                      {[1, 2, 3, 4, 5].map((d) => {
                        const t = settings.timetable.find((x) => x.day === d && x.period === p)
                        const g = t ? groupById.get(t.groupId) : undefined
                        if (!g) return <td key={d} className="h-9 rounded-md bg-fill/60" />
                        const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                        const live = now.getDay() === d && period === p
                        return (
                          <td key={d} className={`h-9 rounded-md p-0 ${live ? 'ring-2 ring-brand' : ''}`} style={{ background: c.bg }}>
                            <Link to={`/groups/${g.id}`} className="block truncate px-1 py-1 leading-tight font-bold text-ink" title={g.name}>
                              {g.name.replace(/학년\s*/, '-').replace(/반$/, '')}
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ③ 내 수업반 — 가로로 넘겨 보기 */}
        {recordsOn && groups && groups.length > 0 && (
          <section className="space-y-2">
            <SectionTitle title={`내 수업반 ${groups.length}`} action={{ to: '/groups', label: '전체' }} />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {groups.map((g) => {
                const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                return (
                  <Link key={g.id} to={`/groups/${g.id}`} className="card flex min-h-[84px] w-40 shrink-0 flex-col justify-between gap-1 p-3.5 transition-transform active:scale-[0.98]">
                    <span className="flex items-center gap-1.5">
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.fg }} aria-hidden />
                      <span className="truncate text-xs font-bold text-ink-3">{g.kind === 'elective' ? '수강반' : '학적반'} · {SEMESTER_LABEL[g.semester]}</span>
                    </span>
                    <b className="line-clamp-2 leading-snug">{g.name}</b>
                    <span className="text-xs font-semibold text-ink-3">{membersOf(g).length}명</span>
                  </Link>
                )
              })}
              <Link to="/groups/new" className="flex min-h-[84px] w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-sm font-bold text-ink-3">
                <Icon name="plus" size={20} />
                수강반
              </Link>
            </div>
          </section>
        )}

        {/* ④ 바로가기 — 앱 아이콘처럼 4칸 */}
        <section className="space-y-2">
          <SectionTitle title="바로가기" button={{ label: '편집', onClick: () => setPick(true) }} />
          {features.length === 0 ? (
            <button type="button" className="card w-full text-center font-bold text-brand" onClick={() => setPick(true)}>
              견학 · 체육부장 · 세특 · 팀 편성을 쓰려면 [편집]에서 켜세요
            </button>
          ) : (
          <div className="card grid grid-cols-4 gap-y-3 px-2 py-4">
            {features.map((f) => (
              <Link key={f.id} to={f.to} className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-center active:bg-fill">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${f.tone}`}>
                  <Icon name={f.icon} size={22} />
                </span>
                <span className="text-[0.8rem] leading-tight font-bold text-ink-2">{f.short}</span>
              </Link>
            ))}
          </div>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="space-y-2">
            <SectionTitle title="다가오는 학사일정" />
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

        <p className="hint text-center">
          처음이라면{' '}
          <Link to="/help" className="font-bold text-brand">
            사용법
          </Link>
          부터 보세요 · 학생 정보는 이 기기에만 저장돼요
        </p>
      </div>
      {pick && <FeatureSheet onClose={() => setPick(false)} />}
    </>
  )
}

/** 아래 탭에 이미 있는 기능 (홈 바로가기에서 뺀다) */
const TAB_FEATURES: readonly string[] = ['records', 'sports', 'paps', 'assess', 'tools']

const SETUP_HIDE_KEY = 'pelog.setupHidden'
function readSetupHidden(): boolean {
  try {
    return localStorage.getItem(SETUP_HIDE_KEY) === '1'
  } catch {
    return false
  }
}

function SectionTitle({ title, action, button }: { title: string; action?: { to: string; label: string }; button?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-end justify-between px-1">
      <h2 className="text-[1.05rem] font-extrabold">{title}</h2>
      {action && (
        <Link to={action.to} className="text-sm font-bold text-ink-3">
          {action.label} ›
        </Link>
      )}
      {button && (
        <button type="button" className="text-sm font-bold text-ink-3" onClick={button.onClick}>
          {button.label}
        </button>
      )}
    </div>
  )
}
