import { ATTEND_LABEL, attendTally, tallyText } from '../lib/attendance'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Masked from '../components/Masked'
import PageHeader from '../components/PageHeader'
import { TYPE_LABEL } from '../components/RecordSheet'
import { db } from '../db/db'
import type { StudentStatus } from '../db/types'
import { monthLabel, shortDateLabel } from '../lib/dates'
import { countByCategory, countByMonth, keywordSummary } from '../lib/recordStats'
import { genderLabel } from '../lib/text'
import { eventName, fixed } from '../lib/paps'
import { areaTotal, appliesTo, fmtNum, itemPoints, itemsOf } from '../lib/assessScore'
import type { Student } from '../db/types'
import { useApp } from '../state/AppContext'
import { usePapsClass } from '../state/usePapsClass'
import { GradeBadge } from './paps/common'
import { TOTAL_ZONES, TrendLine } from './paps/charts'
import { loadYearPaps } from '../db/reportRepo'
import { overrideKey } from '../lib/yearLink'
import { FACTORS } from '../lib/paps'

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Bars({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-sm">{i.label}</span>
          <span className="h-5 rounded bg-brand" style={{ width: `${(i.count / max) * 60}%`, minWidth: '0.5rem' }} aria-hidden />
          <span className="font-bold tabular-nums">{i.count}</span>
        </li>
      ))}
    </ul>
  )
}

/** 학생별 누적 기록 (CLAUDE.md 4-9) */
export default function StudentDetailPage() {
  const { id = '' } = useParams()
  const data = useLiveQuery(async () => {
    const student = await db.students.get(id)
    if (!student) return { student: null }
    const [records, absences, captains, keywords, attendance] = await Promise.all([
      db.records.where('studentId').equals(id).toArray(),
      db.absences.where('studentId').equals(id).toArray(),
      db.captains.where('studentId').equals(id).toArray(),
      db.keywords.toArray(),
      db.attendance.where('studentId').equals(id).toArray(),
    ])
    return { student, records, absences, captains, keywords, attendance }
  }, [id])
  const [openKw, setOpenKw] = useState<string | null>(null)

  if (!data) return <PageHeader title="불러오는 중…" back />
  if (!data.student) {
    return (
      <>
        <PageHeader title="학생을 찾을 수 없어요" back />
      </>
    )
  }
  const { student: s, records, absences, captains, keywords, attendance } = data
  const unprepared = records.filter((r) => r.type === 'unprepared')
  const exemplary = records.filter((r) => r.type === 'exemplary')
  const observations = records.filter((r) => r.type === 'observation').sort((a, b) => b.date.localeCompare(a.date))
  const captainActs = records.filter((r) => r.type === 'captain')
  const kw = keywordSummary(records, keywords)
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 30)

  return (
    <>
      <PageHeader
        title={`${s.number}번 ${s.name}`}
        back
        right={
          <Link to={`/students/${s.id}/report`} className="btn btn-soft">
            <Icon name="file" /> 리포트
          </Link>
        }
      />
      <div className="page space-y-4 py-4">
        <Card title="기본 정보">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-3">학년·반·번호</dt>
            <dd className="font-bold">
              {s.grade}학년 {s.classNo}반 {s.number}번
            </dd>
            <dt className="text-ink-3">학번</dt>
            <dd className="font-bold tabular-nums">{s.studentCode}</dd>
            <dt className="text-ink-3">성별</dt>
            <dd className="font-bold">{genderLabel(s.gender)}</dd>
            <dt className="text-ink-3">학년도</dt>
            <dd className="font-bold">{s.schoolYear}</dd>
          </dl>
          <label className="label mt-2" htmlFor="status">
            상태
          </label>
          <select
            id="status"
            className="field"
            value={s.status}
            onChange={(e) => db.students.update(s.id, { status: e.target.value as StudentStatus })}
          >
            <option value="재학">재학</option>
            <option value="휴학">휴학</option>
            <option value="전출">전출 (기록은 그대로 남아요)</option>
          </select>
        </Card>

        <Card title="체육부장 이력">
          {captains.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <ul className="space-y-1">
              {[...captains]
                .sort((a, b) => a.from.localeCompare(b.from))
                .map((c) => (
                  <li key={c.id}>
                    <b>{c.role}</b> · {shortDateLabel(c.from)} ~ {c.to ? shortDateLabel(c.to) : '지금'}
                  </li>
                ))}
            </ul>
          )}
          {captainActs.length > 0 && (
            <div className="pt-1">
              <p className="hint mb-1">활동 {captainActs.length}회</p>
              <Bars items={countByCategory(captainActs).map((c) => ({ label: c.category, count: c.count }))} />
            </div>
          )}
        </Card>

        <Card title={`❗ 지도(준비물) ${unprepared.length}회`}>
          {unprepared.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <>
              <p className="hint">월별</p>
              <Bars items={countByMonth(unprepared).map((m) => ({ label: monthLabel(m.month), count: m.count }))} />
              <p className="hint pt-1">항목별</p>
              <Bars items={countByCategory(unprepared).map((c) => ({ label: c.category, count: c.count }))} />
            </>
          )}
        </Card>

        <Card title={`⭐ 칭찬 ${exemplary.length}회`}>
          {exemplary.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <Bars items={countByCategory(exemplary).map((c) => ({ label: c.category, count: c.count }))} />
          )}
        </Card>

        <Card title={`🩹 견학 ${absences.length}회`}>
          {absences.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <ul className="space-y-1">
              {[...absences]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="w-24 tabular-nums">{shortDateLabel(a.date)}</span>
                    <Masked text={a.detail ? `${a.reason} · ${a.detail}` : a.reason} />
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title={`📋 출결 ${attendance.length}회`}>
          {attendance.length === 0 ? (
            <p className="hint">결석 · 지각 · 조퇴 · 결과가 없어요</p>
          ) : (
            <>
              <p className="font-bold">{tallyText(attendTally(attendance).get(s.id))}</p>
              <ul className="space-y-1">
                {[...attendance]
                  .sort((a, b) => b.date.localeCompare(a.date) || (b.period ?? 0) - (a.period ?? 0))
                  .map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className="w-24 tabular-nums">{shortDateLabel(a.date)}</span>
                      <span className="w-14 font-bold">{a.period ? `${a.period}교시` : ''}</span>
                      <span className="font-bold text-danger">{ATTEND_LABEL[a.status]}</span>
                      {a.reason && <Masked text={a.reason} />}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="🏷️ 세특 키워드">
          <p className="hint">키워드와 근거 기록만 모아요. 문장은 만들지 않아요. (미준비 기록은 빼요)</p>
          {kw.length === 0 ? (
            <p className="hint">아직 붙인 키워드가 없어요</p>
          ) : (
            <ul className="space-y-2">
              {kw.map((k) => (
                <li key={k.keyword.id}>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-lg bg-fill px-3 text-left"
                    aria-expanded={openKw === k.keyword.id}
                    onClick={() => setOpenKw(openKw === k.keyword.id ? null : k.keyword.id)}
                  >
                    <span className="flex-1 font-bold">{k.keyword.label}</span>
                    <span className="rounded-full bg-brand px-2 text-sm font-bold text-white">{k.count}</span>
                  </button>
                  {openKw === k.keyword.id && (
                    <ul className="mt-1 space-y-1 pl-3 text-sm">
                      {k.records.map((r) => (
                        <li key={r.id}>
                          {shortDateLabel(r.date)} · {TYPE_LABEL[r.type]}({r.category}){r.note ? ` — ${r.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="📝 관찰 메모">
          {observations.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <ul className="space-y-1">
              {observations.map((r) => (
                <li key={r.id}>
                  <span className="text-ink-3">{shortDateLabel(r.date)}</span> {r.note}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <PapsCard student={s} />
        <YearPapsCard student={s} />
        <AssessCard student={s} />

        <Card title="최근 기록 (지우기 가능)">
          {recent.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id} className="flex min-h-[48px] items-center gap-2">
                  <span className="w-20 shrink-0 text-sm tabular-nums text-ink-3">{shortDateLabel(r.date)}</span>
                  <span className="flex-1">
                    {TYPE_LABEL[r.type]} · {r.category}
                    {r.note ? <span className="text-ink-3"> — {r.note}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 text-ink-3"
                    onClick={() => confirm('이 기록을 지울까요?') && db.records.delete(r.id)}
                  >
                    지우기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function PapsCard({ student }: { student: Student }) {
  const { standards } = useApp()
  const pc = usePapsClass({ grade: student.grade, classNo: student.classNo })
  const p = pc.summaries.get(student.id)
  const ex = pc.excluded.get(student.id)
  return (
    <Card title="PAPS" right={p?.complete ? <span className="badge bg-ink text-white">종합 {p.total}점 · {p.grade}등급</span> : <span className="badge bg-caution-light text-caution">미완료 {p?.sum ?? 0}점</span>}>
      {ex !== undefined ? (
        <p className="hint">측정 제외{ex ? ` · ${ex}` : ''}</p>
      ) : !p ? (
        <p className="hint">성별 정보가 없어 등급을 계산할 수 없어요</p>
      ) : (
        <ul className="space-y-1">
          {p.factors.map((f) => (
            <li key={f.factor} className="flex items-center justify-between gap-2 rounded-xl bg-fill px-3 py-1.5 text-[0.92rem]">
              <span className="min-w-0 truncate">
                <b>{f.factor}</b> <span className="text-ink-3">{f.eventId ? eventName(standards, f.eventId, student.gender ?? undefined) : '종목 미정'}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-bold tabular-nums">{f.value === null ? '—' : fixed(f.value, 2)}</span>
                <GradeBadge band={f.band} points={f.points} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        {pc.rounds.rounds.length > 1 ? `${pc.round.round}회차 기준 · ` : ''}나이스 산출값과 다르면 나이스 값이 우선입니다.
      </p>
      <Link to={`/paps/stats?c=${student.grade}-${student.classNo}&s=${student.id}`} className="text-sm font-bold text-brand">
        PAPS 회차별 변화 그래프 ›
      </Link>
    </Card>
  )
}

/**
 * 학년별 PAPS 변화 (2026-11-09): 다른 학년도에 같은 학생(이름 · 성별 · 학년)이 있을 때만 보인다.
 * 학년도마다 가장 최근 회차. 학년도 이월로 지난 명렬이 이 기기에 남아 있어야 이어진다.
 */
function YearPapsCard({ student }: { student: Student }) {
  const { standards, settings, updateSettings, readOnly } = useApp()
  const data = useLiveQuery(
    () => loadYearPaps(db, student, { standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }, settings.yearLinks),
    [student, standards, settings.schoolLevel, settings.papsFlexMode, settings.yearLinks],
  )
  if (!data || data.links.length === 0) return null
  const setLink = (year: number, v: string | undefined) => {
    const next = { ...(settings.yearLinks ?? {}) }
    if (v === undefined) delete next[overrideKey(student.id, year)]
    else next[overrideKey(student.id, year)] = v
    void updateSettings({ yearLinks: next })
  }
  const label = (y: { schoolYear: number; grade: number }) => `${y.schoolYear} ${settings.schoolLevel}${y.grade}`
  return (
    <Card title="학년별 PAPS 변화">
      {data.years.length >= 2 && (
        <>
          <p className="hint">학년도마다 가장 최근 회차의 종합점수예요. 바탕 띠는 종합등급(80 · 60 · 40 · 20점).</p>
          <TrendLine
            points={data.years.map((y) => ({ label: label(y), value: y.paps?.complete ? y.paps.total : null, n: 1 }))}
            max={100}
            unit="점"
            zones={TOTAL_ZONES}
          />
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-ink-3">
                <tr>
                  <th className="py-1 pr-1 text-left">요인 (20점)</th>
                  {data.years.map((y) => (
                    <th key={y.schoolYear} className="px-1 py-1 text-right">
                      {label(y)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FACTORS.map((f) => (
                  <tr key={f} className="border-t border-line">
                    <td className="py-1 pr-1">{f}</td>
                    {data.years.map((y) => {
                      const x = y.paps?.factors.find((v) => v.factor === f)
                      return (
                        <td key={y.schoolYear} className="px-1 py-1 text-right">
                          {x?.points ?? '—'}
                          {x?.band && <span className="text-ink-3"> · {typeof x.band.grade === 'number' ? `${x.band.grade}등급` : x.band.grade}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-t border-line font-bold">
                  <td className="py-1 pr-1">종합</td>
                  {data.years.map((y) => (
                    <td key={y.schoolYear} className="px-1 py-1 text-right">
                      {!y.paps ? '—' : y.paps.complete ? `${y.paps.total} · ${y.paps.grade}등급` : `미완료 ${y.paps.sum}`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      <ul className="space-y-1.5">
        {data.links.map((l) => (
          <li key={l.schoolYear} className="flex flex-wrap items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
            <b className="shrink-0">{l.schoolYear}학년도</b>
            {l.student ? (
              <span className="min-w-0 flex-1 truncate">
                {l.student.grade}-{l.student.classNo}-{l.student.number} {l.student.name}
                {l.manual ? ' (직접 이음)' : ''}
              </span>
            ) : l.options.length > 1 && !l.manual ? (
              <select className="field h-10 min-h-0 min-w-0 flex-1 py-0 text-sm" aria-label={`${l.schoolYear}학년도 같은 학생 고르기`} value="" disabled={readOnly} onChange={(e) => e.target.value && setLink(l.schoolYear, e.target.value)}>
                <option value="">같은 이름 {l.options.length}명 — 이 학생이 누구인지 고르기</option>
                {l.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.grade}학년 {o.classNo}반 {o.number}번 {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 flex-1 text-ink-3">잇지 않음</span>
            )}
            {!readOnly &&
              (l.manual ? (
                <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-sm text-brand" onClick={() => setLink(l.schoolYear, undefined)}>
                  자동으로 되돌리기
                </button>
              ) : (
                l.student && (
                  <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-sm text-ink-3" onClick={() => setLink(l.schoolYear, 'none')}>
                    다른 학생이에요 · 잇지 않기
                  </button>
                )
              ))}
          </li>
        ))}
      </ul>
      <p className="hint">이름 · 성별 · 학년으로 찾고, 틀리면 위에서 끊거나 골라요(이 기기에 기억). 나이스 값이 우선입니다.</p>
    </Card>
  )
}

function AssessCard({ student }: { student: Student }) {
  const data = useLiveQuery(async () => {
    const [all, scores, groups] = await Promise.all([
      db.assessments.where('schoolYear').equals(student.schoolYear).toArray(),
      db.assessmentScores.where('studentId').equals(student.id).toArray(),
      db.groups.where('schoolYear').equals(student.schoolYear).toArray(),
    ])
    const list = all.filter((a) => appliesTo(a, student, groups))
    return { list, scores: new Map(scores.map((x) => [x.assessmentId, x])) }
  }, [student.id])
  return (
    <Card title="수행평가">
      {!data || data.list.length === 0 ? (
        <p className="hint">아직 평가가 없어요</p>
      ) : (
        <ul className="space-y-2">
          {data.list.map((a) => {
            const sc = data.scores.get(a.id)
            const items = itemsOf(a)
            const t = areaTotal(a, sc, student.gender, items)
            return (
              <li key={a.id} className="rounded-xl bg-fill px-3 py-2">
                <p className="font-bold">
                  {a.title}{' '}
                  {t.done > 0 && (
                    <span className={`badge ${t.complete ? 'bg-ink text-white' : 'bg-caution-light text-caution'}`}>
                      {fmtNum(t.total)}/{t.max}점
                    </span>
                  )}
                </p>
                <p className="text-[0.9rem] text-ink-2">
                  {items
                    .map((it) => {
                      const raw = sc?.scores[it.id]
                      const p = itemPoints(it, raw, student.gender)
                      return `${it.label} ${p === null ? '—' : it.method === 'level' ? `${raw}(${fmtNum(p)})` : fmtNum(p)}`
                    })
                    .join(' · ')}
                </p>
                {sc?.note && <p className="text-[0.88rem] text-ink-3">📝 {sc.note}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
