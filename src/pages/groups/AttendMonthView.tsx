import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { setAttendance } from '../../db/attendanceRepo'
import { db } from '../../db/db'
import type { AttendStatus, Student } from '../../db/types'
import { ATTEND_LABEL, ATTEND_ORDER, attendByDay, attendTally, emptyTally, isMissing, nextStatus } from '../../lib/attendance'
import { todayStr } from '../../lib/dates'
import { ledgerColumns, shiftMonth, weekSpans } from '../../lib/ledger'
import { useApp } from '../../state/AppContext'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const SHORT: Record<AttendStatus, string> = { absent: '결', late: '지', early: '조', result: '과' }
const TONE: Record<AttendStatus, string> = {
  absent: 'bg-danger text-white',
  result: 'bg-danger-light text-danger',
  early: 'bg-caution-light text-ink',
  late: 'bg-caution-light text-ink',
}

/**
 * 월간 출결표 (2026-11-12 교사 요청 '출결도 일간 · 월간 골라 보기'): 세로 = 학생, 가로 = 이 달 수업일.
 * 빈칸 = 출석. 칸을 누를 때마다 결석 → 지각 → 조퇴 → 결과 → 출석(일간 카드와 같은 순서).
 * 오른쪽에 학생별 이 달 합계, 맨 아래에 날짜별 출석 아닌 학생 수. 사유는 일간 보기에서만(건강 정보).
 */
export default function AttendMonthView({ groupId, students, numberOf, readOnly }: { groupId: string; students: readonly Student[]; numberOf: (s: Student) => string; readOnly?: boolean }) {
  const { settings } = useApp()
  const today = todayStr()
  const [month, setMonth] = useState(today.slice(0, 7))
  const rows = useLiveQuery(() => db.attendance.where('groupId').equals(groupId).filter((x) => x.date.startsWith(month)).toArray(), [groupId, month])
  const weekdays = useMemo(() => new Set(settings.timetable.filter((x) => x.groupId === groupId).map((x) => x.day % 7)), [settings.timetable, groupId])
  const cols = useMemo(() => ledgerColumns(month, weekdays, (rows ?? []).map((r) => r.date)), [month, weekdays, rows])
  const spans = weekSpans(cols)
  const { cell, perDay } = useMemo(() => attendByDay(rows ?? []), [rows])
  const tally = useMemo(() => attendTally([...cell.values()]), [cell])
  const total = [...tally.values()].reduce((t, x) => ({ absent: t.absent + x.absent, late: t.late + x.late, early: t.early + x.early, result: t.result + x.result }), emptyTally())
  const [y, m] = month.split('-')

  const tap = (s: Student, date: string) => {
    if (readOnly) return
    const cur = cell.get(`${s.id}|${date}`)
    void setAttendance(db, { schoolYear: settings.schoolYear, groupId, studentId: s.id, date, period: cur?.period }, nextStatus(cur?.status))
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-2" aria-label="앞 달" onClick={() => setMonth(shiftMonth(month, -1))}>
          <Icon name="chevronLeft" size={20} />
        </button>
        <b className="min-w-[7.5rem] text-center text-[1.2rem] font-black tracking-tight tabular-nums">
          {y}년 {Number(m)}월
        </b>
        <button type="button" className="btn btn-ghost h-11 min-h-0 min-w-11 px-2" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
          <Icon name="chevronRight" size={20} />
        </button>
        {month !== today.slice(0, 7) && (
          <button type="button" className="rounded-full bg-fill px-3 py-1.5 text-sm font-bold text-ink-2" onClick={() => setMonth(today.slice(0, 7))}>
            이번 달
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center" aria-label="이 달 출결 합계">
        {ATTEND_ORDER.map((st) => (
          <div key={st} className="rounded-2xl bg-white py-2 shadow-[var(--shadow-card)]">
            <p className={`text-xl font-extrabold tabular-nums ${isMissing(st) ? 'text-danger' : 'text-caution'}`}>{total[st]}</p>
            <p className="text-[0.75rem] font-bold text-ink-3">{ATTEND_LABEL[st]}</p>
          </div>
        ))}
      </div>

      <p className="rounded-xl bg-fill px-3 py-2 text-sm font-bold text-ink-2">
        빈칸은 출석이에요. 칸을 누를 때마다 <span className="text-danger">결</span>석 → <span>지</span>각 → <span>조</span>퇴 → 결<span className="text-danger">과</span> → 출석
      </p>

      {cols.length === 0 ? (
        <p className="card text-center font-bold text-ink-3">이 달에는 수업일이 없어요. 시간표에 이 반을 넣으면 수업 요일이 칸으로 나와요.</p>
      ) : (
        <div className="card max-h-[calc(100dvh-13rem)] overflow-auto p-0 lg:max-h-[calc(100dvh-16rem)]">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-20 bg-fill text-ink-2">
                <th rowSpan={2} className="sticky left-0 z-30 w-11 min-w-11 border-r border-b border-line bg-fill px-1 py-1.5 font-bold whitespace-nowrap">
                  번호
                </th>
                <th rowSpan={2} className="sticky left-11 z-30 min-w-[4.5rem] border-r border-b border-line bg-fill px-2 py-1.5 text-left font-bold">
                  이름
                </th>
                {spans.map((w, i) => (
                  <th key={`${w.week}-${i}`} colSpan={w.span} className="border-r border-b border-line px-1 py-1 text-xs font-extrabold">
                    {w.week}주
                  </th>
                ))}
                <th colSpan={4} className="border-b border-line px-2 py-1 text-xs font-extrabold">
                  이 달 합계
                </th>
              </tr>
              <tr className="sticky top-[2.05rem] z-20 bg-fill text-ink-2">
                {cols.map((c) => (
                  <th key={c.date} className={`min-w-[2.75rem] border-r border-b border-line px-1 py-1 text-xs font-bold ${c.date === today ? 'bg-brand text-white' : ''}`}>
                    {c.day}
                    <span className="block text-[0.65rem] font-semibold opacity-80">{WD[c.weekday]}</span>
                  </th>
                ))}
                {ATTEND_ORDER.map((st) => (
                  <th key={st} className="min-w-[2.2rem] border-b border-line px-1 py-1 text-xs font-bold">
                    {SHORT[st]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const t = tally.get(s.id)
                return (
                  <tr key={s.id} className="odd:bg-white even:bg-[#fafbfc]">
                    <td className="sticky left-0 z-10 w-11 min-w-11 border-r border-b border-line bg-inherit px-1 text-center font-extrabold tabular-nums">{numberOf(s)}</td>
                    <td className="sticky left-11 z-10 max-w-[6rem] truncate border-r border-b border-line bg-inherit px-2 font-bold">{s.name}</td>
                    {cols.map((c) => {
                      const st = cell.get(`${s.id}|${c.date}`)?.status
                      return (
                        <td key={c.date} className={`border-r border-b border-line p-0 ${c.date === today ? 'bg-brand-light/60' : ''}`}>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => tap(s, c.date)}
                            aria-label={`${s.name} ${c.day}일 ${st ? ATTEND_LABEL[st] : '출석'}`}
                            className="grid h-11 w-full min-w-[2.75rem] place-items-center"
                          >
                            {st && <span className={`grid h-7 w-7 place-items-center rounded-lg text-[0.86rem] font-black ${TONE[st]}`}>{SHORT[st]}</span>}
                          </button>
                        </td>
                      )
                    })}
                    {ATTEND_ORDER.map((st) => (
                      <td key={st} className={`border-b border-line px-1 text-center font-extrabold tabular-nums ${t?.[st] ? (isMissing(st) ? 'text-danger' : 'text-ink') : 'text-ink-3/40'}`}>
                        {t?.[st] ?? 0}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="sticky bottom-0 z-20 bg-fill text-ink-2">
                <td colSpan={2} className="sticky left-0 z-30 border-r border-line bg-fill px-2 py-1.5 text-xs font-extrabold">
                  출석 아닌 학생
                </td>
                {cols.map((c) => (
                  <td key={c.date} className="border-r border-line text-center text-xs font-extrabold tabular-nums">
                    {perDay.get(c.date) ?? ''}
                  </td>
                ))}
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
