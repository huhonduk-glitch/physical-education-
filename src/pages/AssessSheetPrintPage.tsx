import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { itemsOf } from '../lib/assessScore'
import { criteriaLines, recordSheet, sheetStudents } from '../lib/assessSheet'
import { memberNo } from '../lib/groups'
import { useGroups } from '../state/useGroups'

/**
 * 평가 기록지 인쇄 (2026-10-31 교사 요청): 평가 설정대로 칸이 정해진 표 + 채점 기준.
 * 채운 기록지(앱에 채점한 그대로) 또는 빈 기록지(번호 · 이름만, 종이에 채점).
 */
export default function AssessSheetPrintPage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const a = useLiveQuery(() => db.assessments.get(id), [id])
  const { groups, membersOf } = useGroups(true)
  const items = useMemo(() => (a ? itemsOf(a) : []), [a])
  const linked = useMemo(
    () => (groups ?? []).filter((g) => (a?.groupIds ? a.groupIds.includes(g.id) : g.kind === 'homeroom' && g.grade === a?.grade)),
    [groups, a],
  )
  const gid = sp.get('g') && linked.some((g) => g.id === sp.get('g')) ? sp.get('g')! : linked[0]?.id
  const group = linked.find((g) => g.id === gid)
  const list = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const scores = useLiveQuery(() => db.assessmentScores.where('assessmentId').equals(id).toArray(), [id])
  const absences = useLiveQuery(() => (list.length ? db.absences.where('studentId').anyOf(list.map((s) => s.id)).toArray() : []), [list.map((s) => s.id).join(',')])
  const [blank, setBlank] = useState(sp.get('blank') === '1')
  const [withCriteria, setWithCriteria] = useState(true)

  const rows = useMemo(() => {
    if (!a || !group) return []
    const byStudent = new Map((scores ?? []).map((s) => [s.studentId, s]))
    const altIds = new Map((absences ?? []).filter((x) => x.altTaskId === a.id).map((x) => [x.studentId, x.altTaskDone]))
    return recordSheet(a, items, sheetStudents(list, (s) => memberNo(group, s), byStudent, altIds), blank)
  }, [a, group, items, list, scores, absences, blank])
  const [landscape, setLandscape] = useState<boolean | null>(null)
  const cols = rows[0]?.length ?? 0
  const wide = landscape ?? cols > 9

  if (!a) return <PageHeader title="불러오는 중…" back />
  // recordSheet: 머리글 2줄(아래 줄이 있는 칸이 있을 때) 또는 1줄 + 학생 줄
  const heads = rows.length - list.length
  const crit = criteriaLines(a, items)

  return (
    <>
      {wide && <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>}
      <PageHeader
        title="기록지 인쇄"
        sub={a.title}
        back
        right={
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!group}>
            <Icon name="file" /> 인쇄 · PDF
          </button>
        }
      />
      <div className="page space-y-4 pb-10 print:max-w-none print:p-0">
        <section className="card space-y-1 print:hidden">
          {linked.length > 1 && <GroupPicker groups={linked} value={gid ?? null} onChange={(g) => setSp({ g }, { replace: true })} />}
          {[
            ['빈 기록지 (번호 · 이름만, 종이에 채점)', blank, setBlank],
            ['채점 기준 함께 인쇄', withCriteria, setWithCriteria],
            ['가로로 인쇄 (칸이 많을 때)', wide, (v: boolean) => setLandscape(v)],
          ].map(([text, on, set]) => (
            <label key={text as string} className="flex min-h-[48px] items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={on as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} />
              <span className="font-semibold">{text as string}</span>
            </label>
          ))}
          {linked.length === 0 && <p className="hint">이 평가에 연결된 수업반이 없어요.</p>}
        </section>

        {withCriteria && (
          <article className="print-page card space-y-3 print:rounded-none print:p-0 print:shadow-none" aria-label="채점 기준">
            <h2 className="text-xl font-extrabold">{a.title} · 채점 기준</h2>
            {crit.map((c) => (
              <div key={c.title} className="break-inside-avoid">
                <h3 className="font-extrabold">{c.title}</h3>
                <ul className="mt-1 space-y-0.5 text-sm leading-relaxed">
                  {c.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        )}

        {group && (
          <article className="print-page card space-y-2 print:rounded-none print:p-0 print:shadow-none" aria-label="기록지">
            <h2 className="text-lg font-extrabold">
              {a.title} · {group.name} {blank ? '(빈 기록지)' : ''}
            </h2>
            <div className="-mx-4 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full border-collapse text-center text-[0.8rem] print:text-[9pt]">
                <thead>
                  {rows.slice(0, heads).map((r, ri) => (
                    <tr key={ri}>
                      {r.map((v, ci) => {
                        // 위 머리글: 같은 묶음이 이어지면 한 칸으로 합친다. 아래 머리글이 빈 칸은 위 칸을 두 줄로
                        if (heads === 2 && ri === 0) {
                          if (ci > 0 && rows[0][ci - 1] === v && rows[1][ci - 1] !== '' && rows[1][ci] !== '') return null
                          let span = 1
                          while (rows[1][ci] !== '' && rows[0][ci + span] === v && rows[1][ci + span] !== '') span++
                          return (
                            <th key={ci} colSpan={span} rowSpan={rows[1][ci] === '' ? 2 : 1} className="border border-ink-3 bg-fill px-1 py-1 font-bold">
                              {v}
                            </th>
                          )
                        }
                        if (heads === 2 && ri === 1 && v === '') return null
                        return (
                          <th key={ci} className="border border-ink-3 bg-fill px-1 py-1 font-bold">
                            {v}
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rows.slice(heads).map((r, ri) => (
                    <tr key={ri} className="break-inside-avoid">
                      {r.map((v, ci) => (
                        <td key={ci} className={`border border-ink-3 px-1 py-1.5 ${ci === 1 ? 'whitespace-nowrap' : ''} ${blank ? 'h-8' : ''}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </>
  )
}
