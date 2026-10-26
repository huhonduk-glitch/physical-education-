import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { deleteLeague, saveMatch, updateLeague } from '../../db/leaguesRepo'
import type { League } from '../../db/types'
import { sportOf } from '../../data/sports'
import { copyText } from '../../lib/download'
import { todayStr } from '../../lib/dates'
import { GROUP_COLORS } from '../../lib/groups'
import { boardOver, boardTap, boardToMatch, matchResult, standings, type Board, type LeagueMatch, type LeagueTeam } from '../../lib/league'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

const colorOf = (t?: LeagueTeam) => GROUP_COLORS[t?.color ?? 'blue'] ?? GROUP_COLORS.blue

/** 리그전 한 개: 순위표 · 라운드별 경기(결과 넣기 · 점수판) · 팀 */
export default function LeaguePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { readOnly } = useApp()
  const league = useLiveQuery(() => db.leagues.get(id), [id])
  const [tab, setTab] = useState<'table' | 'games' | 'teams'>('table')
  const [edit, setEdit] = useState<LeagueMatch | null>(null)
  const [board, setBoard] = useState<LeagueMatch | null>(null)
  const [msg, setMsg] = useState('')

  if (league === undefined) return null
  if (!league) return <Navigate to="/sports" replace />
  const guide = sportOf(league.sport)
  const team = (tid: string) => league.teams.find((t) => t.id === tid)
  const rows = standings(
    league.teams.map((t) => t.id),
    league.matches,
    league.rules,
  )
  const done = league.matches.filter((m) => m.done).length
  const sets = league.rules.kind === 'sets'

  const copyTable = async () => {
    const head = `${league.name} 순위 (경기 ${done}/${league.matches.length})`
    const lines = rows.map((r) => `${r.rank}위 ${team(r.teamId)?.name} — ${r.win}승${league.rules.allowDraw ? ` ${r.draw}무` : ''} ${r.loss}패 · ${sets ? '세트' : '득실'} ${r.diff >= 0 ? '+' : ''}${r.diff} · 승점 ${r.points}`)
    setMsg((await copyText([head, ...lines].join('\n'))) ? '순위를 복사했어요. 학급 게시판에 붙여 넣으세요.' : '복사하지 못했어요.')
  }

  return (
    <>
      <PageHeader title={league.name} sub={`${guide?.emoji ?? ''} ${guide?.name ?? ''} · ${league.teams.length}팀 · 경기 ${done}/${league.matches.length}`} back />
      <div className="page space-y-3 pb-10">
        <div className="segment" role="tablist">
          {(
            [
              ['table', '순위'],
              ['games', '경기'],
              ['teams', '팀 · 설정'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'table' && (
          <>
            <div className="card overflow-x-auto p-2">
              <table className="w-full text-center text-sm tabular-nums">
                <thead>
                  <tr className="text-xs font-bold text-ink-3">
                    <th className="py-2">순위</th>
                    <th className="text-left">팀</th>
                    <th>경기</th>
                    <th>승</th>
                    {league.rules.allowDraw && <th>무</th>}
                    <th>패</th>
                    <th>{sets ? '세트' : '득실'}</th>
                    <th>승점</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const t = team(r.teamId)
                    return (
                      <tr key={r.teamId} className="border-t border-line">
                        <td className="py-3 text-lg font-extrabold">{r.rank}</td>
                        <td className="text-left font-bold">
                          <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf(t).fg }} aria-hidden />
                          {t?.name}
                        </td>
                        <td>{r.played}</td>
                        <td>{r.win}</td>
                        {league.rules.allowDraw && <td>{r.draw}</td>}
                        <td>{r.loss}</td>
                        <td>
                          {r.for}:{r.against}
                          <span className="block text-xs text-ink-3">
                            {r.diff > 0 ? '+' : ''}
                            {r.diff}
                          </span>
                        </td>
                        <td className="text-lg font-extrabold text-brand">{r.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint px-1">
              승점: 이김 {league.rules.points.win}
              {league.rules.allowDraw ? ` · 비김 ${league.rules.points.draw}` : ''} · 짐 {league.rules.points.loss}
              {league.rules.points.winDecider !== undefined ? ` · 마지막 세트 이김 ${league.rules.points.winDecider} / 짐 ${league.rules.points.lossDecider}` : ''}. 같으면 그 팀끼리 경기 결과 → 득실 → 득점 → 전체 득실 → 전체 득점(FIBA 부록 D 순서).
            </p>
            <button type="button" className="btn btn-soft w-full" onClick={copyTable}>
              <Icon name="copy" /> 순위 복사
            </button>
            {msg && (
              <p className="font-bold text-ok" role="status">
                {msg}
              </p>
            )}
          </>
        )}

        {tab === 'games' && <Games league={league} team={team} onEdit={setEdit} onBoard={setBoard} readOnly={readOnly} />}

        {tab === 'teams' && (
          <TeamsTab
            league={league}
            readOnly={readOnly}
            onDelete={async () => {
              await deleteLeague(db, league.id)
              nav('/sports', { replace: true })
            }}
          />
        )}
      </div>

      {edit && <ResultSheet league={league} match={edit} team={team} onClose={() => setEdit(null)} />}
      {board && <Scoreboard league={league} match={board} team={team} onClose={() => setBoard(null)} />}
    </>
  )
}

function resultText(m: LeagueMatch, league: League): string {
  if (!m.done) return ''
  if (m.forfeit) return '몰수'
  if (league.rules.kind === 'sets') {
    const r = matchResult(m, league.rules)
    return r ? `${r.homeFor} : ${r.awayFor}` : '확인 필요'
  }
  return `${m.homeScore ?? 0} : ${m.awayScore ?? 0}`
}

function Games({ league, team, onEdit, onBoard, readOnly }: { league: League; team: (id: string) => LeagueTeam | undefined; onEdit: (m: LeagueMatch) => void; onBoard: (m: LeagueMatch) => void; readOnly: boolean }) {
  const rounds = [...new Set(league.matches.map((m) => m.round))].sort((a, b) => a - b)
  const resting = (r: number) => league.teams.filter((t) => !league.matches.some((m) => m.round === r && (m.home === t.id || m.away === t.id)))
  const next = rounds.find((r) => league.matches.some((m) => m.round === r && !m.done))
  return (
    <div className="space-y-3">
      {rounds.map((r) => (
        <Collapse
          key={r}
          title={<b className="text-ink">{r}라운드</b>}
          sub={`${league.matches.filter((m) => m.round === r && m.done).length}/${league.matches.filter((m) => m.round === r).length} 끝${resting(r).length ? ` · 쉼: ${resting(r).map((t) => t.name).join(', ')}` : ''}`}
          defaultOpen={r === next}
          className="card px-2 py-1"
        >
          <ul className="space-y-2 px-1 pb-2">
            {league.matches
              .filter((m) => m.round === r)
              .map((m) => {
                const res = resultText(m, league)
                const rr = m.done ? matchResult(m, league.rules) : null
                const win = (side: 'home' | 'away') => rr?.winner === side
                return (
                  <li key={m.id} className="rounded-2xl bg-fill p-2">
                    <div className="flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-right font-bold ${win('home') ? 'text-brand' : ''}`}>{team(m.home)?.name}</span>
                      <span className={`w-16 text-center font-extrabold tabular-nums ${res === '확인 필요' ? 'text-danger' : ''}`}>{res || 'vs'}</span>
                      <span className={`min-w-0 flex-1 truncate font-bold ${win('away') ? 'text-brand' : ''}`}>{team(m.away)?.name}</span>
                    </div>
                    {league.rules.kind === 'sets' && m.sets?.length ? <p className="text-center text-xs text-ink-3 tabular-nums">{m.sets.map((s) => s.join('-')).join(' · ')}</p> : null}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" className="btn btn-soft min-h-[44px] text-sm" onClick={() => onBoard(m)} disabled={readOnly}>
                        <Icon name="play" size={18} /> 점수판
                      </button>
                      <button type="button" className="btn btn-soft min-h-[44px] text-sm" onClick={() => onEdit(m)} disabled={readOnly}>
                        <Icon name="edit" size={18} /> {m.done ? '결과 고치기' : '결과 넣기'}
                      </button>
                    </div>
                  </li>
                )
              })}
          </ul>
        </Collapse>
      ))}
    </div>
  )
}

function ResultSheet({ league, match, team, onClose }: { league: League; match: LeagueMatch; team: (id: string) => LeagueTeam | undefined; onClose: () => void }) {
  const sets = league.rules.kind === 'sets'
  const [h, setH] = useState(match.homeScore?.toString() ?? '')
  const [a, setA] = useState(match.awayScore?.toString() ?? '')
  const [rows, setRows] = useState<string[][]>(match.sets?.map((s) => s.map(String)) ?? [['', '']])
  const [forfeit, setForfeit] = useState<'' | 'home' | 'away'>(match.forfeit ?? '')
  const [date, setDate] = useState(match.date ?? todayStr())
  const num = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Math.floor(Number(v))))

  const draft: LeagueMatch = forfeit
    ? { ...match, forfeit, homeScore: undefined, awayScore: undefined, sets: undefined, date, done: true }
    : sets
      ? { ...match, forfeit: undefined, sets: rows.filter((r) => r[0] !== '' || r[1] !== '').map((r) => [num(r[0]) ?? 0, num(r[1]) ?? 0] as [number, number]), date, done: true }
      : { ...match, forfeit: undefined, homeScore: num(h), awayScore: num(a), date, done: true }
  const res = matchResult(draft, league.rules)
  const problem = res
    ? ''
    : sets
      ? `세트 점수가 규칙에 맞지 않거나 경기가 아직 안 끝났어요(세트 ${league.rules.setRule?.target}점 · 2점 차 · ${league.rules.setRule?.setsToWin}세트 먼저).`
      : !league.rules.allowDraw && num(h) !== undefined && num(h) === num(a)
        ? '농구는 비길 수 없어요. 연장까지 한 점수를 넣어 주세요.'
        : '두 팀 점수를 넣어 주세요.'

  const save = async () => {
    await saveMatch(db, league.id, draft)
    onClose()
  }
  const clear = async () => {
    await saveMatch(db, league.id, { id: match.id, round: match.round, home: match.home, away: match.away, done: false })
    onClose()
  }
  const H = team(match.home)?.name
  const A = team(match.away)?.name

  return (
    <BottomSheet title={`${H} vs ${A}`} sub={`${match.round}라운드`} onClose={onClose}>
      <div className="space-y-3">
        {!forfeit && !sets && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-center">
              <span className="label">{H}</span>
              <input className="field text-center text-2xl font-extrabold" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} />
            </label>
            <label className="block text-center">
              <span className="label">{A}</span>
              <input className="field text-center text-2xl font-extrabold" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
            </label>
          </div>
        )}
        {!forfeit && sets && (
          <div className="space-y-2">
            <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 text-center text-xs font-bold text-ink-3">
              <span />
              <span className="truncate">{H}</span>
              <span className="truncate">{A}</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
                <span className="text-sm font-bold text-ink-3">{i + 1}세트</span>
                {[0, 1].map((k) => (
                  <input
                    key={k}
                    className="field text-center text-xl font-extrabold"
                    inputMode="numeric"
                    aria-label={`${i + 1}세트 ${k ? A : H}`}
                    value={r[k]}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? x.map((y, q) => (q === k ? e.target.value : y)) : x)))}
                  />
                ))}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-soft" onClick={() => setRows([...rows, ['', '']])} disabled={rows.length >= (league.rules.setRule?.setsToWin ?? 2) * 2 - 1}>
                <Icon name="plus" /> 세트 더하기
              </button>
              <button type="button" className="btn btn-soft" onClick={() => setRows(rows.slice(0, -1))} disabled={rows.length <= 1}>
                <Icon name="minus" /> 마지막 세트 빼기
              </button>
            </div>
          </div>
        )}
        <label className="block">
          <span className="label">몰수패 (나오지 않음 등)</span>
          <select className="field" value={forfeit} onChange={(e) => setForfeit(e.target.value as '' | 'home' | 'away')}>
            <option value="">없음</option>
            <option value="home">{H} 몰수패</option>
            <option value="away">{A} 몰수패</option>
          </select>
        </label>
        <label className="block">
          <span className="label">경기한 날</span>
          <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        {problem && <p className="font-bold text-danger">{problem}</p>}
        <button type="button" className="btn btn-primary w-full" onClick={save} disabled={!res}>
          저장
        </button>
        {match.done && (
          <button type="button" className="btn btn-soft w-full" onClick={clear}>
            결과 지우기 (경기 전으로)
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

/** 큰 점수판: 반쪽을 누르면 그 팀 +1 (농구는 +2 · +3 버튼). 세트 경기는 세트가 끝나면 자동으로 다음 세트 */
function Scoreboard({ league, match, team, onClose }: { league: League; match: LeagueMatch; team: (id: string) => LeagueTeam | undefined; onClose: () => void }) {
  const init: Board = useMemo(
    () => (league.rules.kind === 'sets' ? { sets: match.done ? [] : (match.sets ?? []), cur: [0, 0] } : { sets: [], cur: [match.done ? 0 : (match.homeScore ?? 0), match.done ? 0 : (match.awayScore ?? 0)] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [hist, setHist] = useState<Board[]>([init])
  const b = hist[hist.length - 1]
  const steps = sportOf(league.sport)?.scoreSteps ?? [1]
  const over = boardOver(b, league.rules)
  const tap = (side: 0 | 1, step: number) => setHist((h) => [...h, boardTap(h[h.length - 1], side, step, league.rules)])
  const undo = () => setHist((h) => (h.length > 1 ? h.slice(0, -1) : h))

  useEffect(() => {
    // 점수판을 켜 둔 동안 화면이 꺼지지 않게 (되는 기기만)
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      void lock?.release()
      document.body.style.overflow = prev
    }
  }, [])

  const save = async () => {
    await saveMatch(db, league.id, { ...boardToMatch(match, b, league.rules), date: todayStr() })
    onClose()
  }
  const sides = [team(match.home), team(match.away)]
  const setsWon = (i: 0 | 1) => b.sets.filter((s) => s[i] > s[1 - i]).length
  const canSave = league.rules.kind === 'sets' ? over : league.rules.allowDraw || b.cur[0] !== b.cur[1]

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink text-white" role="dialog" aria-modal="true" aria-label="점수판">
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),8px)] pb-2">
        <button type="button" className="btn min-h-[44px] bg-white/15 px-3 text-white" onClick={onClose}>
          <Icon name="close" /> 닫기
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold text-white/80">
          {league.rules.kind === 'sets' ? (over ? '경기 끝' : `${b.sets.length + 1}세트`) : `${match.round}라운드`}
          {b.sets.length > 0 && ` · ${b.sets.map((s) => s.join('-')).join(' / ')}`}
        </p>
        <button type="button" className="btn min-h-[44px] bg-white/15 px-3 text-white" onClick={undo} disabled={hist.length <= 1}>
          <Icon name="reset" /> 되돌리기
        </button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1 px-1 landscape:grid-cols-2">
        {([0, 1] as const).map((i) => (
          <div key={i} className="flex flex-col rounded-3xl" style={{ background: colorOf(sides[i]).fg }}>
            <button type="button" className="flex flex-1 flex-col items-center justify-center gap-2 p-2 active:brightness-110" onClick={() => tap(i, steps[0])} disabled={over} aria-label={`${sides[i]?.name} ${steps[0]}점`}>
              <span className="max-w-full truncate text-xl font-extrabold">{sides[i]?.name}</span>
              {league.rules.kind === 'sets' && <span className="text-lg font-bold text-white/80">세트 {setsWon(i)}</span>}
              <span className="text-[min(28vw,10rem)] leading-none font-black tabular-nums">{b.cur[i]}</span>
            </button>
            <div className="flex gap-1 p-1">
              {steps.slice(1).map((s) => (
                <button key={s} type="button" className="btn min-h-[52px] flex-1 bg-white/20 text-lg font-extrabold text-white" onClick={() => tap(i, s)} disabled={over}>
                  +{s}
                </button>
              ))}
              <button type="button" className="btn min-h-[52px] flex-1 bg-black/20 text-lg font-extrabold text-white" onClick={() => tap(i, -1)} disabled={over || b.cur[i] === 0} aria-label={`${sides[i]?.name} 1점 빼기`}>
                −1
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        <button type="button" className="btn w-full bg-white text-lg font-extrabold text-ink" onClick={save} disabled={!canSave}>
          {league.rules.kind === 'sets' ? (over ? '결과 저장' : '경기가 끝나면 저장할 수 있어요') : !canSave ? '동점이에요 (연장 점수까지)' : '결과 저장'}
        </button>
      </div>
    </div>
  )
}

function TeamsTab({ league, readOnly, onDelete }: { league: League; readOnly: boolean; onDelete: () => void }) {
  const { groups, membersOf } = useGroups()
  const group = groups?.find((g) => g.id === league.groupId)
  const students = group ? membersOf(group) : []
  const [teams, setTeams] = useState(league.teams)
  const [name, setName] = useState(league.name)
  const [msg, setMsg] = useState('')
  const [sure, setSure] = useState(false)
  const nameOf = (sid: string) => students.find((s) => s.id === sid)?.name ?? ''
  const save = async () => {
    const r = await updateLeague(db, league.id, { name, teams })
    setMsg(r.ok ? '저장했어요.' : (r.error ?? ''))
  }
  return (
    <div className="space-y-3">
      <section className="card space-y-3">
        <label className="block">
          <span className="label">리그 이름</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {teams.map((t, i) => (
          <div key={t.id}>
            <label className="block">
              <span className="label">
                <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf(t).fg }} aria-hidden />
                {i + 1}번째 팀
              </span>
              <input className="field" value={t.name} onChange={(e) => setTeams(teams.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} />
            </label>
            {t.memberIds.length > 0 && <p className="mt-1 px-1 text-sm text-ink-2">{t.memberIds.map(nameOf).filter(Boolean).join(', ')}</p>}
          </div>
        ))}
        <button type="button" className="btn btn-primary w-full" onClick={save} disabled={readOnly}>
          저장
        </button>
        {msg && <p className="font-bold text-ok">{msg}</p>}
      </section>
      <section className="card space-y-2">
        <button type="button" className="btn btn-soft w-full" onClick={() => updateLeague(db, league.id, { archived: !league.archived })} disabled={readOnly}>
          {league.archived ? '다시 보이기' : '숨기기 (목록에서 접기)'}
        </button>
        {!sure ? (
          <button type="button" className="btn btn-soft w-full text-danger" onClick={() => setSure(true)} disabled={readOnly}>
            <Icon name="trash" /> 리그전 지우기
          </button>
        ) : (
          <button type="button" className="btn w-full bg-danger text-white" onClick={onDelete}>
            정말 지우기 (경기 결과도 모두 지워져요)
          </button>
        )}
      </section>
    </div>
  )
}
