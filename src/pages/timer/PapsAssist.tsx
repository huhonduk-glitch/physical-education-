import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import ClassPicker, { classesOf, type ClassKey } from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import { db, newId } from '../../db/db'
import { setCells } from '../../db/papsRepo'
import { cellId, cellsForKey } from '../../lib/papsLayout'
import { pei } from '../../lib/paps'
import { HEART_WINDOWS, STEP_DURATION_SEC, STEP_WORDS, cadenceCount, formatCountdown, heartWindowAt, stepBeatAt, stepBpm } from '../../lib/timerMath'
import { useApp } from '../../state/AppContext'
import { useTimer } from '../../state/TimerContext'
import { usePapsClass } from '../../state/usePapsClass'
import { BigTime, Controls, Panel } from './common'

type Aid = 'curlUp' | 'step' | 'shuttle'

export default function PapsAssist() {
  const t = useTimer()
  const [aid, setAid] = useState<Aid>(t.mode === 'curlUp' ? 'curlUp' : t.mode === 'step' || t.mode === 'stepHeart' ? 'step' : 'curlUp')
  const pick = (a: Aid) => {
    if (t.running) return
    setAid(a)
    if (a === 'curlUp') t.setMode('curlUp')
    if (a === 'step') t.setMode('step')
  }
  useEffect(() => {
    if (!t.running && aid === 'curlUp' && t.mode !== 'curlUp') t.setMode('curlUp')
    if (!t.running && aid === 'step' && t.mode !== 'step' && t.mode !== 'stepHeart') t.setMode('step')
  }, [aid, t])
  return (
    <div className="space-y-4">
      <div className="segment">
        {(
          [
            ['curlUp', '윗몸말아올리기'],
            ['step', '스텝검사'],
            ['shuttle', '왕복오래달리기'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" aria-selected={aid === k} disabled={t.running && aid !== k} onClick={() => pick(k)}>
            {l}
          </button>
        ))}
      </div>
      {aid === 'curlUp' && <CurlUp />}
      {aid === 'step' && <Step />}
      {aid === 'shuttle' && <Shuttle />}
    </div>
  )
}

function CurlUp() {
  const t = useTimer()
  return (
    <Panel>
      <p className="text-center font-bold text-ink-3">3초마다 신호음 · 신호 횟수</p>
      <BigTime size="lg">{cadenceCount(t.elapsedMs)}</BigTime>
      <p className="text-center text-lg font-bold text-ink-2 tabular-nums">{formatCountdown(t.elapsedMs)} 경과</p>
      <Controls />
      <p className="hint">학교건강검사규칙 별표3: 첫 번째로 박자를 놓치면 세지 않고 계속, 두 번째로 놓치면 끝내요.</p>
    </Panel>
  )
}

function Step() {
  const t = useTimer()
  const { settings } = useApp()
  const heart = t.mode === 'stepHeart'
  const bpm = stepBpm(t.stepHighMale)
  const b = stepBeatAt(t.elapsedMs, bpm)
  const exerciseDone = !heart && t.elapsedMs >= STEP_DURATION_SEC * 1000
  const hw = heartWindowAt(t.elapsedMs)
  return (
    <div className="space-y-4">
      {!heart ? (
        <Panel>
          <div className="segment">
            <button type="button" aria-selected={t.stepHighMale} disabled={t.running} onClick={() => t.setStepHighMale(true)}>
              고등 남 (분당 30회)
            </button>
            <button type="button" aria-selected={!t.stepHighMale} disabled={t.running} onClick={() => t.setStepHighMale(false)}>
              여·중학생 (분당 24회)
            </button>
          </div>
          <p className="text-center font-bold text-ink-3">메트로놈 {bpm}bpm · 한 스텝 4박자</p>
          <p className={`text-center text-[min(20vw,7rem)] leading-none font-extrabold ${b.inStep < 2 ? 'text-brand' : 'text-ok'}`}>
            {t.running ? STEP_WORDS[b.inStep] : exerciseDone ? '끝' : '준비'}
          </p>
          <div className="flex justify-center gap-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-3 w-10 rounded-full ${t.running && b.inStep === i ? (i < 2 ? 'bg-brand' : 'bg-ok') : 'bg-fill-2'}`} />
            ))}
          </div>
          <p className="text-center text-lg font-bold tabular-nums">
            {Math.min(b.step, (STEP_DURATION_SEC * bpm) / 240)}스텝 · 남은 시간 {formatCountdown(STEP_DURATION_SEC * 1000 - t.elapsedMs)}
          </p>
          <Controls />
          <p className="hint">3분 뒤 자동으로 끝나요. 끝나면 바로 아래 [회복기 심박 측정]을 누르세요.</p>
          <button type="button" className="btn btn-outline w-full" disabled={t.running} onClick={() => (t.setMode('stepHeart'), setTimeout(t.start, 0))}>
            <Icon name="heart" /> 회복기 심박 측정 시작
          </button>
        </Panel>
      ) : (
        <Panel>
          <p className="text-center font-bold text-ink-3">운동 끝난 뒤 경과</p>
          <BigTime>{formatCountdown(t.elapsedMs)}</BigTime>
          <p
            className={`rounded-2xl p-3 text-center text-xl font-extrabold ${
              hw !== 'done' && hw.state === 'measure' ? 'bg-danger text-white' : 'bg-fill text-ink-2'
            }`}
          >
            {hw === 'done'
              ? '측정 끝 — 아래에 심박수를 넣으세요'
              : hw.state === 'measure'
                ? `${hw.n}회째 측정 중 (${HEART_WINDOWS[hw.n - 1].startSec / 60}:00~${HEART_WINDOWS[hw.n - 1].startSec / 60}:30)`
                : `${hw.n}회째 측정까지 ${formatCountdown(HEART_WINDOWS[hw.n - 1].startSec * 1000 - t.elapsedMs)}`}
          </p>
          <Controls />
          <button type="button" className="btn btn-ghost w-full text-ink-3" disabled={t.running} onClick={() => t.setMode('step')}>
            메트로놈으로 돌아가기
          </button>
        </Panel>
      )}
      <PeiCalc method={settings.papsStepMethod} />
    </div>
  )
}

/** PEI 계산 → PAPS 스텝검사 칸에 저장 */
function PeiCalc({ method }: { method: 'palpation' | 'monitor' }) {
  const { settings, readOnly } = useApp()
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status === '재학').toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const pc = usePapsClass(cls)
  const [sid, setSid] = useState('')
  const [D, setD] = useState('180')
  const [hr, setHr] = useState(['', '', ''])
  const [msg, setMsg] = useState('')
  const st = pc.students.find((s) => s.id === sid)
  const highMale = settings.schoolLevel === '고' && st?.gender === 'M'
  const value = pei(method, highMale, Number(D), hr.map((h) => (h ? Number(h) : undefined)) as [number?, number?, number?])
  const save = async () => {
    if (!st || value === null) return
    const items = [{ studentId: st.id, cell: cellsForKey(pc.cells, 'stepTest')[0] ?? { key: 'stepTest' as const, attempt: null, side: null }, value }]
    // 나이스 양식에 심박수 칸이 있으면 심박수도 넣는다 (헤더 기반)
    for (const c of cellsForKey(pc.cells, 'heartRate')) {
      const v = Number(hr[(c.attempt ?? 1) - 1])
      if (v > 0) items.push({ studentId: st.id, cell: c, value: v })
    }
    const exists = pc.values.get(st.id)?.has(cellId(items[0].cell))
    if (exists && !confirm('이미 기록이 있어요. 덮어쓸까요?')) return
    await setCells(db, settings.schoolYear, items)
    setMsg(`${st.number}번 ${st.name}: PEI ${value} 저장`)
    setHr(['', '', ''])
  }
  return (
    <Panel>
      <p className="card-title">PEI 계산 ({method === 'palpation' ? '촉진법' : '심박계'})</p>
      <p className="hint">측정 방식은 [설정 → PAPS]에서 바꿔요. 나이스에도 자동 계산이 있으니 앱 값은 확인용이에요.</p>
      <ClassPicker classes={classes} value={cls} onChange={setCls} />
      <select className="field" aria-label="학생" value={sid} onChange={(e) => setSid(e.target.value)} disabled={!cls}>
        <option value="">{cls ? '학생 고르기' : '반을 먼저 고르세요'}</option>
        {pc.students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.number}번 {s.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">운동 시간 D(초)</span>
          <input className="field" inputMode="numeric" value={D} onChange={(e) => setD(e.target.value.replace(/\D/g, ''))} />
        </label>
        {(highMale ? [0] : [0, 1, 2]).map((i) => (
          <label key={i}>
            <span className="label">{method === 'palpation' ? `${i + 1}:00~${i + 1}:30 심박` : `${i + 1}분 심박`}</span>
            <input
              className="field"
              inputMode="numeric"
              value={hr[i]}
              onChange={(e) => setHr((h) => h.map((x, k) => (k === i ? e.target.value.replace(/\D/g, '') : x)))}
            />
          </label>
        ))}
      </div>
      {st && <p className="hint">{highMale ? '고등학교 남학생 공식 (첫 번째 심박만 사용)' : '여학생·중학생 공식 (심박 3회 합)'}</p>}
      <p className="text-center text-3xl font-extrabold tabular-nums">{value === null ? '—' : `PEI ${value}`}</p>
      <button type="button" className="btn btn-primary w-full" disabled={!st || value === null || readOnly} onClick={save}>
        PAPS 스텝검사에 저장
      </button>
      {msg && <p className="font-bold text-ok">{msg}</p>}
    </Panel>
  )
}

interface Counter {
  count: number
  warned: boolean
  done: boolean
}

/** 왕복오래달리기: 교사가 올린 음원 재생 + 학생별 횟수 세기 (공식 음원은 앱에 넣지 않는다) */
function Shuttle() {
  const { settings, readOnly } = useApp()
  const files = useLiveQuery(() => db.audioFiles.toArray(), [])
  const [fileId, setFileId] = useState<string>('')
  const [url, setUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const f = files?.find((x) => x.id === fileId) ?? files?.[0]
    if (!f) return setUrl(null)
    if (f.id !== fileId) setFileId(f.id)
    const u = URL.createObjectURL(f.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [files, fileId])

  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status === '재학').toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const pc = usePapsClass(cls)
  const KEY = 'pe.shuttleCounters'
  const [counters, setCounters] = useState<Record<string, Counter>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(counters))
    } catch {
      /* 무시 */
    }
  }, [counters])
  const get = (id: string): Counter => counters[id] ?? { count: 0, warned: false, done: false }
  const upd = (id: string, f: (c: Counter) => Counter) => setCounters((x) => ({ ...x, [id]: f(get(id)) }))
  const [msg, setMsg] = useState('')

  const save = async () => {
    const cell = cellsForKey(pc.cells, 'shuttleRun')[0] ?? { key: 'shuttleRun' as const, attempt: null, side: null }
    const list = pc.students.filter((s) => get(s.id).count > 0)
    const over = list.filter((s) => pc.values.get(s.id)?.has(cellId(cell))).length
    if (over && !confirm(`${over}칸을 덮어씁니다. 계속할까요?`)) return
    await setCells(db, settings.schoolYear, list.map((s) => ({ studentId: s.id, cell, value: get(s.id).count })))
    setMsg(`${list.length}명의 왕복오래달리기 기록을 저장했어요.`)
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="card-title">신호 음원</p>
        <p className="hint">공식 음원은 앱에 들어 있지 않아요. 가지고 계신 mp3 파일을 올리면 이 기기에 보관돼요 (다음부터는 인터넷 없이 재생).</p>
        {files && files.length > 0 && (
          <select className="field" aria-label="음원 고르기" value={fileId} onChange={(e) => setFileId(e.target.value)}>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {url && <audio ref={audioRef} src={url} controls className="w-full" />}
        <div className="flex gap-2">
          <label className="btn btn-outline relative flex-1">
            <Icon name="music" /> mp3 올리기
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                const id = newId()
                await db.audioFiles.add({ id, name: f.name, blob: f, addedAt: Date.now() })
                setFileId(id)
              }}
            />
          </label>
          {fileId && (
            <button type="button" className="btn btn-soft" aria-label="이 음원 지우기" onClick={() => confirm('이 음원을 지울까요?') && db.audioFiles.delete(fileId).then(() => setFileId(''))}>
              <Icon name="trash" />
            </button>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <p className="card-title">학생별 횟수</p>
          <button type="button" className="btn btn-ghost min-h-[40px] text-sm text-ink-3" onClick={() => confirm('횟수를 모두 0으로 할까요?') && setCounters({})}>
            모두 0으로
          </button>
        </div>
        <p className="hint">카드를 누르면 +1. 신호 전에 못 들어오면 △(첫 번째), 두 번째면 ✕로 끝내요 — 끝난 학생은 더 세지 않아요.</p>
        <ClassPicker classes={classes} value={cls} onChange={setCls} />
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pc.students.map((s) => {
            const c = get(s.id)
            return (
              <li key={s.id} className={`overflow-hidden rounded-2xl ${c.done ? 'bg-fill-2' : c.warned ? 'bg-caution-light' : 'bg-fill'}`}>
                <button
                  type="button"
                  className="flex w-full flex-col items-center py-2 active:scale-95 disabled:opacity-60"
                  disabled={c.done}
                  aria-label={`${s.number}번 ${s.name} ${c.count}회, 누르면 1 더하기`}
                  onClick={() => upd(s.id, (x) => ({ ...x, count: x.count + 1 }))}
                >
                  <span className="text-sm font-bold text-ink-3">
                    {s.number}번 {s.name}
                  </span>
                  <span className="text-3xl font-extrabold tabular-nums">{c.count}</span>
                </button>
                <div className="grid grid-cols-3 border-t border-line/60">
                  <button type="button" className="min-h-[44px] font-bold text-ink-3" aria-label={`${s.number}번 1 빼기`} onClick={() => upd(s.id, (x) => ({ ...x, count: Math.max(0, x.count - 1) }))}>
                    −1
                  </button>
                  <button type="button" className={`min-h-[44px] font-bold ${c.warned ? 'text-caution' : 'text-ink-3'}`} aria-pressed={c.warned} onClick={() => upd(s.id, (x) => ({ ...x, warned: !x.warned }))}>
                    △
                  </button>
                  <button type="button" className={`min-h-[44px] font-bold ${c.done ? 'text-danger' : 'text-ink-3'}`} aria-pressed={c.done} onClick={() => upd(s.id, (x) => ({ ...x, done: !x.done }))}>
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {cls && (
          <button type="button" className="btn btn-primary w-full" disabled={readOnly || !pc.students.some((s) => get(s.id).count > 0)} onClick={save}>
            PAPS 왕복오래달리기에 저장
          </button>
        )}
        {msg && <p className="font-bold text-ok">{msg}</p>}
      </Panel>
    </div>
  )
}
