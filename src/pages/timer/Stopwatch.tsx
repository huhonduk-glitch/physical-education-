import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import ClassPicker, { classesOf, type ClassKey } from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import { db } from '../../db/db'
import { setCells } from '../../db/papsRepo'
import { cellLabel } from '../../lib/neisHeaderParser'
import { cellId, cellsForKey } from '../../lib/papsLayout'
import { formatStopwatch, lapToValue } from '../../lib/timerMath'
import { useApp } from '../../state/AppContext'
import { useTimer } from '../../state/TimerContext'
import { usePapsClass } from '../../state/usePapsClass'
import { BigTime, Controls, Panel } from './common'

/** 스톱워치: 랩 기록 → 학생 번호에 붙이기 → PAPS 기록으로 보내기 (예: 50m 달리기) */
export default function Stopwatch() {
  const t = useTimer()
  const { settings, readOnly } = useApp()
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status === '재학').toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const pc = usePapsClass(cls)
  const [eventId, setEventId] = useState<'sprint50m' | 'longRunWalk'>('sprint50m')
  const targetCells = cellsForKey(pc.cells, eventId)
  const [cellIdx, setCellIdx] = useState(0)
  const [msg, setMsg] = useState('')

  const assigned = t.laps.filter((l) => l.studentId && pc.students.some((s) => s.id === l.studentId))
  const send = async () => {
    const cell = targetCells[cellIdx] ?? { key: eventId, attempt: null, side: null }
    const overwrite = assigned.filter((l) => pc.values.get(l.studentId!)?.has(cellId(cell))).length
    if (overwrite && !confirm(`${overwrite}칸을 덮어씁니다. 계속할까요?`)) return
    await setCells(db, settings.schoolYear, assigned.map((l) => ({ studentId: l.studentId!, cell, value: lapToValue(l.ms, eventId) })))
    setMsg(`${assigned.length}명의 기록을 PAPS ${cellLabel(cell)} 칸에 넣었어요.`)
  }

  return (
    <div className="space-y-4">
      <Panel>
        <BigTime>{formatStopwatch(t.elapsedMs)}</BigTime>
        <Controls
          extra={
            <button type="button" className="btn btn-soft h-16 w-16 rounded-full p-0" aria-label="랩" onClick={t.lap} disabled={!t.running}>
              <Icon name="flag" size={26} />
            </button>
          }
        />
        <p className="hint text-center">달리는 학생이 들어올 때마다 깃발(랩)을 누르세요.</p>
      </Panel>

      {t.laps.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between">
            <p className="card-title">랩 {t.laps.length}개</p>
            <button type="button" className="btn btn-ghost text-ink-3" onClick={() => confirm('랩 기록을 모두 지울까요?') && t.clearLaps()}>
              모두 지우기
            </button>
          </div>
          <p className="hint">각 랩에 학생을 고르면 PAPS 기록으로 보낼 수 있어요.</p>
          <ClassPicker classes={classes} value={cls} onChange={setCls} />
          <ol className="overflow-hidden rounded-2xl bg-fill">
            {t.laps.map((l, i) => (
              <li key={l.id} className="list-row">
                <span className="w-8 font-bold text-ink-3 tabular-nums">{i + 1}</span>
                <span className="flex-1 text-lg font-extrabold tabular-nums">{formatStopwatch(l.ms)}</span>
                <select
                  className="field w-40 bg-white"
                  aria-label={`랩 ${i + 1} 학생`}
                  value={l.studentId ?? ''}
                  disabled={!cls}
                  onChange={(e) => t.assignLap(l.id, e.target.value || undefined)}
                >
                  <option value="">{cls ? '학생 고르기' : '반 먼저'}</option>
                  {pc.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}번 {s.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label={`랩 ${i + 1} 지우기`} onClick={() => t.removeLap(l.id)}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ol>
          {cls && (
            <div className="space-y-3 rounded-2xl bg-brand-light p-4">
              <p className="font-extrabold text-brand">PAPS로 보내기 · 학생 {assigned.length}명</p>
              <div className="segment bg-white/70">
                {(['sprint50m', 'longRunWalk'] as const).map((e) => (
                  <button key={e} type="button" aria-selected={eventId === e} onClick={() => (setEventId(e), setCellIdx(0))}>
                    {e === 'sprint50m' ? '50m달리기' : '오래달리기-걷기'}
                  </button>
                ))}
              </div>
              {targetCells.length > 1 && (
                <select className="field bg-white" aria-label="넣을 칸" value={cellIdx} onChange={(e) => setCellIdx(Number(e.target.value))}>
                  {targetCells.map((c, i) => (
                    <option key={cellId(c)} value={i}>
                      {cellLabel(c)}
                    </option>
                  ))}
                </select>
              )}
              {targetCells.length === 0 && <p className="hint">이 반의 측정 종목에 이 종목이 없어요. [PAPS → 측정 설정]을 확인하세요. 그래도 보내면 기록은 저장돼요.</p>}
              <button type="button" className="btn btn-primary w-full" disabled={assigned.length === 0 || readOnly} onClick={send}>
                보내기
              </button>
              {msg && (
                <p className="font-bold text-ok" role="status">
                  {msg}
                </p>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
