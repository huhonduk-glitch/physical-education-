import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ClassPicker from '../../components/ClassPicker'
import Collapse from '../../components/Collapse'
import PageHeader from '../../components/PageHeader'
import { eventName, FACTORS, levelKey, type EventId, type Factor, type StudentPaps } from '../../lib/paps'
import { classStat, factorValues, gradeEdges, improvement, needsSupport, type StatInput } from '../../lib/papsStats'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { DotStrip, FactorBars, GENDER_COLORS, GRADE_COLORS, GradeStack, Legend, ProfileBars, roundColors, SERIES_1, TrendLine } from './charts'
import { usePapsClassKey } from './common'
import RoundBar, { roundLabel } from './RoundBar'
import { useRoundSummaries } from './RoundCompare'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
const SHORT: Record<Factor, string> = { 심폐지구력: '심폐지구력', '근력·근지구력': '근력', 유연성: '유연성', 순발력: '순발력', 비만: '비만(BMI)' }

/**
 * PAPS 통계 (재설계 B-4): 반 결과를 자동으로 그래프·통계로.
 * 모든 값은 공식 기준표로 계산한 점수·등급을 세고 평균 낸 것 (src/lib/papsStats.ts). 새 기준은 만들지 않는다.
 */
export default function PapsStatsPage() {
  const { standards, readOnly, settings } = useApp()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const byRound = useRoundSummaries(cls, pc)
  const rounds = pc.rounds.rounds
  const ri = Math.max(0, rounds.findIndex((r) => r.id === pc.roundId))
  const [sp, setSp] = useSearchParams()

  const inputsAt = useMemo(
    () => (i: number): StatInput[] => pc.students.map((s) => ({ id: s.id, gender: s.gender, paps: byRound?.get(s.id)?.[i] ?? null, excluded: pc.excluded.has(s.id) })),
    [pc.students, pc.excluded, byRound],
  )
  const now = useMemo(() => classStat(inputsAt(ri)), [inputsAt, ri])
  const perRound = useMemo(() => rounds.map((_, i) => classStat(inputsAt(i))), [rounds, inputsAt])
  const genders = new Set(pc.students.map((s) => s.gender).filter(Boolean))
  const mixed = genders.has('M') && genders.has('F')
  const [byGender, setByGender] = useState(false)
  const [trendKey, setTrendKey] = useState<'total' | Factor>('total')
  const [stripFactor, setStripFactor] = useState<Factor>('심폐지구력')
  const studentId = sp.get('s') ?? ''
  const nameOf = new Map(pc.students.map((s) => [s.id, `${s.number}번 ${s.name}`]))

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="PAPS 통계" back />
        <div className="page">
          <p className="card text-center font-bold">먼저 학생 명렬을 올려 주세요</p>
        </div>
      </>
    )
  }

  // ── 요인별 평균 (남녀 따로 보기는 공학 반에서만)
  const factorItems = FACTORS.map((f) => {
    const all = now.factors.find((x) => x.factor === f)!
    if (!(byGender && mixed)) return { label: SHORT[f], values: [{ key: 'all', label: '전체', color: SERIES_1, value: all.avg, n: all.n }] }
    const g = (gender: 'M' | 'F') => classStat(inputsAt(ri).filter((s) => s.gender === gender)).factors.find((x) => x.factor === f)!
    const m = g('M')
    const w = g('F')
    return {
      label: SHORT[f],
      values: [
        { key: 'M', label: '남', color: GENDER_COLORS.M, value: m.avg, n: m.n },
        { key: 'F', label: '여', color: GENDER_COLORS.F, value: w.avg, n: w.n },
      ],
    }
  })

  // ── 회차별 추이
  const trend = rounds.map((r, i) => {
    const st = perRound[i]
    if (trendKey === 'total') return { label: `${r.round}회차`, value: st.avgTotal, n: st.complete }
    const f = st.factors.find((x) => x.factor === trendKey)!
    return { label: `${r.round}회차`, value: f.avg, n: f.n }
  })
  const imp = rounds.length > 1 && byRound ? improvement(pc.students.map((s) => byRound.get(s.id)?.[ri - 1] ?? null), pc.students.map((s) => byRound.get(s.id)?.[ri] ?? null)) : null

  // ── 기록 분포 (공식 기준표의 등급 경계를 세로선으로)
  const stripEvent: EventId | undefined = stripFactor === '비만' ? 'bmi' : pc.selected[stripFactor]
  const lv = cls ? levelKey(settings.schoolLevel, cls.grade) : ''
  const vals = factorValues(inputsAt(ri), stripFactor)
  const stripRows = (['M', 'F'] as const)
    .map((g) => ({
      g,
      dots: vals
        .filter((v) => (mixed ? v.gender === g : true))
        .map((v) => ({ id: v.id, name: nameOf.get(v.id) ?? '', value: v.value, grade: typeof v.band?.grade === 'number' ? v.band.grade : null })),
    }))
    .filter((r, i) => (mixed ? r.dots.length > 0 : i === 0))
    .map((r) => {
      const gender = mixed ? r.g : ((pc.students.find((s) => s.gender)?.gender ?? 'M') as 'M' | 'F')
      const bands = stripEvent ? (standards.table[stripEvent]?.[lv]?.[gender] ?? []) : []
      return {
        label: mixed ? (r.g === 'M' ? '남학생' : '여학생') : '전체',
        dots: r.dots,
        bands: gradeEdges(bands),
      }
    })
  const unit = stripEvent ? (standards.events[stripEvent]?.unit ?? '') : ''

  // ── 학생 한 명 프로필 (회차별)
  const student = pc.students.find((s) => s.id === studentId)
  const sRounds: (StudentPaps | null)[] = student ? (byRound?.get(student.id) ?? []) : []
  const sShown = rounds.map((r, i) => ({ r, p: sRounds[i] })).filter((x) => x.p)
  const colors = roundColors(sShown.length)
  const support = needsSupport(inputsAt(ri))

  return (
    <>
      <PageHeader title="PAPS 통계" sub={cls ? `${cls.grade}학년 ${cls.classNo}반 · ${roundLabel(pc.round)}` : undefined} back />
      <div className="page space-y-4 pb-10">
        <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
        {cls && <RoundBar rounds={pc.rounds} readOnly={readOnly} />}
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          공식 기준표로 낸 점수·등급을 세고 평균만 낸 확인용 값이에요. 나이스 산출값과 다르면 나이스 값이 우선입니다.{' '}
          <Link to={`/paps/results${cls ? `?c=${cls.grade}-${cls.classNo}` : ''}`} className="font-bold text-brand">
            학생별 자세히 ›
          </Link>
        </p>

        {/* 한눈에 보기 */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="요약">
          {[
            { label: '다 측정', value: `${now.complete}`, sub: `/ ${now.students - now.excluded}명` },
            { label: '평균 종합점수', value: now.avgTotal === null ? '—' : `${now.avgTotal}`, sub: now.avgTotal === null ? '' : '점' },
            { label: '종합 1·2등급', value: pct(now.topRate), sub: now.complete ? `${now.gradeDist[0] + now.gradeDist[1]}명` : '' },
            { label: '많이 약한 요인', value: now.weakest[0] ? SHORT[now.weakest[0].factor] : '—', sub: now.weakest[0] ? `${now.weakest[0].count}명` : '' },
          ].map((t) => (
            <div key={t.label} className="card p-3.5">
              <p className="text-[0.8rem] font-bold text-ink-3">{t.label}</p>
              <p className={`mt-0.5 leading-tight font-black tabular-nums ${t.value.length > 5 ? 'text-[1.15rem]' : 'text-[1.5rem]'}`}>
                {t.value}
                <span className="ml-1 text-sm font-bold whitespace-nowrap text-ink-3">{t.sub}</span>
              </p>
            </div>
          ))}
        </section>
        {imp && imp.n > 0 && (
          <p className="card py-3 text-[0.95rem] font-semibold text-ink-2">
            {rounds[ri - 1].round}회차 → {rounds[ri].round}회차 (두 번 다 측정한 {imp.n}명): 오름 <b className="text-ink">{imp.up}명</b> · 같음 {imp.same}명 · 내림{' '}
            <b className="text-ink">{imp.down}명</b> · 평균 {imp.avgDelta! > 0 ? '+' : ''}
            {imp.avgDelta}점
          </p>
        )}

        <section className="card space-y-3">
          <div>
            <p className="card-title">종합등급 분포</p>
            <p className="hint">5개 요인을 다 측정한 학생만 세요. 회차마다 한 줄이에요.</p>
          </div>
          <Legend items={GRADE_COLORS.map((c, i) => ({ label: `${i + 1}등급`, color: c }))} />
          <GradeStack rows={rounds.map((r, i) => ({ label: roundLabel(r).split(' · ')[0], dist: perRound[i].gradeDist }))} />
          <Collapse title="표로 보기">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-ink-3">
                <tr>
                  <th className="p-1 text-left">회차</th>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <th key={g} className="p-1 text-right">
                      {g}등급
                    </th>
                  ))}
                  <th className="p-1 text-right">평균</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, i) => (
                  <tr key={r.id ?? 'first'} className="border-t border-line">
                    <td className="p-1">{r.round}회차</td>
                    {perRound[i].gradeDist.map((n, g) => (
                      <td key={g} className="p-1 text-right">
                        {n}
                      </td>
                    ))}
                    <td className="p-1 text-right">{perRound[i].avgTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Collapse>
        </section>

        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="card-title">체력요인별 평균 점수</p>
              <p className="hint">요인마다 20점 만점. 그 요인을 측정한 학생만 평균 내요.</p>
            </div>
            {mixed && (
              <button type="button" aria-pressed={byGender} className="chip shrink-0" onClick={() => setByGender((v) => !v)}>
                남녀 따로
              </button>
            )}
          </div>
          <Legend
            items={
              byGender && mixed
                ? [
                    { label: '남', color: GENDER_COLORS.M },
                    { label: '여', color: GENDER_COLORS.F },
                  ]
                : []
            }
          />
          <FactorBars items={factorItems} />
          <ul className="grid grid-cols-2 gap-1.5 text-[0.85rem] sm:grid-cols-4">
            {now.factors
              .filter((f) => f.topRate !== null)
              .map((f) => (
                <li key={f.factor} className="rounded-xl bg-fill px-3 py-1.5">
                  <span className="font-bold">{SHORT[f.factor]}</span> <span className="text-ink-3">1·2등급</span> <b className="tabular-nums">{pct(f.topRate)}</b>
                </li>
              ))}
          </ul>
          {now.weakest.length > 0 && (
            <p className="text-[0.9rem] text-ink-2">
              학생마다 점수가 가장 낮은 요인: {now.weakest.map((w) => `${SHORT[w.factor]} ${w.count}명`).join(' · ')}
            </p>
          )}
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">회차별 추이</p>
            <p className="hint">{rounds.length < 2 ? '회차가 하나뿐이에요. [+ 새 회차]로 다시 측정하면 변화가 그려져요.' : '반 평균이 회차마다 어떻게 바뀌었는지 봐요.'}</p>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(['total', ...FACTORS] as const).map((k) => (
              <button key={k} type="button" aria-pressed={trendKey === k} className="chip shrink-0" onClick={() => setTrendKey(k)}>
                {k === 'total' ? '종합점수' : SHORT[k]}
              </button>
            ))}
          </div>
          <TrendLine points={trend} max={trendKey === 'total' ? 100 : 20} unit="점" />
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">기록 분포</p>
            <p className="hint">
              학생 한 명이 점 하나예요. 세로선은 공식 기준표의 등급 경계({lv}
              {mixed ? ' · 남녀 기준이 달라 줄을 나눠요' : ''}). 점을 누르면 이름·기록이 보여요.
            </p>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FACTORS.map((f) => (
              <button key={f} type="button" aria-pressed={stripFactor === f} className="chip shrink-0" onClick={() => setStripFactor(f)}>
                {SHORT[f]}
              </button>
            ))}
          </div>
          {stripEvent ? (
            <>
              <p className="text-sm font-bold text-ink-2">
                {eventName(standards, stripEvent)} ({unit})
              </p>
              <DotStrip rows={stripRows} unit={unit} />
            </>
          ) : (
            <p className="hint">
              이 반의 {SHORT[stripFactor]} 종목을 아직 정하지 않았어요.{' '}
              <Link to={`/paps/setup?c=${cls ? `${cls.grade}-${cls.classNo}` : ''}`} className="font-bold text-brand">
                측정 종목 정하기 ›
              </Link>
            </p>
          )}
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">학생별 변화</p>
            <p className="hint">학생을 고르면 요인 점수를 회차마다 나란히 보여 줘요.</p>
          </div>
          <select
            className="field"
            aria-label="학생 고르기"
            value={studentId}
            onChange={(e) => setSp((p) => (e.target.value ? p.set('s', e.target.value) : p.delete('s'), p), { replace: true })}
          >
            <option value="">학생 고르기</option>
            {pc.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number}번 {s.name}
                {pc.excluded.has(s.id) ? ' (측정 제외)' : ''}
              </option>
            ))}
          </select>
          {student &&
            (sShown.length === 0 ? (
              <p className="hint">이 학생은 아직 기록이 없어요.</p>
            ) : (
              <>
                <Legend items={sShown.map((x, i) => ({ label: `${x.r.round}회차`, color: colors[i] }))} />
                <ProfileBars
                  factors={FACTORS.map((f) => SHORT[f])}
                  series={sShown.map((x, i) => ({ label: `${x.r.round}회차`, color: colors[i], values: FACTORS.map((f) => x.p!.factors.find((y) => y.factor === f)?.points ?? null) }))}
                />
                <p className="text-[0.9rem] text-ink-2">
                  종합:{' '}
                  {sShown.map((x, i) => (
                    <span key={i}>
                      {i > 0 && ' → '}
                      <b className="text-ink">{x.p!.complete ? `${x.p!.total}점 ${x.p!.grade}등급` : `미완료 ${x.p!.sum}점`}</b>
                    </span>
                  ))}
                </p>
                <Link to={`/students/${student.id}`} className="text-sm font-bold text-brand">
                  이 학생 기록 전체 보기 ›
                </Link>
              </>
            ))}
        </section>

        {support.length > 0 && (
          <Collapse title={`지도가 필요한 학생 ${support.length}명`} sub="종합 또는 요인 4·5등급 (이 회차)" className="card">
            <ul className="divide-y divide-line">
              {support.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="flex min-h-[48px] w-full items-center gap-2 text-left"
                    onClick={() => setSp((p) => (p.set('s', x.id), p), { replace: true })}
                  >
                    <b className="shrink-0">{nameOf.get(x.id)}</b>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{x.reasons.join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Collapse>
        )}

        {now.bmi.length > 0 && (
          <Collapse title="비만도(BMI) 판정별 학생 수" sub="건강 정보라 접어 두었어요" className="card">
            <ul className="space-y-1 text-[0.95rem]">
              {now.bmi.map((b) => (
                <li key={b.label} className="flex justify-between rounded-xl bg-fill px-3 py-2">
                  <span className="font-bold">{b.label}</span>
                  <span className="tabular-nums">{b.count}명</span>
                </li>
              ))}
            </ul>
          </Collapse>
        )}
      </div>
    </>
  )
}
