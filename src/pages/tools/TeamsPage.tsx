import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { copyText } from '../../lib/download'
import { GROUP_COLORS } from '../../lib/groups'
import { makeTeams, teamName, teamsForSize, teamsText } from '../../lib/teams'
import { useTeamLevels } from '../../state/useClassTools'
import { NumberField } from '../timer/common'
import { SourceCard, useToolPeople, type ToolPerson } from './common'

const COLORS = Object.values(GROUP_COLORS)
const colorOf = (i: number) => COLORS[i % COLORS.length]

/** 팀 나누기: 무작위 · 남녀 고르게 · 실력(PAPS) 고르게. 실력은 평가 정보라 기본으로 끈다 */
export default function TeamsPage() {
  const t = useToolPeople()
  const [by, setBy] = useState<'count' | 'size'>('count')
  const [num, setNum] = useState(2)
  const [gender, setGender] = useState(true)
  const [level, setLevel] = useState(false)
  const [teams, setTeams] = useState<ToolPerson[][] | null>(null)
  const [big, setBig] = useState(false)
  const [msg, setMsg] = useState('')
  const byGroup = t.source === 'group'
  const students = byGroup ? t.people.flatMap((p) => (p.student ? [p.student] : [])) : []
  const levels = useTeamLevels(students, byGroup && level)

  const key = `${t.source}|${t.group?.id}|${t.count}|${t.people.length}`
  useEffect(() => setTeams(null), [key])

  const teamCount = by === 'count' ? num : teamsForSize(t.people.length, num)
  const measured = levels ? [...levels.values()].filter(Boolean).length : 0

  const split = () => {
    const ppl = t.people.map((p) => ({ ...p, level: levels?.get(p.id) ?? null }))
    setTeams(makeTeams(ppl, { teams: teamCount, balanceGender: byGroup && gender, balanceLevel: byGroup && level }))
    setMsg('')
  }
  /** 학생을 누르면 다음 팀으로 옮긴다 */
  const move = (ti: number, id: string) =>
    setTeams((all) => {
      if (!all) return all
      const p = all[ti].find((x) => x.id === id)
      if (!p) return all
      const to = (ti + 1) % all.length
      return all.map((team, i) => (i === ti ? team.filter((x) => x.id !== id) : i === to ? [...team, p] : team))
    })

  const board = (large: boolean) =>
    teams && (
      <div className={`grid gap-3 ${teams.length === 2 ? 'grid-cols-2' : `grid-cols-1 sm:grid-cols-2 ${large ? 'lg:grid-cols-3' : ''}`}`}>
        {teams.map((team, i) => {
          const c = colorOf(i)
          const m = team.filter((p) => p.gender === 'M').length
          const f = team.filter((p) => p.gender === 'F').length
          return (
            <section key={i} className="rounded-2xl p-3" style={{ background: c.bg }} aria-label={teamName(i)}>
              <p className="mb-2 flex items-baseline gap-2 font-extrabold" style={{ color: c.fg }}>
                <span className={large ? 'text-3xl' : 'text-lg'}>{teamName(i)}</span>
                <span className="text-sm">
                  {team.length}명{m + f > 0 ? ` · 남${m} 여${f}` : ''}
                </span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {team.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`rounded-xl bg-white px-2.5 font-bold text-ink shadow-sm ${large ? 'min-h-[52px] text-2xl' : 'min-h-[40px]'}`}
                      onClick={() => move(i, p.id)}
                      aria-label={`${p.name} 다음 팀으로 옮기기`}
                    >
                      {p.name}
                      {level && levels?.get(p.id) && !large && <small className="ml-1 text-ink-3">{levels.get(p.id)}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    )

  return (
    <>
      <PageHeader
        title="팀 나누기"
        back
        right={
          teams ? (
            <button type="button" className="btn btn-soft" onClick={() => setBig(true)}>
              <Icon name="expand" /> 크게
            </button>
          ) : undefined
        }
      />
      <div className="page space-y-4 pb-8">
        <SourceCard t={t} />

        <section className="card space-y-3">
          <div className="segment" role="tablist" aria-label="나누는 방법">
            <button type="button" role="tab" aria-selected={by === 'count'} onClick={() => (setBy('count'), setNum(2))}>
              팀 수로
            </button>
            <button type="button" role="tab" aria-selected={by === 'size'} onClick={() => (setBy('size'), setNum(5))}>
              팀당 인원으로
            </button>
          </div>
          <NumberField label={by === 'count' ? '팀 수' : '한 팀에'} value={num} onChange={setNum} min={2} max={by === 'count' ? 12 : 30} suffix={by === 'count' ? '팀' : '명'} />
          {by === 'size' && <p className="hint">{t.people.length}명 → {teamCount}팀</p>}
          {byGroup && (
            <>
              <label className="flex min-h-[48px] items-center gap-3">
                <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={gender} onChange={(e) => setGender(e.target.checked)} />
                <span className="font-bold">남녀를 팀마다 고르게</span>
              </label>
              <label className="flex min-h-[48px] items-center gap-3">
                <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={level} onChange={(e) => setLevel(e.target.checked)} />
                <span>
                  <b>실력을 팀마다 고르게 (PAPS 등급)</b>
                  <span className="hint block">
                    {level ? `측정한 학생 ${measured}/${t.people.length}명 · 미측정은 '중'으로 봐요. ` : ''}평가 정보라서 기본은 꺼 둬요. 화면에 등급이 보이니 학생 앞에서는 끄세요.
                  </span>
                </span>
              </label>
            </>
          )}
          <button type="button" className="btn btn-primary h-14 w-full text-lg" onClick={split} disabled={t.people.length < 2}>
            <Icon name="shuffle" /> {teams ? '다시 나누기' : '팀 나누기'}
          </button>
        </section>

        {teams && (
          <section className="space-y-3">
            <p className="hint px-1">학생을 누르면 다음 팀으로 옮겨요.</p>
            {board(false)}
            <button
              type="button"
              className="btn btn-soft w-full"
              onClick={async () => setMsg((await copyText(teamsText(teams))) ? '복사했어요. 메신저나 칠판 앱에 붙여넣으세요.' : '복사하지 못했어요.')}
            >
              <Icon name="copy" /> 팀 명단 글자로 복사
            </button>
            {msg && (
              <p className="rounded-xl bg-ok-light p-3 font-bold text-ok" role="status">
                {msg}
              </p>
            )}
          </section>
        )}
      </div>

      {big && teams && (
        <div className="anim-fade fixed inset-0 z-[70] flex flex-col gap-4 overflow-auto bg-white p-5" role="dialog" aria-modal="true" aria-label="팀 크게 보기">
          <div className="flex-1">{board(true)}</div>
          <div className="flex justify-center gap-3">
            <button type="button" className="btn btn-primary min-h-[60px] px-6 text-xl" onClick={split}>
              다시 나누기
            </button>
            <button type="button" className="btn btn-soft min-h-[60px] px-6 text-xl" onClick={() => setBig(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
