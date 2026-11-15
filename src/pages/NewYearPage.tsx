import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ActionBar from '../components/ActionBar'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { saveSnapshot } from '../db/autoBackup'
import { backupFileName, exportAll } from '../db/backup'
import { db, newId } from '../db/db'
import { IS_DEMO } from '../lib/demo'
import { saveText } from '../lib/download'
import { carryAssessment, carryEvents, carryPlan, MOVED_CLEARS, newYearPatch } from '../lib/newYear'
import { useApp } from '../state/AppContext'

/** 새 학년도를 시작하기 전에 남기는 자동 백업의 이유 (백업 화면 '자동 백업' 목록에 보임) */
export const NEW_YEAR_SNAPSHOT_REASON = '새 학년도 시작 전'

const SEM = (s?: number) => (s === 1 ? '1학기' : s === 2 ? '2학기' : '1년')

/**
 * 새 학년도 시작 (CLAUDE.md 4-11 · 6-30, 2026-11-15 교사 승인 '추천 순서대로').
 * 학교를 옮겼는지 묻고 → 지난해 진도표 · 수행평가 · 직접 넣은 업무 일정을 골라 가져오고 → 자동 백업 뒤 학년도를 넘긴다.
 */
export default function NewYearPage() {
  const { settings, updateSettings } = useApp()
  const years = useLiveQuery(async () => {
    const ys = new Set<number>()
    await db.students.each((s) => ys.add(s.schoolYear))
    return [...ys]
  }, [])
  const latest = Math.max(settings.latestYear, settings.schoolYear, ...(years ?? []))
  const next = latest + 1

  const prev = useLiveQuery(
    async () => ({
      plans: (await db.progressPlans.where('schoolYear').equals(latest).toArray()).sort((a, b) => a.semester - b.semester || a.title.localeCompare(b.title, 'ko')),
      assessments: (await db.assessments.where('schoolYear').equals(latest).toArray()).sort((a, b) => (a.semester ?? 0) - (b.semester ?? 0) || a.title.localeCompare(b.title, 'ko')),
    }),
    [latest],
  )
  const events = useMemo(() => carryEvents(settings.workEvents ?? [], latest), [settings.workEvents, latest])

  const [moved, setMoved] = useState<boolean | null>(null)
  const [pickPlans, setPickPlans] = useState<Set<string>>(new Set())
  const [pickAssess, setPickAssess] = useState<Set<string>>(new Set())
  const [pickEvents, setPickEvents] = useState<Set<string>>(new Set())
  const [fileSaved, setFileSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ year: number; moved: boolean; plans: number; assessments: number; events: number } | null>(null)

  const saveFile = async () => {
    const file = await exportAll(db)
    saveText(backupFileName(), JSON.stringify(file), 'application/json')
    await updateSettings({ lastBackupAt: Date.now() })
    setFileSaved(true)
  }

  const start = async () => {
    if (moved === null) return
    setBusy(true)
    setErr('')
    try {
      // 시연 자료는 버리는 자료라 실제 자동 백업 저장소에 넣지 않는다
      if (!IS_DEMO) await saveSnapshot(await exportAll(db), NEW_YEAR_SNAPSHOT_REASON)
      const now = Date.now()
      const plans = (prev?.plans ?? []).filter((p) => pickPlans.has(p.id)).map((p) => carryPlan(p, { id: newId(), schoolYear: next, now }))
      const assessments = (prev?.assessments ?? []).filter((a) => pickAssess.has(a.id)).map((a) => carryAssessment(a, { id: newId(), schoolYear: next }))
      const evs = events.filter((e) => pickEvents.has(e.from)).map((e) => e.event)
      await db.transaction('rw', db.progressPlans, db.assessments, async () => {
        if (plans.length) await db.progressPlans.bulkAdd(plans)
        if (assessments.length) await db.assessments.bulkAdd(assessments)
      })
      await updateSettings({ ...newYearPatch(settings, { next, moved }), ...(evs.length ? { workEvents: [...(settings.workEvents ?? []), ...evs] } : {}) })
      setDone({ year: next, moved, plans: plans.length, assessments: assessments.length, events: evs.length })
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErr(`새 학년도를 시작하지 못했어요. 자료는 그대로예요. (${e instanceof Error ? e.message : String(e)})`)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Done {...done} hadSpace={!!settings.space} />

  const plansList = prev?.plans ?? []
  const assessList = prev?.assessments ?? []

  return (
    <>
      <PageHeader title={`${next}학년도 시작`} sub={`${latest}학년도 기록은 그대로 보관돼요`} back />
      <div className="page space-y-4 pb-8">
        <section className="card space-y-2" role="radiogroup" aria-label="학교">
          <p className="card-title">1. 학교</p>
          <Choice checked={moved === false} onSelect={() => setMoved(false)} title="같은 학교에서 계속해요" desc="학교 정보 · 교시 시각 · 날씨 위치 · 학교 공유 공간은 그대로 둬요." />
          <Choice checked={moved === true} onSelect={() => setMoved(true)} title="다른 학교로 옮겼어요" desc={`비우는 것: ${MOVED_CLEARS.join(' · ')}. 시작한 뒤 새 학교로 다시 설정해요.`} />
        </section>

        <section className="card space-y-3">
          <p className="card-title">2. 지난해 것 가져오기 (골라서)</p>
          <p className="hint">같은 과목을 또 가르치면 골라 주세요. 반 연결 · 끝낸 차시 · 점수는 빼고 가져와요. 진도표 날짜는 {next}학년도 학기로 바뀌고, 고정한 날짜는 풀려요.</p>
          {plansList.length + assessList.length === 0 && <p className="hint">{latest}학년도에 만든 진도표 · 수행평가가 없어요.</p>}
          {plansList.length > 0 && (
            <PickList
              title={`교과 진도표 ${plansList.length}개`}
              items={plansList.map((p) => ({ id: p.id, label: p.title, sub: `${SEM(p.semester)} · ${p.items.length}차시` }))}
              picked={pickPlans}
              setPicked={setPickPlans}
            />
          )}
          {assessList.length > 0 && (
            <PickList
              title={`수행평가 ${assessList.length}개`}
              items={assessList.map((a) => ({ id: a.id, label: a.title, sub: `${SEM(a.semester)} · 채점 요소 ${(a.items ?? a.rubric).length}개` }))}
              picked={pickAssess}
              setPicked={setPickAssess}
            />
          )}
          {events.length > 0 && (
            <PickList
              title={`직접 넣은 업무 일정 ${events.length}개 (1년 뒤 같은 날로)`}
              items={events.map((e) => ({ id: e.from, label: e.event.title, sub: `${e.event.date.slice(5).replace('-', '/')}${e.event.end ? ` ~ ${e.event.end.slice(5).replace('-', '/')}` : ''}` }))}
              picked={pickEvents}
              setPicked={setPickEvents}
            />
          )}
          {events.length > 0 && <p className="hint">교육청 제출 일정은 [업무 → 매년 기안 문서]의 [제출 일정 넣기]로 해마다 새로 넣어요.</p>}
        </section>

        <section className="card space-y-2">
          <p className="card-title">3. 새 학년도에 바뀌는 것</p>
          <Line icon="calendar" title="새로 받아요">
            내 시간표 · 나이스 학사일정 · 한 주 체육 시간표를 비워요. 시작한 뒤 나이스 · 컴시간에서 다시 받아 주세요.
          </Line>
          <Line icon="note" title="체육 예산">
            {latest}학년도 예산은 보관하고 {next}학년도는 빈 예산표로 시작해요. 지난 학년도를 열면 그해 예산이 보여요.
          </Line>
          <Line icon="check" title="그대로 이어져요">
            키워드 사전 · 기록 버튼 · 세특 문체와 수준 틀 · 기능 고르기 · 홈 배치 · AI 연결 · 체력왕 기준
          </Line>
        </section>

        <section className="card space-y-2">
          <p className="card-title">4. 백업</p>
          <p className="hint">
            {IS_DEMO ? '시연 모드라 자동 백업은 하지 않아요.' : '시작하면 먼저 지금 자료를 이 기기에 자동 백업해요([백업 · 학년도]의 자동 백업 목록에서 되돌릴 수 있어요).'} 기기를 잃어버릴 때를 생각해 파일로도 받아 두세요.
          </p>
          <button type="button" className="btn btn-outline w-full" onClick={() => void saveFile()}>
            <Icon name={fileSaved ? 'check' : 'download'} size={18} /> {fileSaved ? '백업 파일을 받았어요' : '백업 파일 받기 (권장)'}
          </button>
        </section>

        {err && <p className="card bg-danger-light font-bold text-danger shadow-none">{err}</p>}

        <ActionBar>
          <button type="button" className="btn btn-primary w-full text-lg" disabled={moved === null || busy || !prev} onClick={() => void start()}>
            {moved === null ? '1번에서 학교를 골라 주세요' : busy ? '시작하는 중…' : `${next}학년도 시작`}
          </button>
        </ActionBar>
      </div>
    </>
  )
}

function Done({ year, moved, plans, assessments, events, hadSpace }: { year: number; moved: boolean; plans: number; assessments: number; events: number; hadSpace: boolean }) {
  const got = [plans && `진도표 ${plans}개`, assessments && `수행평가 ${assessments}개`, events && `업무 일정 ${events}개`].filter(Boolean)
  const steps: { to: string; label: string; sub: string }[] = [
    ...(moved ? [{ to: '/more/settings', label: '학교 정보 바꾸기', sub: '학교 이름 · 성별 유형 · 학교급' }] : []),
    { to: '/students/import', label: '새 명렬 올리기', sub: '나이스 학생명렬 엑셀' },
    { to: '/more/settings/neis', label: '나이스에서 학사일정 · 시간표 받기', sub: moved ? '새 학교를 찾아서' : '학교는 그대로, 새 학년도 것으로' },
    { to: '/timetable/pe', label: '컴시간으로 내 수업 · 교시 시각 받기', sub: '선생님 이름으로 내 수업을 바로 시간표에' },
    ...(plans ? [{ to: '/plans', label: '진도표에 수업반 연결', sub: '수업반을 만든 뒤 진도표 설정에서' }] : []),
    ...(assessments ? [{ to: '/more/assessments', label: '수행평가에 수업반 연결', sub: '수업반을 만든 뒤 평가 고치기에서' }] : []),
    ...(moved && hadSpace ? [{ to: '/work/space', label: '학교 공유 공간 다시 연결', sub: '새 학교 선생님께 공유 코드를 받아서' }] : []),
  ]
  return (
    <>
      <PageHeader title={`${year}학년도를 시작했어요`} back />
      <div className="page space-y-4 pb-8">
        <p className="card bg-ok-light font-bold text-ok shadow-none">
          {year}학년도를 시작했어요.{got.length ? ` 지난해 ${got.join(' · ')}를 가져왔어요.` : ''}
        </p>
        <section className="card space-y-2">
          <p className="card-title">이제 할 일</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.to}>
                <Link to={s.to} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-line p-3 hover:bg-fill">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-black text-brand">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block">{s.label}</b>
                    <span className="hint block">{s.sub}</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

function Choice({ checked, onSelect, title, desc }: { checked: boolean; onSelect: () => void; title: string; desc: string }) {
  return (
    <label className={`flex min-h-[48px] cursor-pointer gap-3 rounded-xl border-2 p-3 ${checked ? 'border-brand bg-brand-light' : 'border-line'}`}>
      <input type="radio" name="moved" className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={onSelect} />
      <span>
        <b>{title}</b>
        <span className="hint block">{desc}</span>
      </span>
    </label>
  )
}

function PickList({ title, items, picked, setPicked }: { title: string; items: { id: string; label: string; sub: string }[]; picked: Set<string>; setPicked: (s: Set<string>) => void }) {
  const all = items.every((i) => picked.has(i.id))
  const flip = (id: string) => {
    const s = new Set(picked)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setPicked(s)
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <b className="min-w-0 text-sm text-ink-2">{title}</b>
        <button type="button" className="shrink-0 text-sm font-bold whitespace-nowrap text-brand" onClick={() => setPicked(all ? new Set() : new Set(items.map((i) => i.id)))}>
          {all ? '모두 빼기' : '모두 고르기'}
        </button>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-3 py-2">
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--color-brand)]" checked={picked.has(i.id)} onChange={() => flip(i.id)} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{i.label}</span>
                <span className="hint block">{i.sub}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Line({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink-2">
        <Icon name={icon} size={16} />
      </span>
      <p className="text-[0.95rem]">
        <b className="mr-1">{title}</b>
        {children}
      </p>
    </div>
  )
}
