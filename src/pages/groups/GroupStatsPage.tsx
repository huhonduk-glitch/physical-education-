import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { checkItems, checkKey, inRange, PERIOD_LABEL, periodRange, tallyByStudent, type Period } from '../../lib/checkBoard'
import { todayStr } from '../../lib/dates'
import { saveXlsx } from '../../lib/download'
import { memberNo } from '../../lib/groups'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

type SortKey = 'no' | 'plus' | 'minus' | 'absent'

/** 수업반 누적: 학생별 칭찬·지도·견학 합계와 항목별 횟수 (기간 선택 · 엑셀) */
export default function GroupStatsPage() {
  const { id = '' } = useParams()
  const { settings } = useApp()
  const { groups, membersOf } = useGroups(true)
  const group = groups?.find((g) => g.id === id)
  const list = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const [period, setPeriod] = useState<Period>(group?.semester === 1 ? 'sem1' : group?.semester === 2 ? 'sem2' : 'year')
  const [sort, setSort] = useState<SortKey>('no')
  const [from, to] = periodRange(period, settings.schoolYear, todayStr())
  const range = useMemo((): [string, string] => [from, to], [from, to])

  const data = useLiveQuery(async () => {
    const [r, a] = await Promise.all([db.records.where('groupId').equals(id).toArray(), db.absences.where('groupId').equals(id).toArray()])
    return { records: r, absences: a }
  }, [id])
  const tally = useMemo(
    () => tallyByStudent((data?.records ?? []).filter((r) => inRange(r.date, range)), (data?.absences ?? []).filter((a) => inRange(a.date, range))),
    [data, range],
  )
  const days = useMemo(() => new Set((data?.records ?? []).filter((r) => inRange(r.date, range)).map((r) => r.date)).size, [data, range])

  // 표 열: 설정의 체크 항목 + 기간 안에 기록이 있는 예전 항목(이름을 바꾼 항목 등)
  const columns = useMemo(() => {
    const cols = checkItems(settings.recordButtons).map((i) => ({ key: i.key, type: i.type, label: i.label }))
    const have = new Set(cols.map((c) => c.key))
    for (const t of tally.values())
      for (const k of t.byKey.keys()) {
        const [type, label] = k.split('|')
        if (!have.has(k) && (type === 'unprepared' || type === 'exemplary')) {
          have.add(k)
          cols.push({ key: k, type, label })
        }
      }
    return cols
  }, [settings.recordButtons, tally])

  const rows = useMemo(() => {
    const r = list.map((s) => ({ s, t: tally.get(s.id) }))
    const v = (x: (typeof r)[number], k: SortKey) => (k === 'plus' ? x.t?.plus : k === 'minus' ? x.t?.minus : x.t?.absent) ?? 0
    return sort === 'no' ? r : [...r].sort((a, b) => v(b, sort) - v(a, sort))
  }, [list, tally, sort])

  if (!group) return <PageHeader title="누적 기록" back />

  const exportXlsx = () => {
    const head = ['번호', '학번', '이름', '칭찬 합계', '지도 합계', '견학 일수', '관찰 메모', ...columns.map((c) => `${c.type === 'unprepared' ? '지도' : '칭찬'}: ${c.label}`)]
    const body = rows.map(({ s, t }) => [memberNo(group, s), s.studentCode, s.name, t?.plus ?? 0, t?.minus ?? 0, t?.absent ?? 0, t?.notes ?? 0, ...columns.map((c) => t?.byKey.get(c.key) ?? 0)])
    void saveXlsx(`누가기록_${group.name}_${PERIOD_LABEL[period]}.xlsx`, [{ name: '누적', rows: [[`${group.name} · ${PERIOD_LABEL[period]} (${range[0]} ~ ${range[1]})`], head, ...body], widths: [6, 8, 10, 9, 9, 9, 9, ...columns.map(() => 12)] }])
  }

  const head = (k: SortKey, label: string, cls = '') => (
    <th className={`px-2 py-2 text-sm whitespace-nowrap ${cls}`}>
      <button type="button" className={`font-bold ${sort === k ? 'underline' : ''}`} onClick={() => setSort(k)} aria-pressed={sort === k}>
        {label}
        {sort === k && k !== 'no' ? ' ↓' : ''}
      </button>
    </th>
  )

  return (
    <>
      <PageHeader
        title="누적 기록"
        sub={group.name}
        back
        right={
          <button type="button" className="btn btn-soft" onClick={exportXlsx} disabled={list.length === 0}>
            <Icon name="download" size={20} /> 엑셀
          </button>
        }
      />
      <div className="page space-y-3 pb-8">
        <div className="segment" role="tablist" aria-label="기간">
          {(['month', 'sem1', 'sem2', 'year'] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="hint px-1">
          {range[0]} ~ {range[1]} · 기록한 날 {days}일 · 제목을 누르면 많은 순으로 정렬해요. 학생 이름을 누르면 그 학생의 모든 기록을 봐요.
        </p>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-max min-w-full border-separate border-spacing-0 rounded-2xl bg-white text-center shadow-[var(--shadow-card)]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 rounded-tl-2xl bg-white px-2 py-2 text-left text-sm">
                  <button type="button" className={`font-bold ${sort === 'no' ? 'underline' : ''}`} onClick={() => setSort('no')}>
                    학생
                  </button>
                </th>
                {head('plus', '칭찬', 'text-brand')}
                {head('minus', '지도', 'text-danger')}
                {head('absent', '견학', 'text-ink-3')}
                {columns.map((c) => (
                  <th key={c.key} className={`min-w-[56px] px-1 py-2 text-[0.72rem] leading-tight font-bold ${c.type === 'unprepared' ? 'text-danger' : 'text-brand'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, t }) => (
                <tr key={s.id}>
                  <th className="sticky left-0 z-10 border-t border-line bg-white px-2 py-2 text-left text-sm font-semibold whitespace-nowrap">
                    <Link to={`/students/${s.id}`} className="hover:underline">
                      <span className="mr-1 font-extrabold tabular-nums">{memberNo(group, s)}</span>
                      {s.name}
                    </Link>
                  </th>
                  <td className="border-t border-line px-2 font-extrabold text-brand tabular-nums">{t?.plus || ''}</td>
                  <td className="border-t border-line px-2 font-extrabold text-danger tabular-nums">{t?.minus || ''}</td>
                  <td className="border-t border-line px-2 font-bold text-ink-3 tabular-nums">{t?.absent || ''}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="border-t border-line px-1 tabular-nums">
                      {t?.byKey.get(c.key) || ''}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="sticky left-0 z-10 rounded-bl-2xl border-t-2 border-line bg-white px-2 py-2 text-left text-sm text-ink-3">합계</th>
                {(['plus', 'minus', 'absent'] as const).map((k) => (
                  <td key={k} className="border-t-2 border-line px-2 font-extrabold tabular-nums">
                    {rows.reduce((n, r) => n + (r.t?.[k] ?? 0), 0) || ''}
                  </td>
                ))}
                {columns.map((c) => (
                  <td key={c.key} className="border-t-2 border-line px-1 font-bold tabular-nums">
                    {rows.reduce((n, r) => n + (r.t?.byKey.get(checkKey(c.type, c.label)) ?? 0), 0) || ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
