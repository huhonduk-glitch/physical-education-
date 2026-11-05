import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import type { Student } from '../../db/types'
import { todayStr } from '../../lib/dates'
import { ledgerCells, ledgerColumns, ledgerTotals, shiftMonth, weekSpans, type AttendMark } from '../../lib/ledger'
import { useApp } from '../../state/AppContext'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const ATT: Record<AttendMark, { t: string; c: string }> = {
  absent: { t: '결', c: 'bg-danger text-white' },
  result: { t: '과', c: 'bg-danger-light text-danger' },
  early: { t: '조', c: 'bg-caution-light text-ink' },
  late: { t: '지', c: 'bg-caution-light text-ink' },
}

/**
 * 누가 기록표 (2026-11-05 교사 요청 — 나이스 출결 화면처럼): 세로 = 학생 명렬, 가로 = 이 달 수업일(주차로 묶음).
 * 칸을 누르면 그 학생 · 그 날짜로 기록 창이 열린다. 칸에는 ★칭찬 수 · ▲지도 수 · 견학 · 출결 글자.
 */
export default function LedgerView({
  groupId,
  students,
  numberOf,
  onCell,
}: {
  groupId: string
  students: readonly Student[]
  numberOf: (s: Student) => string
  onCell: (s: Student, date: string) => void
}) {
  const { settings } = useApp()
  const today = todayStr()
  const [month, setMonth] = useState(today.slice(0, 7))
  const data = useLiveQuery(async () => {
    const [r, a, t] = await Promise.all([
      db.records.where('groupId').equals(groupId).filter((x) => x.date.startsWith(month)).toArray(),
      db.absences.where('groupId').equals(groupId).filter((x) => x.date.startsWith(month)).toArray(),
      db.attendance.where('groupId').equals(groupId).filter((x) => x.date.startsWith(month)).toArray(),
    ])
    return { r, a, t }
  }, [groupId, month])

  const weekdays = useMemo(() => new Set(settings.timetable.filter((x) => x.groupId === groupId).map((x) => x.day % 7)), [settings.timetable, groupId])
  const cols = useMemo(() => {
    const extra = [...(data?.r ?? []), ...(data?.a ?? []), ...(data?.t ?? [])].map((x) => x.date)
    // 시간표가 없으면 평일 전부
    return ledgerColumns(month, weekdays.size ? weekdays : new Set([1, 2, 3, 4, 5]), extra)
  }, [month, weekdays, data])
  const cells = useMemo(() => ledgerCells(data?.r ?? [], data?.a ?? [], (data?.t ?? []) as { studentId: string; date: string; status: AttendMark }[]), [data])
  const spans = weekSpans(cols)
  const [y, m] = month.split('-')

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="지난달" onClick={() => setMonth(shiftMonth(month, -1))}>
          ◀
        </button>
        <b className="text-lg">
          {y}년 {Number(m)}월 누가 기록표
        </b>
        <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
          ▶
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-fill text-ink-2">
              <th rowSpan={2} className="sticky left-0 z-10 w-10 border-r border-b border-line bg-fill px-2 py-1.5 font-bold">
                번호
              </th>
              <th rowSpan={2} className="sticky left-10 z-10 min-w-[4.5rem] border-r border-b border-line bg-fill px-2 py-1.5 text-left font-bold">
                이름
              </th>
              {spans.map((w, i) => (
                <th key={`${w.week}-${i}`} colSpan={w.span} className="border-r border-b border-line px-1 py-1 text-xs font-extrabold">
                  {w.week}주
                </th>
              ))}
              <th colSpan={3} className="border-b border-line px-2 py-1 text-xs font-extrabold">
                이 달 합계
              </th>
            </tr>
            <tr className="bg-fill text-ink-2">
              {cols.map((c) => (
                <th key={c.date} className={`min-w-[2.6rem] border-r border-b border-line px-1 py-1 text-xs font-bold ${c.date === today ? 'bg-brand text-white' : ''}`}>
                  {c.day}
                  <span className="block text-[0.65rem] font-semibold opacity-80">{WD[c.weekday]}</span>
                </th>
              ))}
              <th className="border-r border-b border-line px-2 text-xs text-brand">칭찬</th>
              <th className="border-r border-b border-line px-2 text-xs text-danger">지도</th>
              <th className="border-b border-line px-2 text-xs">결석</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, si) => {
              const t = ledgerTotals(cells, s.id, cols)
              const zebra = si % 2 ? 'bg-fill/40' : 'bg-white'
              return (
                <tr key={s.id} className={zebra}>
                  <td className={`sticky left-0 z-[1] border-r border-b border-line px-2 py-1 text-center font-bold tabular-nums ${zebra === 'bg-white' ? 'bg-white' : 'bg-[#f7f8fa]'}`}>{numberOf(s)}</td>
                  <td className={`sticky left-10 z-[1] border-r border-b border-line px-2 py-1 font-bold whitespace-nowrap ${zebra === 'bg-white' ? 'bg-white' : 'bg-[#f7f8fa]'}`}>{s.name}</td>
                  {cols.map((c) => {
                    const x = cells.get(`${s.id}|${c.date}`)
                    return (
                      <td key={c.date} className={`border-r border-b border-line p-0 ${c.date === today ? 'bg-brand-light/60' : ''}`}>
                        <button
                          type="button"
                          className="flex h-11 w-full min-w-[2.6rem] flex-col items-center justify-center gap-0.5 hover:bg-brand-light active:bg-brand-light"
                          aria-label={`${s.name} ${c.day}일 기록`}
                          onClick={() => onCell(s, c.date)}
                        >
                          {x?.attend && <span className={`rounded px-1 text-[0.7rem] leading-4 font-black ${ATT[x.attend].c}`}>{ATT[x.attend].t}</span>}
                          {x?.absence && <span className="rounded bg-fill-2 px-1 text-[0.7rem] leading-4 font-bold text-ink-2">견</span>}
                          {(x?.praise || x?.guide) ? (
                            <span className="text-[0.72rem] leading-4 font-black tabular-nums">
                              {x.praise > 0 && <span className="text-brand">★{x.praise > 1 ? x.praise : ''}</span>}
                              {x.guide > 0 && <span className="text-danger">▲{x.guide > 1 ? x.guide : ''}</span>}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    )
                  })}
                  <td className="border-r border-b border-line px-2 text-center font-black text-brand tabular-nums">{t.praise || ''}</td>
                  <td className="border-r border-b border-line px-2 text-center font-black text-danger tabular-nums">{t.guide || ''}</td>
                  <td className="border-b border-line px-2 text-center font-bold tabular-nums">{t.absent || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint px-1">
        <span className="font-bold text-brand">★</span> 칭찬 · <span className="font-bold text-danger">▲</span> 지도 · 견 견학 · 결 결석 · 지 지각 · 조 조퇴 · 과 결과 — 칸을 누르면 그 날짜로 기록해요
      </p>
    </section>
  )
}
