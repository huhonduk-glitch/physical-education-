import { useState } from 'react'
import ClassPicker from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import neisRangesJson from '../../data/neis-valid-ranges.json'
import { db } from '../../db/db'
import { saveConfig } from '../../db/papsRepo'
import { cellLabel, MEASURE_LABEL, parseNeisHeaders, splitHeaderLine, type MeasureKey, type NeisColumn } from '../../lib/neisHeaderParser'
import type { Ranges } from '../../lib/neisExport'
import { applyOverrides, cellId, selectedFromColumns, type CellSpec } from '../../lib/papsLayout'
import { DEFAULT_STANDARDS, FACTORS, eventName, factorChoices, validateStandards, type EventId, type Factor } from '../../lib/paps'
import { readGridsFromFile } from '../../lib/rosterFile'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { usePapsClassKey } from './common'

/** 지정할 수 있는 칸 목록 (알아보지 못한 열용) */
const MAPPABLE: CellSpec[] = [
  { key: 'shuttleRun', attempt: null, side: null },
  { key: 'longRunWalk', attempt: null, side: null },
  { key: 'stepTest', attempt: null, side: null },
  { key: 'heartRate', attempt: 1, side: null },
  { key: 'heartRate', attempt: 2, side: null },
  { key: 'heartRate', attempt: 3, side: null },
  { key: 'gripStrength', attempt: 1, side: 'R' },
  { key: 'gripStrength', attempt: 1, side: 'L' },
  { key: 'gripStrength', attempt: 2, side: 'R' },
  { key: 'gripStrength', attempt: 2, side: 'L' },
  { key: 'curlUp', attempt: null, side: null },
  { key: 'pushUp', attempt: null, side: null },
  { key: 'sitAndReach', attempt: 1, side: null },
  { key: 'sitAndReach', attempt: 2, side: null },
  { key: 'totalFlexibility', attempt: null, side: null },
  { key: 'sprint50m', attempt: null, side: null },
  { key: 'sprint50m', attempt: 1, side: null },
  { key: 'sprint50m', attempt: 2, side: null },
  { key: 'standingLongJump', attempt: 1, side: null },
  { key: 'standingLongJump', attempt: 2, side: null },
  { key: 'height', attempt: null, side: null },
  { key: 'weight', attempt: null, side: null },
]

export default function PapsSetupPage() {
  return (
    <>
      <PageHeader title="PAPS 설정" back />
      <div className="page space-y-4 pb-8">
        <TemplateSection />
        <EventsSection />
        <MethodSection />
        <RangesSection />
        <StandardsSection />
      </div>
    </>
  )
}

function TemplateSection() {
  const { settings, updateSettings, standards } = useApp()
  const year = String(settings.schoolYear)
  const cur = settings.neisTemplates[year]
  const [draft, setDraft] = useState<{ headers: string[]; overrides: Record<number, CellSpec | null> } | null>(null)
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const start = (headers: string[]) => {
    const cols = parseNeisHeaders(headers)
    if (!cols.some((c) => c.kind === 'common') || !cols.some((c) => c.kind === 'measure')) {
      setErr('나이스 PAPS 양식 헤더를 찾지 못했어요. 첫 줄에 학년도·학생성명·종목 이름이 있는지 확인해 주세요.')
      return
    }
    setErr('')
    setDraft({ headers, overrides: {} })
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const sheets = await readGridsFromFile(await f.arrayBuffer(), f.name)
      const grid = sheets[0]?.grid ?? []
      const row = grid.slice(0, 15).find((r) => parseNeisHeaders(r).filter((c) => c.kind !== 'unknown').length >= 3)
      if (!row) return setErr('헤더 줄을 찾지 못했어요.')
      start(row.map(String).filter((h) => h.trim() !== ''))
    } catch {
      setErr('파일을 열지 못했어요.')
    }
  }

  const cols: NeisColumn[] = draft ? applyOverrides(parseNeisHeaders(draft.headers), draft.overrides) : []
  const rawCols = draft ? parseNeisHeaders(draft.headers) : []

  const save = async () => {
    if (!draft) return
    await updateSettings({ neisTemplates: { ...settings.neisTemplates, [year]: { ...draft, registeredAt: Date.now() } } })
    // 측정 종목 자동 설정: 모든 반
    const selected = selectedFromColumns(cols, standards.events)
    const students = await db.students.where('schoolYear').equals(settings.schoolYear).toArray()
    const classes = [...new Set(students.map((s) => `${s.grade}-${s.classNo}`))]
    for (const k of classes) {
      const [g, c] = k.split('-').map(Number)
      await saveConfig(db, settings.schoolYear, g, c, selected)
    }
    setDraft(null)
    setMsg(`양식을 등록하고 ${classes.length}개 반의 측정 종목을 양식에 맞췄어요.`)
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="card-title">나이스 양식 ({year}학년도)</p>
        {cur && <span className="badge bg-ok-light text-ok">등록됨 · {cur.headers.length}열</span>}
      </div>
      <p className="hint">나이스에서 받은 PAPS 일괄업로드 양식을 올리거나, 헤더 한 줄만 복사해 붙여넣으세요. 열 구성은 학교마다 달라서 양식에서 읽어요.</p>
      {!draft && (
        <>
          <label className="btn btn-outline relative w-full">
            <Icon name="upload" /> 양식 파일 올리기 (xlsx)
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          <textarea className="field min-h-[4.5rem] py-2 text-sm" placeholder="또는 헤더 한 줄 붙여넣기 (학년도 → 체중까지)" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="헤더 붙여넣기" />
          <button type="button" className="btn btn-soft w-full" disabled={!paste.trim()} onClick={() => start(splitHeaderLine(paste))}>
            붙여넣은 헤더 읽기
          </button>
          {cur && (
            <button
              type="button"
              className="btn btn-ghost w-full text-danger"
              onClick={() => {
                if (!confirm('등록한 양식을 지울까요? (기록은 지워지지 않아요)')) return
                const next = { ...settings.neisTemplates }
                delete next[year]
                void updateSettings({ neisTemplates: next })
              }}
            >
              등록한 양식 지우기
            </button>
          )}
        </>
      )}
      {err && <p className="font-bold text-danger">{err}</p>}
      {msg && <p className="font-bold text-ok">{msg}</p>}
      {draft && (
        <div className="space-y-2">
          <p className="font-bold">읽은 열 {cols.length}개 — 확인해 주세요</p>
          <ul className="overflow-hidden rounded-2xl bg-fill">
            {cols.map((c, i) => (
              <li key={i} className="list-row min-h-[48px] text-[0.92rem]">
                <span className="w-6 text-ink-3 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{c.header}</span>
                {rawCols[i].kind === 'unknown' ? (
                  <select
                    className="field w-44 bg-white text-sm"
                    aria-label={`${c.header} 종목 지정`}
                    value={draft.overrides[i] ? cellId(draft.overrides[i]!) : ''}
                    onChange={(e) => {
                      const v = MAPPABLE.find((m) => cellId(m) === e.target.value) ?? null
                      setDraft({ ...draft, overrides: { ...draft.overrides, [i]: v } })
                    }}
                  >
                    <option value="">⚠️ 모름 — 지정하기</option>
                    {MAPPABLE.map((m) => (
                      <option key={cellId(m)} value={cellId(m)}>
                        {cellLabel(m)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`badge ${c.kind === 'common' ? 'bg-fill-2 text-ink-2' : 'bg-brand-light text-brand'}`}>{c.kind === 'common' ? '기본 정보' : c.kind === 'measure' ? cellLabel(c) : ''}</span>
                )}
              </li>
            ))}
          </ul>
          {cols.some((c) => c.kind === 'unknown') && <p className="font-bold text-caution">⚠️ 모르는 열이 남아 있으면 내보내기가 막혀요. 종목을 지정해 주세요.</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-soft flex-1" onClick={() => setDraft(null)}>
              취소
            </button>
            <button type="button" className="btn btn-primary flex-[2]" onClick={save}>
              이 양식으로 등록
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function EventsSection() {
  const { settings, standards, readOnly } = useApp()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const choices = factorChoices(standards, settings.schoolLevel, cls?.grade ?? 1)
  const [msg, setMsg] = useState('')
  const set = async (f: Factor, id: EventId | '') => {
    if (!cls) return
    const next = { ...pc.selected }
    if (id) next[f] = id
    else delete next[f]
    await saveConfig(db, settings.schoolYear, cls.grade, cls.classNo, next)
  }
  const applyAll = async () => {
    for (const c of classes) await saveConfig(db, settings.schoolYear, c.grade, c.classNo, pc.selected)
    setMsg(`${classes.length}개 반에 똑같이 적용했어요.`)
  }
  return (
    <section className="card space-y-3">
      <p className="card-title">반별 측정 종목</p>
      <p className="hint">체력요인마다 한 종목을 골라요. 나이스 양식을 등록하면 자동으로 맞춰져요. 비만(BMI)은 신장·체중으로 계산해요.</p>
      <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
      {FACTORS.filter((f) => f !== '비만').map((f) => (
        <label key={f} className="block">
          <span className="label">{f}</span>
          <select className="field" value={pc.selected[f] ?? ''} disabled={readOnly || !cls} onChange={(e) => set(f, e.target.value as EventId | '')}>
            <option value="">— 고르기 —</option>
            {choices[f].map((id) => (
              <option key={id} value={id}>
                {eventName(standards, id)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="button" className="btn btn-soft w-full" disabled={readOnly || !cls || classes.length < 2} onClick={applyAll}>
        모든 반에 똑같이 적용
      </button>
      {msg && <p className="font-bold text-ok">{msg}</p>}
    </section>
  )
}

function MethodSection() {
  const { settings, updateSettings } = useApp()
  return (
    <section className="card space-y-3">
      <p className="card-title">계산 방식</p>
      <div>
        <p className="label">종합유연성 점수</p>
        <div className="segment">
          <button type="button" aria-selected={settings.papsFlexMode === 'regulation'} onClick={() => updateSettings({ papsFlexMode: 'regulation' })}>
            법령 (등급별 고정점수)
          </button>
          <button type="button" aria-selected={settings.papsFlexMode === 'table'} onClick={() => updateSettings({ papsFlexMode: 'table' })}>
            기준표 (xls)
          </button>
        </div>
        <p className="hint mt-1">법령(별표5): 1등급 20 · 2등급 16 · 3등급 12 · 4등급 8 · 5등급 4점. 나이스 실제 산출값을 확인해 맞춰 주세요.</p>
      </div>
      <div>
        <p className="label">스텝검사 심박 측정</p>
        <div className="segment">
          <button type="button" aria-selected={settings.papsStepMethod === 'palpation'} onClick={() => updateSettings({ papsStepMethod: 'palpation' })}>
            촉진법 (손목·목)
          </button>
          <button type="button" aria-selected={settings.papsStepMethod === 'monitor'} onClick={() => updateSettings({ papsStepMethod: 'monitor' })}>
            심박계
          </button>
        </div>
      </div>
    </section>
  )
}

function RangesSection() {
  const { settings, updateSettings } = useApp()
  const r = settings.neisRanges
  const [open, setOpen] = useState(false)
  const set = (k: string, patch: Partial<Ranges[string]>) => updateSettings({ neisRanges: { ...r, [k]: { ...r[k], ...patch } } })
  const num = (s: string) => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null)
  return (
    <section className="card space-y-3">
      <button type="button" className="flex w-full items-center justify-between" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="card-title">나이스 허용 범위 · 소수 자릿수</span>
        <span className="flex items-center gap-2">
          <span className="badge bg-caution-light text-caution">추정값</span>
          <Icon name="chevronDown" className={open ? 'rotate-180' : ''} />
        </span>
      </button>
      <p className="hint">처음 값은 공식 기준표(xls)의 최소·최대값에서 가져온 <b>추정값</b>이에요. 나이스에서 확인하면 고쳐 주세요. 등급 기준과는 별개예요. 신장·체중은 근거 자료가 없어 비워 뒀어요(검사 안 함).</p>
      {open && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.92rem]">
              <thead className="text-ink-3">
                <tr>
                  <th className="py-1">종목</th>
                  <th className="px-1">최소</th>
                  <th className="px-1">최대</th>
                  <th className="px-1">소수</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r).map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1.5 pr-2 font-semibold">{MEASURE_LABEL[k as MeasureKey] ?? k}</td>
                    <td className="px-1">
                      <input className="field min-h-[44px] w-20 px-2" inputMode="decimal" defaultValue={v.min ?? ''} aria-label={`${k} 최소`} onBlur={(e) => set(k, { min: num(e.target.value) })} />
                    </td>
                    <td className="px-1">
                      <input className="field min-h-[44px] w-20 px-2" inputMode="decimal" defaultValue={v.max ?? ''} aria-label={`${k} 최대`} onBlur={(e) => set(k, { max: num(e.target.value) })} />
                    </td>
                    <td className="px-1">
                      <select className="field min-h-[44px] w-16 px-2" value={v.decimals} aria-label={`${k} 소수 자릿수`} onChange={(e) => set(k, { decimals: Number(e.target.value) })}>
                        {[0, 1, 2].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-ghost w-full text-ink-3"
            onClick={() => confirm('처음 추정값으로 되돌릴까요?') && updateSettings({ neisRanges: structuredClone((neisRangesJson as { ranges: Ranges }).ranges) })}
          >
            처음 값으로 되돌리기
          </button>
        </>
      )}
    </section>
  )
}

function StandardsSection() {
  const { standards } = useApp()
  const [err, setErr] = useState<string[]>([])
  const replaced = standards !== DEFAULT_STANDARDS
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const j = JSON.parse(await f.text())
      const errs = validateStandards(j)
      setErr(errs)
      if (errs.length === 0 && confirm(`기준표를 '${j.version}'(으)로 바꿀까요?`)) await db.settings.put({ key: 'papsStandards', value: j })
    } catch {
      setErr(['JSON 파일을 읽지 못했어요'])
    }
  }
  return (
    <section className="card space-y-3">
      <p className="card-title">PAPS 기준표</p>
      <dl className="space-y-1 text-[0.92rem]">
        <div>
          <dt className="font-bold text-ink-2">버전</dt>
          <dd>{standards.version}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink-2">출처</dt>
          <dd className="text-ink-2">{standards.source}</dd>
        </div>
      </dl>
      <p className="hint">기준이 개정되면 새 기준표 JSON으로 바꿀 수 있어요. 형식을 검사한 뒤에만 적용해요.</p>
      <label className="btn btn-soft relative w-full">
        <Icon name="upload" /> 기준표 JSON 교체
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
      </label>
      {replaced && (
        <button type="button" className="btn btn-ghost w-full text-danger" onClick={() => confirm('앱에 들어 있는 공식 기준표로 되돌릴까요?') && db.settings.delete('papsStandards')}>
          공식 기준표로 되돌리기
        </button>
      )}
      {err.length > 0 && (
        <ul className="list-disc pl-5 text-sm font-bold text-danger">
          {err.slice(0, 10).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
