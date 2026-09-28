import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ClassPicker, { classesOf, type ClassKey } from '../components/ClassPicker'
import Masked from '../components/Masked'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { monthLabel, shortDateLabel } from '../lib/dates'
import { countByMonth } from '../lib/recordStats'
import { useApp } from '../state/AppContext'

/**
 * 견학·열외 목록 (CLAUDE.md 4-6). 건강 정보라 사유는 기본으로 가린다.
 * 새 견학 등록은 수업 탭 번호 카드에서 한다. 대체 과제 연결은 수행평가(5단계)와 함께 만든다.
 */
export default function AbsencesPage() {
  const { settings } = useApp()
  const year = settings.schoolYear
  const data = useLiveQuery(async () => {
    const [students, absences] = await Promise.all([
      db.students.where('schoolYear').equals(year).toArray(),
      db.absences.where('schoolYear').equals(year).toArray(),
    ])
    return { students, absences }
  }, [year])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const [view, setView] = useState<'list' | 'stats'>('list')

  const byId = useMemo(() => new Map((data?.students ?? []).map((s) => [s.id, s])), [data])
  const classes = useMemo(() => classesOf(data?.students ?? []), [data])
  const list = useMemo(
    () =>
      (data?.absences ?? [])
        .filter((a) => {
          const s = byId.get(a.studentId)
          return s && (!cls || (s.grade === cls.grade && s.classNo === cls.classNo))
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data, byId, cls],
  )

  const perStudent = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of list) m.set(a.studentId, (m.get(a.studentId) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [list])

  return (
    <>
      <PageHeader title="견학 · 열외" back />
      <div className="page space-y-4 py-4">
        <p className="hint">견학 등록은 [수업] 탭에서 번호 카드를 눌러서 해요. 사유는 눌러야 보여요.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn ${cls === null ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCls(null)}>
            전체
          </button>
          <div className="min-w-0 flex-1">
            <ClassPicker classes={classes} value={cls} onChange={setCls} />
          </div>
        </div>
        <div className="flex gap-2" role="tablist">
          {(['list', 'stats'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={`btn flex-1 ${view === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView(v)}>
              {v === 'list' ? '날짜별 목록' : '횟수 통계'}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="card">견학 기록이 없어요</p>
        ) : view === 'list' ? (
          <ul className="divide-y-2 divide-zinc-100 rounded-xl border-2 border-zinc-200">
            {list.map((a) => {
              const s = byId.get(a.studentId)!
              return (
                <li key={a.id} className="flex min-h-[56px] flex-wrap items-center gap-2 px-3 py-1">
                  <span className="w-20 tabular-nums">{shortDateLabel(a.date)}</span>
                  <Link to={`/students/${s.id}`} className="flex-1 font-bold underline-offset-2 hover:underline">
                    {s.grade}-{s.classNo} {s.number}번 {s.name}
                  </Link>
                  <Masked text={a.detail ? `${a.reason} · ${a.detail}` : a.reason} />
                  <button type="button" className="btn btn-ghost px-2 text-zinc-600" onClick={() => confirm('이 견학 기록을 지울까요?') && db.absences.delete(a.id)}>
                    지우기
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            <section className="card">
              <h2 className="mb-2 text-lg font-extrabold">월별</h2>
              <ul className="space-y-1">
                {countByMonth(list).map((m) => (
                  <li key={m.month} className="flex justify-between">
                    <span>{monthLabel(m.month)}</span>
                    <b className="tabular-nums">{m.count}회</b>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="mb-2 text-lg font-extrabold">학생별 (많은 순)</h2>
              <ul className="space-y-1">
                {perStudent.map(([id, n]) => {
                  const s = byId.get(id)!
                  return (
                    <li key={id} className="flex justify-between">
                      <Link to={`/students/${id}`} className="underline-offset-2 hover:underline">
                        {s.grade}-{s.classNo} {s.number}번 {s.name}
                      </Link>
                      <b className="tabular-nums">{n}회</b>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
