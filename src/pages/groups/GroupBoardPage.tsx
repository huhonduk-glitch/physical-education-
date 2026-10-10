import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackupWarning from '../../components/BackupWarning'
import DateBar from '../../components/DateBar'
import GroupPicker from '../../components/GroupPicker'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import RecordSheet from '../../components/RecordSheet'
import TeamSendSheet from '../../components/TeamSendSheet'
import UndoToast from '../../components/UndoToast'
import { db } from '../../db/db'
import { toggleCheck, undo, type UndoToken } from '../../db/recordsRepo'
import type { Student } from '../../db/types'
import { cellCounts, checkItems, type CheckItem } from '../../lib/checkBoard'
import { todayStr } from '../../lib/dates'
import { memberNo, saveLastGroup, SEMESTER_LABEL } from '../../lib/groups'
import { summarizeDay } from '../../lib/recordStats'
import { classForNow } from '../../lib/timetable'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'
import ClassToolsSheet from './ClassToolsSheet'
import { ItemCheckView, TableCheckView } from './CheckViews'

type BoardMode = 'cards' | 'items' | 'table'
const MODE_KEY = 'pe.boardMode'
const readMode = (): BoardMode => {
  try {
    const m = localStorage.getItem(MODE_KEY)
    return m === 'items' || m === 'table' ? m : 'cards'
  } catch {
    return 'cards'
  }
}

/** 수업반 누가기록 보드: 학생 카드를 눌러 바로 기록한다 (CLAUDE.md 4-2) */
export default function GroupBoardPage() {
  const { settings, readOnly } = useApp()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [date, setDate] = useState(todayStr())
  const isToday = date === todayStr()
  const { groups, membersOf } = useGroups()
  const group = groups?.find((g) => g.id === id)
  const now = isToday ? classForNow(new Date(), settings.timetable, settings.periodStarts, settings.periodMinutes) : null
  const nowHere = now && now.groupId === id ? now : null

  const list: Student[] = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])

  const dayData = useLiveQuery(async () => {
    const [records, absences] = await Promise.all([
      db.records.where('[groupId+date]').equals([id, date]).toArray(),
      db.absences.where('[groupId+date]').equals([id, date]).toArray(),
    ])
    return { summary: summarizeDay(records, absences), counts: cellCounts(records), absentIds: new Set(absences.map((a) => a.studentId)) }
  }, [date, id])
  const day = dayData?.summary
  const items = useMemo(() => checkItems(settings.recordButtons), [settings.recordButtons])
  const [mode, setModeState] = useState<BoardMode>(readMode)
  const setMode = (m: BoardMode) => {
    setModeState(m)
    setMulti(false)
    setSelected([])
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* 무시 */
    }
  }
  const onToggle = (s: Student, item: CheckItem) => {
    void toggleCheck(db, { schoolYear: settings.schoolYear, groupId: id, studentId: s.id, date, period: nowHere?.period, type: item.type, category: item.label })
  }

  // 달력에 점 찍을 날짜: 이 수업반에서 기록한 날
  const marked = useLiveQuery(async () => {
    const [r, a] = await Promise.all([db.records.where('groupId').equals(id).toArray(), db.absences.where('groupId').equals(id).toArray()])
    return new Set([...r.map((x) => x.date), ...a.map((x) => x.date)])
  }, [id])

  const choose = (gid: string) => {
    setSelected([])
    saveLastGroup(gid)
    navigate(`/groups/${gid}`, { replace: true })
  }

  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [sheet, setSheet] = useState<Student[] | null>(null)
  const [teamSend, setTeamSend] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  useEffect(() => {
    if (group) saveLastGroup(group.id)
  }, [group])
  const [toast, setToast] = useState<{ token: UndoToken; message: string; key: number } | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const tapCard = (s: Student) => {
    if (multi) setSelected((sel) => (sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id]))
    else setSheet([s])
  }

  const onRecorded = (token: UndoToken, message: string) => {
    setSheet(null)
    setSelected([])
    setMulti(false)
    setToast({ token, message, key: Date.now() })
  }

  const stats = useMemo(() => {
    let absent = 0
    let unprepared = 0
    let exemplary = 0
    for (const s of list) {
      const d = day?.get(s.id)
      if (!d) continue
      if (d.absent) absent++
      if (d.unprepared) unprepared++
      if (d.exemplary) exemplary++
    }
    return { absent, unprepared, exemplary, present: list.length - absent }
  }, [list, day])

  if (groups && !group) {
    return (
      <>
        <PageHeader title="수업반" back />
        <div className="page pt-2">
          <div className="card space-y-3 text-center">
            <p className="text-lg font-extrabold">이 수업반을 찾을 수 없어요</p>
            <Link to="/groups" className="btn btn-primary w-full">
              수업반 목록으로
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={group?.name ?? ''}
        sub={[group?.subject, group ? SEMESTER_LABEL[group.semester] : '', nowHere ? `지금 ${nowHere.period}교시` : ''].filter(Boolean).join(' · ')}
        back
        right={
          <>
            <button type="button" className="btn btn-soft px-3" aria-label="수업 도구" onClick={() => setToolsOpen(true)} disabled={list.length === 0}>
              <Icon name="team" />
            </button>
            <Link to={`/groups/${id}/stats`} className="btn btn-soft px-3" aria-label="누적 기록 보기">
              <Icon name="list" />
            </Link>
            <button
              type="button"
              aria-pressed={multi}
              className={`btn ${multi ? 'btn-primary' : 'btn-soft'} ${mode === 'cards' ? '' : 'hidden'}`}
              disabled={readOnly}
              onClick={() => {
                setMulti((m) => !m)
                setSelected([])
              }}
            >
              <Icon name="check" size={20} />
              {multi ? '선택 끝' : '여러 명'}
            </button>
          </>
        }
      />
      <div className="page space-y-3 pb-4">
        <BackupWarning hasData={list.length > 0} />
        {groups && groups.length > 1 && <GroupPicker groups={groups} value={id} onChange={choose} />}
        <DateBar value={date} onChange={setDate} marked={marked} />
        <div className="segment" role="tablist" aria-label="기록 방법">
          {(
            [
              ['cards', '학생 카드'],
              ['items', '항목 체크'],
              ['table', '체크표'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center" aria-label="이 반 요약">
          {[
            { label: '참여', n: stats.present, cls: 'text-ink' },
            { label: '견학', n: stats.absent, cls: 'text-ink-3' },
            { label: '지도', n: stats.unprepared, cls: 'text-danger' },
            { label: '칭찬', n: stats.exemplary, cls: 'text-brand' },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-white py-2 shadow-[var(--shadow-card)]">
              <p className={`text-xl font-extrabold tabular-nums ${x.cls}`}>{x.n}</p>
              <p className="text-[0.75rem] font-bold text-ink-3">{x.label}</p>
            </div>
          ))}
        </div>

        {multi && (
          <p className="anim-pop rounded-2xl bg-brand-light px-4 py-2.5 font-bold text-brand">기록할 학생을 모두 누른 뒤 아래 [기록하기]를 누르세요.</p>
        )}
        {readOnly && <p className="rounded-2xl bg-caution-light px-4 py-2.5 font-bold text-caution">지난 학년도는 읽기 전용이에요.</p>}
        {group && list.length === 0 && (
          <div className="card space-y-2 text-center">
            <p className="font-extrabold">이 수업반에 학생이 없어요</p>
            <Link to={`/groups/${id}/edit`} className="btn btn-primary w-full">
              학생 넣기
            </Link>
          </div>
        )}

        {group && list.length > 0 && mode !== 'cards' && (
          <>
            {mode === 'items' ? (
              <ItemCheckView group={group} list={list} items={items} counts={dayData?.counts ?? new Map()} absentIds={dayData?.absentIds ?? new Set()} readOnly={readOnly} onToggle={onToggle} />
            ) : (
              <TableCheckView group={group} list={list} items={items} counts={dayData?.counts ?? new Map()} absentIds={dayData?.absentIds ?? new Set()} readOnly={readOnly} onToggle={onToggle} />
            )}
            <p className="hint px-1">
              항목은{' '}
              <Link to="/more/settings/buttons" className="font-bold text-brand underline">
                체크 항목 편집
              </Link>
              에서 바꿔요. 견학·관찰 메모는 [학생 카드]에서 남겨요.
            </p>
          </>
        )}
        {mode === 'cards' && (<>
        <ul className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="번호 카드">
          {list.map((s) => {
            const d = day?.get(s.id)
            const on = selected.includes(s.id)
            const gray = d?.absent || s.status === '휴학'
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={multi ? on : undefined}
                  aria-label={`${group ? memberNo(group, s) : s.number}번 ${s.name}${d?.absent ? ' 견학' : ''}`}
                  onClick={() => tapCard(s)}
                  disabled={readOnly}
                  className={`relative flex min-h-[66px] w-full flex-col items-center justify-center rounded-2xl px-0.5 pt-1.5 pb-1 transition-[transform,background-color] active:scale-95 ${
                    on
                      ? 'bg-brand text-white shadow-[0_4px_12px_rgb(27_100_218/0.35)]'
                      : gray
                        ? 'bg-fill-2 text-ink-3'
                        : 'bg-white text-ink shadow-[var(--shadow-card)]'
                  }`}
                >
                  <span className={`leading-none font-extrabold tabular-nums ${group?.kind === 'elective' ? 'text-[0.95rem]' : 'text-[1.3rem]'}`}>{group ? memberNo(group, s) : s.number}</span>
                  <span className="mt-1 w-full truncate text-center text-[0.74rem] leading-tight font-semibold">{s.name}</span>
                  <span className="mt-1 flex h-2 items-center gap-1" aria-hidden>
                    {d?.absent && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-ink-3'}`} />}
                    {d && d.unprepared > 0 && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-danger'}`} />}
                    {d && d.exemplary > 0 && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-brand'}`} />}
                    {d && (d.observation > 0 || d.captain > 0) && <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : 'bg-ok'}`} />}
                  </span>
                  {d && d.unprepared > 1 && (
                    <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.7rem] font-bold text-white">{d.unprepared}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[0.8rem] font-semibold text-ink-3">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-danger" /> 지도(미준비)
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-brand" /> 칭찬(솔선수범)
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-ok" /> 관찰·부장
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-ink-3" /> 견학(회색 카드)
          </span>
        </div>
        </>)}
      </div>

      {multi && (
        <div className="anim-pop fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-0 lg:left-60">
          <div className="page flex gap-2 rounded-2xl bg-white p-2 shadow-[var(--shadow-float)]">
            <button type="button" className="btn btn-soft" onClick={() => setSelected(selected.length === list.length ? [] : list.map((s) => s.id))}>
              {selected.length === list.length ? '모두 해제' : '전체'}
            </button>
            <button type="button" className="btn btn-primary flex-1 text-lg" disabled={selected.length === 0} onClick={() => setSheet(list.filter((s) => selected.includes(s.id)))}>
              {selected.length}명 기록하기
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <RecordSheet
          students={sheet}
          date={date}
          period={nowHere?.period}
          groupId={id}
          numberOf={(s) => (group ? memberNo(group, s) : String(s.number))}
          onClose={() => setSheet(null)}
          onRecorded={onRecorded}
        />
      )}
      {toolsOpen && group && (
        <ClassToolsSheet
          group={group}
          onClose={() => setToolsOpen(false)}
          onTeamSend={() => {
            setToolsOpen(false)
            setTeamSend(true)
          }}
        />
      )}
      {teamSend && group && <TeamSendSheet students={list} date={date} groupName={group.name} numberOf={(s) => memberNo(group, s)} onClose={() => setTeamSend(false)} />}

      {toast && (
        <UndoToast
          key={toast.key}
          message={toast.message}
          onDone={clearToast}
          onUndo={() => {
            void undo(db, toast.token)
            setToast(null)
          }}
        />
      )}
    </>
  )
}
