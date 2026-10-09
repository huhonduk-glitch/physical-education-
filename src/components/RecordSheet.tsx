import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { addAbsences, addRecords, type UndoToken } from '../db/recordsRepo'
import type { Absence, RecordType, Student } from '../db/types'
import { useApp } from '../state/AppContext'
import BottomSheet from './BottomSheet'
import Icon, { type IconName } from './Icon'
import KeywordPicker from './KeywordPicker'

export const TYPE_LABEL: Record<RecordType, string> = {
  unprepared: '준비물 미준비',
  exemplary: '솔선수범',
  observation: '관찰 메모',
  captain: '체육부장 활동',
}

const ABSENCE_REASONS: Absence['reason'][] = ['부상', '생리', '질병', '기타']
const ETC = '기타'

interface Props {
  students: Student[]
  date: string
  period?: number
  /** 어느 수업반에서 남기는 기록인지 */
  groupId?: string
  /** 카드 번호 표시 (수강반은 학번) */
  numberOf?: (s: Student) => string
  onClose: () => void
  onRecorded: (token: UndoToken, message: string) => void
}

/** 번호 카드를 누르면 열리는 기록 창 (CLAUDE.md 4-2). 버튼 한 번에 저장한다. */
export default function RecordSheet({ students, date, period, groupId, numberOf = (s) => String(s.number), onClose, onRecorded }: Props) {
  const { settings } = useApp()
  const [keywordIds, setKeywordIds] = useState<string[]>([])
  const [pending, setPending] = useState<{ type: 'unprepared' | 'exemplary'; category: string } | null>(null)
  const [note, setNote] = useState('')
  const [obsNote, setObsNote] = useState('')
  const [obsKeywords, setObsKeywords] = useState<string[]>([])
  const [absDetail, setAbsDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const single = students.length === 1 ? students[0] : null
  const ids = students.map((s) => s.id)
  const who = single ? `${numberOf(single)}번 ${single.name}` : `${students.length}명`

  const record = async (type: RecordType, category: string, extra: { note?: string; keywordIds?: string[] } = {}) => {
    if (busy) return
    setBusy(true)
    const recordIds = await addRecords(db, {
      schoolYear: settings.schoolYear,
      studentIds: ids,
      date,
      period,
      type,
      category,
      groupId,
      ...extra,
    })
    const what = type === 'unprepared' ? `${category} 미준비` : type === 'exemplary' ? `솔선수범(${category})` : '관찰 메모'
    onRecorded({ recordIds, absenceIds: [], absenceBefore: [] }, `${who}: ${what}`)
  }

  const absent = async (reason: Absence['reason']) => {
    if (busy) return
    setBusy(true)
    const r = await addAbsences(db, { schoolYear: settings.schoolYear, studentIds: ids, date, period, reason, detail: absDetail, groupId })
    onRecorded({ recordIds: [], absenceIds: r.added, absenceBefore: r.updated }, `${who}: 견학`)
  }

  const tapCategory = (type: 'unprepared' | 'exemplary', category: string) => {
    if (category === ETC) {
      setPending({ type, category })
      setNote('')
      return
    }
    void record(type, category, type === 'exemplary' ? { keywordIds } : {})
  }

  const btn = 'btn btn-soft min-h-[54px] w-full text-[1.02rem]'
  return (
    <BottomSheet title={single ? <>{numberOf(single)}번 {single.name}</> : <>{students.length}명 한꺼번에 기록</>} onClose={onClose}>
      <div className="space-y-5">
        {!single && <p className="hint">{students.map(numberOf).join(', ')}번</p>}

        {pending ? (
          <section className="anim-pop space-y-3 rounded-2xl bg-brand-light p-4">
            <p className="font-bold">
              {TYPE_LABEL[pending.type]} · 기타 — 메모를 적어 주세요
            </p>
            <input className="field" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 줄넘기 안 가져옴" />
            <div className="flex gap-2">
              <button type="button" className="btn btn-soft flex-1 bg-white" onClick={() => setPending(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary flex-[2]"
                disabled={busy || note.trim() === ''}
                onClick={() => record(pending.type, ETC, { note, ...(pending.type === 'exemplary' ? { keywordIds } : {}) })}
              >
                저장
              </button>
            </div>
          </section>
        ) : (
          <>
            <section>
              <SectionTitle icon="alert" tone="bg-danger-light text-danger">준비물 미준비</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {settings.recordButtons.unprepared.map((c) => (
                  <button key={c} type="button" className={btn} disabled={busy} onClick={() => tapCategory('unprepared', c)}>
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle icon="star" tone="bg-brand-light text-brand">솔선수범</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {settings.recordButtons.exemplary.map((c) => (
                  <button key={c} type="button" className={btn} disabled={busy} onClick={() => tapCategory('exemplary', c)}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <KeywordPicker value={keywordIds} onChange={setKeywordIds} />
              </div>
            </section>

            <section>
              <SectionTitle icon="bandage" tone="bg-fill-2 text-ink-2">견학</SectionTitle>
              <div className="grid grid-cols-4 gap-2">
                {ABSENCE_REASONS.map((r) => (
                  <button key={r} type="button" className={btn} disabled={busy} onClick={() => absent(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <input
                className="field mt-2"
                value={absDetail}
                onChange={(e) => setAbsDetail(e.target.value)}
                placeholder="상세 메모 (선택 · 먼저 적기)"
                aria-label="견학 상세 메모"
              />
            </section>

            <section className="space-y-2">
              <SectionTitle icon="note" tone="bg-ok-light text-ok">관찰 메모</SectionTitle>
              <textarea className="field min-h-[5rem] py-2" value={obsNote} onChange={(e) => setObsNote(e.target.value)} placeholder="예: 모둠 활동에서 역할을 나눠 줌" aria-label="관찰 메모" />
              <KeywordPicker value={obsKeywords} onChange={setObsKeywords} />
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy || (obsNote.trim() === '' && obsKeywords.length === 0)}
                onClick={() => record('observation', '관찰', { note: obsNote, keywordIds: obsKeywords })}
              >
                관찰 메모 저장
              </button>
            </section>

            {single && <TodayList student={single} date={date} />}
          </>
        )}
      </div>
    </BottomSheet>
  )
}

/** 한 학생의 오늘 기록 (잘못 누른 것 지우기) */
function TodayList({ student, date }: { student: Student; date: string }) {
  const data = useLiveQuery(async () => {
    const [records, absences] = await Promise.all([
      db.records.where('[studentId+date]').equals([student.id, date]).toArray(),
      db.absences.where('studentId').equals(student.id).filter((a) => a.date === date).toArray(),
    ])
    return { records: records.sort((a, b) => a.createdAt - b.createdAt), absences }
  }, [student.id, date])
  if (!data) return null
  const empty = data.records.length === 0 && data.absences.length === 0
  return (
    <section className="rounded-2xl bg-fill p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-extrabold">오늘 기록</h3>
        <Link to={`/students/${student.id}`} className="btn min-h-[40px] bg-white px-3 text-sm text-brand">
          누적 기록 보기
        </Link>
      </div>
      {empty ? (
        <p className="hint">아직 없어요</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.absences.map((a) => (
            <li key={a.id} className="flex min-h-[48px] items-center gap-2">
              <span className="flex-1 font-semibold">견학</span>
              <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label="견학 지우기" onClick={() => db.absences.delete(a.id)}>
                지우기
              </button>
            </li>
          ))}
          {data.records.map((r) => (
            <li key={r.id} className="flex min-h-[48px] items-center gap-2">
              <span className="flex-1">
                {TYPE_LABEL[r.type]} · {r.category}
                {r.note ? <span className="text-ink-3"> — {r.note}</span> : null}
              </span>
              <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label={`${r.category} 지우기`} onClick={() => db.records.delete(r.id)}>
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SectionTitle({ icon, tone, children }: { icon: IconName; tone: string; children: string }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[1.05rem] font-extrabold">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>
        <Icon name={icon} size={18} strokeWidth={2.4} />
      </span>
      {children}
    </h3>
  )
}
