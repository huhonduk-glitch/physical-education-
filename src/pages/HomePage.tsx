import { useState, type ReactNode } from 'react'
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
import { currentInstallInfo } from '../lib/install'
import { currentPeriod, todaysLessons } from '../lib/timetable'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'
import { NAV, visibleGroups } from '../lib/nav'
import { WORK_KIND, dday as workDday, upcoming as upcomingWork } from '../lib/workCal'

/**
 * 홈 (2026-11-04 레이아웃 정리 · 교사: "번잡하면 아무도 안 쓴다")
 * 한 가지 일을 크게: 지금 · 다음 수업 카드 하나만 꽉 찬 파랑. 나머지는 조용하게.
 *  폰: 알림 → 지금 수업 → 시작 준비 → 오늘 수업 → 내 수업반 → 바로가기 → 학사일정 → 이번 주 시간표(접힘)
 *  PC(xl): 왼쪽 '오늘'(지금 수업 · 시작 준비 · 오늘 수업 · 이번 주 시간표 펼침) / 오른쪽 '내 것'(수업반 · 바로가기 · 학사일정)
 * 종목 큰 카드는 하단 탭과 겹쳐 뺐다. 수업반으로 가는 길은 지금 수업 · 오늘 수업 · 내 수업반 세 곳만.
 */
export default function HomePage() {
  const { settings } = useApp()
  const { groups, students, membersOf } = useGroups()
  const [pick, setPick] = useState(false)
  const now = new Date()
  const lessons = todaysLessons(now, settings.timetable)
  const period = currentPeriod(now, settings.periodStarts, settings.periodMinutes)
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))
  // 아래 탭(수업반·종목·평가·도구)과 겹치는 기능은 빼고, 탭에 없는 기능만 바로가기에 둔다
  const features = FEATURES.filter((f) => featureOn(settings.features, f.id) && !TAB_FEATURES.includes(f.id))
  const recordsOn = featureOn(settings.features, 'records')
  const today = todayStr()
  const upcoming = upcomingEvents(settings.neisSchedule?.events ?? [], today)
  const dday = (d: string) => ddayOf(d, today)
  const work = upcomingWork(settings.workEvents ?? [], today, 14)
  const install = currentInstallInfo()
  // 아이폰 · 카톡 안 브라우저의 빨간 안내는 자료가 지워질 수 있어 맨 위, 설치 권유(파랑)는 맨 아래
  const urgentInstall = !install.standalone && (!!install.inApp || install.platform === 'ios')

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
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches === true
  const shownGroups = (groups ?? []).slice(0, 6)

  return (
    <>
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="page flex items-center gap-3 pt-5 pb-1 xl:max-w-[72rem]">
          {/* 넓은 화면은 왼쪽 메뉴에 로고가 있어 두 번 보이지 않게 */}
          <span className="lg:hidden">
            <Logo size={40} />
          </span>
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

      <div className="page flex flex-col gap-5 pt-3 pb-8 xl:grid xl:max-w-[72rem] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start xl:gap-6">
        {/* 왼쪽: 오늘 (폰에서는 contents로 풀려 아래 order 순서대로 섞인다) */}
        <div className="contents xl:flex xl:flex-col xl:gap-5">
          <div className="order-1 space-y-3 empty:hidden xl:order-none">
            <AutoBackupNotice />
            {urgentInstall && <InstallGuide place="home" />}
            {/* 시작 준비에 '첫 백업'이 이미 보이면 겹치지 않게 */}
            {!showSetup && <BackupWarning hasData={(students?.length ?? 0) > 0} />}
          </div>

          {/* ① 지금 수업 — 이 화면에서 꽉 찬 파랑은 이것 하나 */}
          {recordsOn && (focus && focusGroup ? (
            <Link
              to={`/groups/${focusGroup.id}`}
              className="anim-pop order-2 block rounded-3xl bg-brand p-5 text-white shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] xl:order-none"
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
            lastGroup && (
              <Link to={`/groups/${lastGroup.id}`} className="card order-2 flex min-h-[72px] items-center gap-3 transition-transform active:scale-[0.99] xl:order-none">
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
          ))}

          {/* ② 시작 준비 — 처음 쓰는 사람이 순서대로 따라 하게 */}
          {showSetup && (
            <section className="card order-3 space-y-3 xl:order-none" aria-label="시작 준비">
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
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${isNext ? 'bg-brand text-white' : 'bg-fill-2 text-ink-3'}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <b className="block">
                            {st.label}
                            {st.optional && <span className="ml-1 text-xs font-bold text-ink-3">선택</span>}
                          </b>
                          <span className="hint block">{st.desc}</span>
                        </span>
                        <Icon name="chevronRight" className="text-ink-3" />
                      </Link>
                    </li>
                  )
                })}
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to="/more/settings/neis" className="text-sm font-bold text-brand">
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

          {/* ③ 오늘 수업 — 세로 목록 (가로 칩은 폰에서 세 번째부터 잘렸다) */}
          {recordsOn && lessons.length > 0 && (
            <section className="order-4 space-y-2 xl:order-none">
              <SectionTitle title={`오늘 수업 ${lessons.length}`} action={{ to: '/more/settings/timetable', label: '시간표' }} />
              <div className="card overflow-hidden p-0">
                {lessons.map((l) => {
                  const g = groupById.get(l.groupId)
                  if (!g) return null
                  const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                  const live = period === l.period
                  const past = period !== null && l.period < period
                  return (
                    <Link key={`${l.day}-${l.period}`} to={`/groups/${g.id}`} className={`list-row min-h-[56px] hover:bg-fill ${past ? 'opacity-55' : ''}`}>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums ${live ? 'bg-brand text-white' : 'bg-fill text-ink-2'}`}>{l.period}</span>
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.fg }} aria-hidden />
                      <b className="min-w-0 flex-1 truncate">{g.name}</b>
                      {live && <span className="badge bg-brand-light text-brand">지금</span>}
                      <Icon name="chevronRight" size={18} className="text-ink-3" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ⑦ 이번 주 내 시간표 — 폰에서는 맨 아래에 접어 두고, PC에서는 펼침 */}
          {recordsOn && settings.timetable.length > 0 && (
            <section className="order-8 xl:order-none">
              <details className="group card p-0" open={wide}>
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
                  <b className="flex-1 text-[1.05rem]">이번 주 내 시간표</b>
                  <Link to="/timetable/pe" className="text-sm font-bold text-ink-3" onClick={(e) => e.stopPropagation()}>
                    전체 체육 ›
                  </Link>
                  <Icon name="chevronDown" size={18} className="text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="overflow-x-auto px-2 pb-2">
                  <WeekTable now={now} period={period} timetable={settings.timetable} groupById={groupById} />
                </div>
              </details>
            </section>
          )}
        </div>

        {/* 오른쪽: 내 것 */}
        <div className="contents xl:flex xl:flex-col xl:gap-5">
          {/* ④ 내 수업반 — 두 칸 격자 (가로로 밀면 뒤 반이 안 보였다) */}
          {recordsOn && groups && groups.length > 0 && (
            <section className="order-5 space-y-2 xl:order-none">
              <SectionTitle title={`내 수업반 ${groups.length}`} action={{ to: '/groups', label: '전체' }} />
              <div className="grid grid-cols-2 gap-2">
                {shownGroups.map((g) => {
                  const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                  return (
                    <Link key={g.id} to={`/groups/${g.id}`} className="card flex min-h-[84px] flex-col justify-between gap-1 p-3.5 transition-transform active:scale-[0.98]">
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
              {groups.length > shownGroups.length && (
                <Link to="/groups" className="block px-1 text-sm font-bold text-brand">
                  나머지 {groups.length - shownGroups.length}개 반 보기
                </Link>
              )}
            </section>
          )}

          {/* ⑤ 바로가기 — 탭에 없는 기능만, 마지막 칸은 [편집] (줄이 비지 않게) */}
          <section className="order-6 space-y-2 xl:order-none">
            <SectionTitle title="바로가기" />
            <div className="card grid grid-cols-4 gap-y-3 px-2 py-4">
              {features.map((f) => (
                <Link key={f.id} to={f.to} className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-center active:bg-fill">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${f.tone}`}>
                    <Icon name={f.icon} size={22} />
                  </span>
                  <span className="text-[0.8rem] leading-tight font-bold text-ink-2">{f.short}</span>
                </Link>
              ))}
              <button type="button" className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-center active:bg-fill" onClick={() => setPick(true)}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-dashed border-line text-ink-3">
                  <Icon name="grid" size={20} />
                </span>
                <span className="text-[0.8rem] leading-tight font-bold text-ink-3">편집</span>
              </button>
            </div>
          </section>

          {/* ⑥ 업무 일정 알림 (같이 쓰기 6-13): 14일 안 D-day */}
          {work.length > 0 && (
            <section className="order-7 space-y-2 xl:order-none">
              <SectionTitle title="다가오는 업무 일정" action={{ to: '/work/calendar', label: '업무 달력' }} />
              <div className="card overflow-hidden p-0">
                {work.slice(0, 5).map((e) => (
                  <Link key={e.id} to="/work/calendar" className="list-row min-h-[52px] hover:bg-fill">
                    <span className="w-16 shrink-0 font-black tabular-nums">{e.date <= today ? '진행 중' : workDday(e.date, today)}</span>
                    <span className="rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: WORK_KIND[e.kind].bg, color: WORK_KIND[e.kind].fg }}>
                      {WORK_KIND[e.kind].label}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ⑥ 학사일정 */}
          {upcoming.length > 0 && (
            <section className="order-7 space-y-2 xl:order-none">
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

          {/* ⑦ 기초 설정 · 평가계획서 넣기 (교사 가안: 초기설정은 홈에) — 메뉴 표 src/lib/nav.ts의 홈 묶음 */}
          {visibleGroups(NAV[0], settings.features).map((g) => (
            <section key={g.title} className="order-9 space-y-2 lg:hidden">
              <SectionTitle title={g.title} />
              <div className="card overflow-hidden p-0">
                {g.items.map((i) => (
                  <Link key={i.to} to={i.to} className="list-row min-h-[54px] hover:bg-fill">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
                      <Icon name={i.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{i.label}</b>
                      {i.desc && <span className="block truncate text-sm text-ink-3">{i.desc}</span>}
                    </span>
                    <Icon name="chevronRight" size={18} className="text-ink-3" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <div className="order-10 space-y-3 xl:order-none">
            {!urgentInstall && <InstallGuide place="home" />}
            <p className="hint text-center">
              처음이라면{' '}
              <Link to="/help" className="font-bold text-brand">
                사용법
              </Link>
              부터 보세요 · 학생 정보는 이 기기에만 저장돼요
            </p>
          </div>
        </div>
      </div>
      {pick && <FeatureSheet onClose={() => setPick(false)} />}
    </>
  )
}

/** 요일 × 교시 표 (2026-10-26 교사 요청). 칸 이름은 '1-1'처럼 짧게, 수강반은 두 줄까지 */
function WeekTable({
  now,
  period,
  timetable,
  groupById,
}: {
  now: Date
  period: number | null
  timetable: { day: number; period: number; groupId: string }[]
  groupById: Map<string, { id: string; name: string; color: string }>
}) {
  return (
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
        {Array.from({ length: Math.max(6, ...timetable.map((t) => t.period)) }, (_, i) => i + 1).map((p) => (
          <tr key={p}>
            <th className="text-center font-bold text-ink-3 tabular-nums">{p}</th>
            {[1, 2, 3, 4, 5].map((d) => {
              const t = timetable.find((x) => x.day === d && x.period === p)
              const g = t ? groupById.get(t.groupId) : undefined
              if (!g) return <td key={d} className="h-10 rounded-md bg-fill/60" />
              const c = GROUP_COLORS[g.color as keyof typeof GROUP_COLORS] ?? GROUP_COLORS.blue
              const live = now.getDay() === d && period === p
              return (
                <td key={d} className={`h-10 rounded-md p-0 ${live ? 'ring-2 ring-brand' : ''}`} style={{ background: c.bg }}>
                  <Link to={`/groups/${g.id}`} className="line-clamp-2 block px-1 py-0.5 leading-tight font-bold break-all text-ink" title={g.name}>
                    {shortName(g.name)}
                  </Link>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** '1학년 2반' → '1-2', '스포츠 생활 · 배드민턴' → '스포츠 생활' (점 앞까지) */
function shortName(name: string): string {
  const m = /^(\d)학년\s*(\d+)반$/.exec(name.trim())
  if (m) return `${m[1]}-${m[2]}`
  return name.split(/\s*[·•]\s*/)[0]
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

function SectionTitle({ title, action }: { title: ReactNode; action?: { to: string; label: string } }) {
  return (
    <div className="flex items-end justify-between px-1">
      <h2 className="text-[1.05rem] font-extrabold">{title}</h2>
      {action && (
        <Link to={action.to} className="text-sm font-bold text-ink-3">
          {action.label} ›
        </Link>
      )}
    </div>
  )
}
