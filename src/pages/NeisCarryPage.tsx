import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { setNeisCarried } from '../db/attendanceRepo'
import { ATTEND_LABEL, isMissing } from '../lib/attendance'
import { copyText } from '../lib/download'
import { memberNo } from '../lib/groups'
import { carryDateLabel, carryDays, carrySummary, carryText, type CarryDay } from '../lib/neisCarry'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/**
 * 나이스에 옮길 출결 (2026-11-11). 수업 출결 중 아직 나이스에 안 옮긴 것만 날짜 · 수업반별로 모아
 * 복사하고 [옮겼어요]로 표시한다. 앱이 나이스에 넣어 주지는 않는다(화면 자동 입력 없음).
 */
export default function NeisCarryPage() {
  const { settings, readOnly } = useApp()
  const { groups, membersOf } = useGroups()
  const rows = useLiveQuery(() => db.attendance.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const [showDone, setShowDone] = useState(false)
  const [withReason, setWithReason] = useState(false)
  const [copied, setCopied] = useState('')

  const who = useMemo(() => {
    const m = new Map<string, { no: string; name: string }>()
    for (const g of groups ?? []) for (const s of membersOf(g)) m.set(`${g.id}|${s.id}`, { no: memberNo(g, s), name: s.name })
    return (studentId: string, groupId: string) => m.get(`${groupId}|${studentId}`)
  }, [groups, membersOf])
  const days = useMemo(() => carryDays(rows ?? [], groups ?? [], who, showDone), [rows, groups, who, showDone])
  const total = days.reduce((n, d) => n + d.rows.length, 0)

  const copy = async (d: CarryDay) => {
    const key = `${d.date}|${d.groupId}`
    setCopied((await copyText(carryText(d, withReason))) ? key : '')
  }

  return (
    <>
      <PageHeader title="나이스에 옮길 출결" sub="수업 출결" back />
      <div className="page space-y-3 pb-10">
        <p className="hint px-1">
          수업 출결 가운데 아직 나이스에 안 옮긴 것만 모았어요. 나이스에 넣은 뒤 [옮겼어요]를 누르면 여기서 빠져요. 앱이 나이스에 대신 넣지는 않아요.
        </p>
        <div className="segment" role="tablist">
          <button type="button" role="tab" aria-selected={!showDone} onClick={() => setShowDone(false)}>
            안 옮긴 것
          </button>
          <button type="button" role="tab" aria-selected={showDone} onClick={() => setShowDone(true)}>
            옮긴 것
          </button>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 px-1 text-sm font-bold text-ink-2">
          <input type="checkbox" className="h-5 w-5" checked={withReason} onChange={(e) => setWithReason(e.target.checked)} />
          사유도 보기 · 복사 (건강 정보일 수 있어요)
        </label>

        {rows && groups && days.length === 0 && (
          <div className="card text-center">
            <p className="font-extrabold">{showDone ? '옮겼다고 표시한 출결이 없어요' : '나이스에 옮길 출결이 없어요 👍'}</p>
            <p className="hint mt-1">결석 · 지각 · 조퇴 · 결과는 수업반 보드의 [출결]이나 [기록표]에서 남겨요.</p>
            <Link to="/groups" className="btn btn-soft mt-3">
              수업반으로
            </Link>
          </div>
        )}
        {days.length > 0 && (
          <p className="px-1 text-sm font-bold text-ink-2">
            {days.length}묶음 · {total}건{showDone ? '' : ' — 오래된 날부터'}
          </p>
        )}

        {days.map((d) => {
          const key = `${d.date}|${d.groupId}`
          return (
            <section key={key} className="card space-y-2">
              <div className="flex items-baseline gap-2">
                <b className="text-lg">{carryDateLabel(d.date)}</b>
                <Link to={`/groups/${d.groupId}`} className="min-w-0 flex-1 truncate font-bold text-brand">
                  {d.groupName}
                </Link>
                <span className="hint shrink-0">{carrySummary(d)}</span>
              </div>
              <ul className="space-y-1">
                {d.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2">
                    <span className="w-12 shrink-0 text-sm font-bold text-ink-3">{r.period ? `${r.period}교시` : ''}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {r.no} {r.name}
                    </span>
                    <span className={`shrink-0 font-extrabold ${isMissing(r.status) ? 'text-danger' : 'text-caution'}`}>
                      {ATTEND_LABEL[r.status]}
                      {withReason && r.reason ? <span className="ml-1 text-sm font-bold text-ink-2">({r.reason})</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => void copy(d)}>
                  {copied === key ? '복사했어요' : '복사'}
                </button>
                <button type="button" className={`btn flex-1 ${showDone ? 'btn-soft' : 'btn-primary'}`} disabled={readOnly} onClick={() => void setNeisCarried(db, d.rows.map((r) => r.id), !showDone)}>
                  {showDone ? '다시 안 옮긴 것으로' : '옮겼어요'}
                </button>
              </div>
            </section>
          )
        })}

        <p className="hint px-1">
          출결을 고치면(상태 · 사유) 그 줄은 다시 ‘안 옮긴 것’으로 돌아와요. 나이스 과목별 출결은 교과 선생님이, 일일 출결은 담임 선생님이 넣어요.
        </p>
      </div>
    </>
  )
}
