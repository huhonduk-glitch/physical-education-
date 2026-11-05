import { useMemo, useState } from 'react'
import BottomSheet from '../components/BottomSheet'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import ShareSheet from '../components/ShareSheet'
import { todayStr } from '../lib/dates'
import { packCalendar } from '../lib/share'
import { WORK_KIND, dday, eventsOn, monthGrid, upcoming, type WorkEvent, type WorkKind } from '../lib/workCal'
import { useApp } from '../state/AppContext'

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const WD = ['월', '화', '수', '목', '금', '토', '일']
const shift = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 업무 달력 (같이 쓰기 6-13): PAPS 기간 · 나이스 마감 · 대회 · 행사. 이 기기에 저장(settings.workEvents),
 * [보내기]로 같은 학교 선생님께 일정 묶음을 링크 · 파일로 보내고, 받은 쪽은 [받은 자료 넣기]에서 합친다.
 * 나이스 학사일정(불러온 것)은 회색으로 함께 보여 준다.
 */
export default function WorkCalendarPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const today = todayStr()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [edit, setEdit] = useState<WorkEvent | null>(null)
  const [sharing, setSharing] = useState(false)
  const events = settings.workEvents ?? []
  const school = useMemo(() => (settings.neisSchedule?.events ?? []).map((e) => ({ date: e.date, name: e.name })), [settings.neisSchedule])
  const grid = monthGrid(month)
  const soon = upcoming(events, today, 30)
  const [y, m] = month.split('-')

  const save = async (e: WorkEvent) => {
    const i = events.findIndex((x) => x.id === e.id)
    const list = i >= 0 ? events.map((x) => (x.id === e.id ? e : x)) : [...events, e]
    await updateSettings({ workEvents: list.sort((a, b) => a.date.localeCompare(b.date)) })
    setEdit(null)
  }
  const remove = async (e: WorkEvent) => {
    if (!confirm(`'${e.title}' 일정을 지울까요?`)) return
    await updateSettings({ workEvents: events.filter((x) => x.id !== e.id) })
    setEdit(null)
  }

  return (
    <>
      <PageHeader
        title="업무 달력"
        sub="PAPS · 나이스 마감 · 대회 · 행사"
        back
        wide="xl"
        right={
          <>
            <button type="button" className="btn btn-soft" disabled={!events.length} onClick={() => setSharing(true)} aria-label="다른 선생님께 보내기" title="일정 묶음 보내기">
              <Icon name="share" />
            </button>
            <button type="button" className="btn btn-primary" disabled={readOnly} onClick={() => setEdit({ id: newId(), date: today, title: '', kind: 'etc' })}>
              <Icon name="plus" size={18} /> 일정
            </button>
          </>
        }
      />
      <div className="page space-y-4 pb-10 lg:max-w-[72rem]">
        {soon.length > 0 && (
          <section className="card space-y-1 p-0">
            <p className="px-4 pt-3 text-sm font-bold text-ink-3">다가오는 일정 (30일)</p>
            {soon.map((e) => (
              <button key={e.id} type="button" className="list-row min-h-[52px] w-full text-left hover:bg-fill" onClick={() => setEdit(e)}>
                <span className="w-16 shrink-0 font-black tabular-nums" style={{ color: dday(e.date, today) === 'D-Day' ? WORK_KIND.neis.fg : undefined }}>
                  {e.date <= today && (e.end ?? e.date) >= today ? '진행 중' : dday(e.date, today)}
                </span>
                <span className="rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: WORK_KIND[e.kind].bg, color: WORK_KIND[e.kind].fg }}>
                  {WORK_KIND[e.kind].label}
                </span>
                <b className="min-w-0 flex-1 truncate">{e.title}</b>
                <span className="hint shrink-0 tabular-nums">
                  {e.date.slice(5).replace('-', '/')}
                  {e.end && e.end !== e.date ? `~${e.end.slice(5).replace('-', '/')}` : ''}
                </span>
              </button>
            ))}
          </section>
        )}

        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="지난달" onClick={() => setMonth(shift(month, -1))}>
            ◀
          </button>
          <b className="text-lg">
            {y}년 {Number(m)}월
          </b>
          <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="다음 달" onClick={() => setMonth(shift(month, 1))}>
            ▶
          </button>
        </div>
        <section className="card overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line bg-fill text-center text-xs font-bold text-ink-2">
            {WD.map((d, i) => (
              <div key={d} className={`py-1.5 ${i === 5 ? 'text-brand' : i === 6 ? 'text-danger' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((c, ci) => {
                const evs = eventsOn(c.date, events)
                const sch = school.filter((s) => s.date === c.date)
                return (
                  <button
                    key={c.date}
                    type="button"
                    disabled={readOnly}
                    className={`flex min-h-[84px] flex-col gap-0.5 border-r border-line p-1 text-left last:border-r-0 hover:bg-fill md:min-h-[104px] ${c.out ? 'bg-fill/50 opacity-50' : ''}`}
                    onClick={() => setEdit({ id: newId(), date: c.date, title: '', kind: 'etc' })}
                    aria-label={`${c.date} 일정 더하기`}
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${c.date === today ? 'bg-brand text-white' : ci === 6 ? 'text-danger' : ci === 5 ? 'text-brand' : 'text-ink-2'}`}>{c.day}</span>
                    {sch.slice(0, 2).map((s) => (
                      <span key={s.name} className="truncate rounded px-1 text-[0.68rem] font-semibold text-ink-3">
                        {s.name}
                      </span>
                    ))}
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        className="truncate rounded px-1 text-[0.7rem] leading-5 font-bold"
                        style={{ background: WORK_KIND[e.kind].bg, color: WORK_KIND[e.kind].fg }}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setEdit(e)
                        }}
                      >
                        {e.title}
                      </span>
                    ))}
                    {evs.length > 3 && <span className="text-[0.65rem] font-bold text-ink-3">+{evs.length - 3}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </section>
        <p className="hint px-1">날짜를 누르면 일정을 더해요 · 회색 글씨는 나이스에서 불러온 학사일정 · 일정은 이 기기에만 저장되고 [보내기]로 다른 선생님께 묶음을 보낼 수 있어요</p>
      </div>

      {edit && <EventSheet key={edit.id} event={edit} isNew={!events.some((x) => x.id === edit.id)} onSave={save} onRemove={remove} onClose={() => setEdit(null)} />}
      {sharing && <ShareSheet pack={packCalendar(events, `${settings.schoolName || '우리 학교'} 체육 업무 일정 ${events.length}개`)} onClose={() => setSharing(false)} />}
    </>
  )
}

function EventSheet({ event, isNew, onSave, onRemove, onClose }: { event: WorkEvent; isNew: boolean; onSave: (e: WorkEvent) => void; onRemove: (e: WorkEvent) => void; onClose: () => void }) {
  const [e, setE] = useState(event)
  const ok = e.title.trim() && e.date && (!e.end || e.end >= e.date)
  return (
    <BottomSheet title={isNew ? '일정 더하기' : '일정 고치기'} onClose={onClose}>
      <div className="space-y-3 px-5 pb-5">
        <input className="field w-full" placeholder="예: 2학기 PAPS 측정, 나이스 PAPS 입력 마감" value={e.title} autoFocus onChange={(x) => setE({ ...e, title: x.target.value })} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WORK_KIND) as WorkKind[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={e.kind === k} style={e.kind === k ? { background: WORK_KIND[k].fg, color: '#fff' } : undefined} onClick={() => setE({ ...e, kind: k })}>
              {WORK_KIND[k].label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-sm font-bold text-ink-2">날짜</span>
            <input type="date" className="field w-full" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-ink-2">끝날 (여러 날이면)</span>
            <input type="date" className="field w-full" value={e.end ?? ''} min={e.date} onChange={(x) => setE({ ...e, end: x.target.value || undefined })} />
          </label>
        </div>
        <textarea className="field min-h-[72px] w-full" placeholder="메모 (선택) — 학생 이름은 적지 마세요" value={e.memo ?? ''} onChange={(x) => setE({ ...e, memo: x.target.value || undefined })} />
        <button type="button" className="btn btn-primary w-full" disabled={!ok} onClick={() => onSave({ ...e, title: e.title.trim() })}>
          저장
        </button>
        {!isNew && (
          <button type="button" className="btn btn-ghost w-full text-danger" onClick={() => onRemove(e)}>
            <Icon name="trash" size={18} /> 지우기
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
