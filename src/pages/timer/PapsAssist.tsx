import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ActionBar from '../../components/ActionBar'
import ClassPicker, { classesOf, classKeyStr, type ClassKey } from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import { db, newId } from '../../db/db'
import { setCells } from '../../db/papsRepo'
import { cellId, cellsForKey } from '../../lib/papsLayout'
import { levelKey, lookup, pei } from '../../lib/paps'
import { canMiss, pushShuttle, replayShuttle, runnerOf, undoShuttle, type ShuttleAction } from '../../lib/shuttle'
import { GradeBadge, usePapsClassKey } from '../paps/common'
import { RoundNote } from '../paps/RoundBar'
import { HEART_WINDOWS, STEP_DURATION_SEC, STEP_WORDS, cadenceCount, formatCountdown, heartWindowAt, stepBeatAt, stepBpm } from '../../lib/timerMath'
import { useApp } from '../../state/AppContext'
import { useTimer } from '../../state/TimerContext'
import { usePapsClass } from '../../state/usePapsClass'
import { BigTime, Controls, Panel } from './common'

type Aid = 'curlUp' | 'step' | 'shuttle'

export default function PapsAssist() {
  const t = useTimer()
  // 도구 탭의 [왕복오래달리기] 카드는 ?aid=shuttle로 바로 연다 (탭 2단을 거치지 않게)
  const [sp] = useSearchParams()
  const [aid, setAid] = useState<Aid>(
    sp.get('aid') === 'shuttle' && !t.running ? 'shuttle' : t.mode === 'curlUp' ? 'curlUp' : t.mode === 'step' || t.mode === 'stepHeart' ? 'step' : 'curlUp',
  )
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
    await setCells(db, settings.schoolYear, items, pc.roundId)
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
      {cls && <RoundNote round={pc.round} />}
      <button type="button" className="btn btn-primary w-full" disabled={!st || value === null || readOnly} onClick={save}>
        PAPS 스텝검사에 저장
      </button>
      {msg && <p className="font-bold text-ok">{msg}</p>}
    </Panel>
  )
}

/**
 * 왕복오래달리기: 교사가 올린 음원 재생 + 반 전체 세기 (공식 음원·신호 간격은 앱에 넣지 않는다).
 * 신호가 울리면 [신호 +1] 한 번, 신호 전에 못 들어온 학생만 카드를 누른다 (계산: src/lib/shuttle.ts).
 */
function Shuttle() {
  const { settings, readOnly, standards } = useApp()
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

  // 반 고르기: 내 학적반 수업반을 먼저 (PAPS 화면들과 같은 반을 기억)
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  // 반 + 회차마다 따로 센다 (새 회차를 만들면 0회부터. 예전 키 '1-3'은 1회차로 그대로 이어진다)
  const clsKey = cls ? `${classKeyStr(cls)}${pc.roundId ? `|${pc.roundId}` : ''}` : ''
  // 누른 순서만 반별로 남긴다 (다른 화면에 다녀와도 그대로, 탭을 닫으면 사라짐)
  const KEY = 'pe.shuttleRun.v2'
  const [all, setAll] = useState<Record<string, ShuttleAction[]>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      /* 무시 */
    }
  }, [all])
  const actions = all[clsKey] ?? []
  const setActions = (f: (a: ShuttleAction[]) => ShuttleAction[]) => setAll((x) => ({ ...x, [clsKey]: f(x[clsKey] ?? []) }))
  const state = useMemo(() => replayShuttle(actions), [actions])
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const outCount = pc.students.filter((s) => !runnerOf(state, s.id).running).length

  // 성별이 없는 학생은 기준을 고를 수 없어서 등급을 비워 둔다
  const bandOf = (s: (typeof pc.students)[number], v: number) => (s.gender ? lookup(standards, 'shuttleRun', levelKey(settings.schoolLevel, s.grade), s.gender, v) : null)
  const toSave = pc.students.filter((s) => !skip.has(s.id))

  const save = async () => {
    const cell = cellsForKey(pc.cells, 'shuttleRun')[0] ?? { key: 'shuttleRun' as const, attempt: null, side: null }
    const over = toSave.filter((s) => pc.values.get(s.id)?.has(cellId(cell))).length
    if (over && !confirm(`${over}칸을 덮어씁니다. 계속할까요?`)) return
    await setCells(db, settings.schoolYear, toSave.map((s) => ({ studentId: s.id, cell, value: runnerOf(state, s.id).record })), pc.roundId)
    setMsg(`${toSave.length}명의 왕복오래달리기 기록을 저장했어요.`)
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
          <p className="card-title">반 전체 세기</p>
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] text-sm text-ink-3"
            disabled={actions.length === 0}
            onClick={() => confirm('이 반의 세기를 처음부터 다시 할까요?') && (setActions(() => []), setSkip(new Set()), setMsg(''))}
          >
            처음부터
          </button>
        </div>
        <ol className="list-decimal space-y-0.5 pl-5 text-[0.95rem] text-ink-2">
          <li>
            신호가 울리면 아래 <b>[신호 +1]</b>을 한 번 눌러요 (반 전체가 1회 더해져요)
          </li>
          <li>
            그 신호 전에 못 들어온 학생 카드를 눌러요. 첫 번째는 <b className="text-caution">△</b>(계속 달림), 두 번째는 <b>끝</b>(직전 횟수로 기록)
          </li>
        </ol>
        <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7">
          {pc.students.map((s) => {
            const r = runnerOf(state, s.id)
            const can = canMiss(state, s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`flex min-h-[76px] w-full flex-col items-center justify-center rounded-2xl px-1 py-1.5 active:scale-95 ${
                    !r.running ? 'bg-fill-2 text-ink-3' : r.warnedAt !== null ? 'bg-caution-light ring-2 ring-caution/50' : 'bg-white shadow-[var(--shadow-card)]'
                  }`}
                  disabled={!can || readOnly}
                  aria-label={`${s.number}번 ${s.name}: ${r.running ? (r.warnedAt !== null ? `△ ${r.warnedAt}회` : '달리는 중') : `끝 ${r.record}회`}. 누르면 이번 신호에 늦음`}
                  onClick={() => setActions((a) => pushShuttle(a, { kind: 'miss', id: s.id }))}
                >
                  <span className="text-lg leading-none font-extrabold tabular-nums">{s.number}</span>
                  <span className="mt-0.5 max-w-full truncate text-xs font-bold">{s.name}</span>
                  <span className={`mt-1 text-xs font-extrabold tabular-nums ${!r.running ? '' : r.warnedAt !== null ? 'text-caution' : 'text-ink-3'}`}>
                    {!r.running ? `끝 ${r.record}회` : r.warnedAt !== null ? `△ ${r.warnedAt}회` : '달리는 중'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {cls && (
          <ActionBar>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                className="btn btn-soft flex-col gap-0 px-3 text-sm"
                disabled={actions.length === 0}
                onClick={() => setActions(undoShuttle)}
                aria-label="방금 누른 것 되돌리기"
              >
                <Icon name="reset" size={20} />
                되돌리기
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-[72px] flex-1 justify-between px-5"
                disabled={readOnly || pc.students.length === 0}
                onClick={() => setActions((a) => pushShuttle(a, { kind: 'lap' }))}
              >
                <span className="text-left leading-tight">
                  <span className="block text-sm font-bold text-white/80">지금</span>
                  <span className="text-3xl font-black whitespace-nowrap tabular-nums">{state.lap}회</span>
                </span>
                <span className="text-2xl font-black whitespace-nowrap">신호 +1</span>
              </button>
            </div>
            <p className="text-center text-sm font-bold text-ink-3 tabular-nums">
              달리는 중 {pc.students.length - outCount}명 · 끝 {outCount}명
            </p>
          </ActionBar>
        )}
      </Panel>

      {cls && state.lap > 0 && (
        <Panel>
          <p className="card-title">기록과 등급</p>
          <p className="hint">
            기록 규칙: 학교건강검사규칙 별표3(신호 전 도착 못 한 첫 회 △ 계속, 두 번째 종료·직전 횟수). 등급·점수: 교육부 PAPS 기준표({standards.version}). 나이스 값과 다르면 나이스 값이 우선이에요.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-left">
              <thead className="bg-fill text-sm">
                <tr>
                  <th className="p-2">저장</th>
                  <th className="p-2">학생</th>
                  <th className="p-2 text-right">기록</th>
                  <th className="p-2">등급 · 점수</th>
                </tr>
              </thead>
              <tbody>
                {pc.students.map((s) => {
                  const r = runnerOf(state, s.id)
                  const band = bandOf(s, r.record)
                  return (
                    <tr key={s.id} className={`border-t border-line ${skip.has(s.id) ? 'text-ink-3' : ''}`}>
                      <td className="p-1">
                        <input
                          type="checkbox"
                          className="m-2 h-6 w-6 accent-[var(--color-brand)]"
                          aria-label={`${s.number}번 ${s.name} 저장`}
                          checked={!skip.has(s.id)}
                          onChange={() => setSkip((x) => (x.has(s.id) ? (x.delete(s.id), new Set(x)) : new Set(x).add(s.id)))}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <span className="tabular-nums">{s.number}</span> {s.name}
                      </td>
                      <td className="p-2 text-right font-bold whitespace-nowrap tabular-nums">{r.record}회</td>
                      <td className="p-2 whitespace-nowrap">
                        <GradeBadge band={band} points={band?.points} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">안 뛴 학생(견학·결석)은 [저장] 체크를 풀어 주세요. 저장한 뒤에도 [PAPS → 기록 입력]에서 고칠 수 있어요.</p>
          <RoundNote round={pc.round} />
          <button type="button" className="btn btn-primary w-full" disabled={readOnly || toSave.length === 0} onClick={save}>
            {toSave.length}명 PAPS 왕복오래달리기에 저장
          </button>
          {msg && <p className="font-bold text-ok">{msg}</p>}
        </Panel>
      )}
    </div>
  )
}
