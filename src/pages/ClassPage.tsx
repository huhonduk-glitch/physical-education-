import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ClassPicker, { classesOf, classKeyStr, type ClassKey } from '../components/ClassPicker'
import DateBar from '../components/DateBar'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import RecordSheet from '../components/RecordSheet'
import TeamSendSheet from '../components/TeamSendSheet'
import UndoToast from '../components/UndoToast'
import { db } from '../db/db'
import { undo, type UndoToken } from '../db/recordsRepo'
import type { Student } from '../db/types'
import { todayStr } from '../lib/dates'
import { summarizeDay } from '../lib/recordStats'
import { classForNow } from '../lib/timetable'
import { useApp } from '../state/AppContext'

const LAST_CLASS_KEY = 'pe.lastClass'

function readLastClass(): string | null {
  try {
    return localStorage.getItem(LAST_CLASS_KEY)
  } catch {
    return null
  }
}

/** 수업 탭: 번호 카드를 눌러 바로 기록하는 핵심 화면 (CLAUDE.md 4-2) */
export default function ClassPage() {
  const { settings, readOnly } = useApp()
  const [date, setDate] = useState(todayStr())
  const isToday = date === todayStr()
  const students = useLiveQuery(
    () => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status !== '전출').toArray(),
    [settings.schoolYear],
  )

  const classes = useMemo(() => classesOf(students ?? []), [students])
  const now = isToday ? classForNow(new Date(), settings.timetable, settings.periodStarts, settings.periodMinutes) : null
  const [cls, setCls] = useState<ClassKey | null>(null)

  // 처음 열 때: 지금 교시 반(시간표) → 지난번에 본 반 → 첫 번째 반
  useEffect(() => {
    if (classes.length === 0 || (cls && classes.some((c) => classKeyStr(c) === classKeyStr(cls)))) return
    const byTime = now && classes.find((c) => c.grade === now.grade && c.classNo === now.classNo)
    const last = readLastClass()
    const byLast = classes.find((c) => classKeyStr(c) === last)
    setCls(byTime || byLast || classes[0])
  }, [classes, cls, now])

  const list: Student[] = useMemo(
    () =>
      (students ?? [])
        .filter((s) => cls && s.grade === cls.grade && s.classNo === cls.classNo)
        .sort((a, b) => a.number - b.number),
    [students, cls],
  )
  const ids = useMemo(() => list.map((s) => s.id), [list])

  const day = useLiveQuery(async () => {
    const [records, absences] = await Promise.all([
      db.records.where('date').equals(date).filter((r) => r.schoolYear === settings.schoolYear).toArray(),
      db.absences.where('date').equals(date).filter((a) => a.schoolYear === settings.schoolYear).toArray(),
    ])
    return summarizeDay(records, absences)
  }, [date, settings.schoolYear])

  // 달력에 점 찍을 날짜: 이 반 학생 기록이 있는 날
  const marked = useLiveQuery(async () => {
    if (ids.length === 0) return new Set<string>()
    const [r, a] = await Promise.all([db.records.where('studentId').anyOf(ids).toArray(), db.absences.where('studentId').anyOf(ids).toArray()])
    return new Set([...r.map((x) => x.date), ...a.map((x) => x.date)])
  }, [ids.join(',')])

  const choose = (c: ClassKey | null) => {
    if (!c) return
    setCls(c)
    setSelected([])
    try {
      localStorage.setItem(LAST_CLASS_KEY, classKeyStr(c))
    } catch {
      /* 무시 */
    }
  }

  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [sheet, setSheet] = useState<Student[] | null>(null)
  const [teamSend, setTeamSend] = useState(false)
  const [toast, setToast] = useState<{ token: UndoToken; message: string; key: number } | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const tapCard = (s: Student) => {
    if (multi) setSelected((sel) => (sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id]))
    else setSheet([s])
  }

  const onRecorded = (token: UndoToken, message: string) => {
    setSheet(null)
    setSelected([])
    setMulti(false)
    setToast({ token, message, key: Date.now() })
  }

  const stats = useMemo(() => {
    let absent = 0
    let unprepared = 0
    let exemplary = 0
    for (const s of list) {
      const d = day?.get(s.id)
      if (!d) continue
      if (d.absent) absent++
      if (d.unprepared) unprepared++
      if (d.exemplary) exemplary++
    }
    return { absent, unprepared, exemplary, present: list.length - absent }
  }, [list, day])

  if (students !== undefined && students.length === 0) {
    return (
      <>
        <PageHeader title="수업" />
        <div className="page pt-2">
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-light text-brand">
              <Icon name="students" size={32} />
            </span>
            <p className="text-xl font-extrabold">먼저 학생 명렬을 올려 주세요</p>
            <p className="hint">나이스 명렬 엑셀을 올리거나, 명단을 복사해서 붙여넣으면 돼요.</p>
            <Link to="/students/import" className="btn btn-primary mt-2 w-full max-w-xs">
              명렬 올리기
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="수업"
        sub={now && cls && now.grade === cls.grade && now.classNo === cls.classNo ? `시간표 ${now.period}교시 반` : undefined}
        right={
          <>
            <button type="button" className="btn btn-soft px-3" aria-label="팀 편성으로 보내기" onClick={() => setTeamSend(true)} disabled={list.length === 0}>
              <Icon name="team" />
            </button>
            <button
              type="button"
              aria-pressed={multi}
              className={`btn ${multi ? 'btn-primary' : 'btn-soft'}`}
              disabled={readOnly}
              onClick={() => {
                setMulti((m) => !m)
                setSelected([])
              }}
            >
              <Icon name="check" size={20} />
              {multi ? '선택 끝' : '여러 명'}
            </button>
          </>
        }
      />
      <div className="page space-y-3 pb-4">
        <ClassPicker classes={classes} value={cls} onChange={choose} />
        <DateBar value={date} onChange={setDate} marked={marked} />

        <div className="grid grid-cols-4 gap-2 text-center" aria-label="이 반 요약">
          {[
            { label: '참여', n: stats.present, cls: 'text-ink' },
            { label: '견학', n: stats.absent, cls: 'text-ink-3' },
            { label: '미준비', n: stats.unprepared, cls: 'text-danger' },
            { label: '솔선수범', n: stats.exemplary, cls: 'text-brand' },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-white py-2 shadow-[var(--shadow-card)]">
              <p className={`text-xl font-extrabold tabular-nums ${x.cls}`}>{x.n}</p>
              <p className="text-[0.75rem] font-bold text-ink-3">{x.label}</p>
            </div>
          ))}
        </div>

        {multi && (
          <p className="anim-pop rounded-2xl bg-brand-light px-4 py-2.5 font-bold text-brand">기록할 학생을 모두 누른 뒤 아래 [기록하기]를 누르세요.</p>
        )}
        {readOnly && <p className="rounded-2xl bg-caution-light px-4 py-2.5 font-bold text-caution">지난 학년도는 읽기 전용이에요.</p>}

        <ul className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="번호 카드">
          {list.map((s) => {
            const d = day?.get(s.id)
            const on = selected.includes(s.id)
            const gray = d?.absent || s.status === '휴학'
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={multi ? on : undefined}
                  aria-label={`${s.number}번 ${s.name}${d?.absent ? ' 견학' : ''}`}
                  onClick={() => tapCard(s)}
                  disabled={readOnly}
                  className={`relative flex min-h-[66px] w-full flex-col items-center justify-center rounded-2xl px-0.5 pt-1.5 pb-1 transition-[transform,background-color] active:scale-95 ${
                    on
                      ? 'bg-brand text-white shadow-[0_4px_12px_rgb(27_100_218/0.35)]'
                      : gray
                        ? 'bg-fill-2 text-ink-3'
                        : 'bg-white text-ink shadow-[var(--shadow-card)]'
                  }`}
                >
                  <span className="text-[1.3rem] leading-none font-extrabold tabular-nums">{s.number}</span>
                  <span className="mt-1 w-full truncate text-center text-[0.74rem] leading-tight font-semibold">{s.name}</span>
                  <span className="mt-1 flex h-2 items-center gap-1" aria-hidden>
                    {d?.absent && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-ink-3'}`} />}
                    {d && d.unprepared > 0 && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-danger'}`} />}
                    {d && d.exemplary > 0 && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-brand'}`} />}
                    {d && (d.observation > 0 || d.captain > 0) && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-ok'}`} />}
                  </span>
                  {d && d.unprepared > 1 && (
                    <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.7rem] font-bold text-white">{d.unprepared}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[0.8rem] font-semibold text-ink-3">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-danger" /> 미준비
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-brand" /> 솔선수범
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-ok" /> 관찰·부장
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-ink-3" /> 견학(회색 카드)
          </span>
        </div>
      </div>

      {multi && (
        <div className="anim-pop fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-0 lg:left-60">
          <div className="page flex gap-2 rounded-2xl bg-white p-2 shadow-[var(--shadow-float)]">
            <button type="button" className="btn btn-soft" onClick={() => setSelected(selected.length === list.length ? [] : list.map((s) => s.id))}>
              {selected.length === list.length ? '모두 해제' : '전체'}
            </button>
            <button type="button" className="btn btn-primary flex-1 text-lg" disabled={selected.length === 0} onClick={() => setSheet(list.filter((s) => selected.includes(s.id)))}>
              {selected.length}명 기록하기
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <RecordSheet
          students={sheet}
          date={date}
          period={now && cls && now.grade === cls.grade && now.classNo === cls.classNo ? now.period : undefined}
          onClose={() => setSheet(null)}
          onRecorded={onRecorded}
        />
      )}
      {teamSend && cls && <TeamSendSheet students={list} date={date} onClose={() => setTeamSend(false)} />}

      {toast && (
        <UndoToast
          key={toast.key}
          message={toast.message}
          onDone={clearToast}
          onUndo={() => {
            void undo(db, toast.token)
            setToast(null)
          }}
        />
      )}
    </>
  )
}
