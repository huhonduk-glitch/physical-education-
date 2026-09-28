import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import ClassPicker from '../components/ClassPicker'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { Student } from '../db/types'
import { useApp } from '../state/AppContext'
import { usePapsClass } from '../state/usePapsClass'
import { usePapsClassKey } from './paps/common'

/** 반 전체 요약 (CLAUDE.md 4-9): 미준비 누적 상위, 솔선수범 누적 상위, PAPS 미측정자 */
export default function ClassSummaryPage() {
  const { settings } = useApp()
  const { classes, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const ids = pc.students.map((s) => s.id)
  const data = useLiveQuery(async () => {
    if (!ids.length) return null
    const [records, absences] = await Promise.all([
      db.records.where('studentId').anyOf(ids).filter((r) => r.schoolYear === settings.schoolYear).toArray(),
      db.absences.where('studentId').anyOf(ids).filter((a) => a.schoolYear === settings.schoolYear).toArray(),
    ])
    const count = (pred: (r: (typeof records)[number]) => boolean) => {
      const m = new Map<string, number>()
      for (const r of records) if (pred(r)) m.set(r.studentId, (m.get(r.studentId) ?? 0) + 1)
      return m
    }
    const abs = new Map<string, number>()
    for (const a of absences) abs.set(a.studentId, (abs.get(a.studentId) ?? 0) + 1)
    return { unprepared: count((r) => r.type === 'unprepared'), exemplary: count((r) => r.type === 'exemplary'), captain: count((r) => r.type === 'captain'), abs }
  }, [ids.join(','), settings.schoolYear])

  const top = (m: Map<string, number> | undefined, n = 10) =>
    [...(m ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, c]) => ({ s: pc.students.find((x) => x.id === id)!, c }))
      .filter((x) => x.s)
  const notMeasured = pc.students.filter((s) => !pc.excluded.has(s.id) && !pc.summaries.get(s.id)?.complete)

  return (
    <>
      <PageHeader title="반 요약" back />
      <div className="page space-y-4 pb-8">
        <ClassPicker classes={classes} value={cls} onChange={setCls} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Rank title="준비물 미준비 누적 상위" tone="text-danger" rows={top(data?.unprepared)} unit="회" />
          <Rank title="솔선수범 누적 상위" tone="text-brand" rows={top(data?.exemplary)} unit="회" />
          <Rank title="체육부장 활동" tone="text-ok" rows={top(data?.captain, 5)} unit="회" />
          <Rank title="견학 횟수" tone="text-ink-2" rows={top(data?.abs, 5)} unit="회" />
        </div>
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="card-title">PAPS 미측정자</p>
            <span className="badge bg-caution-light text-caution">{notMeasured.length}명</span>
          </div>
          {notMeasured.length === 0 ? (
            <p className="hint">모두 측정했어요 (측정 제외 {pc.excluded.size}명)</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {notMeasured.map((s) => (
                <Link key={s.id} to={`/students/${s.id}`} className="chip">
                  {s.number} {s.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function Rank({ title, rows, tone, unit }: { title: string; rows: { s: Student; c: number }[]; tone: string; unit: string }) {
  return (
    <section className="card overflow-hidden p-0">
      <p className="card-title px-5 pt-4 pb-1">{title}</p>
      {rows.length === 0 ? (
        <p className="hint px-5 pb-4">아직 기록이 없어요</p>
      ) : (
        <ol>
          {rows.map(({ s, c }, i) => (
            <li key={s.id}>
              <Link to={`/students/${s.id}`} className="list-row hover:bg-fill">
                <span className={`w-6 font-extrabold tabular-nums ${i < 3 ? tone : 'text-ink-3'}`}>{i + 1}</span>
                <span className="flex-1 font-semibold">
                  {s.number}번 {s.name}
                </span>
                <span className={`font-extrabold tabular-nums ${tone}`}>
                  {c}
                  {unit}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
