import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import GroupPicker from '../../components/GroupPicker'
import Icon from '../../components/Icon'
import { setItemValues } from '../../db/assessRepo'
import { db } from '../../db/db'
import { setCells } from '../../db/papsRepo'
import { itemsOf } from '../../lib/assessScore'
import { memberNo, readLastGroup, saveLastGroup } from '../../lib/groups'
import { cellLabel } from '../../lib/neisHeaderParser'
import { cellId, cellsForKey } from '../../lib/papsLayout'
import { formatStopwatch, lapToValue } from '../../lib/timerMath'
import { useApp } from '../../state/AppContext'
import { useTimer } from '../../state/TimerContext'
import { useGroups } from '../../state/useGroups'
import { usePapsClass } from '../../state/usePapsClass'
import { BigTime, Controls, Panel } from './common'

type Dest = 'paps' | 'assess'

/** 스톱워치: 랩 기록 → 수업반 학생에게 붙이기 → PAPS 기록 또는 수행평가(기록표 요소)로 보내기 */
export default function Stopwatch() {
  const t = useTimer()
  const { settings, readOnly } = useApp()
  const { groups, membersOf } = useGroups()
  const [gid, setGid] = useState<string | null>(readLastGroup)
  const group = groups?.find((g) => g.id === gid) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const isHomeroom = group?.kind === 'homeroom'
  const pc = usePapsClass(isHomeroom && group ? { grade: group.grade!, classNo: group.classNo! } : null)
  const [dest, setDest] = useState<Dest>('paps')
  const destNow: Dest = isHomeroom ? dest : 'assess'
  const [eventId, setEventId] = useState<'sprint50m' | 'longRunWalk'>('sprint50m')
  const targetCells = cellsForKey(pc.cells, eventId)
  const [cellIdx, setCellIdx] = useState(0)
  const [msg, setMsg] = useState('')

  // 이 수업반에 연결된 평가 중 '기록표' 요소
  const assessTargets = useLiveQuery(async () => {
    if (!group) return []
    const list = await db.assessments.where('schoolYear').equals(settings.schoolYear).toArray()
    return list
      .filter((a) => a.groupIds?.includes(group.id))
      .flatMap((a) => itemsOf(a).filter((it) => it.method === 'record').map((it) => ({ a, it, key: `${a.id}:${it.id}` })))
  }, [group?.id, settings.schoolYear])
  const [targetKey, setTargetKey] = useState('')
  const target = assessTargets?.find((x) => x.key === targetKey) ?? assessTargets?.[0]

  const memberIds = new Set(members.map((s) => s.id))
  const assigned = t.laps.filter((l) => l.studentId && memberIds.has(l.studentId))

  const chooseGroup = (id: string) => {
    setGid(id)
    setMsg('')
    saveLastGroup(id)
  }

  /** 아직 학생이 없는 랩에 번호순으로 (이미 붙인 학생은 건너뜀) */
  const fillInOrder = () => {
    const used = new Set(t.laps.map((l) => l.studentId).filter(Boolean))
    const queue = members.filter((s) => !used.has(s.id))
    for (const l of t.laps) {
      if (l.studentId && memberIds.has(l.studentId)) continue
      const s = queue.shift()
      if (!s) break
      t.assignLap(l.id, s.id)
    }
  }

  const sendPaps = async () => {
    const cell = targetCells[cellIdx] ?? { key: eventId, attempt: null, side: null }
    const overwrite = assigned.filter((l) => pc.values.get(l.studentId!)?.has(cellId(cell))).length
    if (overwrite && !confirm(`${overwrite}칸을 덮어씁니다. 계속할까요?`)) return
    await setCells(db, settings.schoolYear, assigned.map((l) => ({ studentId: l.studentId!, cell, value: lapToValue(l.ms, eventId) })))
    setMsg(`${assigned.length}명의 기록을 PAPS ${cellLabel(cell)} 칸에 넣었어요.`)
  }

  const sendAssess = async () => {
    if (!target) return
    const rows = await db.assessmentScores.where('assessmentId').equals(target.a.id).toArray()
    const has = new Set(rows.filter((r) => r.scores[target.it.id] !== undefined && r.scores[target.it.id] !== '').map((r) => r.studentId))
    const overwrite = assigned.filter((l) => has.has(l.studentId!)).length
    if (overwrite && !confirm(`${overwrite}명의 기록을 덮어씁니다. 계속할까요?`)) return
    await setItemValues(
      db,
      target.a.id,
      target.it.id,
      assigned.map((l) => ({ studentId: l.studentId!, value: lapToValue(l.ms, 'sprint50m') })),
    )
    setMsg(`${assigned.length}명의 기록(초)을 ${target.a.title} · ${target.it.label}에 넣었어요.`)
  }

  const unitWarn = target && target.it.unit && !/초|sec|s$/i.test(target.it.unit) ? `이 요소의 단위는 '${target.it.unit}'이에요. 스톱워치는 초로 넣어요.` : ''

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
          {groups && groups.length > 0 ? (
            <>
              <p className="hint">수업반을 고르고 랩마다 학생을 붙이면 PAPS나 수행평가 기록으로 보낼 수 있어요.</p>
              <GroupPicker groups={groups} value={group?.id ?? null} onChange={chooseGroup} />
              <button type="button" className="btn btn-soft w-full" onClick={fillInOrder} disabled={members.length === 0}>
                빈 랩에 번호순으로 학생 붙이기
              </button>
            </>
          ) : (
            <p className="hint">수업반을 만들면 랩을 학생에게 붙여 기록으로 보낼 수 있어요.</p>
          )}
          <ol className="overflow-hidden rounded-2xl bg-fill">
            {t.laps.map((l, i) => (
              <li key={l.id} className="list-row">
                <span className="w-6 shrink-0 font-bold text-ink-3 tabular-nums">{i + 1}</span>
                <span className="shrink-0 text-lg font-extrabold whitespace-nowrap tabular-nums">{formatStopwatch(l.ms)}</span>
                <select
                  className="field min-w-0 flex-1 bg-white px-3"
                  aria-label={`랩 ${i + 1} 학생`}
                  value={l.studentId && memberIds.has(l.studentId) ? l.studentId : ''}
                  disabled={!group}
                  onChange={(e) => t.assignLap(l.id, e.target.value || undefined)}
                >
                  <option value="">{group ? '학생' : '반 선택'}</option>
                  {group &&
                    members.map((s) => (
                      <option key={s.id} value={s.id}>
                        {memberNo(group, s)} {s.name}
                      </option>
                    ))}
                </select>
                <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label={`랩 ${i + 1} 지우기`} onClick={() => t.removeLap(l.id)}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ol>
          {group && (
            <div className="space-y-3 rounded-2xl bg-brand-light p-4">
              <p className="font-extrabold text-brand">기록으로 보내기 · 학생 {assigned.length}명</p>
              <div className="segment bg-white/70" role="tablist" aria-label="보낼 곳">
                <button type="button" role="tab" aria-selected={destNow === 'paps'} disabled={!isHomeroom} onClick={() => (setDest('paps'), setMsg(''))}>
                  PAPS
                </button>
                <button type="button" role="tab" aria-selected={destNow === 'assess'} onClick={() => (setDest('assess'), setMsg(''))}>
                  수행평가
                </button>
              </div>
              {!isHomeroom && <p className="hint">PAPS는 나이스가 학적반 기준이라 학적반 수업반에서 보낼 수 있어요.</p>}

              {destNow === 'paps' ? (
                <>
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
                  <button type="button" className="btn btn-primary w-full" disabled={assigned.length === 0 || readOnly} onClick={sendPaps}>
                    PAPS로 보내기
                  </button>
                </>
              ) : assessTargets && assessTargets.length === 0 ? (
                <p className="hint">이 수업반에 연결된 수행평가 중 '기록표' 요소가 없어요. [평가 → 수행평가]에서 요소를 기록표로 만들면 여기로 보낼 수 있어요.</p>
              ) : (
                <>
                  <select className="field bg-white" aria-label="넣을 평가 요소" value={target?.key ?? ''} onChange={(e) => (setTargetKey(e.target.value), setMsg(''))}>
                    {(assessTargets ?? []).map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.a.title} · {x.it.label}
                      </option>
                    ))}
                  </select>
                  {unitWarn && <p className="text-sm font-bold text-caution">{unitWarn}</p>}
                  <button type="button" className="btn btn-primary w-full" disabled={assigned.length === 0 || readOnly || !target} onClick={sendAssess}>
                    수행평가로 보내기
                  </button>
                </>
              )}
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
