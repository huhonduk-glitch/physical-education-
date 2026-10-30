import { useState } from 'react'
import type { Attendance, AttendReason, AttendStatus, ClassGroup, Student } from '../../db/types'
import { ATTEND_LABEL, ATTEND_ORDER, ATTEND_REASONS, isMissing } from '../../lib/attendance'
import { memberNo } from '../../lib/groups'

interface Props {
  group: ClassGroup
  list: Student[]
  /** 학생 id → 그날(그 교시) 출결 줄. 없으면 출석 */
  status: Map<string, Attendance>
  absentIds: Set<string>
  period?: number
  readOnly: boolean
  onCycle: (s: Student) => void
  onSet: (s: Student, status: AttendStatus | null) => void
  onReason: (row: Attendance, reason: AttendReason | undefined) => void
}

const tone = (s: AttendStatus | undefined) => (!s ? 'bg-white text-ink shadow-[var(--shadow-card)]' : isMissing(s) ? 'bg-danger text-white' : 'bg-caution-light text-caution ring-2 ring-[var(--color-caution)]')

/** 출결: 모두 출석에서 시작해 카드를 누를 때마다 결석 → 지각 → 조퇴 → 결과 → 출석 */
export function AttendView({ group, list, status, absentIds, period, readOnly, onCycle, onSet, onReason }: Props) {
  const [showReason, setShowReason] = useState(false)
  const marked = list.filter((s) => status.has(s.id))
  const count = (st: AttendStatus) => marked.filter((s) => status.get(s.id)?.status === st).length
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-light px-4 py-2.5 text-[0.95rem] font-bold text-brand">
        모두 출석이에요{period ? ` (${period}교시)` : ''}. 안 온 학생 카드를 누르세요 —{' '}
        <span className="font-semibold opacity-80">누를 때마다 결석 → 지각 → 조퇴 → 결과 → 출석</span>
      </p>
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2 md:grid-cols-7" aria-label="출결">
        {list.map((s) => {
          const st = status.get(s.id)?.status
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-label={`${memberNo(group, s)}번 ${s.name} ${st ? ATTEND_LABEL[st] : '출석'}`}
                disabled={readOnly}
                onClick={() => onCycle(s)}
                className={`relative flex min-h-[66px] w-full flex-col items-center justify-center rounded-2xl px-0.5 pt-1.5 pb-1 transition-[transform,background-color] active:scale-95 ${tone(st)}`}
              >
                <span className={`leading-none font-extrabold tabular-nums ${group.kind === 'elective' ? 'text-[0.95rem]' : 'text-[1.3rem]'}`}>{memberNo(group, s)}</span>
                <span className="mt-1 w-full truncate text-center text-[0.74rem] leading-tight font-semibold">{s.name}</span>
                <span className="mt-0.5 h-4 text-[0.72rem] leading-none font-black">{st ? ATTEND_LABEL[st] : absentIds.has(s.id) ? '견학' : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="grid grid-cols-4 gap-2 text-center" aria-label="출결 요약">
        {ATTEND_ORDER.map((st) => (
          <div key={st} className="rounded-2xl bg-white py-2 shadow-[var(--shadow-card)]">
            <p className={`text-xl font-extrabold tabular-nums ${isMissing(st) ? 'text-danger' : 'text-caution'}`}>{count(st)}</p>
            <p className="text-[0.75rem] font-bold text-ink-3">{ATTEND_LABEL[st]}</p>
          </div>
        ))}
      </div>
      {marked.length > 0 && (
        <section className="card space-y-2">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">출석 아닌 학생 {marked.length}명</p>
            {/* 사유는 건강 정보일 수 있어 눌러야 보인다 (견학과 같은 방식) */}
            <button type="button" className="btn btn-soft text-sm" aria-pressed={showReason} onClick={() => setShowReason((v) => !v)}>
              {showReason ? '사유 가리기' : '사유 보기 · 넣기'}
            </button>
          </div>
          <ul className="space-y-2">
            {marked.map((s) => {
              const row = status.get(s.id)!
              return (
                <li key={s.id} className="space-y-1.5 rounded-2xl bg-fill p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="mr-1 min-w-0 flex-1 truncate">
                      {memberNo(group, s)} {s.name}
                    </b>
                    {ATTEND_ORDER.map((st) => (
                      <button key={st} type="button" className="chip" aria-pressed={row.status === st} disabled={readOnly} onClick={() => onSet(s, st)}>
                        {ATTEND_LABEL[st]}
                      </button>
                    ))}
                    <button type="button" className="chip" disabled={readOnly} onClick={() => onSet(s, null)}>
                      출석
                    </button>
                  </div>
                  {showReason && (
                    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`${s.name} 사유`}>
                      <span className="text-sm font-bold text-ink-3">사유</span>
                      {ATTEND_REASONS.map((r) => (
                        <button key={r} type="button" role="radio" className="chip" aria-checked={row.reason === r} disabled={readOnly} onClick={() => onReason(row, row.reason === r ? undefined : r)}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
