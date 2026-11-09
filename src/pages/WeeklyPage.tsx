import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../components/Collapse'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { Student } from '../db/types'
import { shortDateLabel } from '../lib/dates'
import { areaTotal } from '../lib/assessScore'
import { memberNo } from '../lib/groups'
import { groupProgress, meetings, schedule } from '../lib/progressPlan'
import { deltaLabel, GUIDE_REPEAT_DAYS, GUIDE_REPEAT_MIN, NO_PRAISE_DAYS, sumCounts, type Counts } from '../lib/weekly'
import { useApp } from '../state/AppContext'
import { useWeekly } from '../state/useWeekly'

const ROWS: { key: keyof Counts; label: string; tone: string }[] = [
  { key: 'praise', label: '칭찬', tone: 'text-ok' },
  { key: 'guide', label: '지도', tone: 'text-danger' },
  { key: 'absence', label: '견학', tone: 'text-ink-2' },
  { key: 'absent', label: '결석', tone: 'text-ink-2' },
]

/**
 * 이번 주 수업 요약 (2026-11-09). 수업반마다 칭찬 · 지도 · 견학 · 결석 지난주 대비, 챙길 학생,
 * 늦은 진도, 덜 끝난 채점. 모두 기기 안에서 센 것이다(AI · 인터넷 없음).
 */
export default function WeeklyPage() {
  const { settings } = useApp()
  const { summary, groups, students, membersOf, today } = useWeekly()
  const nameOf = useMemo(() => new Map((students ?? []).map((s) => [s.id, s])), [students])

  // 진도: 내 수업반이 들어간 진도표마다 늦은 반
  const plans = useLiveQuery(() => db.progressPlans.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const behind = useMemo(() => {
    const out: { planId: string; title: string; group: string; late: number }[] = []
    for (const p of plans ?? [])
      for (const g of groups ?? []) {
        if (!p.groupIds.includes(g.id)) continue
        const pr = groupProgress(schedule(p.items, meetings(g.id, settings.timetable, p, p.skips[g.id])), p.done[g.id] ?? [], today)
        if (pr.diff < 0) out.push({ planId: p.id, title: p.title, group: g.name, late: -pr.diff })
      }
    return out.sort((a, b) => b.late - a.late)
  }, [plans, groups, settings.timetable, today])

  // 채점: 수업반이 정해진 이 학년도 평가마다 아직 다 채점 안 된 학생 수
  const assess = useLiveQuery(async () => {
    const list = (await db.assessments.where('schoolYear').equals(settings.schoolYear).toArray()).filter((a) => (a.groupIds?.length ?? 0) > 0)
    const scores = await db.assessmentScores.where('assessmentId').anyOf(list.map((a) => a.id)).toArray()
    return { list, scores }
  }, [settings.schoolYear])
  const grading = useMemo(() => {
    if (!assess || !groups) return []
    return assess.list
      .map((a) => {
        const members = new Map<string, Student>()
        for (const g of groups) if (a.groupIds!.includes(g.id)) for (const s of membersOf(g)) members.set(s.id, s)
        const byStudent = new Map(assess.scores.filter((s) => s.assessmentId === a.id).map((s) => [s.studentId, s]))
        const done = [...members.values()].filter((s) => areaTotal(a, byStudent.get(s.id), s.gender).complete).length
        return { id: a.id, title: a.title, done, total: members.size }
      })
      .filter((x) => x.total > 0 && x.done > 0 && x.done < x.total)
  }, [assess, groups, membersOf])

  if (!summary) return <PageHeader title="이번 주 수업 요약" back />
  const { range } = summary
  const any = (c: Counts) => c.praise + c.guide + c.absence + c.absent > 0
  const active = summary.groups.filter((g) => any(g.thisWeek) || any(g.lastWeek))
  const total = sumCounts(summary.groups.map((g) => g.thisWeek))
  const totalLast = sumCounts(summary.groups.map((g) => g.lastWeek))
  const guideStudents = summary.groups.flatMap((g) => g.guideRepeat.map((x) => ({ ...x, group: g })))
  const noPraise = summary.groups.filter((g) => g.noPraise.length > 0)
  const label = (id: string, gid: string) => {
    const s = nameOf.get(id)
    const g = groups?.find((x) => x.id === gid)
    return s ? `${g ? memberNo(g, s) : s.number}번 ${s.name}` : '(명렬에 없음)'
  }

  return (
    <>
      <PageHeader title="이번 주 수업 요약" sub={`${shortDateLabel(range.thisWeek.from)} ~ ${shortDateLabel(range.thisWeek.to)} · 지난주 같은 때(${shortDateLabel(range.lastWeek.from)} ~ ${shortDateLabel(range.lastWeek.to)})와 비교`} back />
      <div className="page space-y-4 pb-10">
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          이 기기에 남긴 기록을 센 것이에요. 점수 · 등급이 아니라 횟수만 보여요. 학생 이름이 나오니 수업 중 화면에 띄우지 마세요.
        </p>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="이번 주 합계">
          {ROWS.map((r) => (
            <div key={r.key} className="card p-3.5">
              <p className="text-[0.8rem] font-bold text-ink-3">이번 주 {r.label}</p>
              <p className="mt-0.5 text-[1.5rem] leading-tight font-black tabular-nums">
                {total[r.key]}
                <span className="ml-1.5 text-sm font-bold text-ink-3">지난주 {totalLast[r.key]} · {deltaLabel(total[r.key], totalLast[r.key])}</span>
              </p>
            </div>
          ))}
        </section>

        <section className="card space-y-2">
          <p className="card-title">수업반별</p>
          {active.length === 0 ? (
            <p className="hint">이번 주와 지난주에 남긴 기록이 없어요. 수업반에서 칭찬 · 지도 · 출결을 기록하면 여기 모여요.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-ink-3">
                  <tr>
                    <th className="py-1.5 pr-1 text-left">수업반</th>
                    {ROWS.map((r) => (
                      <th key={r.key} className="w-11 px-0.5 py-1.5 text-right">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((g) => (
                    <tr key={g.groupId} className="border-t border-line">
                      <td className="py-1.5 pr-1">
                        <Link to={`/groups/${g.groupId}`} className="font-bold">
                          {g.name}
                        </Link>
                        <span className="block text-[0.75rem] text-ink-3">이번 주 {g.daysThisWeek}일 기록</span>
                      </td>
                      {ROWS.map((r) => (
                        <td key={r.key} className="px-0.5 py-1.5 text-right">
                          <b className={g.thisWeek[r.key] ? r.tone : 'text-ink-3'}>{g.thisWeek[r.key]}</b>
                          <span className="block text-[0.75rem] text-ink-3">{deltaLabel(g.thisWeek[r.key], g.lastWeek[r.key])}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card space-y-2">
          <p className="card-title">이번 주 챙길 것</p>
          {guideStudents.length === 0 && noPraise.length === 0 && behind.length === 0 && grading.length === 0 && <p className="hint">챙길 것이 없어요. 👍</p>}

          {guideStudents.length > 0 && (
            <Collapse title={`지도가 쌓이는 학생 ${guideStudents.length}명`} sub={`최근 ${GUIDE_REPEAT_DAYS}일 지도 ${GUIDE_REPEAT_MIN}번 이상 — 한 번 따로 이야기해 보세요`} defaultOpen>
              <ul className="divide-y divide-line">
                {guideStudents.map((x) => (
                  <li key={`${x.group.groupId}-${x.studentId}`} className="flex min-h-[44px] items-center gap-2">
                    <Link to={`/students/${x.studentId}`} className="min-w-0 flex-1 truncate font-bold">
                      {label(x.studentId, x.group.groupId)}
                    </Link>
                    <span className="shrink-0 text-sm text-ink-3">{x.group.name}</span>
                    <span className="badge shrink-0 bg-danger-light text-danger">지도 {x.count}번</span>
                  </li>
                ))}
              </ul>
            </Collapse>
          )}

          {noPraise.length > 0 && (
            <Collapse title={`칭찬을 아직 못 받은 학생 ${noPraise.reduce((n, g) => n + g.noPraise.length, 0)}명`} sub={`최근 ${NO_PRAISE_DAYS}일 — 조용한 학생도 한 번씩 봐 주세요`}>
              <div className="space-y-2">
                {noPraise.map((g) => (
                  <div key={g.groupId}>
                    <p className="text-sm font-bold text-ink-2">{g.name}</p>
                    <p className="text-[0.9rem] text-ink-2">{g.noPraise.map((id) => label(id, g.groupId)).join(' · ')}</p>
                  </div>
                ))}
              </div>
            </Collapse>
          )}

          {behind.length > 0 && (
            <Collapse title={`진도가 늦은 반 ${behind.length}곳`} sub="교과 진도표 계획보다 늦음" defaultOpen>
              <ul className="divide-y divide-line">
                {behind.map((b) => (
                  <li key={`${b.planId}-${b.group}`}>
                    <Link to={`/plans/${b.planId}`} className="flex min-h-[44px] items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        <b>{b.group}</b> <span className="text-sm text-ink-3">{b.title}</span>
                      </span>
                      <span className="badge shrink-0 bg-caution-light text-caution">{b.late}차시 늦음</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Collapse>
          )}

          {grading.length > 0 && (
            <Collapse title={`채점이 덜 끝난 평가 ${grading.length}개`} sub="채점을 시작했지만 아직 남은 학생이 있어요" defaultOpen>
              <ul className="divide-y divide-line">
                {grading.map((a) => (
                  <li key={a.id}>
                    <Link to={`/more/assessments/${a.id}`} className="flex min-h-[44px] items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold">{a.title}</span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-3">
                        {a.done}/{a.total}명 · {a.total - a.done}명 남음
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Collapse>
          )}
        </section>
      </div>
    </>
  )
}
