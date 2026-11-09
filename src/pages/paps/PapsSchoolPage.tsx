import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../../components/Collapse'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { loadSchoolPaps } from '../../db/reportRepo'
import { saveXlsx } from '../../lib/download'
import { BMI_LABELS, clinicTargets, compareYears, rate, resultFormRows, schoolPapsStats, unmeasuredRows, yearImprovers, type ClassPapsStat } from '../../lib/schoolPaps'
import { useApp } from '../../state/AppContext'
import { GRADE_COLORS, GradeStack, Legend } from './charts'

/**
 * 학교 전체 PAPS 결과 · 건강체력교실 대상 (2026-11-09).
 * 반마다 가장 최근 회차로 등급 분포 · 저체력 · 비만 수를 세고(공식 기준표로 이미 낸 등급), 대상 후보 명단을 엑셀로.
 */
export default function PapsSchoolPage() {
  const { settings, standards, updateSettings, readOnly } = useApp()
  const rule = settings.clinicRule
  const rows = useLiveQuery(
    () => loadSchoolPaps(db, settings.schoolYear, { standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }),
    [settings.schoolYear, standards, settings.schoolLevel, settings.papsFlexMode],
  )
  const lastRows = useLiveQuery(
    () => loadSchoolPaps(db, settings.schoolYear - 1, { standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }),
    [settings.schoolYear, standards, settings.schoolLevel, settings.papsFlexMode],
  )
  const stats = useMemo(() => (rows ? schoolPapsStats(rows, rule) : null), [rows, rule])
  const years = useMemo(() => (rows && lastRows?.some((r) => r.paps?.complete) ? compareYears(rows, lastRows, rule) : []), [rows, lastRows, rule])
  const improvers = useMemo(() => (rows && lastRows ? yearImprovers(rows, lastRows, 10) : []), [rows, lastRows])
  const targets = useMemo(() => (rows ? clinicTargets(rows, rule) : []), [rows, rule])
  const lv = settings.schoolLevel
  const lowLabel = `종합 ${rule.lowGrades.join('·')}등급`
  const obeseLabel = rule.obeseLabels.join('·') || '없음'

  if (!stats) return <PageHeader title="학교 PAPS 결과" back />
  if (stats.school.students === 0) {
    return (
      <>
        <PageHeader title="학교 PAPS 결과" back />
        <div className="page">
          <p className="card text-center font-bold">먼저 학생 명렬을 올려 주세요</p>
        </div>
      </>
    )
  }

  const toggle = (key: 'lowGrades' | 'obeseLabels', v: number | string) => {
    const list = rule[key] as (number | string)[]
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
    updateSettings({ clinicRule: { ...rule, [key]: next } })
  }

  const rowOf = (c: ClassPapsStat, label: string) => [
    label,
    c.students - c.excluded,
    c.complete,
    c.excluded,
    ...c.dist,
    c.avgTotal ?? '',
    c.low,
    rate(c.low, c.complete),
    c.obese,
  ]
  const exportXlsx = () => {
    const head = ['학급', '대상 학생', '다 측정', '측정 제외', '1등급', '2등급', '3등급', '4등급', '5등급', '평균 종합점수', `저체력(${lowLabel})`, '저체력 비율', `비만(${obeseLabel})`]
    // 운영방향 서식 14 (학년마다 1~5등급 · 4~5등급 남 · 여 · 계 · 비율, 전체인원) — 머리글 두 줄 병합 그대로
    const form = resultFormRows(rows ?? [])
    const bands = ['1등급', '2등급', '3등급', '4등급', '5등급', '4~5등급']
    const formHead1 = ['연번', '학교급', '학교명', '학년', ...bands.flatMap((b) => [b, '', '', '']), '전체인원']
    const formHead2 = ['', '', '', '', ...bands.flatMap(() => ['남', '여', '계', '비율']), '']
    const formMerges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 28 } },
      ...[0, 1, 2, 3, 28].map((c) => ({ s: { r: 2, c }, e: { r: 3, c } })),
      ...bands.map((_, i) => ({ s: { r: 2, c: 4 + i * 4 }, e: { r: 2, c: 7 + i * 4 } })),
    ]
    const unmeasured = unmeasuredRows(rows ?? [])
    void saveXlsx(`학교PAPS_${settings.schoolYear}.xlsx`, [
      {
        name: '14. PAPS 측정결과',
        rows: [
          [`${settings.schoolYear}학년도 PAPS 측정결과`],
          [],
          formHead1,
          formHead2,
          ...form.map((f, i) => [i + 1, lv, settings.schoolName, `${f.grade}학년`, ...f.cells.flatMap((c) => [c.M, c.F, c.total, c.rate]), f.total]),
        ],
        widths: [5, 6, 14, 6, ...bands.flatMap(() => [5, 5, 5, 7]), 8],
        merges: formMerges,
      },
      {
        name: '12. 미측정 학생 관리부',
        rows: [
          [`${settings.schoolYear}학년도 학생건강체력평가제(PAPS) 특수교육 대상자 및 미측정 학생 관리부`],
          [],
          ['학교명', settings.schoolName],
          [],
          ['학반', '번호', '성명', '성별', '구분', '비고 (특수교육 대상자는 장애 구분, 미측정 학생은 사유)'],
          ...unmeasured.map((u) => [`${u.row.grade}-${u.row.classNo}`, u.row.number, u.row.name, u.row.gender === 'M' ? '남' : u.row.gender === 'F' ? '여' : '', '미측정 학생', u.note]),
        ],
        widths: [8, 6, 10, 6, 12, 50],
      },
      {
        name: '학급별 결과',
        rows: [
          [`${settings.schoolYear}학년도 학생건강체력평가 결과 (반마다 가장 최근 회차 · 앱 계산 확인용, 나이스 값이 우선)`],
          head,
          ...stats.classes.map((c) => rowOf(c, `${lv}${c.grade}-${c.classNo}`)),
          ...stats.grades.map((g) => rowOf(g, `${lv}${g.grade} 계`)),
          rowOf(stats.school, '학교 전체'),
        ],
        widths: [12, 9, 8, 9, 6, 6, 6, 6, 6, 12, 18, 10, 18],
      },
      {
        name: '건강체력교실 대상',
        rows: [
          [`건강체력교실 대상 후보 (학교체육 진흥법 제9조: 저체력 또는 비만 판정 학생) · 기준: ${lowLabel} / ${obeseLabel}`],
          ['학년', '반', '번호', '이름', '성별', '종합점수', '종합등급', 'BMI 판정', '대상 까닭', '참여 여부', '비고'],
          ...targets.map((t) => {
            const bmi = t.row.paps?.factors.find((f) => f.factor === '비만')?.band?.grade
            return [t.row.grade, t.row.classNo, t.row.number, t.row.name, t.row.gender === 'M' ? '남' : t.row.gender === 'F' ? '여' : '', t.row.paps?.total ?? '', t.row.paps?.grade ?? '', typeof bmi === 'string' ? bmi : '', t.reasons.join(', '), '', '']
          }),
        ],
        widths: [6, 5, 6, 10, 6, 9, 9, 10, 18, 10, 20],
      },
    ])
  }

  return (
    <>
      <PageHeader title="학교 PAPS 결과" sub={`${settings.schoolYear}학년도 · 반마다 가장 최근 회차`} back />
      <div className="page space-y-4 pb-10">
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          이 기기에 입력한 PAPS를 학교 전체로 모은 확인용 값이에요. 다른 선생님이 입력한 반은 그 기기에 있어요. 나이스 산출값과 다르면 나이스 값이 우선입니다.
        </p>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="학교 전체 요약">
          {[
            { label: '다 측정', value: `${stats.school.complete}`, sub: `/ ${stats.school.students - stats.school.excluded}명` },
            { label: '평균 종합점수', value: stats.school.avgTotal === null ? '—' : `${stats.school.avgTotal}`, sub: '점' },
            { label: `저체력 (${lowLabel})`, value: rate(stats.school.low, stats.school.complete), sub: `${stats.school.low}명` },
            { label: `비만 (${obeseLabel})`, value: `${stats.school.obese}`, sub: '명' },
          ].map((t) => (
            <div key={t.label} className="card p-3.5">
              <p className="truncate text-[0.8rem] font-bold text-ink-3">{t.label}</p>
              <p className="mt-0.5 text-[1.5rem] leading-tight font-black tabular-nums">
                {t.value}
                <span className="ml-1 text-sm font-bold text-ink-3">{t.sub}</span>
              </p>
            </div>
          ))}
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">학년별 종합등급 분포</p>
            <p className="hint">5개 요인을 다 측정한 학생만 세요.</p>
          </div>
          <Legend items={GRADE_COLORS.map((c, i) => ({ label: `${i + 1}등급`, color: c }))} />
          <GradeStack rows={stats.grades.map((g) => ({ label: `${lv}${g.grade}`, dist: g.dist }))} labelW={52} />
          <Collapse title="학급별로 보기">
            <GradeStack rows={stats.classes.map((c) => ({ label: `${c.grade}-${c.classNo}`, dist: c.dist }))} labelW={52} />
          </Collapse>
        </section>

        <section className="card space-y-2">
          <div className="flex items-start gap-2">
            <p className="card-title flex-1">학급별 표</p>
            <button type="button" className="btn btn-ghost shrink-0 px-3 text-brand" onClick={exportXlsx}>
              엑셀 받기
            </button>
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm whitespace-nowrap tabular-nums">
              <thead className="text-ink-3">
                <tr>
                  <th className="py-1.5 pr-2 text-left">학급</th>
                  <th className="px-1 text-right">다 측정</th>
                  <th className="px-1 text-right">평균</th>
                  <th className="px-1 text-right">저체력</th>
                  <th className="px-1 text-right">비만</th>
                </tr>
              </thead>
              <tbody>
                {stats.classes.map((c) => (
                  <tr key={`${c.grade}-${c.classNo}`} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      <Link to={`/paps/stats?c=${c.grade}-${c.classNo}`} className="font-bold">
                        {lv}
                        {c.grade}-{c.classNo}
                      </Link>
                    </td>
                    <td className="px-1 text-right">
                      {c.complete}/{c.students - c.excluded}
                    </td>
                    <td className="px-1 text-right">{c.avgTotal ?? '—'}</td>
                    <td className="px-1 text-right">
                      {c.low} <span className="text-ink-3">({rate(c.low, c.complete)})</span>
                    </td>
                    <td className="px-1 text-right">{c.obese}</td>
                  </tr>
                ))}
                {[...stats.grades, stats.school].map((g, i) => (
                  <tr key={`sum-${i}`} className="border-t-2 border-line font-bold">
                    <td className="py-1.5 pr-2">{g.grade ? `${lv}${g.grade} 계` : '학교 전체'}</td>
                    <td className="px-1 text-right">
                      {g.complete}/{g.students - g.excluded}
                    </td>
                    <td className="px-1 text-right">{g.avgTotal ?? '—'}</td>
                    <td className="px-1 text-right">
                      {g.low} <span className="text-ink-3">({rate(g.low, g.complete)})</span>
                    </td>
                    <td className="px-1 text-right">{g.obese}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">건강체력교실 대상 후보 {targets.length}명</p>
            <p className="hint">
              학교체육 진흥법 제9조: 학생건강체력평가에서 <b>저체력 또는 비만 판정</b>을 받은 학생을 대상으로 건강체력교실을 운영해요. 시행규칙 제5조에 따라 매년 운영계획(시기 · 담당자, 프로그램, 참여 학생 지도 · 관리)을 세워요.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl bg-fill p-3">
            <p className="text-sm font-bold">대상 기준 — 법령에는 등급이 없어요. 학교 · 교육청 지침에 맞게 고르세요</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 text-sm text-ink-3">저체력</span>
              {[3, 4, 5].map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={rule.lowGrades.includes(g)} disabled={readOnly} onClick={() => toggle('lowGrades', g)}>
                  종합 {g}등급
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 text-sm text-ink-3">비만</span>
              {BMI_LABELS.filter((l) => l !== '정상' && l !== '마름').map((l) => (
                <button key={l} type="button" className="chip" aria-pressed={rule.obeseLabels.includes(l)} disabled={readOnly} onClick={() => toggle('obeseLabels', l)}>
                  {l}
                </button>
              ))}
            </div>
            <p className="hint">
              기본값은 제주특별자치도교육청 「2026학년도 학교체육 운영방향」(누리집 PDF) 24쪽 “대상: 학생건강체력평가 결과 4~5등급, 비만 판정 학생 및 참여 희망자 등”이에요. 희망 학생은 [건강체력교실 운영]에서 더해요.
            </p>
          </div>
          {targets.length === 0 ? (
            <p className="hint">대상 후보가 없어요.</p>
          ) : (
            <Collapse title="명단 보기" sub="학생 이름이 나와요 — 수업 중 화면에 띄우지 마세요">
              <ul className="divide-y divide-line">
                {targets.map((t) => (
                  <li key={t.row.studentId}>
                    <Link to={`/students/${t.row.studentId}`} className="flex min-h-[44px] items-center gap-2">
                      <span className="w-16 shrink-0 text-sm text-ink-3 tabular-nums">
                        {t.row.grade}-{t.row.classNo}-{t.row.number}
                      </span>
                      <b className="min-w-0 flex-1 truncate">{t.row.name}</b>
                      <span className="shrink-0 text-sm text-ink-2">{t.reasons.join(' · ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Collapse>
          )}
          <Link to="/paps/clinic" className="btn btn-soft w-full">
            건강체력교실 운영 (참여 학생 · 활동 기록 · 변화 분석) ›
          </Link>
          <button type="button" className="btn btn-primary w-full" onClick={exportXlsx}>
            엑셀 받기 (서식 14 · 서식 12 · 학급별 · 대상 명단)
          </button>
        </section>

        {years.length > 0 && (
          <section className="card space-y-2">
            <div>
              <p className="card-title">작년과 비교</p>
              <p className="hint">같은 학년끼리 견줘요 ({settings.schoolYear - 1} ↔ {settings.schoolYear}). 지난 학년도 명렬 · PAPS가 이 기기에 있을 때만 나와요.</p>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm whitespace-nowrap tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    <th className="py-1.5 pr-2 text-left">학년</th>
                    <th className="px-1 text-right">평균 (작년 → 올해)</th>
                    <th className="px-1 text-right">저체력 비율 (작년 → 올해)</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.grade} className="border-t border-line">
                      <td className="py-1.5 pr-2 font-bold">
                        {lv}
                        {y.grade}
                      </td>
                      <td className="px-1 text-right">
                        {y.last?.avgTotal ?? '—'} → <b>{y.now?.avgTotal ?? '—'}</b>
                      </td>
                      <td className="px-1 text-right">
                        {y.last ? rate(y.last.low, y.last.complete) : '—'} → <b>{y.now ? rate(y.now.low, y.now.complete) : '—'}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {improvers.length > 0 && (
          <Collapse title={`전년 대비 많이 향상된 학생 ${improvers.length}명`} sub="운영방향 22쪽 PAPS 우수학생 표창 예시 · 학생 이름이 나와요" className="card">
            <ul className="divide-y divide-line">
              {improvers.map((x) => (
                <li key={x.row.studentId}>
                  <Link to={`/students/${x.row.studentId}`} className="flex min-h-[44px] items-center gap-2">
                    <span className="w-16 shrink-0 text-sm text-ink-3 tabular-nums">
                      {x.row.grade}-{x.row.classNo}-{x.row.number}
                    </span>
                    <b className="min-w-0 flex-1 truncate">{x.row.name}</b>
                    <span className="shrink-0 text-sm tabular-nums">
                      {x.before} → {x.after} <b className="text-ok">+{x.delta}</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Collapse>
        )}
      </div>
    </>
  )
}
