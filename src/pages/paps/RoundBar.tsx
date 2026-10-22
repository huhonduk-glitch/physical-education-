import { useState } from 'react'
import Icon from '../../components/Icon'
import { shortDateLabel } from '../../lib/dates'
import type { RoundInfo } from '../../lib/papsRounds'
import type { PapsRoundState } from '../../state/usePapsRound'

export const roundLabel = (r: RoundInfo) => `${r.round}회차${r.date ? ` · ${shortDateLabel(r.date)}` : ''}`

/**
 * PAPS 측정 회차 고르기 (B-5): [1회차 · 3/15] [2회차 · 6/2] [+ 새 회차].
 * 입력·붙여넣기·결과·스톱워치·왕복오래달리기 모두 여기서 고른 회차에 저장·표시한다.
 */
export default function RoundBar({ rounds, readOnly }: { rounds: PapsRoundState; readOnly: boolean }) {
  const [msg, setMsg] = useState('')
  const cur = rounds.current
  // 새 회차는 기존 기록을 바꾸지 않고, 비어 있으면 지울 수 있어서 확인 창 없이 바로 만든다
  const add = async () => {
    const next = rounds.rounds[rounds.rounds.length - 1].round + 1
    await rounds.add()
    setMsg(`${next}회차를 만들었어요(오늘 날짜). 이제 입력하는 기록은 ${next}회차에 들어가요. 지금까지 기록은 그대로예요.`)
  }
  const remove = async () => {
    if (!confirm(`${cur.round}회차를 지울까요? (기록이 없는 회차만 지울 수 있어요)`)) return
    const ok = await rounds.remove(cur)
    setMsg(ok ? `${cur.round}회차를 지웠어요.` : '이 회차에는 기록이 있어서 지우지 않았어요.')
  }
  return (
    <section className="card space-y-2.5" aria-label="측정 회차">
      <div className="flex items-center justify-between gap-2">
        <p className="card-title">측정 회차</p>
        {!readOnly && (
          <button type="button" className="btn btn-outline min-h-[44px] px-3 text-sm" onClick={() => void add()}>
            <Icon name="plus" size={18} /> 새 회차
          </button>
        )}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {rounds.rounds.map((r) => (
          <button
            key={r.id ?? 'first'}
            type="button"
            role="tab"
            aria-selected={r.id === cur.id}
            className="chip shrink-0 tabular-nums"
            onClick={() => (rounds.setCurrent(r.id), setMsg(''))}
          >
            {roundLabel(r)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">{cur.round}회차 측정한 날</span>
          <input type="date" className="field" value={cur.date ?? ''} disabled={readOnly} onChange={(e) => e.target.value && void rounds.setDate(cur, e.target.value)} />
        </label>
        {cur.id && !readOnly && (
          <button type="button" className="btn btn-ghost text-sm text-ink-3" onClick={() => void remove()}>
            이 회차 지우기
          </button>
        )}
      </div>
      <p className="hint">
        지금 <b className="text-ink-2">{cur.round}회차</b>를 보고 있어요. 입력하면 이 회차에 저장돼요.{rounds.rounds.length > 1 ? ' 회차별 비교는 [결과 보기]에서 봐요.' : ' 예전 기록은 모두 1회차예요.'}
      </p>
      {msg && <p className="text-sm font-bold text-ok">{msg}</p>}
    </section>
  )
}

/** 타이머 도구용 한 줄: 어느 회차에 저장되는지 */
export function RoundNote({ round }: { round: RoundInfo }) {
  return (
    <p className="text-sm font-bold text-ink-2">
      저장할 회차: <span className="text-brand">{roundLabel(round)}</span> <span className="font-semibold text-ink-3">(바꾸기: PAPS 화면의 측정 회차)</span>
    </p>
  )
}
