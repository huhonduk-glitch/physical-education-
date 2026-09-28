import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import Masked from '../components/Masked'
import PageHeader from '../components/PageHeader'
import { TYPE_LABEL } from '../components/RecordSheet'
import { db } from '../db/db'
import type { StudentStatus } from '../db/types'
import { monthLabel, shortDateLabel } from '../lib/dates'
import { countByCategory, countByMonth, keywordSummary } from '../lib/recordStats'
import { genderLabel } from '../lib/text'

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
    const [records, absences, captains, keywords] = await Promise.all([
      db.records.where('studentId').equals(id).toArray(),
      db.absences.where('studentId').equals(id).toArray(),
      db.captains.where('studentId').equals(id).toArray(),
      db.keywords.toArray(),
    ])
    return { student, records, absences, captains, keywords }
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
  const { student: s, records, absences, captains, keywords } = data
  const unprepared = records.filter((r) => r.type === 'unprepared')
  const exemplary = records.filter((r) => r.type === 'exemplary')
  const observations = records.filter((r) => r.type === 'observation').sort((a, b) => b.date.localeCompare(a.date))
  const captainActs = records.filter((r) => r.type === 'captain')
  const kw = keywordSummary(records, keywords)
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 30)

  return (
    <>
      <PageHeader title={`${s.number}번 ${s.name}`} back />
      <div className="page space-y-4 py-4">
        <Card title="기본 정보">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-zinc-600">학년·반·번호</dt>
            <dd className="font-bold">
              {s.grade}학년 {s.classNo}반 {s.number}번
            </dd>
            <dt className="text-zinc-600">학번</dt>
            <dd className="font-bold tabular-nums">{s.studentCode}</dd>
            <dt className="text-zinc-600">성별</dt>
            <dd className="font-bold">{genderLabel(s.gender)}</dd>
            <dt className="text-zinc-600">학년도</dt>
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

        <Card title={`❗ 준비물 미준비 ${unprepared.length}회`}>
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

        <Card title={`⭐ 솔선수범 ${exemplary.length}회`}>
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
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-lg bg-zinc-50 px-3 text-left"
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
                  <span className="text-zinc-600">{shortDateLabel(r.date)}</span> {r.note}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="PAPS · 수행평가">
          <p className="hint">PAPS 결과는 4단계, 수행평가 점수는 5단계에서 이곳에 나와요.</p>
        </Card>

        <Card title="최근 기록 (지우기 가능)">
          {recent.length === 0 ? (
            <p className="hint">없어요</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recent.map((r) => (
                <li key={r.id} className="flex min-h-[48px] items-center gap-2">
                  <span className="w-20 shrink-0 text-sm tabular-nums text-zinc-600">{shortDateLabel(r.date)}</span>
                  <span className="flex-1">
                    {TYPE_LABEL[r.type]} · {r.category}
                    {r.note ? <span className="text-zinc-600"> — {r.note}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 text-zinc-600"
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
