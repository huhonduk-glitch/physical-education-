import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionBar from '../../components/ActionBar'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { createPlan, deletePlan, updatePlan } from '../../db/plansRepo'
import { shortDateLabel } from '../../lib/dates'
import { defaultTerm, examDaysFromSchedule, HOUR_CHOICES, offDaysFromSchedule, targetFor, WEEKS_DEFAULT } from '../../lib/progressPlan'
import { gradesFor } from '../../lib/school'
import { STANDARDS } from '../../lib/standards'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 진도표 만들기 · 설정 고치기 (6-5) */
export default function PlanSetupPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { settings, readOnly } = useApp()
  const year = settings.schoolYear
  const { groups } = useGroups()
  const existing = useLiveQuery(() => (id ? db.progressPlans.get(id) : undefined), [id])
  const others = useLiveQuery(() => db.progressPlans.where('schoolYear').equals(year).toArray(), [year])

  const [f, setF] = useState(() => ({
    title: '',
    subject: '',
    grade: 0,
    semester: (new Date().getMonth() >= 7 ? 2 : 1) as 1 | 2,
    weeklyHours: 1,
    weeks: WEEKS_DEFAULT,
    target: WEEKS_DEFAULT,
    targetTouched: false,
    ...defaultTerm(year, new Date().getMonth() >= 7 ? 2 : 1),
    offDays: [] as string[],
    groupIds: [] as string[],
  }))
  const [loaded, setLoaded] = useState(!id)
  const [newOff, setNewOff] = useState('')
  useEffect(() => {
    if (!existing || loaded) return
    setF({ ...existing, grade: existing.grade ?? 0, targetTouched: existing.target !== targetFor(existing.weeklyHours, existing.weeks) })
    setLoaded(true)
  }, [existing, loaded])

  const set = (p: Partial<typeof f>) => setF((cur) => {
    const next = { ...cur, ...p }
    if (!next.targetTouched) next.target = targetFor(next.weeklyHours, next.weeks)
    return next
  })

  // 같은 학년에서 마지막에 고른 주당 시간을 처음 값으로 (학교·학년마다 달라서 기억해 둔다)
  const pickGrade = (grade: number) => {
    const last = (others ?? []).filter((p) => p.grade === grade && p.id !== id).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    set({ grade, ...(last && !id ? { weeklyHours: last.weeklyHours, weeks: last.weeks } : {}) })
  }
  const pickSemester = (semester: 1 | 2) => set({ semester, ...(id ? {} : defaultTerm(year, semester)) })

  const subjects = useMemo(() => [...new Set(STANDARDS.subjects.filter((s) => s.school === settings.schoolLevel).map((s) => s.subject))], [settings.schoolLevel])
  const schedule = settings.neisSchedule?.events ?? []
  const fromNeis = offDaysFromSchedule(schedule, f.startDate, f.endDate, f.grade || undefined)
  const exams = examDaysFromSchedule(schedule, f.startDate, f.endDate)
  const addOff = (days: string[]) => set({ offDays: [...new Set([...f.offDays, ...days])].sort() })

  const sortedGroups = [...(groups ?? [])].sort((a, b) => Number(b.grade === f.grade) - Number(a.grade === f.grade))
  const valid = f.title.trim() && f.target > 0 && f.startDate && f.endDate && f.startDate <= f.endDate

  const save = async () => {
    if (!valid) return
    const body = {
      title: f.title.trim(),
      subject: f.subject.trim(),
      grade: f.grade || undefined,
      semester: f.semester,
      weeklyHours: f.weeklyHours,
      weeks: f.weeks,
      target: f.target,
      startDate: f.startDate,
      endDate: f.endDate,
      offDays: f.offDays,
      groupIds: f.groupIds,
    }
    if (id) {
      await updatePlan(db, id, body)
      nav(-1)
    } else {
      const nid = await createPlan(db, { schoolYear: year, ...body })
      nav(`/plans/${nid}`, { replace: true })
    }
  }
  const remove = async () => {
    if (!id || !confirm('이 진도표를 지울까요? 차시 계획과 반별 진도 표시가 모두 지워져요. (수업 일지는 그대로)')) return
    await deletePlan(db, id)
    nav('/plans', { replace: true })
  }

  return (
    <>
      <PageHeader title={id ? '진도표 설정' : '새 진도표'} back />
      <div className="page space-y-4 pb-8">
        <section className="card space-y-3">
          <label className="block">
            <span className="label">진도표 이름</span>
            <input className="field" value={f.title} placeholder="예: 2학년 스포츠 생활2 (배드민턴)" onChange={(e) => set({ title: e.target.value })} disabled={readOnly} />
          </label>
          <label className="block">
            <span className="label">과목 (성취기준을 고를 때 씀)</span>
            <input className="field" list="plan-subjects" value={f.subject} placeholder="예: 스포츠 생활2" onChange={(e) => set({ subject: e.target.value })} disabled={readOnly} />
            <datalist id="plan-subjects">
              {subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <div>
            <span className="label">학년</span>
            <div className="flex flex-wrap gap-2">
              {gradesFor(settings.schoolLevel).map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={f.grade === g} onClick={() => pickGrade(g)} disabled={readOnly}>
                  {g}학년
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">학기</span>
            <div className="segment" role="radiogroup" aria-label="학기">
              {([1, 2] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={f.semester === s} onClick={() => pickSemester(s)} disabled={readOnly}>
                  {s}학기
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <p className="card-title">차시 수</p>
          <div>
            <span className="label">주당 시간 (학점)</span>
            <div className="flex flex-wrap gap-2">
              {HOUR_CHOICES.map((h) => (
                <button key={h} type="button" className="chip tabular-nums" aria-pressed={f.weeklyHours === h} onClick={() => set({ weeklyHours: h })} disabled={readOnly}>
                  주 {h}시간 → {targetFor(h, f.weeks)}차시
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">주 수</span>
              <input className="field tabular-nums" type="number" inputMode="numeric" min={1} max={30} value={f.weeks} onChange={(e) => set({ weeks: Math.max(1, Number(e.target.value) || 0) })} disabled={readOnly} />
            </label>
            <label className="block flex-1">
              <span className="label">목표 차시</span>
              <input
                className="field tabular-nums"
                type="number"
                inputMode="numeric"
                min={1}
                value={f.target}
                onChange={(e) => setF((cur) => ({ ...cur, target: Math.max(0, Number(e.target.value) || 0), targetTouched: true }))}
                disabled={readOnly}
              />
            </label>
          </div>
          <p className="hint">
            보통 주당 시간 × 17주예요. 학교마다 다르면 목표 차시를 직접 고치세요.
            {f.targetTouched && (
              <button type="button" className="ml-1 font-bold text-brand underline" onClick={() => setF((cur) => ({ ...cur, targetTouched: false, target: targetFor(cur.weeklyHours, cur.weeks) }))}>
                계산값으로 ({targetFor(f.weeklyHours, f.weeks)})
              </button>
            )}
          </p>
        </section>

        <section className="card space-y-3">
          <p className="card-title">이 진도표를 쓰는 수업반</p>
          {groups && groups.length === 0 && <p className="hint">수업반이 아직 없어요. 수업반을 먼저 만들면 날짜와 반별 진도가 보여요.</p>}
          <div className="flex flex-wrap gap-2">
            {sortedGroups.map((g) => {
              const on = f.groupIds.includes(g.id)
              return (
                <button key={g.id} type="button" className="chip" aria-pressed={on} onClick={() => set({ groupIds: on ? f.groupIds.filter((x) => x !== g.id) : [...f.groupIds, g.id] })} disabled={readOnly}>
                  {g.name}
                </button>
              )
            })}
          </div>
          <p className="hint">날짜는 [설정 → 수업 시간표]에서 이 반 칸으로 계산해요.</p>
        </section>

        <section className="card space-y-3">
          <p className="card-title">학기 기간 · 수업 없는 날</p>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">첫날</span>
              <input className="field" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} disabled={readOnly} />
            </label>
            <label className="block flex-1">
              <span className="label">끝날</span>
              <input className="field" type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} disabled={readOnly} />
            </label>
          </div>
          {schedule.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-soft" onClick={() => addOff(fromNeis)} disabled={readOnly || fromNeis.every((d) => f.offDays.includes(d))}>
                <Icon name="download" /> 학사일정 휴일 {fromNeis.length}일 넣기
              </button>
              {exams.length > 0 && (
                <button type="button" className="btn btn-soft" onClick={() => addOff(exams)} disabled={readOnly || exams.every((d) => f.offDays.includes(d))}>
                  고사 {exams.length}일도 넣기
                </button>
              )}
            </div>
          ) : (
            <p className="hint">[더보기 → 나이스에서 불러오기]로 학사일정을 받으면 휴일을 한 번에 넣을 수 있어요.</p>
          )}
          <div className="flex gap-2">
            <input className="field flex-1" type="date" value={newOff} min={f.startDate} max={f.endDate} onChange={(e) => setNewOff(e.target.value)} disabled={readOnly} />
            <button type="button" className="btn btn-soft" onClick={() => (newOff && addOff([newOff]), setNewOff(''))} disabled={readOnly || !newOff}>
              <Icon name="plus" /> 더하기
            </button>
          </div>
          {f.offDays.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {f.offDays.map((d) => (
                <button key={d} type="button" className="badge bg-fill text-ink-2" onClick={() => set({ offDays: f.offDays.filter((x) => x !== d) })} disabled={readOnly} aria-label={`${d} 빼기`}>
                  {shortDateLabel(d)} ✕
                </button>
              ))}
            </div>
          )}
        </section>

        {id && !readOnly && (
          <button type="button" className="btn btn-danger-soft w-full" onClick={remove}>
            <Icon name="trash" /> 이 진도표 지우기
          </button>
        )}

        {!readOnly && (
          <ActionBar>
            <button type="button" className="btn btn-primary w-full" onClick={save} disabled={!valid}>
              {id ? '저장' : '만들고 차시 짜기'}
            </button>
          </ActionBar>
        )}
      </div>
    </>
  )
}
