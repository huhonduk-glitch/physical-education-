import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { Student } from '../db/types'
import { genderLabel } from '../lib/text'
import { useApp } from '../state/AppContext'

export default function StudentsPage() {
  const { settings } = useApp()
  const students = useLiveQuery(
    () => db.students.where('schoolYear').equals(settings.schoolYear).toArray(),
    [settings.schoolYear],
  )
  const [showLeft, setShowLeft] = useState(false)

  const classes = useMemo(() => {
    const set = new Map<string, { grade: number; classNo: number; count: number }>()
    for (const s of students ?? []) {
      const k = `${s.grade}-${s.classNo}`
      const c = set.get(k) ?? { grade: s.grade, classNo: s.classNo, count: 0 }
      if (s.status !== '전출') c.count++
      set.set(k, c)
    }
    return [...set.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
  }, [students])

  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (classes.length > 0 && (selected === null || !classes.some((c) => `${c.grade}-${c.classNo}` === selected))) {
      setSelected(`${classes[0].grade}-${classes[0].classNo}`)
    }
  }, [classes, selected])

  const list: Student[] = useMemo(() => {
    if (!students || !selected) return []
    const [g, c] = selected.split('-').map(Number)
    return students
      .filter((s) => s.grade === g && s.classNo === c && (showLeft || s.status !== '전출'))
      .sort((a, b) => a.number - b.number || a.status.localeCompare(b.status))
  }, [students, selected, showLeft])

  const leftCount = useMemo(() => {
    if (!students || !selected) return 0
    const [g, c] = selected.split('-').map(Number)
    return students.filter((s) => s.grade === g && s.classNo === c && s.status === '전출').length
  }, [students, selected])

  return (
    <>
      <PageHeader
        title={`학생 · ${settings.schoolYear}학년도`}
        right={
          <Link to="/students/import" className="btn btn-primary">
            명렬 올리기
          </Link>
        }
      />
      {students === undefined ? null : students.length === 0 ? (
        <div className="page py-4">
          <div className="card text-center">
            <p className="text-lg font-bold">아직 등록된 학생이 없어요</p>
            <p className="hint mt-1">나이스 명렬 엑셀을 올리거나 명단을 붙여넣어 주세요.</p>
            <Link to="/students/import" className="btn btn-primary mt-4 w-full">
              명렬 올리기
            </Link>
          </div>
        </div>
      ) : (
        <div className="page py-4">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="반 고르기">
            {classes.map((c) => {
              const k = `${c.grade}-${c.classNo}`
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={selected === k}
                  className={`btn shrink-0 ${selected === k ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelected(k)}
                >
                  {c.grade}-{c.classNo}
                  <span className="text-sm font-normal">({c.count})</span>
                </button>
              )
            })}
          </div>

          <ul className="mt-3 divide-y-2 divide-zinc-100 rounded-xl border-2 border-zinc-200">
            {list.map((s) => (
              <li key={s.id} className={`flex min-h-[52px] items-center gap-3 px-3 ${s.status === '전출' ? 'bg-zinc-100 text-zinc-500' : ''}`}>
                <span className="w-8 text-right text-lg font-extrabold tabular-nums">{s.number}</span>
                <span className="flex-1 text-lg">{s.name}</span>
                <span className="text-zinc-600">{genderLabel(s.gender)}</span>
                {s.status !== '재학' && (
                  <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-sm font-bold text-zinc-700">{s.status}</span>
                )}
              </li>
            ))}
          </ul>

          {leftCount > 0 && (
            <button type="button" className="btn btn-ghost mt-2 text-zinc-700 underline" onClick={() => setShowLeft((v) => !v)}>
              {showLeft ? '전출생 숨기기' : `전출생 ${leftCount}명 보기`}
            </button>
          )}
          <p className="hint mt-4">학생별 누적 기록 화면은 2단계에서 만들어요.</p>
        </div>
      )}
    </>
  )
}
