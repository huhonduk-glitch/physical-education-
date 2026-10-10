import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db, newId } from '../db/db'
import { saveXlsx } from '../lib/download'
import { buildRubric, LEVEL_SETS, METHOD_ORDER, METHODS, recommendMethods, rubricTable, rubricToItems, type RubricMethod, type RubricRow } from '../lib/rubric'
import { findStandards, STANDARDS, type Standard } from '../lib/standards'
import { useApp } from '../state/AppContext'
import { NumberField } from './timer/common'

/**
 * 루브릭 만들기 (재설계 5단계): 성취기준 고르기 → 평가 방법 추천 → 요소×등급 판단 기준 초안 → 고치기 → 수행평가로.
 * 초안은 정해 둔 틀로 만든다(인공지능·인터넷 없음). 성취기준 목록은 교육과정 파일에서만 채운다.
 */
export default function RubricPage() {
  const { settings, readOnly } = useApp()
  const nav = useNavigate()
  const hasList = STANDARDS.subjects.length > 0
  const [school, setSchool] = useState(settings.schoolLevel === '중' ? '중' : '고')
  const subjects = useMemo(() => [...new Set(STANDARDS.subjects.filter((s) => s.school === school).map((s) => s.subject))], [school])
  const [subject, setSubject] = useState('')
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Standard[]>([])
  const [typed, setTyped] = useState('')
  const [content, setContent] = useState('')
  const [method, setMethod] = useState<RubricMethod | null>(null)
  const [levelSet, setLevelSet] = useState(Object.keys(LEVEL_SETS)[0])
  const [max, setMax] = useState(100)
  const [rows, setRows] = useState<RubricRow[] | null>(null)
  const [msg, setMsg] = useState('')

  const hits = useMemo(() => (hasList ? findStandards(STANDARDS, { school, subject: subject || undefined, text: q }).slice(0, 40) : []), [hasList, school, subject, q])
  const standardText = [...chosen.map((s) => s.text), typed].join(' ')
  const recs = useMemo(() => (standardText.trim() ? recommendMethods(standardText) : []), [standardText])
  const methodNow: RubricMethod = method ?? recs[0]?.method ?? 'skill'
  const levels = LEVEL_SETS[levelSet]

  const toggle = (s: Standard) => setChosen((l) => (l.some((x) => x.code === s.code) ? l.filter((x) => x.code !== s.code) : l.length >= 3 ? l : [...l, s]))
  const make = () => {
    setRows(buildRubric({ method: methodNow, content, levels, max }))
    setMsg('')
  }
  const patchRow = (i: number, p: Partial<RubricRow>) => setRows((r) => r && r.map((x, k) => (k === i ? { ...x, ...p } : x)))
  /** 등급 점수를 고치면 요소 만점 = 가장 높은 등급 점수 */
  const patchLevel = (i: number, k: number, p: Partial<RubricRow['levels'][number]>) =>
    setRows((r) =>
      r?.map((x, j) => {
        if (j !== i) return x
        const lv = x.levels.map((l, m) => (m === k ? { ...l, ...p } : l))
        return { ...x, levels: lv, max: Math.max(0, ...lv.map((l) => l.points)) }
      }) ?? null,
    )
  const total = (rows ?? []).reduce((a, r) => a + r.max, 0)

  const standardsOut = [...chosen.map((s) => ({ code: s.code, text: s.text })), ...(typed.trim() ? [{ code: '', text: typed.trim() }] : [])]
  const createAssessment = async () => {
    if (!rows) return
    const id = newId()
    await db.assessments.add({
      id,
      schoolYear: settings.schoolYear,
      title: content.trim() || METHODS[methodNow].label,
      grade: 0,
      rubric: [],
      altTaskEnabled: true,
      groupIds: [],
      items: rubricToItems(rows, newId),
      standards: standardsOut,
    })
    nav(`/more/assessments/${id}/edit?from=rubric`)
  }
  const exportXlsx = () =>
    rows &&
    saveXlsx(`루브릭_${(content || '수행평가').replace(/\s+/g, '')}.xlsx`, [
      {
        name: '루브릭',
        rows: [
          ['평가 내용', content],
          ['성취기준', standardsOut.map((s) => `${s.code} ${s.text}`.trim()).join('\n')],
          ['평가 방법', METHODS[methodNow].label],
          [],
          ...rubricTable(rows, levels),
        ],
        widths: [18, 8, ...levels.map(() => 34)],
      },
    ])

  return (
    <>
      <PageHeader title="루브릭 만들기" sub="성취기준 → 채점 기준 추천" back />
      <div className="page space-y-4 pb-10">
        <section className="card space-y-3 print:hidden">
          <p className="card-title">① 성취기준</p>
          {hasList ? (
            <>
              <div className="segment" role="tablist" aria-label="학교급">
                {['중', '고'].map((x) => (
                  <button key={x} type="button" role="tab" aria-selected={school === x} onClick={() => (setSchool(x), setSubject(''))}>
                    {x === '중' ? '중학교' : '고등학교'}
                  </button>
                ))}
              </div>
              <select className="field" aria-label="과목" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">과목 전체</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input className="field" placeholder="찾을 말 (예: 경기, 표현, 체력)" aria-label="성취기준 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
              <ul className="max-h-72 space-y-1.5 overflow-auto">
                {hits.map((s) => {
                  const on = chosen.some((x) => x.code === s.code)
                  return (
                    <li key={`${s.subject}${s.code}`}>
                      <button type="button" aria-pressed={on} className={`w-full rounded-2xl p-3 text-left ${on ? 'bg-brand-light ring-2 ring-brand' : 'bg-fill'}`} onClick={() => toggle(s)}>
                        <span className="block text-sm font-bold text-ink-3">
                          {s.code} · {s.subject} · {s.area}
                        </span>
                        <span className="block font-semibold">{s.text}</span>
                      </button>
                    </li>
                  )
                })}
                {hits.length === 0 && <li className="hint">맞는 성취기준이 없어요.</li>}
              </ul>
              <p className="hint">최대 3개까지 고를 수 있어요. 출처: {STANDARDS.source}</p>
            </>
          ) : (
            <p className="rounded-2xl bg-caution-light p-3 text-sm font-bold text-caution">
              성취기준 목록은 교육과정 파일을 받은 뒤에 채워져요. 그 전에는 아래에 성취기준을 붙여넣어 주세요.
            </p>
          )}
          <label className="block">
            <span className="label">{hasList ? '목록에 없으면 직접 붙여넣기' : '성취기준 붙여넣기'}</span>
            <textarea className="field min-h-[72px] py-3" value={typed} placeholder="교육과정의 성취기준 문장을 그대로 붙여넣어 주세요" onChange={(e) => setTyped(e.target.value)} />
          </label>
        </section>

        <section className="card space-y-3 print:hidden">
          <p className="card-title">② 평가 내용과 방법</p>
          <label className="block">
            <span className="label">평가 내용 (종목 · 활동)</span>
            <input className="field" value={content} placeholder="예: 농구 레이업 슛, 배드민턴 하이클리어, 창작 체조" onChange={(e) => setContent(e.target.value)} />
          </label>
          <div className="space-y-2" role="radiogroup" aria-label="평가 방법">
            {METHOD_ORDER.map((m) => {
              const rec = recs.find((r) => r.method === m && r.words.length > 0)
              const on = methodNow === m
              return (
                <button key={m} type="button" role="radio" aria-checked={on} className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ${on ? 'bg-brand-light ring-2 ring-brand' : 'bg-fill'}`} onClick={() => setMethod(m)}>
                  <span className="min-w-0 flex-1">
                    <b className="block">
                      {METHODS[m].label}
                      {rec && <span className="badge ml-2 bg-ok text-white">추천</span>}
                    </b>
                    <span className="hint block">{METHODS[m].desc}</span>
                    {rec && <span className="block text-sm font-bold text-ok">성취기준의 '{rec.words.join("', '")}'</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <label className="block">
            <span className="label">등급 단계</span>
            <select className="field" value={levelSet} onChange={(e) => setLevelSet(e.target.value)}>
              {Object.keys(LEVEL_SETS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <NumberField label="영역 만점 (나이스 만점)" value={max} onChange={setMax} min={5} max={100} suffix="점" />
          <button type="button" className="btn btn-primary h-14 w-full text-lg" onClick={make} disabled={!content.trim()}>
            <Icon name="bolt" /> 루브릭 만들기
          </button>
          {!content.trim() && <p className="hint">평가 내용을 적으면 만들 수 있어요.</p>}
        </section>

        {rows && (
          <section className="space-y-3">
            <div className="card space-y-1">
              <p className="card-title">③ 루브릭 초안 · 고쳐서 쓰세요</p>
              <p className="hint">
                {METHODS[methodNow].label} · {levels.join('·')} · 합계 {total}점{total !== max ? ` (만점 ${max}점과 달라요)` : ''}
              </p>
              {standardsOut.length > 0 && (
                <ul className="text-sm text-ink-2">
                  {standardsOut.map((s, i) => (
                    <li key={i}>
                      {s.code} {s.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {rows.map((r, i) => (
              <article key={i} className="card space-y-2">
                <div className="flex items-center gap-2">
                  <input className="field min-w-0 flex-1 font-bold" aria-label={`${i + 1}번째 요소`} value={r.label} onChange={(e) => patchRow(i, { label: e.target.value })} />
                  <span className="badge shrink-0 bg-fill-2 text-ink-2 tabular-nums">{r.max}점</span>
                </div>
                {r.record ? (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-fill p-3 text-sm">기록(시간·거리·횟수)은 기록표로 채점해요. 수행평가를 만든 뒤 구간(예: 120회 이상 → {r.max}점)을 넣어 주세요.</p>
                    <NumberField label="이 요소 만점" value={r.max} onChange={(v) => patchRow(i, { max: v })} min={1} max={100} suffix="점" />
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {r.levels.map((l, k) => (
                      <li key={k} className="space-y-1 rounded-2xl bg-fill p-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-10 shrink-0 place-items-center rounded-xl bg-ink font-black text-white">{l.label}</span>
                          <span className="flex-1" />
                          <input
                            className="field w-20 bg-white text-center font-bold tabular-nums"
                            inputMode="numeric"
                            aria-label={`${r.label} ${l.label} 점수`}
                            value={l.points}
                            onChange={(e) => patchLevel(i, k, { points: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })}
                          />
                          <span className="text-ink-3">점</span>
                        </div>
                        <textarea
                          className="field min-h-[56px] bg-white py-2 text-[0.95rem]"
                          aria-label={`${r.label} ${l.label} 기준`}
                          value={l.desc}
                          onChange={(e) => patchLevel(i, k, { desc: e.target.value })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" className="btn btn-primary sm:col-span-3" onClick={createAssessment} disabled={readOnly}>
                <Icon name="clipboard" /> 이 루브릭으로 수행평가 만들기
              </button>
              <button type="button" className="btn btn-soft" onClick={exportXlsx}>
                <Icon name="download" /> 엑셀
              </button>
              <button type="button" className="btn btn-soft" onClick={() => window.print()}>
                <Icon name="file" /> 인쇄
              </button>
              <button type="button" className="btn btn-soft" onClick={make}>
                <Icon name="reset" /> 처음 초안으로
              </button>
            </div>
            {msg && <p className="font-bold text-ok">{msg}</p>}
            <p className="hint">초안은 정해 둔 틀로 만든 출발점이에요. 학교 평가 계획에 맞게 꼭 고쳐서 쓰세요.</p>
          </section>
        )}
      </div>
    </>
  )
}
