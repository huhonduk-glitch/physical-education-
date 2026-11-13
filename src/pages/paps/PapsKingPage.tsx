import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../../components/Collapse'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { loadKingStudents } from '../../db/reportRepo'
import { copyText, saveXlsx } from '../../lib/download'
import {
  CUT_STEP,
  EXAMPLE_CUTS,
  KING_COLUMNS,
  cutKey,
  cutsFor,
  cutsInOrder,
  officialCuts,
  parseCuts,
  rankKings,
  winners,
  winnersText,
  type KingConf,
  type KingGroup,
  type KingRow,
} from '../../lib/fitKing'
import { eventName, fixed, type EventId, type Gender } from '../../lib/paps'
import { useApp } from '../../state/AppContext'

const AWARD_TONE: Record<string, string> = {
  최우수상: 'bg-brand text-white',
  우수상: 'bg-brand-light text-brand',
  장려상: 'bg-fill text-ink-2',
}
const G_LABEL: Record<Gender, string> = { M: '남', F: '여' }

/**
 * 체력왕 선발 (2026-11-13 교사 요청). 종목마다 가장 좋은 기록 → 점수 → 합계 순위 → 위에서부터 시상.
 * 계산은 src/lib/fitKing.ts. 학교 자체 기준은 교사가 넣는 시상용 숫자(PAPS 등급 아님).
 */
export default function PapsKingPage() {
  const { settings, standards, updateSettings, readOnly } = useApp()
  const conf = settings.fitKing
  const grades = useLiveQuery(
    async () => [...new Set((await db.students.where('schoolYear').equals(settings.schoolYear).toArray()).filter((s) => s.status === '재학').map((s) => s.grade))].sort(),
    [settings.schoolYear],
  )
  const [grade, setGrade] = useState<number | null>(null)
  useEffect(() => {
    if (grades?.length && (grade === null || !grades.includes(grade))) setGrade(grades[0])
  }, [grades, grade])
  const students = useLiveQuery(() => (grade === null ? Promise.resolve(undefined) : loadKingStudents(db, settings.schoolYear, grade, standards)), [settings.schoolYear, grade, standards])
  const ctx = useMemo(() => ({ std: standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }), [standards, settings.schoolLevel, settings.papsFlexMode])
  const result = useMemo(() => (students ? rankKings(ctx, conf, students) : null), [ctx, conf, students])
  const [copied, setCopied] = useState(false)

  const save = (patch: Partial<KingConf>) => updateSettings({ fitKing: { ...conf, ...patch } })

  if (!grades) return <PageHeader title="체력왕 선발" back />
  if (grades.length === 0) {
    return (
      <>
        <PageHeader title="체력왕 선발" back />
        <div className="page">
          <p className="card text-center font-bold">먼저 학생 명렬을 올려 주세요</p>
        </div>
      </>
    )
  }

  const lv = settings.schoolLevel
  const genders = (['M', 'F'] as const).filter((g) => students?.some((s) => s.gender === g))
  // 이 학년이 잰 종목 (반마다 다르면 모두)
  const events = KING_COLUMNS.flatMap((f) => [...new Set((students ?? []).map((s) => s.events[f]).filter((e): e is EventId => !!e))])
  const noConfig = (students ?? []).length > 0 && events.length === 0
  const title = `${settings.schoolYear}학년도 ${lv}${grade} 체력왕`
  const allWinners = result?.groups.flatMap(winners) ?? []
  const recordOf = (e: EventId | null, v: number | null) => (e && v !== null ? fixed(v, Math.min(standards.events[e]?.decimals ?? 0, 1)) : '')

  const fillExample = () => {
    if (grade === null) return
    const cuts = { ...conf.cuts }
    for (const e of events) {
      const ex = EXAMPLE_CUTS[e]
      if (!ex) continue
      for (const g of genders) if (!cuts[cutKey(grade, e, g)]?.length) cuts[cutKey(grade, e, g)] = [...ex]
    }
    save({ cuts })
  }
  const fillOfficial = () => {
    if (grade === null) return
    const cuts = { ...conf.cuts }
    for (const e of events)
      for (const g of genders) {
        const oc = officialCuts(standards, e, `${lv}${grade}`, g)
        if (oc) cuts[cutKey(grade, e, g)] = oc
      }
    save({ cuts })
  }

  const exportXlsx = () => {
    if (!result || grade === null) return
    const head = ['순위', '수상', '학년', '반', '번호', '이름', '성별', ...KING_COLUMNS.flatMap((f) => [`${f} 종목`, '최고기록', '점수']), '점수 총합', '측정 상태']
    const line = (r: KingRow) => [
      r.rank ?? '',
      r.award ?? '',
      r.student.grade,
      r.student.classNo,
      r.student.number,
      r.student.name,
      r.student.gender ? G_LABEL[r.student.gender] : '',
      ...r.factors.flatMap((f) => [f.eventId ? eventName(standards, f.eventId, r.student.gender ?? undefined) : '', f.value ?? '', f.points ?? '']),
      r.total ?? '',
      r.status === '측정완료' ? '측정완료' : `${r.status}(수상 제외)`,
    ]
    const basis =
      conf.mode === 'official'
        ? '점수 기준: 공식 PAPS 점수(종목당 0~20점, BMI 제외) 합'
        : `점수 기준: 학교 자체 기준(넘은 기준 하나에 ${CUT_STEP}점, PAPS 등급 아님) — ${events
            .flatMap((e) => genders.map((g) => `${eventName(standards, e, g)}${genders.length > 1 ? `(${G_LABEL[g]})` : ''} ${(cutsFor(conf, grade, e, g) ?? []).join('/')}`))
            .join(' · ')}`
    void saveXlsx(`체력왕_${settings.schoolYear}_${lv}${grade}.xlsx`, [
      ...result.groups.map((g) => ({
        name: result.groups.length > 1 ? `순위(${g.label})` : '순위',
        rows: [[`${title} 선발 (종목별 가장 좋은 기록 · 앱 계산 확인용)`], [basis], [`대상 ${g.eligible}명 · 측정완료 ${g.complete}명 · 시상 ${g.quota}명까지(최우수 포함)`], head, ...g.rows.map(line)],
        widths: [6, 9, 5, 5, 6, 10, 5, ...KING_COLUMNS.flatMap(() => [18, 9, 6]), 9, 20],
      })),
      {
        name: '수상자',
        rows: [[`${title} 수상자`], ['수상', '순위', '학년', '반', '번호', '이름', '점수 총합'], ...allWinners.map((r) => [r.award!, r.rank!, r.student.grade, r.student.classNo, r.student.number, r.student.name, r.total!])],
        widths: [10, 6, 5, 5, 6, 10, 9],
      },
    ])
  }

  return (
    <>
      <PageHeader title="체력왕 선발" sub="종목별 가장 좋은 기록 → 점수 → 순위 → 시상" back wide="xl" />
      <div className="page space-y-4 pb-8 lg:max-w-[72rem]">
        <div className="flex gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible">
          {grades.map((g) => (
            <button key={g} type="button" className="chip shrink-0" aria-pressed={g === grade} onClick={() => setGrade(g)}>
              {lv}
              {g}
            </button>
          ))}
        </div>

        <section className="card space-y-3">
          <div>
            <p className="card-title">선발 방법</p>
            <p className="hint">BMI를 뺀 네 체력요인의 종목마다, 여러 번 쟀으면 가장 좋은 기록으로 점수를 매겨 더해요. 한 종목이라도 안 잰 학생 · 측정 제외 학생은 수상에서 빠져요.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="chip justify-center" aria-pressed={conf.mode === 'custom'} disabled={readOnly} onClick={() => save({ mode: 'custom' })}>
              학교 자체 기준
            </button>
            <button type="button" className="chip justify-center" aria-pressed={conf.mode === 'official'} disabled={readOnly} onClick={() => save({ mode: 'official' })}>
              공식 PAPS 점수
            </button>
          </div>
          <p className="hint">
            {conf.mode === 'custom'
              ? `학교 자체 기준: 종목마다 선생님이 정한 기준 기록을 넘을 때마다 ${CUT_STEP}점이에요. 시상용 점수이며 PAPS 등급이 아니에요.`
              : '공식 PAPS 점수: 교육부 기준표의 종목 점수(0~20점)를 더해요(80점 만점). 상위권은 만점이 많아 동점이 자주 나와요.'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.95rem] font-bold">
            <label className="flex items-center gap-2">
              시상
              <input
                className="field w-20 text-center"
                inputMode="numeric"
                aria-label="시상 비율(%)"
                disabled={readOnly || conf.count !== null}
                value={conf.count !== null ? '' : String(conf.percent)}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n) && n >= 0 && n <= 100) save({ percent: n })
                }}
              />
              %까지
            </label>
            <label className="flex items-center gap-2">
              또는
              <input
                className="field w-20 text-center"
                inputMode="numeric"
                aria-label="시상 인원 직접 정하기"
                placeholder="인원"
                disabled={readOnly}
                value={conf.count === null ? '' : String(conf.count)}
                onChange={(e) => {
                  const t = e.target.value.trim()
                  const n = Number(t)
                  save({ count: t === '' || !Number.isFinite(n) || n < 0 ? null : Math.floor(n) })
                }}
              />
              명까지
            </label>
          </div>
          <p className="hint">
            최우수상 {conf.gold}명 · 우수상 {conf.silver}명 · 그 아래는 장려상이에요. 시상 인원은 최우수상까지 포함한 수예요(측정 제외 학생을 뺀 인원의 {conf.count !== null ? `${conf.count}명` : `${conf.percent}%`}).
            장려상은 같은 순위가 여러 명이라 인원을 넘으면 그 묶음을 모두 빼요.
          </p>
          {genders.length > 1 && (
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" className="h-5 w-5" checked={conf.split} disabled={readOnly} onChange={(e) => save({ split: e.target.checked })} />
              <span className="font-bold">남녀 따로 순위 매기기</span>
              <span className="hint">(끄면 한 순위 — 점수 기준이 남녀 따로라서)</span>
            </label>
          )}
        </section>

        {noConfig && (
          <p className="card font-bold text-caution">
            이 학년 반들의 측정 종목이 정해지지 않았어요.{' '}
            <Link to="/paps/setup" className="text-brand underline">
              측정 설정
            </Link>
            에서 종목을 고르면 여기에 나와요.
          </p>
        )}

        {conf.mode === 'custom' && grade !== null && events.length > 0 && (
          <Collapse
            title={`학교 자체 기준 (${lv}${grade})`}
            sub={result?.missing.length ? '기준이 비어 있는 종목이 있어요' : `기준을 넘을 때마다 ${CUT_STEP}점 · 눌러서 고치기`}
            className="card"
            defaultOpen={!!result?.missing.length}
          >
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className="btn btn-soft" disabled={readOnly} onClick={fillOfficial}>
                  공식 등급 경계로 채우기
                </button>
                <button type="button" className="btn btn-soft" disabled={readOnly} onClick={fillExample}>
                  빈 종목에 예시 기준 넣기
                </button>
              </div>
              <p className="hint">낮은 점수 기준부터 쉼표로 적어요. 예: 40, 45, 50, 55, 60 → 40회 이상 5점 … 60회 이상 25점. 낮을수록 좋은 종목(달리기 초)은 큰 수부터 적어요.</p>
              <div className="grid gap-3 lg:grid-cols-2">
              {events.map((e) =>
                genders.map((g) => (
                  <CutInput
                    key={`${grade}|${e}|${g}`}
                    label={`${eventName(standards, e, g)}${genders.length > 1 ? ` (${G_LABEL[g]})` : ''} · ${standards.events[e]?.unit ?? ''}`}
                    value={cutsFor(conf, grade, e, g) ?? []}
                    lower={standards.events[e]?.direction === 'lower'}
                    disabled={readOnly}
                    onSave={(list) => save({ cuts: { ...conf.cuts, [cutKey(grade, e, g)]: list } })}
                  />
                )),
              )}
              </div>
              <p className="hint">
                예시 기준은 이 기능을 제안한 선생님 학교의 2026학년도 3학년 기준(왕복오래달리기 · 악력 · 제자리멀리뛰기 · 앉아윗몸앞으로굽히기)이에요. 공식 등급 경계는 교육부 기준표에서 4 · 3 · 2 · 1등급이 되는 기록을 가져와요(5 ·
                10 · 15 · 20점). 더 높은 기준은 뒤에 이어 적으면 돼요.
              </p>
            </div>
          </Collapse>
        )}

        {result?.groups.map((g) => (
          <GroupCard key={g.key} g={g} many={result.groups.length > 1} max={result.max} recordOf={recordOf} />
        ))}

        {result && allWinners.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-primary" onClick={exportXlsx}>
              엑셀 받기 (순위표 · 수상자)
            </button>
            <button
              type="button"
              className="btn btn-soft"
              onClick={async () => {
                setCopied(await copyText(winnersText(`${title} 수상자`, result.groups)))
                setTimeout(() => setCopied(false), 2500)
              }}
            >
              {copied ? '복사했어요' : '수상자 명단 복사'}
            </button>
          </div>
        )}
        <p className="hint">
          앱 계산은 확인용이에요. 시상 전에 기록을 한 번 더 확인하세요. 교내상 수상 사실은 학교생활기록부 세특에 적을 수 없어요(수상경력 항목은 학교 규정에 따라요). 학생 이름이 나오는 화면이니 수업 중 화면에 띄울 때 주의하세요.
        </p>
      </div>
    </>
  )
}

function CutInput({ label, value, lower, disabled, onSave }: { label: string; value: number[]; lower: boolean; disabled: boolean; onSave: (list: number[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  const [err, setErr] = useState('')
  const joined = value.join(', ')
  useEffect(() => setText(joined), [joined])
  const commit = () => {
    const list = parseCuts(text)
    if (!list) return setErr('숫자만 쉼표로 나눠 적어 주세요')
    if (!cutsInOrder(list, lower)) return setErr(lower ? '낮을수록 좋은 종목이라 큰 수부터 작아지게 적어 주세요' : '작은 수부터 커지게 적어 주세요')
    setErr('')
    if (list.join(',') !== value.join(',')) onSave(list)
  }
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        className="field mt-1"
        inputMode="text"
        placeholder={lower ? '기준 없음 — 느린 기록부터 쉼표로' : '기준 없음 — 낮은 기록부터 쉼표로'}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {err ? <span className="text-sm font-bold text-danger">{err}</span> : value.length > 0 && <span className="hint">{value.map((c, i) => `${c}${lower ? '↓' : '↑'} ${(i + 1) * CUT_STEP}점`).join(' · ')}</span>}
    </label>
  )
}

function GroupCard({ g, many, max, recordOf }: { g: KingGroup; many: boolean; max: number | null; recordOf: (e: EventId | null, v: number | null) => string }) {
  const { standards } = useApp()
  const won = winners(g)
  const out = g.rows.filter((r) => r.total === null && r.status !== '측정 제외')
  const count = (a: string) => won.filter((r) => r.award === a).length
  return (
    <section className="card space-y-3">
      <div>
        <p className="card-title">{many ? `${g.label} 수상자` : '수상자'}</p>
        <p className="hint">
          대상 {g.eligible}명 · 측정완료 {g.complete}명 · 시상 {g.quota}명까지 → 최우수 {count('최우수상')} · 우수 {count('우수상')} · 장려 {count('장려상')} (모두 {won.length}명)
          {g.cutTies > 0 && ` · 같은 순위라 인원을 넘어 빠진 학생 ${g.cutTies}명(기준을 더 잘게 나누면 동점이 줄어요)`}
          {max !== null && ` · ${max}점 만점`}
        </p>
      </div>
      {g.complete === 0 ? (
        <p className="hint">아직 네 종목을 다 잰 학생이 없어요{out.some((r) => r.status === '기준 없음') ? ' — 위에서 학교 자체 기준을 넣어 주세요' : ''}.</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {won.map((r) => (
              <li key={r.student.studentId}>
                <Link to={`/students/${r.student.studentId}`} className="flex min-h-[48px] items-center gap-2">
                  <span className={`w-[4.2rem] shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-extrabold ${AWARD_TONE[r.award!]}`}>{r.award}</span>
                  <span className="w-8 shrink-0 text-right font-bold tabular-nums">{r.rank}</span>
                  <span className="w-14 shrink-0 text-sm text-ink-3 tabular-nums">
                    {r.student.classNo}-{r.student.number}
                  </span>
                  <b className="min-w-0 flex-1 truncate">{r.student.name}</b>
                  <span className="shrink-0 font-bold tabular-nums">{r.total}점</span>
                </Link>
              </li>
            ))}
          </ul>
          <Collapse title={`전체 순위 ${g.complete}명`} sub="종목별 최고 기록 · 점수">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm whitespace-nowrap tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    <th className="py-1.5 pr-2 text-right">순위</th>
                    <th className="px-1 text-left">반-번호</th>
                    <th className="px-1 text-left">이름</th>
                    {g.rows[0]?.factors.map((f) => (
                      <th key={f.factor} className="px-1 text-right">
                        {f.eventId ? eventName(standards, f.eventId, g.key === 'all' ? undefined : g.key).split(' ')[0].split('(')[0] : f.factor}
                      </th>
                    ))}
                    <th className="px-1 text-right">합계</th>
                    <th className="px-1 text-left">수상</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows
                    .filter((r) => r.total !== null)
                    .map((r) => (
                      <tr key={r.student.studentId} className="border-t border-line">
                        <td className="py-1.5 pr-2 text-right font-bold">{r.rank}</td>
                        <td className="px-1">
                          {r.student.classNo}-{r.student.number}
                        </td>
                        <td className="px-1 font-bold">{r.student.name}</td>
                        {r.factors.map((f) => (
                          <td key={f.factor} className="px-1 text-right">
                            {recordOf(f.eventId, f.value)} <b className="text-brand">{f.points}</b>
                          </td>
                        ))}
                        <td className="px-1 text-right font-bold">{r.total}</td>
                        <td className="px-1">{r.award ?? ''}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Collapse>
        </>
      )}
      {out.length > 0 && (
        <Collapse title={`수상에서 빠진 학생 ${out.length}명`} sub={out.every((r) => r.status === '기준 없음') ? '점수 기준이 없는 종목이 있어요' : '안 잰 종목이 있어요'}>
          <ul className="divide-y divide-line">
            {out.map((r) => (
              <li key={r.student.studentId} className="flex min-h-[44px] items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-ink-3 tabular-nums">
                  {r.student.classNo}-{r.student.number}
                </span>
                <b className="min-w-0 flex-1 truncate">{r.student.name}</b>
                <span className="shrink-0 text-sm text-ink-2">
                  {r.status}
                  {r.status === '일부 미측정' && ` · ${r.factors.filter((f) => f.value === null).map((f) => f.factor).join(', ')}`}
                </span>
              </li>
            ))}
          </ul>
        </Collapse>
      )}
    </section>
  )
}
