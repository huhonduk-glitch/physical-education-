import ClassPicker from '../../components/ClassPicker'
import PageHeader from '../../components/PageHeader'
import { eventName, fixed } from '../../lib/paps'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { GradeBadge, usePapsClassKey } from './common'

/** 반 전체 결과: 요인별 대표 기록·등급·점수, 종합점수·종합등급 (CLAUDE.md 4-5) */
export default function PapsResultsPage() {
  const { standards } = useApp()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const notMeasured = pc.students.filter((s) => !pc.excluded.has(s.id) && !pc.summaries.get(s.id)?.complete)
  return (
    <>
      <PageHeader title="결과 · 등급" back />
      <div className="page space-y-4 pb-8">
        <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">나이스 산출값과 다르면 나이스 값이 우선입니다.</p>
        <ul className="space-y-2">
          {pc.students.map((s) => {
            const p = pc.summaries.get(s.id)
            const ex = pc.excluded.has(s.id)
            return (
              <li key={s.id} className={`card p-4 ${ex ? 'opacity-60' : ''}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-fill font-extrabold tabular-nums">{s.number}</span>
                  <span className="flex-1 font-bold">{s.name}</span>
                  {ex ? (
                    <span className="badge bg-fill-2 text-ink-2">측정 제외</span>
                  ) : p?.complete ? (
                    <span className={`badge ${p.grade === 1 ? 'bg-brand text-white' : 'bg-ink text-white'}`}>
                      종합 {p.total}점 · {p.grade}등급
                    </span>
                  ) : (
                    <span className="badge bg-caution-light text-caution">미완료 (현재 {p?.sum ?? 0}점)</span>
                  )}
                </div>
                {!ex && p && (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {p.factors.map((f) => (
                      <div key={f.factor} className="flex items-center justify-between gap-2 rounded-xl bg-fill px-3 py-1.5 text-[0.9rem]">
                        <span className="min-w-0 truncate">
                          <b>{f.factor}</b> <span className="text-ink-3">{f.eventId ? eventName(standards, f.eventId, s.gender ?? undefined) : '종목 미정'}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="font-bold tabular-nums">{f.value === null ? '—' : fixed(f.value, 2)}</span>
                          <GradeBadge band={f.band} points={f.points} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {notMeasured.length > 0 && (
          <section className="card">
            <p className="card-title mb-1">아직 다 측정하지 않은 학생 {notMeasured.length}명</p>
            <p className="text-ink-2">{notMeasured.map((s) => `${s.number}번 ${s.name}`).join(', ')}</p>
          </section>
        )}
      </div>
    </>
  )
}
