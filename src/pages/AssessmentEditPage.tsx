import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import type { AssessItem, AssessMethod, Assessment } from '../db/types'
import { ASSESS_TEMPLATES } from '../data/assessTemplates'
import { assessmentProblems, checklistBands, fmtNum, itemMax, itemsOf, LEVEL_CUT_PRESETS, levelPreset } from '../lib/assessScore'
import { GROUP_COLORS, SEMESTER_LABEL } from '../lib/groups'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const METHOD_LABEL: Record<AssessMethod, string> = { level: '등급표', record: '기록표', direct: '점수 입력' }
const METHOD_HINT: Record<AssessMethod, string> = {
  level: '등급(A·B·C…)을 누르면 정한 점수가 들어가요',
  record: '기록(회·초·cm)을 넣으면 구간표로 점수가 정해져요',
  direct: '점수를 직접 넣어요',
}

const newItem = (method: AssessMethod = 'level'): AssessItem => ({
  id: newId(),
  label: '',
  method,
  ...(method === 'level' ? { levels: levelPreset(['A', 'B', 'C', 'D', 'E'], 20) } : {}),
  ...(method === 'record' ? { unit: '회', better: 'higher' as const, bands: [{ limit: 0, points: 0 }], basePoints: 0 } : {}),
  ...(method === 'direct' ? { max: 10 } : {}),
})

/** 수행평가 만들기·고치기 (재설계 3단계) */
export default function AssessmentEditPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const query = new URLSearchParams(useLocation().search)
  const fromRubric = query.get('from') === 'rubric'
  const tpl = !id ? ASSESS_TEMPLATES.find((t) => t.id === query.get('tpl')) : undefined
  const [tplData] = useState(() => tpl?.build(newId))
  const { settings, readOnly } = useApp()
  const { groups } = useGroups()
  const existing = useLiveQuery(async () => (id ? db.assessments.get(id) : undefined), [id])
  const [title, setTitle] = useState(tplData?.title ?? '')
  const [semester, setSemester] = useState<0 | 1 | 2>(0)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [items, setItems] = useState<AssessItem[]>(tplData?.items ?? [newItem()])
  const [specials, setSpecials] = useState<{ label: string; points: number }[]>(tplData?.specials ?? [])
  const [texts, setTexts] = useState<string[]>(tplData?.texts ?? [])
  const [levelCuts, setLevelCuts] = useState<{ label: string; min: number }[]>(tplData?.levelCuts ?? [])
  const [altTask, setAltTask] = useState(true)
  const [loaded, setLoaded] = useState(!id)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (loaded || !existing) return
    setTitle(existing.title)
    setSemester(existing.semester ?? 0)
    setItems(itemsOf(existing))
    setAltTask(existing.altTaskEnabled)
    setSpecials(existing.specials ?? [])
    setTexts(existing.texts ?? [])
    setLevelCuts(existing.levelCuts ?? [])
    setGroupIds(existing.groupIds ?? (groups ?? []).filter((g) => g.kind === 'homeroom' && g.grade === existing.grade).map((g) => g.id))
    setLoaded(true)
  }, [existing, loaded, groups])

  const total = items.reduce((n, it) => n + itemMax(it), 0)
  const patch = (i: number, p: Partial<AssessItem>) => setItems((l) => l.map((it, k) => (k === i ? { ...it, ...p } : it)))

  const save = async () => {
    const probs = assessmentProblems(title, items)
    if (specials.some((x) => !x.label.trim())) probs.push('제출 구분 이름을 적어 주세요')
    if (new Set(specials.map((x) => x.label.trim())).size !== specials.length) probs.push('같은 제출 구분 이름이 있어요')
    if (texts.some((x) => !x.trim()) || new Set(texts.map((x) => x.trim())).size !== texts.length) probs.push('글 칸 이름이 비었거나 겹쳐요')
    if (levelCuts.some((x) => !x.label.trim())) probs.push('성취 수준 이름을 적어 주세요')
    if (groupIds.length === 0) probs.push('이 평가를 하는 수업반을 골라 주세요')
    setErrors(probs)
    if (probs.length) return window.scrollTo({ top: 0, behavior: 'smooth' })
    const firstGroup = (groups ?? []).find((g) => groupIds.includes(g.id))
    const a: Assessment = {
      id: existing?.id ?? newId(),
      schoolYear: existing?.schoolYear ?? settings.schoolYear,
      title: title.trim(),
      grade: existing?.grade ?? firstGroup?.grade ?? 0,
      rubric: existing?.rubric ?? [],
      altTaskEnabled: altTask,
      groupIds,
      items: items.map((it) => ({ ...it, label: it.label.trim() })),
      semester,
      ...(existing?.standards ? { standards: existing.standards } : {}),
      ...(existing?.plan ? { plan: existing.plan } : {}),
      ...(specials.length ? { specials: specials.map((x) => ({ ...x, label: x.label.trim() })) } : {}),
      ...(texts.length ? { texts: texts.map((x) => x.trim()) } : {}),
      ...(levelCuts.length ? { levelCuts: levelCuts.map((x) => ({ ...x, label: x.label.trim() })) } : {}),
    }
    await db.assessments.put(a)
    nav(`/more/assessments/${a.id}`, { replace: true })
  }

  const remove = async () => {
    if (!existing) return
    if (!confirm(`'${existing.title}' 평가와 채점한 점수를 모두 지울까요? 되돌릴 수 없어요.`)) return
    await db.transaction('rw', db.assessments, db.assessmentScores, async () => {
      await db.assessmentScores.where('assessmentId').equals(existing.id).delete()
      await db.assessments.delete(existing.id)
    })
    nav('/more/assessments', { replace: true })
  }

  return (
    <>
      <PageHeader title={id ? '평가 고치기' : '새 수행평가'} back />
      <div className="page space-y-4 pb-36">
        {tpl && errors.length === 0 && (
          <p className="rounded-2xl bg-ok-light p-4 font-bold text-ok">'{tpl.name}' 예시로 채웠어요. 평가 이름 · 요소 · 점수를 우리 평가에 맞게 고치고, 수업반을 골라 [저장]을 눌러 주세요.</p>
        )}
        {fromRubric && errors.length === 0 && (
          <p className="rounded-2xl bg-ok-light p-4 font-bold text-ok">루브릭으로 평가를 만들었어요. 이 평가를 하는 수업반을 고르고 [저장]을 눌러 주세요.</p>
        )}
        {existing?.standards && existing.standards.length > 0 && (
          <section className="card space-y-1">
            <p className="text-sm font-bold text-ink-3">성취기준</p>
            {existing.standards.map((st, i) => (
              <p key={i} className="text-[0.95rem]">
                {st.code} {st.text}
              </p>
            ))}
          </section>
        )}
        {errors.length > 0 && (
          <ul className="card space-y-1 border-danger bg-danger-light text-danger" role="alert">
            {errors.map((e) => (
              <li key={e} className="font-bold">
                · {e}
              </li>
            ))}
          </ul>
        )}

        <section className="card space-y-4">
          <label className="block">
            <span className="label">평가 이름 = 나이스 영역 이름</span>
            <input className="field" value={title} placeholder="예: 나를 지키는 상황별 실전 호신술" onChange={(e) => setTitle(e.target.value)} disabled={readOnly} />
            <span className="hint mt-1 block">나이스 양식 1행의 영역 이름과 똑같이 쓰면 내보낼 때 자동으로 맞춰져요 (띄어쓰기 차이는 괜찮아요).</span>
          </label>
          <div>
            <span className="label">기간</span>
            <div className="segment" role="radiogroup" aria-label="기간">
              {([0, 1, 2] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={semester === v} onClick={() => setSemester(v)} disabled={readOnly}>
                  {v === 0 ? '1년' : SEMESTER_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">이 평가를 하는 수업반</span>
            {groups?.length === 0 ? (
              <p className="hint">먼저 [수업반]에서 반을 만들어 주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(groups ?? []).map((g) => {
                  const on = groupIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      className="chip gap-1.5"
                      disabled={readOnly}
                      onClick={() => setGroupIds((l) => (on ? l.filter((x) => x !== g.id) : [...l, g.id]))}
                    >
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: on ? '#fff' : (GROUP_COLORS[g.color] ?? GROUP_COLORS.blue).fg }} aria-hidden />
                      {g.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={altTask} onChange={(e) => setAltTask(e.target.checked)} disabled={readOnly} />
            <span>
              <b>견학 학생 대체 과제로 연결할 수 있게</b>
              <span className="hint block">견학 목록에서 이 평가를 대체 과제로 고를 수 있어요.</span>
            </span>
          </label>
        </section>

        <h2 className="px-1 text-lg font-extrabold">채점 요소</h2>
        {items.map((it, i) => (
          <ItemEditor
            key={it.id}
            index={i}
            item={it}
            readOnly={readOnly}
            onChange={(p) => patch(i, p)}
            onRemove={items.length > 1 ? () => setItems((l) => l.filter((_, k) => k !== i)) : undefined}
            onMove={(d) =>
              setItems((l) => {
                const j = i + d
                if (j < 0 || j >= l.length) return l
                const c = [...l]
                ;[c[i], c[j]] = [c[j], c[i]]
                return c
              })
            }
          />
        ))}
        {!readOnly && (
          <button type="button" className="btn btn-outline w-full" onClick={() => setItems((l) => [...l, newItem()])}>
            <Icon name="plus" /> 채점 요소 더하기
          </button>
        )}

        <h2 className="px-1 text-lg font-extrabold">기록표 칸</h2>
        <SheetOptions readOnly={readOnly} texts={texts} setTexts={setTexts} specials={specials} setSpecials={setSpecials} levelCuts={levelCuts} setLevelCuts={setLevelCuts} />

        {existing && !readOnly && (
          <button type="button" className="btn btn-danger-soft w-full" onClick={remove}>
            <Icon name="trash" /> 평가 지우기
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-0 lg:left-60">
          <div className="page flex items-center gap-3 rounded-2xl bg-white p-2 pl-4 shadow-[var(--shadow-float)]">
            <span className="flex-1 leading-tight">
              <span className="block text-xs font-bold text-ink-3">영역 만점</span>
              <b className="text-xl tabular-nums">{Math.round(total * 100) / 100}점</b>
            </span>
            <button type="button" className="btn btn-primary flex-[2] text-lg" onClick={save}>
              저장
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ItemEditor({
  index,
  item,
  readOnly,
  onChange,
  onRemove,
  onMove,
}: {
  index: number
  item: AssessItem
  readOnly: boolean
  onChange: (p: Partial<AssessItem>) => void
  onRemove?: () => void
  onMove: (d: -1 | 1) => void
}) {
  const [presetMax, setPresetMax] = useState(String(itemMax(item) || 20))
  const hasDesc = (item.levels ?? []).some((l) => l.desc !== undefined)
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? 0 : Number(v))
  const setMethod = (m: AssessMethod) => {
    const n = newItem(m)
    onChange({ method: m, levels: item.levels ?? n.levels, unit: item.unit ?? n.unit, better: item.better ?? n.better, bands: item.bands ?? n.bands, basePoints: item.basePoints ?? n.basePoints, max: item.max ?? n.max })
  }
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-black text-white">{index + 1}</span>
        <input className="field flex-1" value={item.label} placeholder="요소 이름 (예: 기술 수행, 줄넘기 기록, 태도)" onChange={(e) => onChange({ label: e.target.value })} disabled={readOnly} aria-label={`${index + 1}번째 요소 이름`} />
        <span className="badge shrink-0 bg-fill-2 text-ink-2 tabular-nums">{itemMax(item)}점</span>
      </div>
      <div className="segment" role="radiogroup" aria-label="채점 방법">
        {(['level', 'record', 'direct'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={item.method === m} onClick={() => setMethod(m)} disabled={readOnly}>
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>
      <p className="hint">{METHOD_HINT[item.method]}</p>

      {item.method === 'level' && (
        <div className="space-y-2">
          {(item.levels ?? []).map((l, k) => (
            <div key={k} className="space-y-1">
            <div className="flex items-center gap-2">
              <input className="field w-24 text-center font-bold" value={l.label} aria-label="등급 이름" disabled={readOnly} onChange={(e) => onChange({ levels: item.levels!.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} />
              <NumInput className="field flex-1 text-right tabular-nums" value={l.points} aria-label={`${l.label} 점수`} disabled={readOnly} onValue={(v) => onChange({ levels: item.levels!.map((x, j) => (j === k ? { ...x, points: v } : x)) })} />
              <span className="text-ink-3">점</span>
              <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label="등급 빼기" disabled={readOnly} onClick={() => onChange({ levels: item.levels!.filter((_, j) => j !== k) })}>
                <Icon name="close" size={18} />
              </button>
            </div>
            {hasDesc && (
              <textarea
                className="field min-h-[48px] py-2 text-[0.92rem]"
                placeholder={`${l.label} 기준 (예: 동작을 정확하게 수행한다)`}
                aria-label={`${l.label} 기준`}
                value={l.desc ?? ''}
                disabled={readOnly}
                onChange={(e) => onChange({ levels: item.levels!.map((x, j) => (j === k ? { ...x, desc: e.target.value } : x)) })}
              />
            )}
            </div>
          ))}
          {!hasDesc && !readOnly && (
            <button type="button" className="btn btn-ghost px-1 text-sm text-brand" onClick={() => onChange({ levels: item.levels!.map((x) => ({ ...x, desc: '' })) })}>
              + 등급별 기준(루브릭) 적기
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-soft" disabled={readOnly} onClick={() => onChange({ levels: [...(item.levels ?? []), { label: String.fromCharCode(65 + (item.levels?.length ?? 0)), points: 0 }] })}>
              <Icon name="plus" size={18} /> 등급
            </button>
            <span className="ml-auto flex items-center gap-1 text-sm text-ink-3">
              만점
              <input className="field w-20 text-center" inputMode="decimal" value={presetMax} onChange={(e) => setPresetMax(e.target.value)} aria-label="고르게 나눌 만점" disabled={readOnly} />
              <button type="button" className="btn btn-soft text-sm" disabled={readOnly} onClick={() => onChange({ levels: levelPreset((item.levels ?? []).map((l) => l.label), num(presetMax)).map((x, j) => ({ ...x, desc: item.levels?.[j]?.desc })) })}>
                고르게 채우기
              </button>
            </span>
          </div>
        </div>
      )}

      {item.method === 'record' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="block w-24">
              <span className="label">단위</span>
              <input className="field text-center" value={item.unit ?? ''} onChange={(e) => onChange({ unit: e.target.value })} disabled={readOnly} />
            </label>
            <div className="flex-1">
              <span className="label">좋은 기록</span>
              <div className="segment" role="radiogroup" aria-label="좋은 기록">
                <button type="button" role="radio" aria-checked={item.better !== 'lower'} onClick={() => onChange({ better: 'higher' })} disabled={readOnly}>
                  높을수록
                </button>
                <button type="button" role="radio" aria-checked={item.better === 'lower'} onClick={() => onChange({ better: 'lower' })} disabled={readOnly}>
                  낮을수록
                </button>
              </div>
            </div>
          </div>
          {(['bands', 'bandsF'] as const)
            .filter((key) => key === 'bands' || item.bandsF)
            .map((key) => {
              const baseKey = key === 'bands' ? 'basePoints' : 'basePointsF'
              const list = item[key] ?? []
              return (
                <div key={key} className="space-y-2">
                  {item.bandsF && <p className="text-sm font-extrabold text-ink-2">{key === 'bands' ? '남학생 기준' : '여학생 기준'}</p>}
                  {list.map((b, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <NumInput className="field w-24 text-right tabular-nums" value={b.limit} aria-label="기준 기록" disabled={readOnly} onValue={(v) => onChange({ [key]: list.map((x, j) => (j === k ? { ...x, limit: v } : x)) })} />
                      <span className="shrink-0 text-sm text-ink-2">
                        {item.unit} {item.better === 'lower' ? '이하' : '이상'} →
                      </span>
                      <NumInput className="field flex-1 text-right tabular-nums" value={b.points} aria-label="점수" disabled={readOnly} onValue={(v) => onChange({ [key]: list.map((x, j) => (j === k ? { ...x, points: v } : x)) })} />
                      <span className="text-ink-3">점</span>
                      <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label="구간 빼기" disabled={readOnly} onClick={() => onChange({ [key]: list.filter((_, j) => j !== k) })}>
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-soft" disabled={readOnly} onClick={() => onChange({ [key]: [...list, { limit: 0, points: 0 }] })}>
                    <Icon name="plus" size={18} /> 구간
                  </button>
                  <label className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-bold text-ink-2">어느 구간에도 못 들면 (기본 점수)</span>
                    <NumInput className="field w-24 text-right tabular-nums" value={item[baseKey] ?? 0} aria-label="기본 점수" onValue={(v) => onChange({ [baseKey]: v })} disabled={readOnly} />
                    <span className="text-ink-3">점</span>
                  </label>
                </div>
              )
            })}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost w-full text-sm"
              onClick={() => onChange(item.bandsF ? { bandsF: undefined, basePointsF: undefined } : { bandsF: (item.bands ?? []).map((b) => ({ ...b })), basePointsF: item.basePoints })}
            >
              {item.bandsF ? '여학생 기준 빼기 (남녀 같은 기준)' : '+ 여학생 기준 따로 정하기'}
            </button>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={item.nonPartPoints !== undefined} disabled={readOnly} onChange={(e) => onChange({ nonPartPoints: e.target.checked ? (item.basePoints ?? 0) : undefined })} />
            <span className="flex-1 text-sm font-bold text-ink-2">자발적 미참여 · 장기 미인정 결석 점수</span>
            {item.nonPartPoints !== undefined && (
              <>
                <NumInput className="field w-24 text-right tabular-nums" value={item.nonPartPoints} aria-label="미참여 점수" onValue={(v) => onChange({ nonPartPoints: v })} disabled={readOnly} />
                <span className="text-ink-3">점</span>
              </>
            )}
          </label>
          <ChecklistEditor item={item} readOnly={readOnly} onChange={onChange} />
        </div>
      )}

      {item.method === 'direct' && (
        <label className="flex items-center gap-2">
          <span className="flex-1 text-sm font-bold text-ink-2">만점</span>
          <NumInput className="field w-28 text-right tabular-nums" value={item.max} aria-label="만점" onValue={(v) => onChange({ max: v })} disabled={readOnly} />
          <span className="text-ink-3">점</span>
        </label>
      )}

      {!readOnly && (
        <div className="flex gap-2 border-t border-line pt-3">
          <button type="button" className="btn btn-ghost px-3 text-ink-3" aria-label="위로" onClick={() => onMove(-1)}>
            <Icon name="up" size={18} />
          </button>
          <button type="button" className="btn btn-ghost px-3 text-ink-3" aria-label="아래로" onClick={() => onMove(1)}>
            <Icon name="down" size={18} />
          </button>
          {onRemove && (
            <button type="button" className="btn btn-ghost ml-auto text-danger" onClick={onRemove}>
              <Icon name="trash" size={18} /> 요소 빼기
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** 숫자 칸: 입력 중에는 글자 그대로(소수점 입력 가능), 칸을 벗어날 때 숫자로 저장 */
function NumInput({ value, onValue, className, ...rest }: { value: number | undefined; onValue: (v: number) => void; className?: string; disabled?: boolean; 'aria-label'?: string }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  // 밖에서 값이 바뀌었을 때만 칸을 고친다 ('2.'처럼 입력 중인 글자는 그대로 둔다)
  useEffect(() => {
    setText((t) => (Number(t) === value && t.trim() !== '' ? t : value === undefined ? '' : String(value)))
  }, [value])
  return (
    <input
      {...rest}
      className={className}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onValue(n)
      }}
      onBlur={() => {
        const n = Number(text)
        if (text.trim() === '' || !Number.isFinite(n)) {
          onValue(0)
          setText('0')
        }
      }}
    />
  )
}

/** 체크리스트: 평가 요소 목록 + 개수별 점수 채우기. 채점표에서 항목마다 체크하면 만족한 개수가 기록이 된다 */
function ChecklistEditor({ item, readOnly, onChange }: { item: AssessItem; readOnly: boolean; onChange: (p: Partial<AssessItem>) => void }) {
  const checks = item.checks
  const sorted = [...(item.bands ?? [])].sort((a, b) => a.limit - b.limit)
  const [base, setBase] = useState(String(item.basePoints ?? 0))
  const [step, setStep] = useState(String(sorted.length >= 1 ? sorted[0].points - (item.basePoints ?? 0) : 10))
  if (!checks) {
    if (readOnly) return null
    return (
      <button type="button" className="btn btn-ghost w-full text-sm" onClick={() => onChange({ checks: [''], unit: '개', better: 'higher', bands: checklistBands(1, 30, 10), basePoints: 30 })}>
        + 체크리스트로 채점 (평가 요소를 하나씩 체크 → 만족한 개수로 점수)
      </button>
    )
  }
  const setChecks = (next: string[]) => onChange({ checks: next })
  const fill = () => {
    const b = Number(base)
    const st = Number(step)
    if (!Number.isFinite(b) || !Number.isFinite(st)) return
    onChange({ bands: checklistBands(checks.length, b, st), basePoints: b })
  }
  return (
    <div className="space-y-2 rounded-xl bg-fill p-3">
      <p className="text-sm font-extrabold text-ink-2">체크리스트 평가 요소 (기록 = 만족한 개수)</p>
      {checks.map((c, k) => (
        <div key={k} className="flex items-start gap-2">
          <span className="mt-3 w-5 shrink-0 text-center font-bold text-ink-3">{k + 1}</span>
          <textarea
            className="field min-h-[48px] flex-1 py-2 text-[0.92rem]"
            value={c}
            placeholder="예: 참고자료나 사례를 표기하였는가?"
            aria-label={`평가 요소 ${k + 1}`}
            disabled={readOnly}
            onChange={(e) => setChecks(checks.map((x, j) => (j === k ? e.target.value : x)))}
          />
          {!readOnly && (
            <button type="button" className="btn btn-ghost mt-1 px-2 text-ink-3" aria-label={`평가 요소 ${k + 1} 빼기`} onClick={() => setChecks(checks.filter((_, j) => j !== k))}>
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-soft" onClick={() => setChecks([...checks, ''])}>
              <Icon name="plus" size={18} /> 평가 요소
            </button>
            <button type="button" className="btn btn-ghost text-sm text-ink-3" onClick={() => onChange({ checks: undefined })}>
              체크리스트 끄기
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm">
            <span className="font-bold text-ink-2">개수별 점수:</span>
            0개
            <input className="field w-16 text-center" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} aria-label="0개일 때 점수" />점 + 1개마다
            <input className="field w-16 text-center" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} aria-label="1개마다 더할 점수" />점
            <button type="button" className="btn btn-soft text-sm" onClick={fill}>
              채우기 ({checks.length}개 → {fmtNum(Number(base) + checks.length * Number(step) || 0)}점)
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** 기록표 칸: 글 칸 · 제출 구분 · 성취 수준 (평가마다 고름) */
function SheetOptions({
  readOnly,
  texts,
  setTexts,
  specials,
  setSpecials,
  levelCuts,
  setLevelCuts,
}: {
  readOnly: boolean
  texts: string[]
  setTexts: (v: string[]) => void
  specials: { label: string; points: number }[]
  setSpecials: (v: { label: string; points: number }[]) => void
  levelCuts: { label: string; min: number }[]
  setLevelCuts: (v: { label: string; min: number }[]) => void
}) {
  const levelMode =
    levelCuts.length === 0 ? 'off' : levelCuts.length === 3 && levelCuts[0].label === '상' ? '3' : levelCuts.length === 5 && levelCuts[0].label === 'A' ? '5' : 'custom'
  return (
    <section className="card space-y-5">
      <div className="space-y-2">
        <p className="font-extrabold">글 칸</p>
        <p className="hint">학생마다 적어 둘 칸이에요 (예: 탐구주제, 발표 주제). 점수에는 들어가지 않아요.</p>
        {texts.map((t, k) => (
          <div key={k} className="flex items-center gap-2">
            <input className="field flex-1" value={t} placeholder="예: 탐구주제" aria-label={`글 칸 ${k + 1} 이름`} disabled={readOnly} onChange={(e) => setTexts(texts.map((x, j) => (j === k ? e.target.value : x)))} />
            {!readOnly && (
              <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label="글 칸 빼기" onClick={() => setTexts(texts.filter((_, j) => j !== k))}>
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="btn btn-soft" onClick={() => setTexts([...texts, ''])}>
            <Icon name="plus" size={18} /> 글 칸
          </button>
        )}
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <p className="font-extrabold">제출 구분</p>
        <p className="hint">고르면 요소 점수 대신 이 점수가 평가 점수가 돼요 (예: 백지 제출 20점, 미응시(미인정) 15점).</p>
        {specials.map((x, k) => (
          <div key={k} className="flex items-center gap-2">
            <input className="field flex-1" value={x.label} placeholder="예: 백지 제출" aria-label={`제출 구분 ${k + 1} 이름`} disabled={readOnly} onChange={(e) => setSpecials(specials.map((y, j) => (j === k ? { ...y, label: e.target.value } : y)))} />
            <NumInput className="field w-20 text-right tabular-nums" value={x.points} aria-label={`${x.label} 점수`} disabled={readOnly} onValue={(v) => setSpecials(specials.map((y, j) => (j === k ? { ...y, points: v } : y)))} />
            <span className="text-ink-3">점</span>
            {!readOnly && (
              <button type="button" className="btn btn-ghost px-2 text-ink-3" aria-label="제출 구분 빼기" onClick={() => setSpecials(specials.filter((_, j) => j !== k))}>
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="btn btn-soft" onClick={() => setSpecials([...specials, { label: '', points: 0 }])}>
            <Icon name="plus" size={18} /> 제출 구분
          </button>
        )}
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <p className="font-extrabold">성취 수준</p>
        <div className="segment" role="radiogroup" aria-label="성취 수준">
          {(
            [
              ['off', '안 씀'],
              ['3', '상·중·하'],
              ['5', 'A~E'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" role="radio" aria-checked={levelMode === m} disabled={readOnly} onClick={() => setLevelCuts(m === 'off' ? [] : LEVEL_CUT_PRESETS[m].map((c) => ({ ...c })))}>
              {label}
            </button>
          ))}
        </div>
        {levelCuts.length > 0 && (
          <>
            <p className="hint">합계가 만점의 몇 % 이상이면 그 수준인지 정해요 (만점 100점이면 % = 점수).</p>
            {levelCuts.map((c, k) => (
              <div key={k} className="flex items-center gap-2">
                <input className="field w-20 text-center font-bold" value={c.label} aria-label={`수준 ${k + 1} 이름`} disabled={readOnly} onChange={(e) => setLevelCuts(levelCuts.map((y, j) => (j === k ? { ...y, label: e.target.value } : y)))} />
                {k === levelCuts.length - 1 ? (
                  <span className="text-sm text-ink-3">그 밖</span>
                ) : (
                  <>
                    <NumInput className="field w-20 text-right tabular-nums" value={c.min} aria-label={`${c.label} 기준 %`} disabled={readOnly} onValue={(v) => setLevelCuts(levelCuts.map((y, j) => (j === k ? { ...y, min: v } : y)))} />
                    <span className="text-sm text-ink-3">% 이상</span>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
