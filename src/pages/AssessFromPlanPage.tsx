import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionBar from '../components/ActionBar'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import type { AssessItem, Assessment } from '../db/types'
import { readAssessPlan, planTotals, type PlannedAssessment } from '../lib/assessPlanCells'
import { fmtNum, itemMax } from '../lib/assessScore'
import { STANDARDS, findStandards } from '../lib/standards'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/** 평가계획서 PDF → 수행평가 여러 개 한 번에 (6-5 ②). 파일은 이 기기 안에서만 읽는다 */
export default function AssessFromPlanPage() {
  const nav = useNavigate()
  const { settings, readOnly } = useApp()
  const { groups } = useGroups()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [list, setList] = useState<(PlannedAssessment & { on: boolean })[] | null>(null)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [semester, setSemester] = useState<0 | 1 | 2>(new Date().getMonth() >= 7 ? 2 : 1)

  const read = async (f: File) => {
    setBusy(true)
    setErr('')
    try {
      const [{ readPdf, buildCells }, pdfjs, worker] = await Promise.all([import('../lib/pdfTable'), import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const pages = await readPdf(pdfjs as unknown as Parameters<typeof readPdf>[0], new Uint8Array(await f.arrayBuffer()))
      const found = readAssessPlan(pages.map((p) => buildCells(p).cells))
      if (!found.length) setErr('수행평가 세부계획 표(평가요소 · 채점 기준)를 찾지 못했어요. 한글에서 PDF로 저장한 파일인지 확인해 주세요. 스캔한 PDF는 못 읽어요.')
      setList(found.map((a) => ({ ...a, on: true })))
    } catch (e) {
      setErr(`파일을 읽지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const chosen = (list ?? []).filter((a) => a.on)
  const totals = planTotals(chosen)
  const make = async () => {
    if (!chosen.length || !groupIds.length) return
    const firstGroup = (groups ?? []).find((g) => groupIds.includes(g.id))
    const all = findStandards(STANDARDS, {})
    const rows: Assessment[] = chosen.map((a) => {
      const item: AssessItem = a.item ? { ...a.item, id: newId() } : { id: newId(), label: a.title, method: 'direct', max: a.max ?? 0 }
      return {
        id: newId(),
        schoolYear: settings.schoolYear,
        title: a.title.trim(),
        grade: firstGroup?.grade ?? 0,
        rubric: [],
        altTaskEnabled: true,
        groupIds,
        items: [item],
        semester,
        standards: a.standards.map((code) => ({ code, text: all.find((s) => s.code === code)?.text ?? '' })),
        plan: { elements: a.elements, methods: a.methods, when: a.when, ratio: a.ratio, levelDescs: a.levelDescs },
      }
    })
    await db.assessments.bulkAdd(rows)
    nav('/more/assessments', { replace: true })
  }
  const edit = (i: number, p: Partial<PlannedAssessment & { on: boolean }>) => setList((l) => l && l.map((a, k) => (k === i ? { ...a, ...p } : a)))

  return (
    <>
      <PageHeader title="평가계획서로 만들기" sub="수행평가 · 채점 기준 · 체크리스트" back />
      <div className="page space-y-4 pb-8">
        {!list ? (
          <section className="card space-y-3">
            <label className="btn btn-primary w-full cursor-pointer">
              <Icon name="upload" /> {busy ? '읽는 중…' : '평가계획서 PDF 고르기'}
              <input type="file" accept=".pdf" className="sr-only" disabled={busy || readOnly} onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
            </label>
            <ul className="hint list-disc space-y-1 pl-5">
              <li>&lsquo;수행평가 세부계획 및 세부기준&rsquo; 표에서 평가마다 성취기준 · 평가요소 · 평가방법 · 시기 · 반영비율 · 만점 · 성취수준(A/B/C) · 채점 기준을 읽어요.</li>
              <li>&lsquo;남자 20회 이상, 여자 15회 이상&rsquo;처럼 남녀 기준이 다르면 따로 넣고, &lsquo;자발적 미참여&rsquo; 점수도 넣어요. 평가 요소 개수로 점수를 주면 체크리스트로 만들어요.</li>
              <li>채점 기준 구간이 겹치거나 비면 알려 드려요. 나이스에 내기 전에 계획서를 고칠 수 있어요.</li>
              <li>한글 파일은 [파일 → PDF로 저장]해서 넣으세요. 파일은 이 기기 안에서만 읽어요.</li>
            </ul>
            {err && <p className="font-bold text-danger">{err}</p>}
          </section>
        ) : (
          <>
            {err && <p className="rounded-2xl bg-caution-light p-4 font-bold text-caution">{err}</p>}
            <p className="font-bold">
              평가 {list.length}개를 찾았어요 · 고른 {chosen.length}개 만점 합 {fmtNum(totals.max)}점 · 반영비율 합 {fmtNum(totals.ratio)}%
            </p>
            {totals.ratio > 0 && totals.ratio !== 100 && <p className="hint">반영비율 합이 100%가 아니에요. 정기시험이 있거나 일부 평가만 골랐다면 괜찮아요.</p>}
            {list.map((a, i) => (
              <section key={i} className={`card space-y-2 ${a.on ? '' : 'opacity-60'}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={a.on} onChange={(e) => edit(i, { on: e.target.checked })} />
                  <input className="field flex-1 font-bold" value={a.title} onChange={(e) => edit(i, { title: e.target.value })} aria-label="평가 이름 (나이스 영역 이름)" />
                </label>
                <p className="hint">
                  {[a.max !== undefined ? `만점 ${a.max}점` : '', a.ratio ? `반영 ${a.ratio}` : '', a.when, a.standards.join(' '), a.methods.join(' · ')].filter(Boolean).join(' · ')}
                </p>
                {a.item && <ItemSummary item={a.item} />}
                {a.levelDescs.length > 0 && (
                  <details className="text-sm text-ink-2">
                    <summary className="cursor-pointer font-bold text-brand">성취수준별 수행 특성 {a.levelDescs.map((l) => l.label).join('·')}</summary>
                    <ul className="mt-1 space-y-1">
                      {a.levelDescs.map((l) => (
                        <li key={l.label}>
                          <b>{l.label}</b> {l.desc}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {a.problems.map((p) => (
                  <p key={p} className="rounded-xl bg-danger-light px-3 py-2 text-sm font-bold text-danger">
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <section className="card space-y-3">
              <p className="card-title">이 평가를 하는 수업반</p>
              <div className="flex flex-wrap gap-2">
                {(groups ?? []).map((g) => {
                  const on = groupIds.includes(g.id)
                  return (
                    <button key={g.id} type="button" className="chip" aria-pressed={on} onClick={() => setGroupIds(on ? groupIds.filter((x) => x !== g.id) : [...groupIds, g.id])}>
                      {g.name}
                    </button>
                  )
                })}
              </div>
              <div className="segment" role="radiogroup" aria-label="학기">
                {([1, 2, 0] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={semester === s} onClick={() => setSemester(s)}>
                    {s ? `${s}학기` : '1년'}
                  </button>
                ))}
              </div>
            </section>
            {list.some((a) => a.on && a.problems.length) && <p className="hint px-1">빨간 알림이 있어도 만들 수 있어요. 만든 뒤 [고치기]에서 채점 구간을 바로잡으세요.</p>}
            <button type="button" className="btn btn-ghost w-full" onClick={() => setList(null)}>
              다른 파일 고르기
            </button>
            {!readOnly && (
              <ActionBar>
                <button type="button" className="btn btn-primary w-full" disabled={!chosen.length || !groupIds.length} onClick={make}>
                  {groupIds.length ? `수행평가 ${chosen.length}개 만들기` : '수업반을 골라 주세요'}
                </button>
              </ActionBar>
            )}
          </>
        )}
      </div>
    </>
  )
}

/** 채점 요소 한눈에: 기록표(남녀) 또는 체크리스트 */
function ItemSummary({ item }: { item: AssessItem }) {
  const dir = item.better === 'lower' ? '이하' : '이상'
  const line = (bands: { limit: number; points: number }[], base?: number) =>
    [...bands]
      .sort((a, b) => b.points - a.points)
      .map((b) => `${fmtNum(b.limit)}${item.unit ?? ''} ${dir} ${fmtNum(b.points)}`)
      .concat(base !== undefined ? [`그 밖 ${fmtNum(base)}`] : [])
      .join(' · ')
  return (
    <div className="space-y-1 rounded-xl bg-fill px-3 py-2 text-sm">
      <p className="font-bold">
        {item.label} · {item.checks?.length ? `체크리스트 ${item.checks.length}개` : '기록표'} · 만점 {fmtNum(itemMax(item))}점
        {item.nonPartPoints !== undefined && ` · 미참여 ${fmtNum(item.nonPartPoints)}점`}
      </p>
      {item.bandsF ? (
        <>
          <p>
            <b>남</b> {line(item.bands ?? [], item.basePoints)}
          </p>
          <p>
            <b>여</b> {line(item.bandsF, item.basePointsF)}
          </p>
        </>
      ) : (
        <p>{line(item.bands ?? [], item.basePoints)}</p>
      )}
    </div>
  )
}
