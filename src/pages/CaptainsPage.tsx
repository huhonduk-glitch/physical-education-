import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import ClassPicker, { classesOf, type ClassKey } from '../components/ClassPicker'
import KeywordPicker from '../components/KeywordPicker'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { addRecords, applyCaptainChange } from '../db/recordsRepo'
import type { Captain, Student } from '../db/types'
import { captainOn, planCaptainChange } from '../lib/captains'
import { dayBefore, shortDateLabel, todayStr } from '../lib/dates'
import { countByCategory } from '../lib/recordStats'
import { useApp } from '../state/AppContext'

const ROLES: Captain['role'][] = ['부장', '부부장']

/** 체육부장 관리 (CLAUDE.md 4-3): 지정·교체 이력, 날짜별 활동 체크, 누적 횟수 */
export default function CaptainsPage() {
  const { settings } = useApp()
  const year = settings.schoolYear
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(year).toArray(), [year])
  const classes = useMemo(() => classesOf((students ?? []).filter((s) => s.status !== '전출')), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  useEffect(() => {
    if (!cls && classes.length) setCls(classes[0])
  }, [classes, cls])
  const [date, setDate] = useState(todayStr())

  const captains = useLiveQuery(
    () => (cls ? db.captains.where('[schoolYear+grade+classNo]').equals([year, cls.grade, cls.classNo]).toArray() : []),
    [year, cls?.grade, cls?.classNo],
  )
  const byId = useMemo(() => new Map((students ?? []).map((s) => [s.id, s])), [students])
  const classStudents = useMemo(
    () =>
      (students ?? [])
        .filter((s) => cls && s.grade === cls.grade && s.classNo === cls.classNo && s.status !== '전출')
        .sort((a, b) => a.number - b.number),
    [students, cls],
  )

  const change = async (role: Captain['role'], studentId: string | null) => {
    if (!cls || !captains) return
    await applyCaptainChange(db, planCaptainChange(captains, { schoolYear: year, grade: cls.grade, classNo: cls.classNo, role, studentId, date }, dayBefore))
  }

  const current = ROLES.map((role) => ({ role, cap: captains ? captainOn(captains, role, date) : undefined }))
  const name = (id: string) => {
    const s = byId.get(id)
    return s ? `${s.number}번 ${s.name}` : '(알 수 없음)'
  }

  return (
    <>
      <PageHeader title="체육부장" back />
      <div className="page space-y-4 py-4">
        {classes.length === 0 ? (
          <p className="card">먼저 학생 명렬을 올려 주세요.</p>
        ) : (
          <>
            <ClassPicker classes={classes} value={cls} onChange={setCls} />
            <div>
              <label className="label" htmlFor="capdate">
                날짜
              </label>
              <input id="capdate" type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>

            <section className="card space-y-3">
              <h2 className="text-lg font-extrabold">지정 · 교체</h2>
              <p className="hint">바꾸면 이전 사람의 임기는 전날로 끝나고 이력이 남아요.</p>
              {current.map(({ role, cap }) => (
                <div key={role}>
                  <label className="label" htmlFor={`sel-${role}`}>
                    체육{role}
                  </label>
                  <select id={`sel-${role}`} className="field" value={cap?.studentId ?? ''} onChange={(e) => change(role, e.target.value || null)}>
                    <option value="">— 없음 —</option>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number}번 {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </section>

            <ActivityCheck
              date={date}
              schoolYear={year}
              people={current.filter((c) => c.cap).map((c) => ({ role: c.role, student: byId.get(c.cap!.studentId) }))}
              buttons={settings.recordButtons.captain}
            />

            <section className="card space-y-3">
              <h2 className="text-lg font-extrabold">이력과 누적 활동</h2>
              {!captains || captains.length === 0 ? (
                <p className="hint">아직 지정한 사람이 없어요</p>
              ) : (
                <CaptainHistory captains={captains} name={name} />
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}

function ActivityCheck({
  date,
  schoolYear,
  people,
  buttons,
}: {
  date: string
  schoolYear: number
  people: { role: Captain['role']; student?: Student }[]
  buttons: string[]
}) {
  const ids = people.map((p) => p.student?.id).filter((x): x is string => !!x)
  const done = useLiveQuery(
    () => db.records.where('date').equals(date).filter((r) => r.type === 'captain' && ids.includes(r.studentId)).toArray(),
    [date, ids.join(',')],
  )
  const [keywordIds, setKeywordIds] = useState<string[]>([])
  const [etc, setEtc] = useState<{ studentId: string; note: string } | null>(null)

  const toggle = async (studentId: string, category: string) => {
    const existing = done?.find((r) => r.studentId === studentId && r.category === category)
    if (existing) {
      await db.records.delete(existing.id)
      return
    }
    if (category === '기타') {
      setEtc({ studentId, note: '' })
      return
    }
    await addRecords(db, { schoolYear, studentIds: [studentId], date, type: 'captain', category, keywordIds })
  }

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-extrabold">활동 체크 · {shortDateLabel(date)}</h2>
      {people.length === 0 ? (
        <p className="hint">먼저 부장·부부장을 지정해 주세요</p>
      ) : (
        <>
          <p className="hint">누르면 체크, 한 번 더 누르면 취소돼요.</p>
          {people.map(({ role, student }) =>
            student ? (
              <div key={role}>
                <p className="mb-1 font-bold">
                  체육{role} · {student.number}번 {student.name}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {buttons.map((b) => {
                    const on = !!done?.some((r) => r.studentId === student.id && r.category === b)
                    return (
                      <button key={b} type="button" aria-pressed={on} className={`btn min-h-[52px] ${on ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggle(student.id, b)}>
                        {on ? '✔ ' : ''}
                        {b}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null,
          )}
          {etc && (
            <div className="space-y-2 rounded-xl border-2 border-brand p-3">
              <p className="font-bold">기타 활동 메모</p>
              <input className="field" autoFocus value={etc.note} onChange={(e) => setEtc({ ...etc, note: e.target.value })} placeholder="예: 체육대회 준비 도움" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setEtc(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-[2]"
                  disabled={etc.note.trim() === ''}
                  onClick={async () => {
                    await addRecords(db, { schoolYear, studentIds: [etc.studentId], date, type: 'captain', category: '기타', note: etc.note, keywordIds })
                    setEtc(null)
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          )}
          <KeywordPicker value={keywordIds} onChange={setKeywordIds} />
          <p className="hint">키워드를 먼저 고르고 활동을 누르면 함께 기록돼요.</p>
        </>
      )}
    </section>
  )
}

function CaptainHistory({ captains, name }: { captains: Captain[]; name: (id: string) => string }) {
  const ids = [...new Set(captains.map((c) => c.studentId))]
  const acts = useLiveQuery(() => db.records.where('studentId').anyOf(ids).filter((r) => r.type === 'captain').toArray(), [ids.join(',')])
  return (
    <ul className="space-y-3">
      {[...captains]
        .sort((a, b) => b.from.localeCompare(a.from))
        .map((c) => {
          const mine = (acts ?? []).filter((r) => r.studentId === c.studentId)
          return (
            <li key={c.id} className="rounded-xl bg-zinc-50 p-3">
              <p className="font-bold">
                체육{c.role} · {name(c.studentId)}
              </p>
              <p className="hint">
                {shortDateLabel(c.from)} ~ {c.to ? shortDateLabel(c.to) : '지금'} · 활동 {mine.length}회
              </p>
              {mine.length > 0 && (
                <p className="mt-1 text-sm">
                  {countByCategory(mine)
                    .map((x) => `${x.category} ${x.count}`)
                    .join(' · ')}
                </p>
              )}
            </li>
          )
        })}
    </ul>
  )
}
