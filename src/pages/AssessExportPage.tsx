import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { Assessment, AssessmentScore } from '../db/types'
import { fmtNum, itemMax, itemsOf, totalOf } from '../lib/assessScore'
import { saveBlob } from '../lib/download'
import {
  assessWorkbook,
  buildAssessGrid,
  fillTemplateGrid,
  headerMerges,
  layoutOf,
  matchAreaTitle,
  matchTemplateRows,
  parseAssessTemplate,
  type AssessTemplate,
  type SheetLayout,
} from '../lib/neisAssess'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

interface Loaded {
  fileName: string
  grid: string[][]
  layout: SheetLayout
  tpl: AssessTemplate
}

interface Issue {
  level: 'error' | 'warn'
  text: string
}

/** 나이스 수행평가 일괄입력 파일 만들기 (재설계 3단계) */
export default function AssessExportPage() {
  const { settings } = useApp()
  const { groups, membersOf } = useGroups(true)
  const assessments = useLiveQuery(() => db.assessments.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const withAssess = useMemo(() => (groups ?? []).filter((g) => (assessments ?? []).some((a) => a.groupIds?.includes(g.id))), [groups, assessments])
  const [gid, setGid] = useState<string | null>(null)
  const group = withAssess.find((g) => g.id === gid) ?? withAssess[0]
  const members = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const linked = useMemo(() => (assessments ?? []).filter((a) => group && a.groupIds?.includes(group.id)), [assessments, group])
  const scores = useLiveQuery(async () => {
    if (!linked.length) return new Map<string, Map<string, AssessmentScore>>()
    const rows = await db.assessmentScores.where('assessmentId').anyOf(linked.map((a) => a.id)).toArray()
    const m = new Map<string, Map<string, AssessmentScore>>()
    for (const r of rows) {
      if (!m.has(r.assessmentId)) m.set(r.assessmentId, new Map())
      m.get(r.assessmentId)!.set(r.studentId, r)
    }
    return m
  }, [linked.map((a) => a.id).join(',')])
  const [mode, setMode] = useState<'template' | 'new'>('template')

  const scoreOf = (a: Assessment, studentId: string) => totalOf(itemsOf(a), scores?.get(a.id)?.get(studentId)?.scores)

  return (
    <>
      <PageHeader title="나이스로 내보내기" sub="수행평가 일괄입력 파일" back />
      <div className="page space-y-4 pb-10">
        {withAssess.length === 0 ? (
          <div className="card space-y-2 text-center">
            <p className="font-extrabold">수업반에 연결된 평가가 없어요</p>
            <Link to="/more/assessments/new" className="btn btn-primary w-full">
              평가 만들기
            </Link>
          </div>
        ) : (
          <>
            {withAssess.length > 1 && <GroupPicker groups={withAssess} value={group?.id ?? null} onChange={setGid} />}
            <div className="segment" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'template'} onClick={() => setMode('template')}>
                나이스 양식에 채우기
              </button>
              <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => setMode('new')}>
                양식 없이 만들기
              </button>
            </div>
            {group &&
              (mode === 'template' ? (
                <TemplateFill key={group.id} groupKind={group.kind} members={members} linked={linked} scoreOf={scoreOf} />
              ) : (
                <NewFile key={group.id} group={group} members={members} linked={linked} scoreOf={scoreOf} />
              ))}
          </>
        )}
      </div>
    </>
  )
}

type ScoreOf = (a: Assessment, studentId: string) => ReturnType<typeof totalOf>

/** 방법 1 (권장): 나이스에서 받은 양식을 올리면 점수만 채워 같은 파일로 돌려준다 */
function TemplateFill({ groupKind, members, linked, scoreOf }: { groupKind: 'homeroom' | 'elective'; members: { id: string; name: string; number: number }[]; linked: Assessment[]; scoreOf: ScoreOf }) {
  const [file, setFile] = useState<Loaded | null>(null)
  const [err, setErr] = useState('')
  /** 양식 영역 열 → 평가 id ('' = 비워 둠) */
  const [mapping, setMapping] = useState<Record<number, string>>({})

  const load = async (f: File | undefined) => {
    setErr('')
    if (!f) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer())
      const name = wb.SheetNames[0]
      const ws = wb.Sheets[name]
      const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
      const tpl = parseAssessTemplate(grid)
      if (!tpl) return setErr('번호·성명 머리글을 찾지 못했어요. 나이스에서 받은 수행평가 일괄입력 양식인지 확인해 주세요.')
      if (tpl.areas.length === 0) return setErr('양식에 평가 영역 칸이 없어요.')
      const m: Record<number, string> = {}
      for (const area of tpl.areas) m[area.col] = matchAreaTitle(area.title, linked)?.id ?? ''
      setMapping(m)
      setFile({ fileName: f.name, grid, layout: layoutOf(ws, name), tpl })
    } catch {
      setErr('파일을 읽지 못했어요. 엑셀(.xlsx) 파일인지 확인해 주세요.')
    }
  }

  const result = useMemo(() => {
    if (!file) return null
    const { matches, missing } = matchTemplateRows(file.tpl, members, groupKind === 'homeroom')
    const issues: Issue[] = []
    const cells: { row: number; col: number; value: string }[] = []
    for (const area of file.tpl.areas) {
      const a = linked.find((x) => x.id === mapping[area.col])
      if (!a) {
        issues.push({ level: 'warn', text: `'${area.title}' 칸은 연결한 평가가 없어 비워 둬요` })
        continue
      }
      const max = itemsOf(a).reduce((n, it) => n + itemMax(it), 0)
      if (area.max !== null && Math.abs(area.max - max) > 1e-9) issues.push({ level: 'error', text: `'${area.title}' 만점이 달라요 — 양식 ${area.max}점, 앱 ${max}점. 평가의 채점 요소 점수를 맞춰 주세요` })
      for (const m of matches) {
        if (!m.studentId) continue
        const t = scoreOf(a, m.studentId)
        if (!t.complete) {
          issues.push({ level: 'error', text: `${m.row.number}번 ${m.row.name} · ${a.title}: 채점이 끝나지 않았어요 (${t.done}/${itemsOf(a).length})` })
          continue
        }
        if (area.max !== null && t.total > area.max) issues.push({ level: 'error', text: `${m.row.number}번 ${m.row.name} · ${a.title}: ${fmtNum(t.total)}점이 만점을 넘어요` })
        cells.push({ row: m.row.row, col: area.col, value: fmtNum(t.total) })
      }
    }
    for (const m of matches) if (!m.studentId) issues.push({ level: 'warn', text: `양식 ${m.row.number}번 ${m.row.name}: ${m.problem} — 점수를 비워 둬요` })
    for (const s of missing) issues.push({ level: 'warn', text: `${s.name}: 수업반에는 있지만 양식에 없어요 (파일에 들어가지 않아요)` })
    return { issues, cells, matched: matches.filter((m) => m.studentId).length }
  }, [file, mapping, members, groupKind, linked, scoreOf])

  const download = async () => {
    if (!file || !result) return
    if (result.issues.some((i) => i.level === 'warn') && !confirm('확인할 내용이 남아 있어요. 그래도 파일을 만들까요?')) return
    const XLSX = await import('xlsx')
    const wb = assessWorkbook(XLSX, fillTemplateGrid(file.grid, result.cells), file.layout)
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    saveBlob(file.fileName.replace(/\.xlsx?$/i, '') + '_점수입력.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  }

  const errors = result?.issues.filter((i) => i.level === 'error') ?? []
  const warns = result?.issues.filter((i) => i.level === 'warn') ?? []

  return (
    <section className="space-y-3">
      <div className="card space-y-3">
        <p className="card-title">① 나이스에서 받은 양식 올리기</p>
        <p className="hint">나이스 수행평가 일괄입력에서 내려받은 엑셀(학생 이름이 들어 있는 빈 양식)을 올려 주세요. 영역 이름·만점이 바뀌어도 머리글을 읽어서 맞춰요. 파일은 이 기기 안에서만 읽어요.</p>
        <label className="btn btn-primary relative w-full">
          <Icon name="upload" /> {file ? '다른 양식 올리기' : '양식 파일 고르기'}
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => (void load(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        {err && <p className="font-bold text-danger">{err}</p>}
        {file && (
          <p className="text-sm font-semibold text-ink-2">
            {file.fileName} · 학생 {file.tpl.rows.length}명 · 영역 {file.tpl.areas.length}칸{file.tpl.rows[0]?.subject ? ` · ${file.tpl.rows[0].subject}` : ''}
          </p>
        )}
      </div>

      {file && result && (
        <>
          <div className="card space-y-2">
            <p className="card-title">② 영역 ↔ 평가 연결</p>
            {file.tpl.areas.map((area) => (
              <label key={area.col} className="block rounded-xl bg-fill p-3">
                <span className="block text-sm font-bold text-ink-2">
                  양식: {area.title}
                  {area.max !== null && <span className="text-ink-3"> · 만점 {area.max}</span>}
                </span>
                <select className="field mt-1 bg-white" value={mapping[area.col] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [area.col]: e.target.value }))} aria-label={`${area.title} 연결`}>
                  <option value="">비워 두기</option>
                  {linked.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({itemsOf(a).reduce((n, it) => n + itemMax(it), 0)}점)
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="card space-y-2">
            <p className="card-title">③ 검사</p>
            <p className="text-sm font-semibold text-ink-2">
              학생 맞춤 {result.matched}/{file.tpl.rows.length}명 · 채울 칸 {result.cells.length}개
            </p>
            {errors.length === 0 && warns.length === 0 && <p className="rounded-xl bg-ok-light px-3 py-2 font-bold text-ok">✅ 모두 맞아요. 파일을 받아 나이스에 올리세요.</p>}
            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-danger-light p-3 text-sm font-semibold text-danger">
                {errors.slice(0, 40).map((i, k) => (
                  <li key={k}>❌ {i.text}</li>
                ))}
                {errors.length > 40 && <li>… 외 {errors.length - 40}개</li>}
              </ul>
            )}
            {warns.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-caution-light p-3 text-sm font-semibold text-caution">
                {warns.slice(0, 40).map((i, k) => (
                  <li key={k}>⚠️ {i.text}</li>
                ))}
                {warns.length > 40 && <li>… 외 {warns.length - 40}개</li>}
              </ul>
            )}
            <button type="button" className="btn btn-primary w-full text-lg" disabled={errors.length > 0} onClick={download}>
              <Icon name="download" /> 점수 채운 파일 받기
            </button>
            {errors.length > 0 && <p className="hint">빨간 항목을 고치면 파일을 받을 수 있어요.</p>}
          </div>
        </>
      )}
    </section>
  )
}

/** 방법 2: 양식이 없을 때 같은 모양으로 새로 만든다 (나이스 양식과 한 번 비교 권장) */
function NewFile({
  group,
  members,
  linked,
  scoreOf,
}: {
  group: { name: string; subject: string; kind: 'homeroom' | 'elective'; classNo?: number }
  members: { id: string; name: string; number: number; classNo: number; studentCode: string }[]
  linked: Assessment[]
  scoreOf: ScoreOf
}) {
  const [subject, setSubject] = useState(group.subject)
  const [cls, setCls] = useState(group.kind === 'homeroom' ? String(group.classNo ?? '') : '')
  const [picked, setPicked] = useState<string[]>(linked.map((a) => a.id))
  const chosen = linked.filter((a) => picked.includes(a.id))
  const incomplete = members.flatMap((s) => chosen.filter((a) => !scoreOf(a, s.id).complete).map((a) => `${s.name} · ${a.title}`))

  const download = async () => {
    const rows = members.map((s, i) => ({
      cls: group.kind === 'homeroom' ? String(s.classNo) : cls,
      number: String(group.kind === 'homeroom' ? s.number : i + 1),
      name: s.name,
      scores: chosen.map((a) => fmtNum(scoreOf(a, s.id).total)),
    }))
    const areas = chosen.map((a) => ({ title: a.title, max: itemsOf(a).reduce((n, it) => n + itemMax(it), 0) }))
    const XLSX = await import('xlsx')
    const wb = assessWorkbook(XLSX, buildAssessGrid(subject, rows, areas), { sheetName: 'empty0', merges: headerMerges(3), colWidths: [7, 7, 7, 21, ...areas.map(() => 21)] })
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    saveBlob(`수행평가_${group.name}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  }

  return (
    <section className="card space-y-3">
      <p className="rounded-xl bg-caution-light px-3 py-2 text-sm font-bold text-caution">
        나이스에서 받은 양식에 채우는 방법이 가장 정확해요. 이 방법으로 만든 파일은 나이스 양식과 과목명·반·번호가 같은지 꼭 비교해 주세요.
        {group.kind === 'elective' && ' 수강반은 번호를 학번 순서대로 1번부터 붙여요.'}
      </p>
      <label className="block">
        <span className="label">과목 (나이스 양식에 적힌 그대로, 예: 운동과 건강(2))</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      {group.kind === 'elective' && (
        <label className="block">
          <span className="label">반 (나이스 양식의 반 칸 값)</span>
          <input className="field" value={cls} onChange={(e) => setCls(e.target.value)} />
        </label>
      )}
      <div>
        <span className="label">넣을 평가(영역)</span>
        <div className="flex flex-wrap gap-2">
          {linked.map((a) => (
            <button key={a.id} type="button" className="chip" aria-pressed={picked.includes(a.id)} onClick={() => setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}>
              {a.title}
            </button>
          ))}
        </div>
      </div>
      {incomplete.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-danger-light p-3 text-sm font-semibold text-danger">
          {incomplete.slice(0, 30).map((t) => (
            <li key={t}>❌ {t}: 채점이 끝나지 않았어요</li>
          ))}
          {incomplete.length > 30 && <li>… 외 {incomplete.length - 30}개</li>}
        </ul>
      )}
      <button type="button" className="btn btn-primary w-full" disabled={chosen.length === 0 || incomplete.length > 0 || !subject.trim()} onClick={download}>
        <Icon name="download" /> 파일 만들기 ({members.length}명 · 영역 {chosen.length}칸)
      </button>
    </section>
  )
}
