import { useState } from 'react'
import Collapse from '../components/Collapse'
import { db } from '../db/db'
import { todayStr } from '../lib/dates'
import { compareAttend, pelogCounts, readNeisAttend, type CompareLine } from '../lib/neisAttendCompare'
import { readGridsFromFile } from '../lib/rosterFile'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/**
 * 나이스 출결과 맞춰 보기 (2026-11-26, 슈퍼스쿨 '나이스 자료 비교' 참고 — 코드는 새로 씀).
 * 담임 선생님이 나이스 [학급별출결현황]에서 받은 엑셀(학급 하나 · 한 달)을 올리면, 체육 수업 출결이 나이스보다 많은 학생만 보여 준다.
 * 파일은 이 기기에서만 읽고 저장하지 않는다.
 */
export default function NeisAttendCompareCard({ withReason }: { withReason: boolean }) {
  const { settings } = useApp()
  const { students } = useGroups()
  const [month, setMonth] = useState(() => todayStr().slice(0, 7))
  const [res, setRes] = useState<{ cls: string; matched: number; unmatched: string[]; lines: CompareLine[] } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const read = async (file: File) => {
    setErr('')
    setRes(null)
    setBusy(true)
    try {
      const sheets = await readGridsFromFile(await file.arrayBuffer(), file.name)
      const f = readNeisAttend(sheets[0]?.grid ?? [])
      if ('error' in f) return setErr(f.error)
      if (!f.grade || !f.classNo) return setErr("파일에서 'N학년 N반'을 찾지 못했어요. 나이스에서 학급을 골라 받은 파일인지 확인해 주세요.")
      const mine = (students ?? []).filter((s) => s.schoolYear === settings.schoolYear && s.grade === f.grade && s.classNo === f.classNo && s.status !== '전출')
      if (!mine.length) return setErr(`명렬에 ${f.grade}학년 ${f.classNo}반 학생이 없어요.`)
      const ids = new Set(mine.map((s) => s.id))
      const rows = (await db.attendance.where('schoolYear').equals(settings.schoolYear).toArray()).filter((r) => ids.has(r.studentId))
      setRes({ cls: `${f.grade}학년 ${f.classNo}반`, ...compareAttend(f, mine, pelogCounts(rows, month)) })
    } catch {
      setErr('파일을 읽지 못했어요. 엑셀(.xlsx · .xls) 파일인지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  // 사유를 가리면 '결과 질병' 대신 '결과 사유가 달라요'
  const label = (l: string) => (withReason || / 합계$/.test(l) ? l : `${l.split(' ')[0]} 사유가 달라요`)

  return (
    <Collapse title="나이스 출결과 맞춰 보기" sub="나이스 [학급별출결현황] 엑셀을 올려 빠진 것 찾기">
      <div className="space-y-3">
        <ol className="hint list-decimal space-y-0.5 pl-5">
          <li>나이스 [학급별출결현황]에서 학급과 달을 골라 엑셀로 받아요(담임 선생님께 부탁해도 돼요).</li>
          <li>아래에서 같은 달을 고르고 파일을 올려요.</li>
          <li>체육 수업 출결이 나이스보다 많은 학생만 보여요. 나이스는 모든 교과 출결이라 체육이 더 적은 것은 정상이에요.</li>
        </ol>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="label">달</span>
            <input type="month" className="field" value={month} onChange={(e) => (setMonth(e.target.value), setRes(null))} />
          </label>
          <label className={`btn btn-outline ${busy ? 'opacity-60' : ''}`}>
            엑셀 올리기
            <input type="file" accept=".xlsx,.xls" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
          </label>
        </div>
        <p className="hint">파일은 이 기기에서만 읽고 저장하지 않아요.</p>
        {err && <p className="rounded-xl bg-danger-light px-3 py-2 font-bold text-danger">{err}</p>}
        {res && (
          <div className="space-y-2">
            <p className="font-bold">
              {res.cls} · {Number(month.slice(5))}월: {res.matched}명 맞춰 봄
              {res.unmatched.length > 0 && <span className="text-ink-3"> · 명렬에 없는 줄 {res.unmatched.length}</span>}
            </p>
            {res.lines.length === 0 ? (
              <p className="rounded-xl bg-ok-light px-3 py-2 font-bold text-ok">체육 수업 출결이 모두 나이스에 들어 있어요.</p>
            ) : (
              <ul className="space-y-1.5" aria-label="나이스에 빠졌을 수 있는 출결">
                {res.lines.map((l) => (
                  <li key={l.studentId} className="rounded-xl bg-caution-light px-3 py-2">
                    <b>
                      {l.no} {l.name}
                    </b>
                    <span className="ml-2 text-[0.92rem]">
                      {[...new Set(l.more.map((m) => (withReason || / 합계$/.test(m.label) ? `${m.label} 체육 ${m.pe} · 나이스 ${m.neis}` : label(m.label))))].join(' / ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {res.unmatched.length > 0 && <p className="hint">명렬에 없는 줄: {res.unmatched.join(', ')} — 번호 · 이름이 명렬과 같은지 확인해 주세요.</p>}
          </div>
        )}
      </div>
    </Collapse>
  )
}
