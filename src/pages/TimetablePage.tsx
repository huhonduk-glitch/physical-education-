import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { setTimetableCell } from '../lib/timetable'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const DAYS = ['월', '화', '수', '목', '금']

/** 수업 시간표 (CLAUDE.md 4-12): 요일·교시별 수업반. 홈에 오늘 수업이 뜨고, 지금 교시 반이 맨 위에 온다 */
export default function TimetablePage() {
  const { settings, updateSettings } = useApp()
  const { groups } = useGroups()
  const periods = settings.periodStarts.length

  const cell = (day: number, period: number) => settings.timetable.find((t) => t.day === day && t.period === period)
  const setCell = (day: number, period: number, v: string) => {
    updateSettings({ timetable: setTimetableCell(settings.timetable, day, period, v || null) })
  }
  const setStart = (i: number, v: string) => {
    const l = [...settings.periodStarts]
    l[i] = v
    updateSettings({ periodStarts: l })
  }

  return (
    <>
      <PageHeader title="수업 시간표" back />
      <div className="page space-y-4 py-4">
        <p className="hint">수업반을 넣어 두면 홈에 오늘 수업이 뜨고, 지금 교시의 반을 바로 열 수 있어요. 수업 시작 10분 전부터 그 교시로 봐요.</p>
        <Link to="/more/settings/neis" className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-ok-light px-4 font-bold text-ok">
          <span className="flex-1">나이스 시간표에서 내 체육 수업 불러오기</span>
          <span aria-hidden>›</span>
        </Link>
        {groups?.length === 0 && (
          <p className="card">
            먼저 수업반을 만들어 주세요.{' '}
            <Link to="/groups" className="font-bold text-brand underline">
              수업반 만들기
            </Link>
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-center">
            <thead className="bg-fill">
              <tr>
                <th className="p-1 text-sm">교시</th>
                {DAYS.map((d) => (
                  <th key={d} className="p-1">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                <tr key={p} className="border-t-2 border-line">
                  <th className="p-1 text-sm">{p}</th>
                  {DAYS.map((d, di) => {
                    const c = cell(di + 1, p)
                    return (
                      <td key={d} className="p-0.5">
                        <select
                          aria-label={`${d}요일 ${p}교시`}
                          className={`field min-w-[4.2rem] px-0.5 text-center text-sm ${c ? 'border-brand bg-brand-light font-bold' : ''}`}
                          value={c?.groupId ?? ''}
                          onChange={(e) => setCell(di + 1, p, e.target.value)}
                        >
                          <option value="">—</option>
                          {(groups ?? []).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="card space-y-3">
          <h2 className="text-lg font-extrabold">교시 시작 시각</h2>
          <p className="hint">학교 종 시간에 맞게 고쳐 주세요.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {settings.periodStarts.map((t, i) => (
              <label key={i} className="block">
                <span className="label">{i + 1}교시</span>
                <input type="time" className="field" value={t} onChange={(e) => setStart(i, e.target.value)} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="label">한 교시 길이(분)</span>
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={120}
                className="field w-28"
                value={settings.periodMinutes}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (n >= 30 && n <= 120) updateSettings({ periodMinutes: n })
                }}
              />
            </label>
            <button type="button" className="btn btn-outline" disabled={periods >= 10} onClick={() => updateSettings({ periodStarts: [...settings.periodStarts, '16:50'] })}>
              교시 추가
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={periods <= 1}
              onClick={() =>
                updateSettings({
                  periodStarts: settings.periodStarts.slice(0, -1),
                  timetable: settings.timetable.filter((t) => t.period < periods),
                })
              }
            >
              마지막 교시 빼기
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
