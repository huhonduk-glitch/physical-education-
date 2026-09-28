import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { db, newId } from '../../db/db'
import { formatCountdown, intervalAt, type IntervalConfig } from '../../lib/timerMath'
import { useTimer } from '../../state/TimerContext'
import { BigTime, Controls, NumberField, Panel } from './common'

/** 처음 쓸 때 넣어 두는 기본 프리셋 (CLAUDE.md 4-4 예: 3분, 5분, 10분) */
async function ensurePresets() {
  if ((await db.timerPresets.count()) > 0) return
  await db.timerPresets.bulkAdd([
    { id: newId(), name: '3분', mode: 'countdown', config: { ms: 180000 } },
    { id: newId(), name: '5분', mode: 'countdown', config: { ms: 300000 } },
    { id: newId(), name: '10분', mode: 'countdown', config: { ms: 600000 } },
    { id: newId(), name: '타바타 20/10 ×8', mode: 'interval', config: { workSec: 20, restSec: 10, rounds: 8 } },
    { id: newId(), name: '30/15 ×6', mode: 'interval', config: { workSec: 30, restSec: 15, rounds: 6 } },
  ])
}

function Presets({ mode, onPick, current, isCurrent }: { mode: 'countdown' | 'interval'; onPick: (cfg: Record<string, unknown>) => void; current: () => { name: string; config: Record<string, unknown> }; isCurrent: (cfg: Record<string, unknown>) => boolean }) {
  const t = useTimer()
  useEffect(() => void ensurePresets(), [])
  const presets = useLiveQuery(() => db.timerPresets.filter((p) => p.mode === mode).toArray(), [mode])
  const [edit, setEdit] = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label mb-0">저장한 시간</p>
        <button type="button" className="btn btn-ghost min-h-[40px] px-2 text-sm text-ink-3" onClick={() => setEdit((e) => !e)}>
          {edit ? '완료' : '편집'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets?.map((p) => (
          <span key={p.id} className="relative">
            <button type="button" className="chip" aria-pressed={isCurrent(p.config)} disabled={t.running} onClick={() => onPick(p.config)}>
              {p.name}
            </button>
            {edit && (
              <button
                type="button"
                aria-label={`${p.name} 지우기`}
                className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-danger text-white"
                onClick={() => db.timerPresets.delete(p.id)}
              >
                <Icon name="close" size={14} strokeWidth={3} />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          className="chip text-brand"
          disabled={t.running}
          onClick={() => {
            const c = current()
            void db.timerPresets.add({ id: newId(), mode, ...c })
          }}
        >
          <Icon name="plus" size={18} /> 지금 설정 저장
        </button>
      </div>
    </div>
  )
}

export function Countdown({ onFull }: { onFull: () => void }) {
  const t = useTimer()
  const left = Math.max(0, t.countdownMs - t.elapsedMs)
  const done = left === 0 && t.elapsedMs > 0
  const [m, setM] = useState(Math.floor(t.countdownMs / 60000))
  const [s, setS] = useState(Math.floor((t.countdownMs % 60000) / 1000))
  const apply = (mm: number, ss: number) => {
    setM(mm)
    setS(ss)
    t.setCountdown((mm * 60 + ss) * 1000)
  }
  return (
    <div className="space-y-4">
      <Panel>
        <BigTime tone={done ? 'text-danger' : left <= 10000 && t.running ? 'text-caution' : 'text-ink'}>{formatCountdown(left)}</BigTime>
        <div className="h-2 overflow-hidden rounded-full bg-fill-2">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(left / Math.max(1, t.countdownMs)) * 100}%` }} />
        </div>
        <Controls
          extra={
            <button type="button" className="btn btn-soft h-16 w-16 rounded-full p-0" aria-label="크게 보기" onClick={onFull}>
              <Icon name="expand" size={24} />
            </button>
          }
        />
        {done && <p className="text-center text-lg font-extrabold text-danger">시간 끝!</p>}
      </Panel>
      <Panel>
        <Presets
          mode="countdown"
          onPick={(c) => {
            const ms = Number(c.ms)
            apply(Math.floor(ms / 60000), Math.floor((ms % 60000) / 1000))
          }}
          isCurrent={(c) => Number(c.ms) === t.countdownMs}
          current={() => ({ name: s ? `${m}분 ${s}초` : `${m}분`, config: { ms: t.countdownMs } })}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="분" value={m} max={180} onChange={(v) => !t.running && apply(v, s)} />
          <NumberField label="초" value={s} max={59} onChange={(v) => !t.running && apply(m, v)} />
        </div>
      </Panel>
    </div>
  )
}

export function Interval({ onFull }: { onFull: () => void }) {
  const t = useTimer()
  const cfg = t.interval
  const st = intervalAt(cfg, t.elapsedMs)
  const set = (patch: Partial<IntervalConfig>) => t.setIntervalCfg({ ...cfg, ...patch })
  const started = t.elapsedMs > 0
  return (
    <div className="space-y-4">
      <Panel>
        <IntervalFace />
        <Controls
          extra={
            <button type="button" className="btn btn-soft h-16 w-16 rounded-full p-0" aria-label="크게 보기" onClick={onFull}>
              <Icon name="expand" size={24} />
            </button>
          }
        />
        <p className="hint text-center">구간이 바뀔 때 소리와 진동으로 알려요. 끝나기 3초 전부터 짧게 울려요.</p>
      </Panel>
      <Panel>
        <Presets
          mode="interval"
          onPick={(c) => t.setIntervalCfg({ workSec: Number(c.workSec), restSec: Number(c.restSec), rounds: Number(c.rounds) })}
          isCurrent={(c) => Number(c.workSec) === cfg.workSec && Number(c.restSec) === cfg.restSec && Number(c.rounds) === cfg.rounds}
          current={() => ({ name: `${cfg.workSec}/${cfg.restSec} ×${cfg.rounds}`, config: { ...cfg } })}
        />
        <NumberField label="운동 시간" suffix="초" value={cfg.workSec} min={1} max={3600} onChange={(v) => !t.running && set({ workSec: v })} />
        <NumberField label="휴식 시간" suffix="초" value={cfg.restSec} min={0} max={3600} onChange={(v) => !t.running && set({ restSec: v })} />
        <NumberField label="라운드" suffix="회" value={cfg.rounds} min={1} max={99} onChange={(v) => !t.running && set({ rounds: v })} />
        {!started && <p className="hint">전체 {formatCountdown(st.totalMs)}</p>}
      </Panel>
    </div>
  )
}

/** 인터벌 큰 화면 (카드·전체화면 공용) */
export function IntervalFace({ big }: { big?: boolean }) {
  const t = useTimer()
  const st = intervalAt(t.interval, t.elapsedMs)
  const label = st.phase === 'work' ? '운동' : st.phase === 'rest' ? '휴식' : '끝'
  const tone = st.phase === 'work' ? 'bg-ok text-white' : st.phase === 'rest' ? 'bg-caution-light text-caution' : 'bg-fill-2 text-ink-2'
  return (
    <div className="space-y-3 text-center">
      <div className="flex items-center justify-center gap-3">
        <span className={`badge px-4 py-1 ${big ? 'text-3xl' : 'text-lg'} ${tone}`}>{label}</span>
        <span className={`font-extrabold tabular-nums ${big ? 'text-3xl' : 'text-lg'} opacity-80`}>
          {st.round} / {t.interval.rounds} 라운드
        </span>
      </div>
      <p className={`leading-none font-extrabold tabular-nums ${big ? 'text-[min(24vw,15rem)]' : 'text-[min(19vw,6.5rem)]'}`}>{formatCountdown(st.remainingMs)}</p>
    </div>
  )
}
