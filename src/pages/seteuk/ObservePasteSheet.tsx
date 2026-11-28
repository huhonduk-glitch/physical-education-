import { useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import { db } from '../../db/db'
import { addRecords } from '../../db/recordsRepo'
import type { ClassGroup, Student } from '../../db/types'
import { todayStr } from '../../lib/dates'
import { memberNo } from '../../lib/groups'
import { readObservations, type ObservePasteResult } from '../../lib/observePaste'
import { useApp } from '../../state/AppContext'

/**
 * 관찰 메모 한꺼번에 넣기 (2026-11-26, 슈퍼스쿨 '학생 관찰 · 평가 업로드' 참고): 엑셀 · 시트에서 [학번(번호) · 이름 · 내용]을 복사해 붙이면
 * 학생마다 '관찰' 기록 한 줄로 이 수업반에 넣는다 → 세특 근거 목록에 바로 들어감. 선생님이 쓴 관찰만 넣어 주세요(학생이 쓴 글은 참고만).
 */
export default function ObservePasteSheet({ group, members, onClose }: { group: ClassGroup; members: Student[]; onClose: () => void }) {
  const { settings } = useApp()
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayStr())
  const [res, setRes] = useState<ObservePasteResult | null>(null)
  const [done, setDone] = useState('')
  const read = () => setRes(readObservations(text, members.map((s) => ({ id: s.id, no: memberNo(group, s), studentCode: s.studentCode, name: s.name }))))
  const save = async () => {
    if (!res) return
    for (const it of res.items) await addRecords(db, { schoolYear: settings.schoolYear, studentIds: [it.studentId], date, type: 'observation', category: '관찰', note: it.text, groupId: group.id })
    setDone(`${res.items.length}명에게 관찰 메모를 넣었어요. 세특 근거 목록에 들어가요.`)
    setRes(null)
    setText('')
  }
  return (
    <BottomSheet title="관찰 메모 한꺼번에 넣기" sub={group.name} onClose={onClose}>
      <div className="space-y-3">
        <p className="hint">엑셀 · 구글 시트에서 [학번 또는 번호 · 이름 · 내용] 칸을 복사해 붙여 넣으세요. 한 줄 = 학생 한 명. &lsquo;3 홍길동 내용&rsquo;처럼 띄어 써도 돼요. 선생님이 직접 관찰한 내용만 넣어 주세요(학생이 쓴 글은 참고만).</p>
        <label className="block">
          <span className="label">관찰한 날</span>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <textarea className="field min-h-[160px] w-full py-3 text-sm" value={text} placeholder={'10101\t홍길동\t모둠 활동에서 역할을 나눔\n2 김철수 시범을 자원해 보여 줌'} aria-label="관찰 메모 붙여 넣기" onChange={(e) => (setText(e.target.value), setRes(null), setDone(''))} />
        {done && <p className="rounded-xl bg-ok-light px-3 py-2 font-bold text-ok">{done}</p>}
        {res && (
          <div className="space-y-2">
            {res.items.length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-fill p-2 text-[0.92rem]" aria-label="읽은 관찰 메모">
                {res.items.map((it, i) => (
                  <li key={i}>
                    <b>{it.who}</b> {it.text}
                  </li>
                ))}
              </ul>
            )}
            {res.problems.length > 0 && (
              <ul className="space-y-0.5 rounded-xl bg-caution-light p-2 text-[0.88rem] text-caution">
                {res.problems.map((p, i) => (
                  <li key={i}>⚠️ {p}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn btn-soft flex-1" disabled={!text.trim()} onClick={read}>
            읽기
          </button>
          <button type="button" className="btn btn-primary flex-1" disabled={!res?.items.length} onClick={() => void save()}>
            {res?.items.length ? `${res.items.length}명 넣기` : '넣기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
