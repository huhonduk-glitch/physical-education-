import { useState } from 'react'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { formatCountdown, formatStopwatch } from '../lib/timerMath'
import { useTimer, type ToolMode } from '../state/TimerContext'
import { BigTime, FullscreenOverlay } from './timer/common'
import { Countdown, Interval, IntervalFace } from './timer/CountdownInterval'
import PapsAssist from './timer/PapsAssist'
import Stopwatch from './timer/Stopwatch'

type Tab = 'stopwatch' | 'countdown' | 'interval' | 'paps'

const TABS: [Tab, string][] = [
  ['stopwatch', '스톱워치'],
  ['countdown', '카운트다운'],
  ['interval', '인터벌'],
  ['paps', 'PAPS 보조'],
]

const tabOf = (m: ToolMode): Tab => (m === 'stopwatch' || m === 'countdown' || m === 'interval' ? m : 'paps')

/** 타이머 탭 (CLAUDE.md 4-4). 다른 화면으로 가도 계속 돌고, 화면 위에 작게 보인다 */
export default function TimerPage() {
  const t = useTimer()
  const [tab, setTab] = useState<Tab>(tabOf(t.mode))
  const [full, setFull] = useState(false)
  const choose = (k: Tab) => {
    if (t.running && tabOf(t.mode) !== k) return
    setTab(k)
    if (k !== 'paps') t.setMode(k)
    else if (tabOf(t.mode) !== 'paps') t.setMode('curlUp')
  }
  return (
    <>
      <PageHeader
        title="타이머"
        sub={t.running ? '다른 화면으로 가도 계속 돌아요' : undefined}
        right={
          tab !== 'paps' ? (
            <button type="button" className="btn btn-soft" onClick={() => setFull(true)}>
              <Icon name="expand" /> 크게
            </button>
          ) : undefined
        }
      />
      <div className="page space-y-4 pb-6">
        <div className="segment" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} disabled={t.running && tabOf(t.mode) !== k} onClick={() => choose(k)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'stopwatch' && <Stopwatch />}
        {tab === 'countdown' && <Countdown onFull={() => setFull(true)} />}
        {tab === 'interval' && <Interval onFull={() => setFull(true)} />}
        {tab === 'paps' && <PapsAssist />}
      </div>
      {full && (
        <FullscreenOverlay
          label={tab === 'stopwatch' ? '스톱워치' : tab === 'countdown' ? '카운트다운' : '인터벌'}
          onClose={() => setFull(false)}
          tone={tab === 'interval' ? 'bg-ink text-white' : undefined}
        >
          {tab === 'interval' ? (
            <IntervalFace big />
          ) : (
            <BigTime size="lg" tone="text-white">
              {tab === 'countdown' ? formatCountdown(Math.max(0, t.countdownMs - t.elapsedMs)) : formatStopwatch(t.elapsedMs)}
            </BigTime>
          )}
        </FullscreenOverlay>
      )}
    </>
  )
}
