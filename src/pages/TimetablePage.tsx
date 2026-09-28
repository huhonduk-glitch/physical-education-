import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { classesOf } from '../components/ClassPicker'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { setTimetableCell } from '../lib/timetable'
import { useApp } from '../state/AppContext'

const DAYS = ['월', '화', '수', '목', '금']

/** 수업 시간표 (CLAUDE.md 4-12): 요일·교시별 담당 반. 수업 탭이 지금 교시의 반을 자동으로 고른다 */
export default function TimetablePage() {
  const { settings, updateSettings } = useApp()
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const periods = settings.periodStarts.length

  const cell = (day: number, period: number) => settings.timetable.find((t) => t.day === day && t.period === period)
  const setCell = (day: number, period: number, v: string) => {
    const [g, c] = v.split('-').map(Number)
    updateSettings({ timetable: setTimetableCell(settings.timetable, day, period, v ? { grade: g, classNo: c } : null) })
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
        <p className="hint">담당 반을 넣어 두면 [수업] 탭을 열 때 지금 교시의 반이 자동으로 골라져요. 수업 시작 10분 전부터 그 교시로 봐요.</p>
        {classes.length === 0 && <p className="card">먼저 학생 명렬을 올려야 반을 고를 수 있어요.</p>}

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
                          className={`field min-w-[3.6rem] px-0.5 text-center ${c ? 'border-brand bg-brand-light font-bold' : ''}`}
                          value={c ? `${c.grade}-${c.classNo}` : ''}
                          onChange={(e) => setCell(di + 1, p, e.target.value)}
                        >
                          <option value="">—</option>
                          {classes.map((k) => (
                            <option key={`${k.grade}-${k.classNo}`} value={`${k.grade}-${k.classNo}`}>
                              {k.grade}-{k.classNo}
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
