import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../../components/Collapse'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { loadClinicChanges, loadSchoolPaps } from '../../db/reportRepo'
import { changeSummary, EMPTY_CLINIC, PLAN_FIELDS, presentCount, toggleMember, type ClinicSession, type ClinicYear } from '../../lib/clinic'
import { shortDateLabel, todayStr } from '../../lib/dates'
import { saveXlsx } from '../../lib/download'
import { clinicTargets } from '../../lib/schoolPaps'
import { useApp } from '../../state/AppContext'

/**
 * 건강체력교실 운영 (2026-11-09): 운영계획(시행규칙 제5조) → 참여 학생(대상 후보 + 참여 희망) → 활동 기록 · 참여 체크 → 변화 분석(1회차 → 최근 회차).
 * 근거: 학교체육 진흥법 제9조 · 시행규칙 제5조 · 제주교육청 「2026학년도 학교체육 운영방향」(누리집 PDF) 21~24쪽.
 * 저장은 settings.clinic[학년도] (이 기기 · 백업에 들어감).
 */
export default function ClinicPage() {
  const { settings, standards, updateSettings, readOnly } = useApp()
  const year = settings.schoolYear
  const data: ClinicYear = settings.clinic?.[year] ?? EMPTY_CLINIC
  const save = (next: ClinicYear) => updateSettings({ clinic: { ...(settings.clinic ?? {}), [year]: next } })
  const ctx = { standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(year).toArray(), [year])
  const rows = useLiveQuery(() => loadSchoolPaps(db, year, ctx), [year, standards, settings.schoolLevel, settings.papsFlexMode])
  const memberIds = data.members.map((m) => m.studentId).join(',')
  const changes = useLiveQuery(
    () => loadClinicChanges(db, year, (students ?? []).filter((s) => memberIds.split(',').includes(s.id)), ctx),
    [year, students, memberIds, standards, settings.schoolLevel, settings.papsFlexMode],
  )
  const byId = useMemo(() => new Map((students ?? []).map((s) => [s.id, s])), [students])
  const candidates = useMemo(() => (rows ? clinicTargets(rows, settings.clinicRule) : []), [rows, settings.clinicRule])
  const counts = presentCount(data.sessions)
  const summary = changeSummary(changes ?? [])
  const [find, setFind] = useState('')
  const [draft, setDraft] = useState<{ date: string; activity: string; present: string[] } | null>(null)

  const who = (id: string) => {
    const s = byId.get(id)
    return s ? `${s.grade}-${s.classNo}-${s.number} ${s.name}` : '(명렬에 없음)'
  }
  const found = find.trim().length >= 1 ? (students ?? []).filter((s) => s.name.includes(find.trim()) && !data.members.some((m) => m.studentId === s.id)).slice(0, 6) : []

  const addSession = () => {
    if (!draft || !draft.activity.trim()) return
    const s: ClinicSession = { id: `cs${Date.now()}`, date: draft.date, activity: draft.activity.trim(), present: draft.present }
    void save({ ...data, sessions: [...data.sessions, s].sort((a, b) => a.date.localeCompare(b.date)) })
    setDraft(null)
  }

  const exportXlsx = () => {
    const ch = new Map((changes ?? []).map((c) => [c.studentId, c]))
    const fmt = (p: { complete: boolean; total: number | null; grade: number | null; sum: number } | null) => (!p ? '' : p.complete ? `${p.total}점 ${p.grade}등급` : `미완료 ${p.sum}점`)
    void saveXlsx(`건강체력교실_${year}.xlsx`, [
      {
        name: '운영계획',
        rows: [[`${year}학년도 건강체력교실 운영계획 (학교체육 진흥법 시행규칙 제5조)`], [], ...PLAN_FIELDS.map((f) => [f.label, data.plan[f.key]])],
        widths: [24, 80],
      },
      {
        name: '참여 학생 · 변화',
        rows: [
          ['학년', '반', '번호', '이름', '대상 까닭', '참여 횟수', '처음(1회차)', '최근 회차', '최근', '변화(점)'],
          ...data.members.map((m) => {
            const s = byId.get(m.studentId)
            const c = ch.get(m.studentId)
            const d = c?.first?.complete && c.latest?.complete && c.latestRound > 1 ? c.latest.total! - c.first.total! : ''
            return [s?.grade ?? '', s?.classNo ?? '', s?.number ?? '', s?.name ?? '', m.why, counts.get(m.studentId) ?? 0, fmt(c?.first ?? null), c ? `${c.latestRound}회차` : '', c && c.latestRound > 1 ? fmt(c.latest) : '', d]
          }),
        ],
        widths: [5, 5, 5, 10, 14, 9, 14, 9, 14, 9],
      },
      {
        name: '활동 기록',
        rows: [['날짜', '활동', '참여 인원', '참여 학생'], ...data.sessions.map((s) => [s.date, s.activity, s.present.length, s.present.map((id) => byId.get(id)?.name ?? '').join(', ')])],
        widths: [11, 30, 9, 60],
      },
    ])
  }

  return (
    <>
      <PageHeader title="건강체력교실 운영" sub={`${year}학년도 · 참여 ${data.members.length}명 · 활동 ${data.sessions.length}회`} back />
      <div className="page space-y-4 pb-10">
        <Link to="/paps/clinic/flow" className="block px-1 text-sm font-bold text-brand">
          건강체력교실 1년 업무 흐름 ›
        </Link>
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          학교체육 진흥법 제9조: 저체력 또는 비만 판정 학생을 대상으로 운영해요. 제주교육청 운영방향(누리집 PDF 24쪽): 대상 4~5등급 · 비만 판정 · 참여 희망자, 학년 초 운영계획 수립(필수), 연중 운영, 참여 학생의 체력 변화 분석.
        </p>

        <section className="card space-y-3">
          <p className="card-title">① 운영계획 (시행규칙 제5조)</p>
          {PLAN_FIELDS.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="text-sm font-bold">{f.label}</span>
              <textarea
                className="field min-h-[3.5rem]"
                placeholder={f.hint}
                defaultValue={data.plan[f.key]}
                disabled={readOnly}
                onBlur={(e) => e.target.value !== data.plan[f.key] && void save({ ...data, plan: { ...data.plan, [f.key]: e.target.value } })}
              />
            </label>
          ))}
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">② 참여 학생 {data.members.length}명</p>
            <p className="hint">
              대상 후보는 <Link to="/paps/school" className="font-bold text-brand">학교 전체 결과</Link>의 기준(종합 {settings.clinicRule.lowGrades.join('·')}등급 · {settings.clinicRule.obeseLabels.join('·')})으로 골라요. 누르면 넣고 빼요.
            </p>
          </div>
          {candidates.length > 0 && (
            <Collapse title={`대상 후보 ${candidates.length}명`} sub="학생 이름이 나와요" defaultOpen={data.members.length === 0}>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map((t) => {
                  const on = data.members.some((m) => m.studentId === t.row.studentId)
                  return (
                    <button
                      key={t.row.studentId}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      disabled={readOnly}
                      onClick={() => void save({ ...data, members: toggleMember(data.members, { studentId: t.row.studentId, why: t.reasons.join(', ') }) })}
                    >
                      {t.row.grade}-{t.row.classNo} {t.row.name} · {t.reasons.join(', ')}
                    </button>
                  )
                })}
              </div>
            </Collapse>
          )}
          {!readOnly && (
            <div className="space-y-1.5">
              <input className="field" placeholder="참여 희망 학생 이름으로 찾기" value={find} onChange={(e) => setFind(e.target.value)} />
              {found.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn btn-soft w-full justify-start"
                  onClick={() => {
                    void save({ ...data, members: toggleMember(data.members, { studentId: s.id, why: '참여 희망' }) })
                    setFind('')
                  }}
                >
                  + {s.grade}-{s.classNo}-{s.number} {s.name} (참여 희망)
                </button>
              ))}
            </div>
          )}
          {data.members.length > 0 && (
            <ul className="divide-y divide-line">
              {data.members.map((m) => (
                <li key={m.studentId} className="flex min-h-[44px] items-center gap-2">
                  <Link to={`/students/${m.studentId}`} className="min-w-0 flex-1 truncate font-bold">
                    {who(m.studentId)}
                  </Link>
                  <span className="shrink-0 text-sm text-ink-3">{m.why}</span>
                  <span className="badge shrink-0 bg-fill text-ink-2">참여 {counts.get(m.studentId) ?? 0}</span>
                  {!readOnly && (
                    <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-ink-3" aria-label="빼기" onClick={() => void save({ ...data, members: data.members.filter((x) => x.studentId !== m.studentId) })}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">③ 활동 기록 {data.sessions.length}회</p>
            {!readOnly && !draft && data.members.length > 0 && (
              <button type="button" className="btn btn-soft shrink-0 px-3" onClick={() => setDraft({ date: todayStr(), activity: '', present: data.members.map((m) => m.studentId) })}>
                + 오늘 활동
              </button>
            )}
          </div>
          {draft && (
            <div className="space-y-2 rounded-2xl bg-fill p-3">
              <div className="flex gap-2">
                <input type="date" className="field w-40 shrink-0" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                <input className="field min-w-0 flex-1" placeholder="활동 (예: 줄넘기 순환 운동)" value={draft.activity} onChange={(e) => setDraft({ ...draft, activity: e.target.value })} />
              </div>
              <p className="text-sm font-bold">참여한 학생 (안 온 학생은 눌러서 빼요)</p>
              <div className="flex flex-wrap gap-1.5">
                {data.members.map((m) => (
                  <button
                    key={m.studentId}
                    type="button"
                    className="chip"
                    aria-pressed={draft.present.includes(m.studentId)}
                    onClick={() => setDraft({ ...draft, present: draft.present.includes(m.studentId) ? draft.present.filter((x) => x !== m.studentId) : [...draft.present, m.studentId] })}
                  >
                    {byId.get(m.studentId)?.name ?? '?'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setDraft(null)}>
                  그만두기
                </button>
                <button type="button" className="btn btn-primary flex-1" disabled={!draft.activity.trim()} onClick={addSession}>
                  저장 ({draft.present.length}명)
                </button>
              </div>
            </div>
          )}
          {data.members.length === 0 && <p className="hint">먼저 참여 학생을 넣어 주세요.</p>}
          {data.sessions.length > 0 && (
            <ul className="divide-y divide-line">
              {[...data.sessions].reverse().map((s) => (
                <li key={s.id} className="flex min-h-[44px] items-center gap-2">
                  <span className="w-20 shrink-0 text-sm font-bold text-ink-3">{shortDateLabel(s.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{s.activity}</span>
                  <span className="shrink-0 text-sm tabular-nums">{s.present.length}명</span>
                  {!readOnly && (
                    <button type="button" className="btn btn-ghost h-9 min-h-0 shrink-0 px-2 text-ink-3" aria-label="지우기" onClick={() => confirm('이 활동 기록을 지울까요?') && void save({ ...data, sessions: data.sessions.filter((x) => x.id !== s.id) })}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-3">
          <div>
            <p className="card-title">④ 변화 분석</p>
            <p className="hint">처음 측정(1회차, 정시) → 가장 최근 회차. 다시 측정은 PAPS → 기록 입력에서 [+ 새 회차]로 넣어요(운영방향 21쪽: 4~5등급 학생 수시 측정).</p>
          </div>
          {data.members.length === 0 ? (
            <p className="hint">참여 학생이 없어요.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: '비교한 학생', value: `${summary.compared}명` },
                  { label: '종합점수 오름', value: `${summary.up}명` },
                  { label: '평균 변화', value: summary.avgDelta === null ? '—' : `${summary.avgDelta > 0 ? '+' : ''}${summary.avgDelta}점` },
                  { label: '4·5등급 벗어남', value: `${summary.leftLow}명` },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl bg-fill p-3">
                    <p className="text-[0.8rem] font-bold text-ink-3">{t.label}</p>
                    <p className="text-[1.3rem] font-black tabular-nums">{t.value}</p>
                  </div>
                ))}
              </div>
              {summary.notRemeasured > 0 && <p className="hint">아직 다시 측정하지 않은 학생 {summary.notRemeasured}명</p>}
              <Collapse title="학생별 변화" sub="학생 이름이 나와요">
                <ul className="divide-y divide-line">
                  {(changes ?? []).map((c) => (
                    <li key={c.studentId} className="flex min-h-[44px] items-center gap-2 text-sm">
                      <b className="min-w-0 flex-1 truncate">{who(c.studentId)}</b>
                      <span className="shrink-0 tabular-nums">
                        {c.first?.complete ? `${c.first.total}점 ${c.first.grade}등급` : '미완료'}
                        {c.latestRound > 1 ? ` → ${c.latest?.complete ? `${c.latest.total}점 ${c.latest.grade}등급` : '미완료'} (${c.latestRound}회차)` : ' · 다시 측정 전'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Collapse>
            </>
          )}
          <button type="button" className="btn btn-primary w-full" onClick={exportXlsx}>
            엑셀 받기 (운영계획 · 참여 학생과 변화 · 활동 기록)
          </button>
        </section>
      </div>
    </>
  )
}
