import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import { setAttendance } from '../../db/attendanceRepo'
import { toggleCheck } from '../../db/recordsRepo'
import { checkItems, type CheckItem } from '../../lib/checkBoard'
import type { Student } from '../../db/types'
import { todayStr } from '../../lib/dates'
import { creditRisk } from '../../lib/attendance'
import { ledgerCells, ledgerColumns, ledgerTotals, shiftMonth, weekSpans, type AttendMark } from '../../lib/ledger'
import { useApp } from '../../state/AppContext'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const ATT_NAME: Record<AttendMark, string> = { absent: '결석', late: '지각', early: '조퇴', result: '결과' }
const ATT: Record<AttendMark, { t: string; c: string }> = {
  absent: { t: '결', c: 'bg-danger text-white' },
  result: { t: '과', c: 'bg-danger-light text-danger' },
  early: { t: '조', c: 'bg-caution-light text-ink' },
  late: { t: '지', c: 'bg-caution-light text-ink' },
}

/** 입력 도구: 아무것도 안 고르면 칸을 눌러 기록 창, 고르면 칸을 누를 때마다 바로 넣기 · 빼기 */
type Tool = { kind: 'attend'; status: AttendMark } | { kind: 'check'; item: CheckItem } | null

/**
 * 누가 기록표 (2026-11-05 교사 요청 — 나이스 출결 화면처럼): 세로 = 학생 명렬, 가로 = 이 달 수업일(주차로 묶음).
 * 위 입력 도구에서 결석 · 지각 · 칭찬 항목 등을 고르고 칸을 누르면 바로 기록된다(다시 누르면 지움) — 나이스 출결 입력과 같은 방식.
 * 도구를 안 고르면 칸을 눌러 그 학생 · 그 날짜의 기록 창을 연다. 칸에는 ★칭찬 수 · ▲지도 수 · 견학 · 출결 글자.
 */
export default function LedgerView({
  groupId,
  students,
  numberOf,
  onCell,
  readOnly,
}: {
  groupId: string
  students: readonly Student[]
  numberOf: (s: Student) => string
  onCell: (s: Student, date: string) => void
  readOnly?: boolean
}) {
  const { settings } = useApp()
  const [tool, setTool] = useState<Tool>(null)
  const tools = useMemo(() => checkItems(settings.recordButtons), [settings.recordButtons])
  const praiseTools = tools.filter((t) => t.type === 'exemplary')
  const guideTools = tools.filter((t) => t.type === 'unprepared')
  const today = todayStr()
  // 고교학점제 출석률 2/3 (누적 기록 화면과 같은 셈): 학년도 전체 결석 · 결과(인정 제외) / 수업 횟수(진도표 목표 차시, 없으면 기록한 날 수)
  const year = useLiveQuery(async () => {
    const [att, recs, plans] = await Promise.all([
      db.attendance.where('groupId').equals(groupId).filter((x) => x.schoolYear === settings.schoolYear).toArray(),
      db.records.where('groupId').equals(groupId).filter((x) => x.schoolYear === settings.schoolYear).toArray(),
      db.progressPlans.where('groupIds').equals(groupId).toArray(),
    ])
    const missing = new Map<string, number>()
    for (const x of att) if ((x.status === 'absent' || x.status === 'result') && x.reason !== '인정') missing.set(x.studentId, (missing.get(x.studentId) ?? 0) + 1)
    const target = plans.reduce((m, p) => Math.max(m, p.target || 0), 0)
    const held = target || new Set([...att, ...recs].map((x) => x.date)).size
    return { missing, held }
  }, [groupId, settings.schoolYear])
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

  const tap = (s: Student, date: string) => {
    if (!tool || readOnly) return onCell(s, date)
    if (tool.kind === 'check') {
      void toggleCheck(db, { schoolYear: settings.schoolYear, groupId, studentId: s.id, date, type: tool.item.type, category: tool.item.label })
      return
    }
    // 그 학생 · 그날 출결 줄이 이미 있으면 그 교시 줄을 고친다 (같은 상태면 지우기 = 출석)
    const cur = (data?.t ?? []).find((x) => x.studentId === s.id && x.date === date)
    const next = cur?.status === tool.status ? null : tool.status
    void setAttendance(db, { schoolYear: settings.schoolYear, groupId, studentId: s.id, date, period: cur?.period }, next)
  }
  const chip = (on: boolean, cls: string) => `chip min-h-[40px] shrink-0 px-3 text-sm ${on ? cls : ''}`
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

      {!readOnly && (
        <div className="card space-y-2 p-3">
          <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            <span className="sticky left-0 w-12 shrink-0 bg-white text-xs font-extrabold text-ink-3">입력</span>
            <button type="button" className={chip(!tool, 'bg-ink text-white')} aria-pressed={!tool} onClick={() => setTool(null)}>
              칸 눌러 기록 창
            </button>
          </div>
          <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            <span className="sticky left-0 w-12 shrink-0 bg-white text-xs font-extrabold text-ink-3">출결</span>
            {(['absent', 'late', 'early', 'result'] as AttendMark[]).map((st) => {
              const on = tool?.kind === 'attend' && tool.status === st
              return (
                <button key={st} type="button" className={chip(on, 'bg-danger text-white')} aria-pressed={on} onClick={() => setTool(on ? null : { kind: 'attend', status: st })}>
                  {ATT_NAME[st]}
                </button>
              )
            })}
          </div>
          {praiseTools.length > 0 && (
            <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              <span className="sticky left-0 w-12 shrink-0 bg-white text-xs font-extrabold text-brand">★ 칭찬</span>
              {praiseTools.map((it) => {
                const on = tool?.kind === 'check' && tool.item.key === it.key
                return (
                  <button key={it.key} type="button" className={chip(on, 'bg-brand text-white')} aria-pressed={on} onClick={() => setTool(on ? null : { kind: 'check', item: it })}>
                    {it.label}
                  </button>
                )
              })}
            </div>
          )}
          {guideTools.length > 0 && (
            <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              <span className="sticky left-0 w-12 shrink-0 bg-white text-xs font-extrabold text-danger">▲ 지도</span>
              {guideTools.map((it) => {
                const on = tool?.kind === 'check' && tool.item.key === it.key
                return (
                  <button key={it.key} type="button" className={chip(on, 'bg-danger text-white')} aria-pressed={on} onClick={() => setTool(on ? null : { kind: 'check', item: it })}>
                    {it.label}
                  </button>
                )
              })}
            </div>
          )}
          <p className={`rounded-xl px-3 py-2 text-sm font-bold ${tool ? 'bg-brand-light text-brand' : 'bg-fill text-ink-2'}`}>
            {!tool
              ? '항목을 고르면 칸을 누를 때마다 바로 기록돼요. 안 고르면 칸을 눌러 기록 창.'
              : `‘${tool.kind === 'attend' ? ATT_NAME[tool.status] : tool.item.label}’ 입력 중 — 칸을 누르면 넣고, 다시 누르면 빼요`}
          </p>
        </div>
      )}

      <div className="card max-h-[calc(100dvh-13rem)] overflow-auto p-0 lg:max-h-[calc(100dvh-16rem)]">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-20 bg-fill text-ink-2">
              <th rowSpan={2} className="sticky left-0 z-30 w-10 border-r border-b border-line bg-fill px-2 py-1.5 font-bold">
                번호
              </th>
              <th rowSpan={2} className="sticky left-10 z-30 min-w-[4.5rem] border-r border-b border-line bg-fill px-2 py-1.5 text-left font-bold">
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
            <tr className="sticky top-[2.05rem] z-20 bg-fill text-ink-2">
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
                  <td className={`sticky left-10 z-[1] border-r border-b border-line px-2 py-1 font-bold whitespace-nowrap ${zebra === 'bg-white' ? 'bg-white' : 'bg-[#f7f8fa]'}`}>
                    {s.name}
                    {(() => {
                      const risk = year ? creditRisk(year.missing.get(s.id) ?? 0, year.held) : 'ok'
                      if (risk === 'ok') return null
                      return (
                        <span
                          className={`ml-1 rounded px-1 text-[0.65rem] font-black ${risk === 'danger' ? 'bg-danger text-white' : 'bg-caution-light text-ink'}`}
                          title={`고교학점제 출석률: 학년도 결석 · 결과 ${year?.missing.get(s.id) ?? 0}번 / 수업 약 ${year?.held}번 (인정 결석 제외) — 담임 확인용 참고`}
                        >
                          {risk === 'danger' ? '미달' : '주의'}
                        </span>
                      )
                    })()}
                  </td>
                  {cols.map((c) => {
                    const x = cells.get(`${s.id}|${c.date}`)
                    return (
                      <td key={c.date} className={`border-r border-b border-line p-0 ${c.date === today ? 'bg-brand-light/60' : ''}`}>
                        <button
                          type="button"
                          className={`flex h-11 w-full min-w-[2.6rem] flex-col items-center justify-center gap-0.5 active:bg-brand-light ${tool ? 'cursor-crosshair hover:bg-brand-light' : 'hover:bg-fill'}`}
                          aria-label={`${s.name} ${c.day}일 기록`}
                          onClick={() => tap(s, c.date)}
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
        <span className="font-bold text-brand">★</span> 칭찬 · <span className="font-bold text-danger">▲</span> 지도 · 견 견학 · 결 결석 · 지 지각 · 조 조퇴 · 과 결과 · 빈칸 = 출석 · 이름 옆 <b>주의</b>/<b className="text-danger">미달</b> = 고교학점제 출석률 2/3(담임 확인용 참고)
      </p>
    </section>
  )
}
