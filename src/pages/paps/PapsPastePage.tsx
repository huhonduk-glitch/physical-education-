import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClassPicker, { classKeyStr } from '../../components/ClassPicker'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { setCells } from '../../db/papsRepo'
import { cellLabel, MEASURE_LABEL } from '../../lib/neisHeaderParser'
import { checkValue } from '../../lib/neisExport'
import { cellId, type CellSpec } from '../../lib/papsLayout'
import { parsePapsPaste } from '../../lib/papsPasteParser'
import { fixed } from '../../lib/paps'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { measureGroups, usePapsClassKey } from './common'

/** 기록 붙여넣기 (파일 없이) — 헤더가 있으면 알아서 칸을 맞추고, 없으면 고른 종목 칸 순서대로 */
export default function PapsPastePage() {
  const { settings, readOnly } = useApp()
  const nav = useNavigate()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const groups = measureGroups(pc.cells).filter((g) => g.key !== 'bmi')
  const [groupKey, setGroupKey] = useState<string>('')
  const cells: CellSpec[] | null = groups.find((g) => g.key === groupKey)?.cells ?? null
  const [text, setText] = useState('')
  const result = useMemo(() => (text.trim() ? parsePapsPaste(text, { students: pc.students, cells }) : null), [text, pc.students, cells])
  const [saved, setSaved] = useState('')

  const shownCells: CellSpec[] = useMemo(() => {
    if (!result) return []
    const ids = new Set(result.rows.flatMap((r) => Object.keys(r.values)))
    return pc.cells.filter((c) => ids.has(cellId(c))).concat(
      [...ids]
        .filter((id) => !pc.cells.some((c) => cellId(c) === id))
        .map((id) => {
          const [key, a, s] = id.split('|')
          return { key: key as CellSpec['key'], attempt: a ? Number(a) : null, side: (s || null) as CellSpec['side'] }
        }),
    )
  }, [result, pc.cells])

  const stats = useMemo(() => {
    if (!result) return { errors: 0, overwrite: 0, bad: 0, ok: 0 }
    let overwrite = 0
    let bad = 0
    for (const r of result.rows) {
      if (!r.studentId) continue
      for (const [id, v] of Object.entries(r.values)) {
        if (pc.values.get(r.studentId)?.has(id) && pc.values.get(r.studentId)?.get(id) !== v) overwrite++
        if (checkValue(v, settings.neisRanges[id.split('|')[0]])) bad++
      }
    }
    const errors = result.rows.filter((r) => r.errors.length).length
    return { errors, overwrite, bad, ok: result.rows.length - errors }
  }, [result, pc.values, settings.neisRanges])

  const save = async () => {
    if (!result) return
    if (stats.overwrite && !confirm(`${stats.overwrite}칸을 덮어씁니다. 계속할까요?`)) return
    const items = result.rows
      .filter((r) => r.studentId && !r.errors.length)
      .flatMap((r) =>
        Object.entries(r.values).map(([id, value]) => {
          const [key, a, s] = id.split('|')
          return { studentId: r.studentId!, cell: { key: key as CellSpec['key'], attempt: a ? Number(a) : null, side: (s || null) as CellSpec['side'] }, value }
        }),
      )
    await setCells(db, settings.schoolYear, items)
    setSaved(`${items.length}칸을 저장했어요.`)
    setText('')
  }

  return (
    <>
      <PageHeader title="붙여넣기 입력" back />
      <div className="page space-y-4 pb-8">
        <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
        <section className="card space-y-3">
          <p className="hint">
            엑셀에서 <b>헤더(제목 줄)까지</b> 복사해 붙여넣으면 칸을 알아서 맞춰요. 나이스 양식 전체를 붙여넣어도 돼요.
            <br />
            값만 붙여넣을 때는 먼저 종목을 고르세요: <code>1 34</code> · <code>1 강OO 34</code> · <code>10101 34</code> · <code>1 32.9 27.6 32 27</code>
          </p>
          <select className="field" aria-label="종목 (값만 붙여넣을 때)" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
            <option value="">종목 고르기 (헤더 없이 값만 붙여넣을 때)</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {MEASURE_LABEL[g.key as keyof typeof MEASURE_LABEL] ?? g.key} ({g.cells.map(cellLabel).join(', ')})
              </option>
            ))}
          </select>
          <textarea className="field min-h-[9rem] py-2 font-mono text-[0.95rem]" aria-label="기록 붙여넣기" value={text} onChange={(e) => (setText(e.target.value), setSaved(''))} placeholder={'예)\n1\t34\n2\t41\n3\t28'} />
        </section>

        {saved && <p className="card bg-ok-light font-bold text-ok shadow-none">{saved}</p>}

        {result && (
          <section className="card space-y-3 p-0">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
              <p className="card-title flex-1">미리보기 · {result.mode === 'table' ? '헤더 인식' : '값만'}</p>
              {stats.errors > 0 && <span className="badge bg-danger-light text-danger">오류 {stats.errors}줄</span>}
              {stats.bad > 0 && <span className="badge bg-danger-light text-danger">범위·자릿수 {stats.bad}칸</span>}
              {stats.overwrite > 0 && <span className="badge bg-caution-light text-caution">덮어쓰기 {stats.overwrite}칸</span>}
            </div>
            {result.sequential && <p className="mx-4 rounded-xl bg-caution-light p-3 font-bold text-caution">값만 있어서 번호순으로 채웠어요. 순서가 맞는지 꼭 확인하세요!</p>}
            {result.unknownColumns.length > 0 && <p className="mx-4 rounded-xl bg-caution-light p-3 text-sm font-bold text-caution">알아보지 못한 열(무시): {result.unknownColumns.join(', ')}</p>}
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-max border-separate border-spacing-y-1 text-left text-[0.92rem]">
                <thead>
                  <tr className="text-ink-3">
                    <th className="px-2">줄</th>
                    <th className="px-2">학생</th>
                    {shownCells.map((c) => (
                      <th key={cellId(c)} className="px-2 whitespace-nowrap">
                        {cellLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const st = pc.students.find((s) => s.id === r.studentId)
                    return (
                      <tr key={r.line} className={r.errors.length ? 'bg-danger-light' : 'bg-fill'}>
                        <td className="rounded-l-xl px-2 py-2 text-ink-3">{r.line}</td>
                        <td className="px-2 py-2 font-bold whitespace-nowrap">
                          {st ? `${st.number} ${st.name}` : r.who || '?'}
                          {r.errors.map((e) => (
                            <span key={e} className="block text-[0.78rem] text-danger">
                              {e}
                            </span>
                          ))}
                          {r.warnings.map((w) => (
                            <span key={w} className="block text-[0.78rem] text-caution">
                              {w}
                            </span>
                          ))}
                        </td>
                        {shownCells.map((c, k) => {
                          const id = cellId(c)
                          const v = r.values[id]
                          const old = r.studentId ? pc.values.get(r.studentId)?.get(id) : undefined
                          const bad = v !== undefined && checkValue(v, settings.neisRanges[c.key])
                          const over = v !== undefined && old !== undefined && old !== v
                          return (
                            <td key={id} className={`px-2 py-2 tabular-nums ${k === shownCells.length - 1 ? 'rounded-r-xl' : ''} ${bad ? 'font-bold text-danger' : over ? 'bg-caution-light' : ''}`}>
                              {v === undefined ? '' : fixed(v, 4)}
                              {over && <span className="block text-[0.72rem] text-caution">기존 {fixed(old!, 4)}</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <button type="button" className="btn btn-primary w-full" disabled={readOnly || stats.ok === 0} onClick={save}>
                오류 없는 {stats.ok}줄 저장{stats.overwrite ? ` (덮어쓰기 ${stats.overwrite}칸)` : ''}
              </button>
              {cls && (
                <button type="button" className="btn btn-ghost mt-2 w-full text-ink-3" onClick={() => nav(`/paps?c=${classKeyStr(cls)}`)}>
                  PAPS 첫 화면으로
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
