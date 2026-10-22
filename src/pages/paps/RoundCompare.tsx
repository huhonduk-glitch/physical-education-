import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { ClassKey } from '../../components/ClassPicker'
import { db } from '../../db/db'
import { EXCLUDED_KEY, indexResults, loadClassPaps, studentSummary } from '../../db/papsRepo'
import type { StudentPaps } from '../../lib/paps'
import { groupByStudentRound, lastChange } from '../../lib/papsRounds'
import { useApp } from '../../state/AppContext'
import type { PapsClassView } from '../../state/usePapsClass'
import { roundLabel } from './RoundBar'

/** 학생 × 회차 종합 결과 (B-5 회차별 비교, B-4 그래프도 이 계산을 쓴다) */
export function useRoundSummaries(cls: ClassKey | null, pc: PapsClassView): Map<string, (StudentPaps | null)[]> | undefined {
  const { settings, standards } = useApp()
  const ids = pc.students.map((s) => s.id).join(',')
  const all = useLiveQuery(
    () => (cls && ids ? loadClassPaps(db, settings.schoolYear, cls.grade, cls.classNo, ids.split(','), 'all') : Promise.resolve(null)),
    [settings.schoolYear, cls?.grade, cls?.classNo, ids],
  )
  return useMemo(() => {
    if (all === undefined) return undefined
    const by = groupByStudentRound(all?.results ?? [], EXCLUDED_KEY)
    const out = new Map<string, (StudentPaps | null)[]>()
    for (const s of pc.students) {
      out.set(
        s.id,
        pc.rounds.rounds.map((r) => {
          const rows = by.get(s.id)?.get(r.id)
          if (!rows?.length) return null
          const { values } = indexResults(rows)
          return studentSummary(standards, s, settings.schoolLevel, pc.selected, values.get(s.id), settings.papsFlexMode)
        }),
      )
    }
    return out
  }, [all, pc.students, pc.rounds.rounds, pc.selected, standards, settings.schoolLevel, settings.papsFlexMode])
}

/** 회차별 비교 표: 회차마다 종합점수·등급, 마지막 두 회차 사이 변화 */
export default function RoundCompare({ cls, pc }: { cls: ClassKey | null; pc: PapsClassView }) {
  const sums = useRoundSummaries(cls, pc)
  const rounds = pc.rounds.rounds
  if (rounds.length < 2 || !sums) return null
  const cell = (p: StudentPaps | null) => {
    if (!p) return <span className="text-ink-3">—</span>
    if (!p.complete) return <span className="text-caution">미완료 {p.sum}</span>
    return (
      <span className="font-bold">
        {p.total}점 <span className="text-ink-3">{p.grade}등급</span>
      </span>
    )
  }
  return (
    <section className="card space-y-2">
      <p className="card-title">회차별 비교</p>
      <p className="hint">회차마다 종합점수(100점 만점)와 종합등급이에요. 변화는 다 측정한 마지막 두 회차를 비교해요.</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-left text-[0.9rem]">
          <thead className="bg-fill text-sm">
            <tr>
              <th className="p-2 whitespace-nowrap">학생</th>
              {rounds.map((r) => (
                <th key={r.id ?? 'first'} className="p-2 whitespace-nowrap">
                  {roundLabel(r)}
                </th>
              ))}
              <th className="p-2 whitespace-nowrap">변화</th>
            </tr>
          </thead>
          <tbody>
            {pc.students.map((s) => {
              const list = sums.get(s.id) ?? []
              const ch = pc.excluded.has(s.id) ? null : lastChange(list.map((p) => (p?.complete ? p.total : null)))
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="p-2 whitespace-nowrap">
                    <span className="tabular-nums">{s.number}</span> {s.name}
                  </td>
                  {list.map((p, i) => (
                    <td key={i} className="p-2 whitespace-nowrap tabular-nums">
                      {pc.excluded.has(s.id) ? <span className="text-ink-3">제외</span> : cell(p)}
                    </td>
                  ))}
                  <td className={`p-2 font-extrabold whitespace-nowrap tabular-nums ${ch === null ? 'text-ink-3' : ch > 0 ? 'text-ok' : ch < 0 ? 'text-danger' : 'text-ink-2'}`}>
                    {ch === null ? '—' : ch > 0 ? `▲ ${ch}` : ch < 0 ? `▼ ${-ch}` : '0'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
