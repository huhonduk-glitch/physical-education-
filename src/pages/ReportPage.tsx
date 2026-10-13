import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { loadReports } from '../db/reportRepo'
import type { Student } from '../db/types'
import { longDateLabel, todayStr } from '../lib/dates'
import { groupMembers } from '../lib/groups'
import { eventName, fixed } from '../lib/paps'
import type { StudentReport } from '../lib/report'
import { useApp } from '../state/AppContext'

/**
 * 학생별 리포트 (재설계 5단계): 상담·학생 피드백용 한 장 요약을 인쇄하거나 PDF로 저장.
 * /students/:id/report = 한 명, /groups/:id/report = 수업반 전체(한 장에 한 명).
 * 견학 사유(건강 정보)는 넣지 않는다. 세특 문장도 만들지 않는다.
 */
export default function ReportPage({ scope }: { scope: 'student' | 'group' }) {
  const { id = '' } = useParams()
  const { settings, standards } = useApp()
  const [guidance, setGuidance] = useState(true)
  const [absence, setAbsence] = useState(false)
  const [memo, setMemo] = useState(true)
  const data = useLiveQuery(async () => {
    let students: Student[] = []
    let title = ''
    if (scope === 'student') {
      const s = await db.students.get(id)
      if (s) students = [s]
      title = s ? `${s.name} 리포트` : ''
    } else {
      const g = await db.groups.get(id)
      if (g) {
        const all = await db.students.where('schoolYear').equals(g.schoolYear).toArray()
        students = groupMembers(g, all).filter((s) => s.status === '재학')
        title = `${g.name} 리포트`
      }
    }
    const reports = await loadReports(db, students, { schoolYear: settings.schoolYear, standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode })
    return { title, reports }
  }, [scope, id, settings.schoolYear, standards, settings.schoolLevel, settings.papsFlexMode])

  return (
    <>
      <PageHeader
        title={data?.title || '리포트'}
        sub={data ? `${data.reports.length}명 · 한 장에 한 명` : undefined}
        back
        right={
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!data?.reports.length}>
            <Icon name="file" /> 인쇄 · PDF
          </button>
        }
      />
      <div className="page space-y-4 pb-10 print:max-w-none print:p-0">
        <section className="card space-y-1 print:hidden">
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={guidance} onChange={(e) => setGuidance(e.target.checked)} />
            <span>
              <b>지도 기록(준비물 미준비 등) 넣기</b>
              <span className="hint block">학생·학부모에게 줄 때는 끌 수 있어요.</span>
            </span>
          </label>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={absence} onChange={(e) => setAbsence(e.target.checked)} />
            <span>
              <b>견학 횟수 넣기</b>
              <span className="hint block">사유(건강 정보)는 넣지 않고 횟수만 넣어요.</span>
            </span>
          </label>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={memo} onChange={(e) => setMemo(e.target.checked)} />
            <b>교사 의견 빈칸 넣기</b>
          </label>
          <p className="hint">[인쇄 · PDF]를 누르고 프린터 대신 'PDF로 저장'을 고르면 파일로 받을 수 있어요. 파일은 이 기기에만 저장돼요.</p>
        </section>
        {data?.reports.length === 0 && <p className="card hint">학생이 없어요.</p>}
        {data?.reports.map((r) => (
          <ReportSheet key={r.student.id} r={r} school={settings.schoolName} year={settings.schoolYear} opts={{ guidance, absence, memo }} standards={standards} />
        ))}
      </div>
    </>
  )
}

function ReportSheet({
  r,
  school,
  year,
  opts,
  standards,
}: {
  r: StudentReport
  school: string
  year: number
  opts: { guidance: boolean; absence: boolean; memo: boolean }
  standards: ReturnType<typeof useApp>['standards']
}) {
  const s = r.student
  const stats = [
    { l: '칭찬', n: r.exemplary, show: true },
    { l: '지도', n: r.unprepared, show: opts.guidance },
    { l: '견학', n: r.absent, show: opts.absence },
  ].filter((x) => x.show)
  return (
    <article className="print-page card space-y-4 print:rounded-none print:p-0 print:shadow-none" aria-label={`${s.name} 리포트`}>
      <header className="flex items-end justify-between gap-2 border-b-2 border-ink pb-2">
        <div>
          <p className="text-sm font-bold text-ink-3">
            {school || '체육'} · {year}학년도 체육 활동 리포트
          </p>
          <h2 className="text-2xl font-black">
            {s.grade}학년 {s.classNo}반 {s.number}번 {s.name}
          </h2>
        </div>
        <p className="text-sm text-ink-3">{longDateLabel(todayStr())}</p>
      </header>

      <section className="space-y-2">
        <h3 className="font-extrabold">수업 참여</h3>
        <div className={`grid gap-2 text-center ${stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {stats.map((x) => (
            <div key={x.l} className="rounded-xl border border-line py-2">
              <p className="text-2xl font-extrabold tabular-nums">{x.n}</p>
              <p className="text-sm font-bold text-ink-3">{x.l}</p>
            </div>
          ))}
        </div>
        {r.exemplaryTop.length > 0 && <p className="text-[0.95rem]">칭찬: {r.exemplaryTop.map((c) => `${c.category} ${c.count}`).join(' · ')}</p>}
        {opts.guidance && r.unpreparedTop.length > 0 && <p className="text-[0.95rem]">지도: {r.unpreparedTop.map((c) => `${c.category} ${c.count}`).join(' · ')}</p>}
        {r.captain.length > 0 && <p className="text-[0.95rem]">체육부장 활동: {[...new Set(r.captain)].join(', ')}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="font-extrabold">건강체력평가 (PAPS)</h3>
        {r.papsExcluded ? (
          <p className="hint">측정 제외</p>
        ) : !r.paps || r.paps.factors.every((f) => f.value === null) ? (
          <p className="hint">아직 측정 기록이 없어요</p>
        ) : (
          <>
            <table className="w-full border-collapse text-[0.92rem]">
              <tbody>
                {r.paps.factors.map((f) => (
                  <tr key={f.factor} className="border-b border-line">
                    <th className="py-1 text-left font-bold">{f.factor}</th>
                    <td className="py-1 text-ink-2">{f.eventId ? eventName(standards, f.eventId, s.gender ?? undefined) : '-'}</td>
                    <td className="py-1 text-right tabular-nums">{f.value === null ? '—' : fixed(f.value, 2)}</td>
                    <td className="py-1 text-right font-bold">{f.band ? (typeof f.band.grade === 'number' ? `${f.band.grade}등급` : f.band.grade) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[0.95rem] font-bold">{r.paps.complete ? `종합 ${r.paps.total}점 · ${r.paps.grade}등급` : `측정 중 (지금까지 ${r.paps.sum}점)`}</p>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-extrabold">수행평가</h3>
        {r.assessments.length === 0 ? (
          <p className="hint">평가가 없어요</p>
        ) : (
          <ul className="space-y-1">
            {r.assessments.map((a) => (
              <li key={a.title} className="flex flex-wrap items-baseline gap-x-2 border-b border-line py-1">
                <b className="flex-1">{a.title}</b>
                <span className="font-bold tabular-nums">{a.score}</span>
                <span className="w-full text-sm text-ink-3">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.keywords.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-extrabold">관찰 키워드</h3>
          <p className="text-[0.95rem]">{r.keywords.map((k) => `${k.label}(${k.count})`).join(' · ')}</p>
        </section>
      )}

      {opts.memo && (
        <section className="space-y-1">
          <h3 className="font-extrabold">교사 의견</h3>
          <div className="h-28 rounded-xl border border-line" />
        </section>
      )}
      <p className="text-xs text-ink-3">PAPS 등급은 앱 계산값이며 나이스 산출값과 다르면 나이스 값이 우선입니다.</p>
    </article>
  )
}
