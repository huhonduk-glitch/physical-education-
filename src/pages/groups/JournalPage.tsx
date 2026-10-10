import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import DateBar from '../../components/DateBar'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { saveLesson } from '../../db/lessonsRepo'
import { longDateLabel, shortDateLabel, todayStr } from '../../lib/dates'
import { saveXlsx } from '../../lib/download'
import { countsByDate, journalRows, previousLesson, unitSuggestions } from '../../lib/lessons'
import { classForNow } from '../../lib/timetable'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 수업 일지: 수업반 · 날짜마다 단원 · 한 일 · 다음 시간 메모. 그날 누가기록 수는 저절로 붙는다 */
export default function JournalPage() {
  const { id = '' } = useParams()
  const { settings, readOnly } = useApp()
  const [sp, setSp] = useSearchParams()
  const date = sp.get('d') ?? todayStr()
  const setDate = (d: string) => setSp((p) => (p.set('d', d), p), { replace: true })
  const { groups, membersOf } = useGroups(true)
  const group = groups?.find((g) => g.id === id)
  const memberCount = useMemo(() => (group ? membersOf(group).length : 0), [group, membersOf])

  const data = useLiveQuery(async () => {
    const [lessons, records, absences] = await Promise.all([
      db.lessons.where('groupId').equals(id).toArray(),
      db.records.where('groupId').equals(id).toArray(),
      db.absences.where('groupId').equals(id).toArray(),
    ])
    return { lessons, counts: countsByDate(records, absences) }
  }, [id])
  const lessons = useMemo(() => data?.lessons ?? [], [data])
  const current = lessons.find((l) => l.date === date)
  const prev = previousLesson(lessons, date)
  const units = useMemo(() => unitSuggestions(lessons), [lessons])
  const marked = useMemo(() => new Set(lessons.map((l) => l.date)), [lessons])
  const dayCount = data?.counts.get(date)

  const nowPeriod = date === todayStr() ? classForNow(new Date(), settings.timetable, settings.periodStarts, settings.periodMinutes) : null
  const [form, setForm] = useState({ period: '', unit: '', activity: '', note: '' })
  const [msg, setMsg] = useState('')
  // 날짜를 바꾸거나 저장된 내용이 바뀌면 칸을 다시 채운다
  const loadedKey = `${date}|${current?.updatedAt ?? 'none'}|${data ? 1 : 0}`
  useEffect(() => {
    setForm({
      period: current?.period ? String(current.period) : nowPeriod?.groupId === id ? String(nowPeriod.period) : '',
      unit: current?.unit ?? (current ? '' : (prev?.unit ?? '')),
      activity: current?.activity ?? '',
      note: current?.note ?? '',
    })
  }, [loadedKey])
  useEffect(() => setMsg(''), [date]) // 날짜·저장본이 바뀔 때만 (적는 중인 글자는 그대로 둔다)

  const save = async () => {
    if (!group) return
    const r = await saveLesson(db, { schoolYear: group.schoolYear, groupId: id, date }, { period: Number(form.period) || undefined, unit: form.unit, activity: form.activity, note: form.note })
    setMsg(r === 'saved' ? '저장했어요.' : r === 'deleted' ? '비워서 이날 일지를 지웠어요.' : '적은 내용이 없어요.')
  }

  const exportXlsx = async () => {
    if (!group || !data) return
    await saveXlsx(`수업일지_${group.name.replace(/\s+/g, '')}_${settings.schoolYear}.xlsx`, [
      { name: '수업 일지', rows: journalRows(lessons, data.counts, memberCount), widths: [11, 5, 18, 50, 30, 6, 6, 6, 6] },
    ])
  }

  if (groups && !group) return <PageHeader title="수업 일지" back />
  const sorted = [...lessons].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <PageHeader
        title="수업 일지"
        sub={group?.name}
        back
        right={
          <button type="button" className="btn btn-soft" onClick={exportXlsx} disabled={!data || (lessons.length === 0 && (data?.counts.size ?? 0) === 0)}>
            <Icon name="download" /> 엑셀
          </button>
        }
      />
      <div className="page space-y-4 pb-8">
        <DateBar value={date} onChange={setDate} marked={marked} />

        {prev?.note && !current && (
          <section className="rounded-2xl bg-caution-light p-4">
            <p className="text-sm font-bold text-caution">지난 시간({shortDateLabel(prev.date)})에 적은 메모</p>
            <p className="mt-1 font-semibold whitespace-pre-wrap">{prev.note}</p>
          </section>
        )}

        <section className="card space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="card-title">{longDateLabel(date)}</p>
            {current && <span className="badge bg-ok-light text-ok">적어 둠</span>}
          </div>
          <div className="flex gap-2">
            <label className="block w-24 shrink-0">
              <span className="label">교시</span>
              <select className="field" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} disabled={readOnly}>
                <option value="">-</option>
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}교시
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 flex-1">
              <span className="label">단원 · 주제</span>
              <input className="field" list="journal-units" value={form.unit} placeholder="예: 농구 - 패스와 드리블" onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={readOnly} />
              <datalist id="journal-units">
                {units.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="block">
            <span className="label">한 일</span>
            <textarea className="field min-h-[96px] py-3" value={form.activity} placeholder="예: 준비운동 → 체스트 패스 2인 1조 → 3:3 미니게임" onChange={(e) => setForm({ ...form, activity: e.target.value })} disabled={readOnly} />
          </label>
          <label className="block">
            <span className="label">다음 시간 · 준비물 · 메모</span>
            <textarea className="field min-h-[72px] py-3" value={form.note} placeholder="예: 다음 시간 레이업 수행평가, 조끼 챙기기" onChange={(e) => setForm({ ...form, note: e.target.value })} disabled={readOnly} />
          </label>
          <div className="grid grid-cols-4 gap-2 text-center" aria-label="이날 기록">
            {[
              { l: '참여', n: Math.max(0, memberCount - (dayCount?.absent ?? 0)), c: 'text-ink' },
              { l: '견학', n: dayCount?.absent ?? 0, c: 'text-ink-3' },
              { l: '칭찬', n: dayCount?.exemplary ?? 0, c: 'text-brand' },
              { l: '지도', n: dayCount?.unprepared ?? 0, c: 'text-danger' },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-fill py-2">
                <p className={`text-xl font-extrabold tabular-nums ${x.c}`}>{x.n}</p>
                <p className="text-[0.75rem] font-bold text-ink-3">{x.l}</p>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={save} disabled={readOnly}>
            저장
          </button>
          {msg && (
            <p className="font-bold text-ok" role="status">
              {msg}
            </p>
          )}
        </section>

        {sorted.length > 0 && (
          <section className="card overflow-hidden p-0">
            <p className="card-title px-5 pt-4 pb-2">지난 일지 {sorted.length}개</p>
            <ul>
              {sorted.map((l) => (
                <li key={l.id}>
                  <button type="button" className={`list-row w-full text-left hover:bg-fill ${l.date === date ? 'bg-brand-light' : ''}`} onClick={() => setDate(l.date)}>
                    <span className="w-16 shrink-0 font-bold text-ink-2 tabular-nums">{shortDateLabel(l.date)}</span>
                    <span className="min-w-0 flex-1">
                      {l.unit && <b className="block truncate">{l.unit}</b>}
                      <span className="hint block truncate">{l.activity || l.note}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}
