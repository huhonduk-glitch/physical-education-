import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import NeisGuide from '../components/NeisGuide'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { applyRosterPlan, studentsOfYear, type SaveSummary } from '../db/rosterRepo'
import { RosterFileError, readRosterFile } from '../lib/rosterFile'
import type { RosterRow } from '../lib/rosterGrid'
import { defaultNameDecision, planRosterSave, type NameDecision, type SaveMode, type SavePlan } from '../lib/rosterMerge'
import { parsePastedRoster } from '../lib/rosterParser'
import { hasErrors, toNewStudent, validateRoster, type IssueField, type ValidatedRow } from '../lib/rosterValidate'
import { CLASS_OPTIONS, gradesFor } from '../lib/school'
import { genderLabel } from '../lib/text'
import { useApp } from '../state/AppContext'

type Step = 'input' | 'preview' | 'confirm' | 'done'

/** 명렬 올리기: ① 파일 또는 붙여넣기 → ② 미리보기(바로 고치기) → ③ 저장 확인 → ④ 끝 (CLAUDE.md 4-1) */
export default function RosterImportPage() {
  const { settings } = useApp()
  const [step, setStep] = useState<Step>('input')
  const [source, setSource] = useState<'file' | 'paste'>('file')
  const [rows, setRows] = useState<RosterRow[]>([])
  const [origin, setOrigin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<SaveMode>('merge')
  const [plan, setPlan] = useState<SavePlan | null>(null)
  const [decisions, setDecisions] = useState<Record<string, NameDecision>>({})
  const [summary, setSummary] = useState<SaveSummary | null>(null)

  // 붙여넣기
  const [pasteGrade, setPasteGrade] = useState<number | null>(null)
  const [pasteClass, setPasteClass] = useState<number | null>(null)
  const [text, setText] = useState('')

  const { schoolYear, schoolGenderType } = settings
  const validated = useMemo(
    () => validateRoster(rows, { schoolYear, schoolGenderType }),
    [rows, schoolYear, schoolGenderType],
  )
  const blocked = hasErrors(validated)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const r = await readRosterFile(await file.arrayBuffer(), file.name)
      if (r.rows.length === 0) throw new RosterFileError('헤더는 찾았지만 학생 줄이 없어요.')
      setRows(r.rows)
      setOrigin(`${file.name} · ${r.sheetName} 시트 · 헤더 ${r.header!.rowIndex + 1}행`)
      setStep('preview')
    } catch (e) {
      setError(e instanceof RosterFileError ? e.message : '파일을 읽는 중에 문제가 생겼어요. 파일을 다시 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const onPaste = () => {
    setError('')
    const r = parsePastedRoster(text, { grade: pasteGrade, classNo: pasteClass })
    if (r.rows.length === 0) {
      setError('붙여넣은 글자가 없어요.')
      return
    }
    setRows(r.rows)
    setOrigin(`붙여넣기 ${r.rows.length}줄${r.mode === 'table' ? ' (헤더 인식)' : ''}`)
    setStep('preview')
  }

  const updateRow = (key: string, patch: Partial<RosterRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, problems: 'problems' in patch ? patch.problems! : r.problems } : r)))
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))

  const toConfirm = async () => {
    setBusy(true)
    const incoming = validated.map((v) => toNewStudent(v, settings.schoolYear)).filter((s) => s !== null)
    const existing = await studentsOfYear(db, settings.schoolYear)
    const p = planRosterSave(existing, incoming, mode)
    setPlan(p)
    setDecisions(Object.fromEntries(p.nameConflicts.map((c) => [c.student.id, defaultNameDecision(mode)])))
    setBusy(false)
    setStep('confirm')
  }

  const save = async () => {
    if (!plan) return
    setBusy(true)
    try {
      setSummary(await applyRosterPlan(db, plan, decisions))
      setStep('done')
    } catch {
      setError('저장하지 못했어요. 아무것도 바뀌지 않았으니 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="명렬 올리기" back />
      <div className="page space-y-4 py-4">
        {error && (
          <p className="card border-danger bg-danger-light font-bold text-danger" role="alert">
            {error}
          </p>
        )}

        {step === 'input' && (
          <>
            <div className="flex gap-2" role="tablist">
              {(['file', 'paste'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={source === s}
                  className={`btn flex-1 ${source === s ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSource(s)}
                >
                  {s === 'file' ? '📄 엑셀 파일' : '📋 붙여넣기'}
                </button>
              ))}
            </div>

            {source === 'file' ? (
              <div className="card space-y-3">
                <p>
                  <b>나이스 PAPS 일괄업로드 메뉴의 학생명렬표</b>를 그대로 올리면 돼요. 다른 엑셀(.xlsx, .xls)이나 CSV도 헤더를 찾아서 읽어요.
                </p>
                <label className={`btn btn-primary relative w-full text-lg ${busy ? 'opacity-40' : ''}`}>
                  {busy ? '읽는 중…' : '파일 고르기'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      void onFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="hint">생년월일 칸은 읽기만 하고 저장하지 않아요.</p>
                <NeisGuide kind="roster" />
              </div>
            ) : (
              <div className="card space-y-3">
                <p className="hint">
                  번호와 이름만 붙여넣을 때는 학년·반을 먼저 골라 주세요. 줄에 학년·반이 있으면(예: <code>1-3-12 홍길동</code>, <code>10312 홍길동</code>) 고르지 않아도 돼요.
                </p>
                <div className="flex gap-2">
                  <select className="field" aria-label="학년" value={pasteGrade ?? ''} onChange={(e) => setPasteGrade(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">학년 선택 안 함</option>
                    {gradesFor(settings.schoolLevel).map((g) => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                  <select className="field" aria-label="반" value={pasteClass ?? ''} onChange={(e) => setPasteClass(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">반 선택 안 함</option>
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}반</option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="field min-h-[12rem] py-2 font-mono"
                  aria-label="명단 붙여넣기"
                  placeholder={'예)\n1\t3\t12\t홍길동\t여\n1학년 3반 12번 홍길동\n10312 홍길동\n12 홍길동'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button type="button" className="btn btn-primary w-full text-lg" disabled={text.trim() === ''} onClick={onPaste}>
                  인식하기
                </button>
              </div>
            )}
          </>
        )}

        {step === 'preview' && (
          <Preview
            validated={validated}
            origin={origin}
            schoolYear={settings.schoolYear}
            onUpdate={updateRow}
            onRemove={removeRow}
            onFixYear={() => setRows((rs) => rs.map((r) => ({ ...r, schoolYear: settings.schoolYear })))}
            onBack={() => {
              setRows([])
              setStep('input')
            }}
          >
            <fieldset className="card space-y-2">
              <legend className="label px-1">저장 방식</legend>
              <ModeOption
                checked={mode === 'merge'}
                onSelect={() => setMode('merge')}
                title="병합 (추천)"
                desc="지금 명렬은 그대로 두고 새 학생만 더해요. 이름이 다른 학생은 다음 화면에서 하나씩 확인해요."
              />
              <ModeOption
                checked={mode === 'replace'}
                onSelect={() => setMode('replace')}
                title="교체"
                desc="올린 반은 이 명단대로 바꿔요. 명단에서 빠진 학생은 기록이 있으면 '전출'로 남기고, 없으면 지워요."
              />
            </fieldset>
            <button type="button" className="btn btn-primary w-full text-lg" disabled={blocked || busy || rows.length === 0} onClick={toConfirm}>
              {blocked ? '빨간 칸을 먼저 고쳐 주세요' : '다음: 저장 확인'}
            </button>
          </Preview>
        )}

        {step === 'confirm' && plan && (
          <Confirm
            plan={plan}
            decisions={decisions}
            onDecide={(id, d) => setDecisions((x) => ({ ...x, [id]: d }))}
            busy={busy}
            onBack={() => setStep('preview')}
            onSave={save}
          />
        )}

        {step === 'done' && summary && (
          <div className="card space-y-3 border-ok bg-ok-light">
            <p className="text-xl font-extrabold text-ok">✅ 저장했어요</p>
            <ul className="space-y-1 text-lg">
              <li>새로 추가 {summary.added}명</li>
              {summary.updated > 0 && <li>정보 보충·수정 {summary.updated}명</li>}
              {summary.renamed > 0 && <li>이름 고침 {summary.renamed}명</li>}
              {summary.transferred > 0 && <li>전출 처리 {summary.transferred}명 (기록은 그대로)</li>}
              {summary.deleted > 0 && <li>삭제 {summary.deleted}명</li>}
              {summary.skipped > 0 && <li>그대로 둠 {summary.skipped}명</li>}
            </ul>
            <Link to="/students" className="btn btn-primary w-full">
              명렬 보기
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

function ModeOption({ checked, onSelect, title, desc }: { checked: boolean; onSelect: () => void; title: string; desc: string }) {
  return (
    <label className={`flex min-h-[48px] cursor-pointer gap-3 rounded-xl border-2 p-3 ${checked ? 'border-brand bg-brand-light' : 'border-zinc-200'}`}>
      <input type="radio" name="mode" className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={onSelect} />
      <span>
        <b>{title}</b>
        <span className="hint block">{desc}</span>
      </span>
    </label>
  )
}

function Preview({
  validated,
  origin,
  schoolYear,
  onUpdate,
  onRemove,
  onFixYear,
  onBack,
  children,
}: {
  validated: ValidatedRow[]
  origin: string
  schoolYear: number
  onUpdate: (key: string, patch: Partial<RosterRow>) => void
  onRemove: (key: string) => void
  onFixYear: () => void
  onBack: () => void
  children: ReactNode
}) {
  const [onlyProblems, setOnlyProblems] = useState(false)
  const errorCount = validated.filter((v) => v.issues.some((i) => i.level === 'error')).length
  const yearIssue = validated.some((v) => v.issues.some((i) => i.field === 'schoolYear'))
  const shown = onlyProblems ? validated.filter((v) => v.issues.length > 0) : validated

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="hint">{origin}</p>
        <p className="mt-1 text-lg">
          전체 <b>{validated.length}</b>명 ·{' '}
          {errorCount > 0 ? <b className="text-danger">고칠 줄 {errorCount}개</b> : <b className="text-ok">문제 없음</b>}
        </p>
        <p className="hint mt-1">칸을 눌러 바로 고칠 수 있어요. 과정·계열·학과·반코드도 함께 저장해요 (생년월일은 저장하지 않아요).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline" onClick={onBack}>
            다시 올리기
          </button>
          {errorCount > 0 && (
            <button type="button" className="btn btn-outline" aria-pressed={onlyProblems} onClick={() => setOnlyProblems((v) => !v)}>
              {onlyProblems ? '전체 보기' : '고칠 줄만 보기'}
            </button>
          )}
          {yearIssue && (
            <button type="button" className="btn btn-outline" onClick={onFixYear}>
              학년도를 모두 {schoolYear}로 맞추기
            </button>
          )}
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-xl border-2 border-zinc-300">
        <table className="w-full border-collapse text-left">
          <thead className="bg-zinc-100">
            <tr>
              <th className="p-1 text-sm">줄</th>
              <th className="p-1 text-sm">학년</th>
              <th className="p-1 text-sm">반</th>
              <th className="p-1 text-sm">번호</th>
              <th className="p-1 text-sm">이름</th>
              <th className="p-1 text-sm">성별</th>
              <th className="p-1"><span className="sr-only">빼기</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <PreviewRow key={v.row.key} v={v} onUpdate={onUpdate} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  )
}

function PreviewRow({
  v,
  onUpdate,
  onRemove,
}: {
  v: ValidatedRow
  onUpdate: (key: string, patch: Partial<RosterRow>) => void
  onRemove: (key: string) => void
}) {
  const r = v.row
  const bad = (f: IssueField) => v.issues.some((i) => i.field === f && i.level === 'error')
  const rowError = v.issues.some((i) => i.level === 'error')
  const numInput = (f: 'grade' | 'classNo' | 'number', label: string) => (
    <input
      aria-label={`${r.source} ${label}`}
      inputMode="numeric"
      className={`field w-11 px-0 text-center ${bad(f) ? 'border-danger bg-white' : ''}`}
      value={r[f] ?? ''}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '')
        // 고치면 그 줄의 '인식 실패' 메모는 지운다 (교사가 직접 확인한 값이므로)
        onUpdate(r.key, { [f]: d === '' ? null : Number(d), problems: [] })
      }}
    />
  )
  return (
    <>
      <tr className={`border-t-2 border-zinc-200 ${rowError ? 'bg-danger-light' : ''}`}>
        <td className="p-1 text-center text-sm text-zinc-700" title={r.source}>{r.source.replace(/\D+$/, '').replace(/^.*:/, '')}</td>
        <td className="p-1">{numInput('grade', '학년')}</td>
        <td className="p-1">{numInput('classNo', '반')}</td>
        <td className="p-1">{numInput('number', '번호')}</td>
        <td className="p-1">
          <input
            aria-label={`${r.source} 이름`}
            className={`field min-w-[5rem] px-2 ${bad('name') ? 'border-danger bg-white' : ''}`}
            value={r.name}
            onChange={(e) => onUpdate(r.key, { name: e.target.value, problems: [] })}
          />
        </td>
        <td className="p-1">
          <select
            aria-label={`${r.source} 성별`}
            className={`field w-[3.6rem] px-0.5 ${bad('gender') ? 'border-danger bg-white' : ''}`}
            value={r.gender ?? ''}
            onChange={(e) => onUpdate(r.key, { gender: (e.target.value || null) as RosterRow['gender'] })}
          >
            <option value="">{v.effectiveGender && !r.gender ? `(${genderLabel(v.effectiveGender)})` : '—'}</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </td>
        <td className="p-0">
          <button type="button" className="btn btn-ghost min-w-[40px] px-0 text-xl text-zinc-600" aria-label={`${r.source} 빼기`} onClick={() => onRemove(r.key)}>
            ✕
          </button>
        </td>
      </tr>
      {v.issues.length > 0 && (
        <tr className={rowError ? 'bg-danger-light' : 'bg-caution-light'}>
          <td colSpan={7} className="px-3 pb-2 text-sm">
            {v.issues.map((i, n) => (
              <span key={n} className={`mr-3 inline-block font-bold ${i.level === 'error' ? 'text-danger' : 'text-caution'}`}>
                {i.level === 'error' ? '❗' : 'ℹ️'} {i.message}
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

const DECISIONS: { value: NameDecision; label: string }[] = [
  { value: 'rename', label: '같은 학생 (이름만 고침)' },
  { value: 'transfer', label: '다른 학생 (기존 학생 전출)' },
  { value: 'skip', label: '이번엔 그대로 둠' },
]

function Confirm({
  plan,
  decisions,
  onDecide,
  busy,
  onBack,
  onSave,
}: {
  plan: SavePlan
  decisions: Record<string, NameDecision>
  onDecide: (id: string, d: NameDecision) => void
  busy: boolean
  onBack: () => void
  onSave: () => void
}) {
  const nothing = plan.add.length + plan.update.length + plan.nameConflicts.length + plan.missing.length === 0
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-lg">
        <p className="label">{plan.mode === 'merge' ? '병합' : '교체'} — 이렇게 저장해요</p>
        <p>➕ 새로 추가 <b>{plan.add.length}</b>명</p>
        {plan.update.length > 0 && <p>✏️ 정보 보충·수정 <b>{plan.update.length}</b>명</p>}
        <p>✔️ 그대로 <b>{plan.unchanged.length}</b>명</p>
        {plan.nameConflicts.length > 0 && <p className="text-caution">⚠️ 이름이 다름 <b>{plan.nameConflicts.length}</b>명 (아래에서 골라 주세요)</p>}
        {plan.missing.length > 0 && <p className="text-danger">➖ 명단에서 빠짐 <b>{plan.missing.length}</b>명</p>}
      </div>

      {plan.nameConflicts.length > 0 && (
        <section className="card space-y-4 border-caution">
          <h2 className="text-lg font-extrabold">이름이 다른 학생</h2>
          <p className="hint">같은 학년·반·번호에 이름이 달라요. 오타를 고친 것인지, 다른 학생인지 골라 주세요.</p>
          {plan.nameConflicts.map((c) => (
            <fieldset key={c.student.id} className="rounded-xl border-2 border-zinc-200 p-3">
              <legend className="px-1 font-bold">
                {c.student.grade}-{c.student.classNo} {c.student.number}번: {c.student.name} → {c.incoming.name}
              </legend>
              <div className="mt-1 grid gap-2">
                {DECISIONS.map((d) => (
                  <label key={d.value} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-2 has-[:checked]:bg-brand-light">
                    <input
                      type="radio"
                      name={`d-${c.student.id}`}
                      className="h-6 w-6 accent-[var(--color-brand)]"
                      checked={decisions[c.student.id] === d.value}
                      onChange={() => onDecide(c.student.id, d.value)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      )}

      {plan.missing.length > 0 && (
        <section className="card space-y-2 border-danger">
          <h2 className="text-lg font-extrabold">명단에서 빠진 학생</h2>
          <p className="hint">기록이 있는 학생은 지우지 않고 &lsquo;전출&rsquo;로 바꿔요. 기록이 없는 학생은 지워요.</p>
          <ul className="list-disc pl-6">
            {plan.missing.map((s) => (
              <li key={s.id}>
                {s.grade}-{s.classNo} {s.number}번 {s.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn btn-outline flex-1" onClick={onBack} disabled={busy}>
          뒤로
        </button>
        <button type="button" className="btn btn-primary flex-[2] text-lg" onClick={onSave} disabled={busy || nothing}>
          {nothing ? '바뀌는 것이 없어요' : busy ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
