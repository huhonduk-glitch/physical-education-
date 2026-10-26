import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ActionBar from '../../components/ActionBar'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { createLeague } from '../../db/leaguesRepo'
import { SPORTS, sportOf } from '../../data/sports'
import type { LeagueRules, SportId } from '../../lib/league'
import { makeTeams, teamName } from '../../lib/teams'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 리그전 만들기: 종목 → (수업반) → 팀 수 · 이름(수업반이면 남녀 고르게 팀원 채우기) → 승점 · 세트 */
export default function LeagueSetupPage() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { settings, readOnly } = useApp()
  const { groups, membersOf } = useGroups()
  const [sport, setSport] = useState<SportId>((sportOf(sp.get('sport') ?? '')?.id ?? 'basketball') as SportId)
  const guide = sportOf(sport)!
  const [rules, setRules] = useState<LeagueRules>(structuredClone(guide.league))
  const [groupId, setGroupId] = useState<string>(sp.get('g') ?? '')
  const group = groups?.find((g) => g.id === groupId) ?? null
  const [names, setNames] = useState<string[]>(['1팀', '2팀', '3팀', '4팀'])
  const [members, setMembers] = useState<string[][] | null>(null)
  const [double, setDouble] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const students = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? ''

  const pickSport = (id: SportId) => {
    setSport(id)
    setRules(structuredClone(sportOf(id)!.league))
  }
  const setCount = (n: number) => {
    const k = Math.max(2, Math.min(10, n))
    setNames((prev) => Array.from({ length: k }, (_, i) => prev[i] ?? teamName(i)))
    setMembers(null)
  }
  const split = () => {
    const ts = makeTeams(
      students.map((s) => ({ id: s.id, gender: s.gender })),
      { teams: names.length, balanceGender: true },
    )
    setMembers(ts.map((t) => t.map((p) => p.id)))
  }
  const games = (names.length * (names.length - 1)) / 2 * (double ? 2 : 1)

  const save = async () => {
    setBusy(true)
    const id = await createLeague(db, {
      schoolYear: settings.schoolYear,
      sport,
      name: name.trim() || `${group ? `${group.name} ` : ''}${guide.name} 리그`,
      groupId: group?.id,
      rules,
      double,
      teams: names.map((n, i) => ({ name: n, memberIds: members?.[i] ?? [] })),
    })
    nav(`/leagues/${id}`, { replace: true })
  }

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const P = (k: keyof LeagueRules['points'], label: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" inputMode="numeric" value={rules.points[k] ?? ''} onChange={(e) => setRules({ ...rules, points: { ...rules.points, [k]: e.target.value === '' ? undefined : num(e.target.value) } })} />
    </label>
  )
  const S = (k: 'target' | 'decider' | 'setsToWin' | 'cap', label: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="field"
        inputMode="numeric"
        value={rules.setRule?.[k] ?? ''}
        onChange={(e) => setRules({ ...rules, setRule: { ...rules.setRule!, [k]: e.target.value === '' && k === 'cap' ? undefined : Math.max(1, num(e.target.value)) } })}
      />
    </label>
  )

  return (
    <>
      <PageHeader title="새 리그전" sub="모든 팀이 서로 한 번씩 겨뤄요" back />
      <div className="page space-y-4 pb-4">
        <section className="card space-y-2">
          <p className="card-title">종목</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={s.id === sport} onClick={() => pickSport(s.id)}>
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-3">
          <label className="block">
            <span className="label">수업반 (선택 — 고르면 팀원을 채울 수 있어요)</span>
            <select
              className="field"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value)
                setMembers(null)
              }}
            >
              <option value="">수업반 없이</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">리그 이름</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${group ? `${group.name} ` : ''}${guide.name} 리그`} />
          </label>
        </section>

        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">팀 {names.length}개</p>
            <button type="button" className="btn btn-soft h-12 w-12 p-0" aria-label="팀 하나 빼기" onClick={() => setCount(names.length - 1)} disabled={names.length <= 2}>
              <Icon name="minus" />
            </button>
            <button type="button" className="btn btn-soft h-12 w-12 p-0" aria-label="팀 하나 더하기" onClick={() => setCount(names.length + 1)} disabled={names.length >= 10}>
              <Icon name="plus" />
            </button>
          </div>
          <ul className="space-y-2">
            {names.map((n, i) => (
              <li key={i}>
                <input className="field" value={n} aria-label={`${i + 1}번째 팀 이름`} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                {members && <p className="mt-1 px-1 text-sm text-ink-2">{members[i]?.map(nameOf).join(', ') || '팀원 없음'}</p>}
              </li>
            ))}
          </ul>
          {group && (
            <button type="button" className="btn btn-soft w-full" onClick={split} disabled={students.length < names.length}>
              <Icon name="shuffle" /> {members ? '다시 나누기' : `${group.name} ${students.length}명을 팀으로 나누기`} (남녀 고르게)
            </button>
          )}
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={double} onChange={(e) => setDouble(e.target.checked)} />
            <span>
              <b>두 번씩 겨루기</b>
              <span className="hint block">홈 · 원정을 바꿔 한 번 더</span>
            </span>
          </label>
          <p className="hint">경기 {games}개{names.length % 2 ? ' · 팀 수가 홀수라 라운드마다 한 팀이 쉬어요' : ''}</p>
        </section>

        <Collapse title={<b className="text-ink">승점{rules.kind === 'sets' ? ' · 세트' : ''}</b>} sub={guide.pointsNote} className="card px-2 py-1">
          <div className="space-y-3 px-2 pb-3">
            <div className="grid grid-cols-3 gap-2">
              {P('win', '이김')}
              {rules.allowDraw && P('draw', '비김')}
              {P('loss', '짐')}
              {P('forfeit', '몰수패')}
            </div>
            {rules.kind === 'sets' && rules.setRule && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {P('winDecider', '마지막 세트까지 가서 이김')}
                  {P('lossDecider', '마지막 세트까지 가서 짐')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {S('setsToWin', '이겨야 할 세트 수')}
                  {S('target', '세트 점수')}
                  {S('decider', '마지막 세트 점수')}
                  {sport === 'badminton' && S('cap', '이 점수면 끝 (29-29 → 30)')}
                </div>
                <p className="hint">2점 앞서야 세트를 이겨요(배구 6.2 · 배드민턴 7.4). 수업 시간에 맞춰 세트 점수를 줄여도 돼요(예: 15점).</p>
              </>
            )}
            {!rules.allowDraw && rules.kind === 'goals' && <p className="hint">농구는 비길 수 없어 동점이면 연장 점수까지 넣어요(제8조).</p>}
          </div>
        </Collapse>
      </div>
      <ActionBar>
        <button type="button" className="btn btn-primary w-full" onClick={save} disabled={busy || readOnly || names.length < 2}>
          대진표 만들기
        </button>
      </ActionBar>
    </>
  )
}
