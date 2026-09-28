import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ClassPicker, { classesOf, classKeyStr, type ClassKey } from '../components/ClassPicker'
import PageHeader from '../components/PageHeader'
import RecordSheet from '../components/RecordSheet'
import UndoToast from '../components/UndoToast'
import { db } from '../db/db'
import { undo, type UndoToken } from '../db/recordsRepo'
import type { Student } from '../db/types'
import { shortDateLabel, todayStr } from '../lib/dates'
import { summarizeDay } from '../lib/recordStats'
import { classForNow } from '../lib/timetable'
import { useApp } from '../state/AppContext'

const LAST_CLASS_KEY = 'pe.lastClass'

function readLastClass(): string | null {
  try {
    return localStorage.getItem(LAST_CLASS_KEY)
  } catch {
    return null
  }
}

/** 수업 탭: 번호 카드를 눌러 바로 기록하는 핵심 화면 (CLAUDE.md 4-2) */
export default function ClassPage() {
  const { settings } = useApp()
  const date = todayStr()
  const students = useLiveQuery(
    () => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status !== '전출').toArray(),
    [settings.schoolYear],
  )
  const today = useLiveQuery(async () => {
    const [records, absences] = await Promise.all([
      db.records.where('date').equals(date).filter((r) => r.schoolYear === settings.schoolYear).toArray(),
      db.absences.where('date').equals(date).filter((a) => a.schoolYear === settings.schoolYear).toArray(),
    ])
    return summarizeDay(records, absences)
  }, [date, settings.schoolYear])

  const classes = useMemo(() => classesOf(students ?? []), [students])
  const now = classForNow(new Date(), settings.timetable, settings.periodStarts, settings.periodMinutes)
  const [cls, setCls] = useState<ClassKey | null>(null)

  // 처음 열 때: 지금 교시 반(시간표) → 지난번에 본 반 → 첫 번째 반
  useEffect(() => {
    if (classes.length === 0 || (cls && classes.some((c) => classKeyStr(c) === classKeyStr(cls)))) return
    const byTime = now && classes.find((c) => c.grade === now.grade && c.classNo === now.classNo)
    const last = readLastClass()
    const byLast = classes.find((c) => classKeyStr(c) === last)
    setCls(byTime || byLast || classes[0])
  }, [classes, cls, now])

  const choose = (c: ClassKey) => {
    setCls(c)
    setSelected([])
    try {
      localStorage.setItem(LAST_CLASS_KEY, classKeyStr(c))
    } catch {
      /* 무시 */
    }
  }

  const list: Student[] = useMemo(
    () =>
      (students ?? [])
        .filter((s) => cls && s.grade === cls.grade && s.classNo === cls.classNo)
        .sort((a, b) => a.number - b.number),
    [students, cls],
  )

  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [sheet, setSheet] = useState<Student[] | null>(null)
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

  if (students !== undefined && students.length === 0) {
    return (
      <>
        <PageHeader title="수업" />
        <div className="page pt-4">
          <div className="card border-brand bg-brand-light">
            <p className="text-lg font-bold">먼저 학생 명렬을 올려 주세요</p>
            <p className="hint mt-1">나이스 명렬 엑셀을 올리거나, 명단을 복사해서 붙여넣으면 돼요.</p>
            <Link to="/students/import" className="btn btn-primary mt-3 w-full">
              명렬 올리기
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`수업 · ${shortDateLabel(date)}`}
        right={
          <button
            type="button"
            aria-pressed={multi}
            className={`btn ${multi ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setMulti((m) => !m)
              setSelected([])
            }}
          >
            {multi ? '선택 끝' : '여러 명 선택'}
          </button>
        }
      />
      <div className="page space-y-3 py-3">
        <ClassPicker classes={classes} value={cls} onChange={choose} />
        {now && cls && now.grade === cls.grade && now.classNo === cls.classNo && (
          <p className="hint">⏰ 시간표에 따라 {now.period}교시 반을 골랐어요</p>
        )}
        {multi && <p className="font-bold text-brand">기록할 학생을 모두 누른 뒤, 아래 [기록하기]를 누르세요.</p>}

        <ul className="grid grid-cols-5 gap-1.5" aria-label="번호 카드">
          {list.map((s) => {
            const d = today?.get(s.id)
            const on = selected.includes(s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={multi ? on : undefined}
                  aria-label={`${s.number}번 ${s.name}${d?.absent ? ' 견학' : ''}`}
                  onClick={() => tapCard(s)}
                  className={`flex min-h-[64px] w-full flex-col items-center justify-center rounded-xl border-2 px-0.5 py-1 ${
                    on
                      ? 'border-brand bg-brand text-white'
                      : d?.absent || s.status === '휴학'
                        ? 'border-zinc-300 bg-zinc-200 text-zinc-500'
                        : 'border-zinc-300 bg-white text-black active:bg-brand-light'
                  }`}
                >
                  <span className="text-xl leading-none font-extrabold tabular-nums">{s.number}</span>
                  <span className="mt-0.5 w-full truncate text-center text-[0.75rem] leading-tight">{s.name}</span>
                  <span className="mt-0.5 flex h-4 gap-0.5 text-[0.7rem] leading-none" aria-hidden>
                    {d?.absent && <span>🩹</span>}
                    {d && d.unprepared > 0 && <span>❗{d.unprepared > 1 ? d.unprepared : ''}</span>}
                    {d && d.exemplary > 0 && <span>⭐{d.exemplary > 1 ? d.exemplary : ''}</span>}
                    {d && d.observation > 0 && <span>📝</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="hint">❗미준비 ⭐솔선수범 📝관찰 🩹견학(회색)</p>
      </div>

      {multi && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t-2 border-zinc-300 bg-white p-2 lg:bottom-0 lg:left-60">
          <div className="page flex gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setSelected(list.map((s) => s.id))}>
              전체
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1 text-lg"
              disabled={selected.length === 0}
              onClick={() => setSheet(list.filter((s) => selected.includes(s.id)))}
            >
              {selected.length}명 기록하기
            </button>
          </div>
        </div>
      )}

      {sheet && <RecordSheet students={sheet} date={date} period={now && cls && now.grade === cls.grade && now.classNo === cls.classNo ? now.period : undefined} onClose={() => setSheet(null)} onRecorded={onRecorded} />}

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
