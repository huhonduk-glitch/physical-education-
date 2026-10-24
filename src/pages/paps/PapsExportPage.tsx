import { useState } from 'react'
import { Link } from 'react-router-dom'
import ClassPicker, { classKeyStr } from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { indexResults, loadClassPapsFactorPicked, loadClassPapsPicked, studentSummary } from '../../db/papsRepo'
import type { PapsConfig, PapsResult } from '../../db/types'
import { saveBlob } from '../../lib/download'
import { buildRows, rowsToXlsx, validateExport, type ExportIssue } from '../../lib/neisExport'
import { cellId, columnsFor, selectedFromColumns } from '../../lib/papsLayout'
import { FACTORS, type EventId, type Factor } from '../../lib/paps'
import { groupOfEvent, type PickGroup, type RoundPick } from '../../lib/papsRounds'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { measureGroups, usePapsClassKey } from './common'

interface Outcome {
  /** round: 그 학생에게 고른 회차 (문제를 누르면 그 회차 입력 칸으로 간다) */
  issues: (ExportIssue & { cls: string; round: { id: string | null; no: number } })[]
  excluded: string[]
  unknown: string[]
  fileName?: string
  rows?: number
  blocked?: string
  /** 회차를 고른 결과 요약 (예: 2회차 18명 · 1회차 7명). 요인별 최고면 요인마다 한 줄 */
  picked?: string[]
}

/** 내보낼 회차 고르기: 최근 회차 / 최고 회차(통째로) / 요인별 최고 */
type ExportPick = RoundPick | 'factor'

/** 요인별 최고의 묶음: 요인마다 선택 종목(스텝검사는 심박수 칸까지), 신장·체중·체지방은 최근 회차 (2026-10-24 교사 결정) */
function factorGroups(selected: Partial<Record<Factor, EventId>>): PickGroup[] {
  const out: PickGroup[] = []
  for (const f of FACTORS) {
    const e = selected[f]
    if (f === '비만' || !e) continue
    out.push({ key: f, events: e === 'stepTest' ? ['stepTest', 'heartRate'] : [e], mode: 'best' })
  }
  out.push({ key: '비만', events: ['height', 'weight', 'bodyFat'], mode: 'latest' })
  return out
}

const GROUP_LABEL: Record<string, string> = { 비만: '신장·체중', '*': '기타' }

/** 나이스 내보내기 (CLAUDE.md 4-5): 검사 → 문제 없을 때만 파일 */
export default function PapsExportPage() {
  const { settings, standards } = useApp()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const [scope, setScope] = useState<'class' | 'grade'>('class')
  // 여러 번 측정했을 때 학생마다 어느 회차를 내보낼지 (B-5 교사 결정: 회차 하나를 통째로, 섞지 않음)
  // 2026-10-24: 요인마다 회차를 따로 고르는 '요인별 최고'도 (요인 안의 칸은 섞지 않음)
  const [pick, setPick] = useState<ExportPick>('latest')
  const [out, setOut] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [showN, setShowN] = useState(30)
  const year = settings.schoolYear
  const template = settings.neisTemplates[String(year)] ?? null
  const defaults = { course: settings.defaultCourse, track: settings.defaultTrack, dept: settings.defaultDept }

  const run = async () => {
    if (!cls) return
    setBusy(true)
    setOut(null)
    setShowN(30)
    try {
      const targets = scope === 'class' ? [cls] : classes.filter((c) => c.grade === cls.grade)
      const all: Outcome = { issues: [], excluded: [], unknown: [] }
      let columns = null as ReturnType<typeof columnsFor> | null
      let headerKey = ''
      const rows: string[][] = []
      // 묶음(요인, 통째로면 '') → 회차 번호 → 학생 수
      const pickedCount = new Map<string, Map<number, number>>()
      const countPick = (g: string, n: number) => {
        let m = pickedCount.get(g)
        if (!m) pickedCount.set(g, (m = new Map()))
        m.set(n, (m.get(n) ?? 0) + 1)
      }
      for (const c of targets) {
        const students = (await db.students.where('[schoolYear+grade+classNo]').equals([year, c.grade, c.classNo]).toArray())
          .filter((s) => s.status === '재학')
          .sort((a, b) => a.number - b.number)
        const tCols = template ? columnsFor(template, {}) : null
        const selectedOf = (config: { selectedEvents?: Record<string, string> } | undefined): Partial<Record<Factor, EventId>> => {
          const saved = (config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
          return Object.keys(saved).length ? saved : tCols ? selectedFromColumns(tCols, standards.events) : {}
        }
        const byId = new Map(students.map((s) => [s.id, s]))
        const summaryOf = (sid: string, rs: PapsResult[], config: PapsConfig | undefined) => {
          const s = byId.get(sid)
          return s ? studentSummary(standards, s, settings.schoolLevel, selectedOf(config), indexResults(rs).values.get(sid), settings.papsFlexMode) : null
        }
        const ids = students.map((s) => s.id)
        // 학생·칸 → 고른 회차 (문제를 누르면 그 회차 입력 칸으로 간다)
        let roundOfCell: (sid: string, cell: string) => string | null
        let data: { config: PapsConfig | undefined; results: PapsResult[]; rounds: { id: string | null; round: number }[] }
        if (pick === 'factor') {
          // 요인마다: 그 요인 칸이 다 있는 회차 먼저 → 그 요인 점수 높은 회차 → 같으면 늦은 회차
          const d = await loadClassPapsFactorPicked(
            db,
            year,
            c.grade,
            c.classNo,
            ids,
            (config) => factorGroups(selectedOf(config)),
            (sid, g, rs, config) => {
              const p = summaryOf(sid, rs, config)
              if (!p) return null
              const groupOf = groupOfEvent(factorGroups(selectedOf(config)))
              const have = indexResults(rs).values.get(sid)
              const need = (tCols ?? columnsFor(null, selectedOf(config))).filter((x) => x.kind === 'measure' && groupOf(x.key) === g)
              return {
                complete: need.every((x) => x.kind === 'measure' && have?.has(cellId(x))),
                total: p.factors.find((f) => f.factor === g)?.points ?? 0,
              }
            },
          )
          const groupOf = groupOfEvent(d.groups)
          roundOfCell = (sid, cell) => d.pick.get(sid)?.get(groupOf(cell.split('|')[0])) ?? null
          const no = new Map(d.rounds.map((r) => [r.id, r.round]))
          for (const s of students) for (const g of d.groups) countPick(g.key, no.get(d.pick.get(s.id)?.get(g.key) ?? null) ?? 1)
          data = d
        } else {
          // 학생마다 회차 하나 → 그 회차의 칸만 (최고 회차는 종합점수로 비교)
          const d = await loadClassPapsPicked(db, year, c.grade, c.classNo, ids, pick, (sid, rs, config) => {
            const p = summaryOf(sid, rs, config)
            return p ? { complete: p.complete, total: p.complete ? (p.total ?? p.sum) : p.sum } : null
          })
          roundOfCell = (sid) => d.pick.get(sid) ?? null
          const no = new Map(d.rounds.map((r) => [r.id, r.round]))
          for (const s of students) countPick('', no.get(d.pick.get(s.id) ?? null) ?? 1)
          data = d
        }
        const roundNo = new Map(data.rounds.map((r) => [r.id, r.round]))
        const selected = selectedOf(data.config)
        const cols = tCols ?? columnsFor(null, selected)
        const key = cols.map((x) => x.header).join('\t')
        if (columns && key !== headerKey) {
          setOut({ issues: [], excluded: [], unknown: [], blocked: '반마다 측정 종목이 달라 학년 전체를 한 파일로 만들 수 없어요. 나이스 양식을 등록하거나 반별로 내보내세요.' })
          return
        }
        columns = cols
        headerKey = key
        const { values, excluded } = indexResults(data.results)
        const v = validateExport(cols, students, values, new Set(excluded.keys()), settings.neisRanges)
        all.issues.push(
          ...v.issues.map((i) => {
            const id = roundOfCell(i.studentId, i.cell)
            return { ...i, cls: `${c.grade}-${c.classNo}`, round: { id, no: roundNo.get(id) ?? 1 } }
          }),
        )
        all.excluded.push(...v.excluded.map((s) => `${c.grade}-${c.classNo} ${s.number}번 ${s.name}`))
        all.unknown = v.unknownColumns
        const r = buildRows(cols, v.included, values, defaults, settings.neisRanges)
        if (rows.length === 0) rows.push(r[0])
        rows.push(...r.slice(1))
      }
      if ([...pickedCount.values()].some((m) => [...m.keys()].some((n) => n > 1)))
        all.picked = [...pickedCount].map(
          ([g, m]) =>
            (g ? `${GROUP_LABEL[g] ?? g}: ` : '') +
            [...m]
              .sort((a, b) => b[0] - a[0])
              .map(([n, k]) => `${n}회차 ${k}명`)
              .join(' · '),
        )
      if (all.issues.length === 0 && all.unknown.length === 0 && rows.length > 1) {
        const name = `PAPS_나이스업로드_${year}_${scope === 'class' ? `${cls.grade}-${cls.classNo}반` : `${cls.grade}학년`}.xlsx`
        saveBlob(name, new Blob([await rowsToXlsx(rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
        all.fileName = name
        all.rows = rows.length - 1
      }
      setOut(all)
    } finally {
      setBusy(false)
    }
  }

  const groups = measureGroups(pc.cells)
  const groupOf = (cellKey: string) => groups.find((g) => g.cells.some((c) => c.key === cellKey))?.key ?? cellKey

  return (
    <>
      <PageHeader title="나이스 내보내기" back />
      <div className="page space-y-4 pb-8">
        <section className="rounded-2xl bg-caution-light p-4 text-caution">
          <p className="font-extrabold">⚠️ 나이스는 기록이 하나라도 비어 있거나 허용 범위를 벗어나면 파일 전체가 업로드되지 않습니다.</p>
          <p className="mt-1 font-semibold">아래 검사가 모두 통과한 뒤 내려받으세요. 측정 제외 학생은 파일에서 빠지므로 나이스에서 따로 처리해야 합니다.</p>
        </section>
        <ClassPicker classes={classes} mine={mine} value={cls} onChange={(c) => (setCls(c), setOut(null))} />
        <section className="card space-y-3">
          <p className="label mb-0">파일 단위</p>
          <div className="segment">
            <button type="button" aria-selected={scope === 'class'} onClick={() => (setScope('class'), setOut(null))}>
              {cls ? `${cls.grade}학년 ${cls.classNo}반만` : '학급별'}
            </button>
            <button type="button" aria-selected={scope === 'grade'} onClick={() => (setScope('grade'), setOut(null))}>
              {cls ? `${cls.grade}학년 전체` : '학년 전체'}
            </button>
          </div>
          <p className="label mb-0">여러 번 측정했으면</p>
          <div className="segment">
            <button type="button" aria-selected={pick === 'latest'} onClick={() => (setPick('latest'), setOut(null))}>
              최근 회차
            </button>
            <button type="button" aria-selected={pick === 'best'} onClick={() => (setPick('best'), setOut(null))}>
              최고 회차
            </button>
            <button type="button" aria-selected={pick === 'factor'} onClick={() => (setPick('factor'), setOut(null))}>
              요인별 최고
            </button>
          </div>
          <p className="hint">
            {pick === 'factor' ? (
              <>
                체력요인마다 점수가 가장 높은 회차를 <b>따로</b> 골라요(같으면 늦은 회차). 한 요인 안의 칸(1차·2차·좌우)은 그 회차 하나에서 그대로 넣어요. 신장·체중은 최근 회차.
              </>
            ) : (
              <>
                학생마다 회차 <b>하나</b>의 칸(1차·2차·좌우)을 그대로 넣어요. 회차를 섞지 않아요.{' '}
                {pick === 'latest' ? '최근 회차 = 그 학생 기록이 있는 가장 늦은 회차.' : '최고 회차 = 다 측정한 회차 중 종합점수가 가장 높은 회차(같으면 늦은 회차).'}
              </>
            )}
          </p>
          <p className="hint">
            {template
              ? '등록한 나이스 양식과 같은 열 순서로 만들어요.'
              : '나이스 양식을 등록하지 않아 표준 헤더로 만들어요. 나이스에서 받은 양식과 열 순서를 한 번 비교해 보세요.'}{' '}
            허용 범위는 <b>추정값</b>이에요 — [PAPS 설정]에서 고칠 수 있어요.
          </p>
          <button type="button" className="btn btn-primary w-full text-lg" disabled={!cls || busy} onClick={run}>
            <Icon name="download" /> {busy ? '검사 중…' : '검사하고 내려받기'}
          </button>
        </section>

        {out?.blocked && <p className="card bg-danger-light font-bold text-danger shadow-none">{out.blocked}</p>}
        {out && !out.blocked && (
          <>
            {out.fileName ? (
              <section className="card bg-ok-light shadow-none">
                <p className="card-title text-ok">✅ 검사 통과 · 파일을 저장했어요</p>
                <p className="mt-1 font-semibold text-ok">
                  {out.fileName} ({out.rows}명)
                </p>
                {out.picked && (
                  <div className="mt-1 text-sm font-semibold text-ok">
                    <p>
                      {pick === 'latest' ? '최근 회차' : pick === 'best' ? '최고 회차' : '요인별 최고 회차'}로 넣었어요{pick === 'factor' ? '' : `: ${out.picked[0]}`}
                    </p>
                    {pick === 'factor' && out.picked.map((t) => <p key={t}>{t}</p>)}
                  </div>
                )}
              </section>
            ) : (
              <section className="card bg-danger-light shadow-none">
                <p className="card-title text-danger">파일을 만들지 않았어요</p>
                <p className="mt-1 font-semibold text-danger">아래 문제를 고친 뒤 다시 눌러 주세요. 항목을 누르면 그 학생 입력 칸으로 가요.</p>
              </section>
            )}
            {out.excluded.length > 0 && (
              <p className="card font-semibold text-ink-2">
                측정 제외 {out.excluded.length}명은 파일에서 빠집니다. 나이스에서 따로 처리하세요: {out.excluded.join(', ')}
              </p>
            )}
            {out.unknown.length > 0 && (
              <p className="card font-bold text-danger">
                알아보지 못한 양식 열이 있어요: {out.unknown.join(', ')} —{' '}
                <Link className="underline" to={`/paps/setup?c=${cls ? classKeyStr(cls) : ''}`}>
                  측정 설정에서 종목을 지정
                </Link>
                해 주세요.
              </p>
            )}
            {out.issues.length > 0 && (
              <section className="card overflow-hidden p-0">
                <p className="card-title px-5 pt-4 pb-2">
                  문제 {out.issues.length}칸 (누락 {out.issues.filter((i) => i.kind === 'missing').length} · 범위·자릿수 {out.issues.filter((i) => i.kind !== 'missing').length})
                </p>
                <ul>
                  {out.issues.slice(0, showN).map((i, k) => (
                    <li key={k}>
                      <Link to={`/paps/input/${groupOf(i.cell.split('|')[0])}?c=${i.cls}&s=${i.studentId}&r=${i.round.id ?? ''}`} className="list-row hover:bg-fill">
                        <span className={`badge ${i.kind === 'missing' ? 'bg-caution-light text-caution' : 'bg-danger-light text-danger'}`}>
                          {i.kind === 'missing' ? '누락' : i.kind === 'range' ? '범위' : '자릿수'}
                        </span>
                        <span className="flex-1">
                          <b>
                            {i.cls} {i.who}
                            {pc.rounds.rounds.length > 1 || i.round.no > 1 ? ` (${i.round.no}회차)` : ''}
                          </b>{' '}
                          · {i.label}
                          {i.value !== undefined && (
                            <span className="text-ink-3">
                              {' '}
                              · 입력 {i.value}
                              {i.range ? ` (허용 ${i.range})` : ''}
                            </span>
                          )}
                        </span>
                        <Icon name="chevronRight" className="text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {out.issues.length > showN && (
                  <button type="button" className="btn btn-ghost w-full text-brand" onClick={() => setShowN((n) => n + 100)}>
                    나머지 {out.issues.length - showN}칸 더 보기
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
