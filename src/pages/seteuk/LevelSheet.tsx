import { useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import { db } from '../../db/db'
import type { StudentBasis } from '../../db/seteukLevelRepo'
import { setLevel } from '../../db/seteukRepo'
import type { ClassGroup, SeteukDraft } from '../../db/types'
import { memberNo } from '../../lib/groups'
import { DEFAULT_FRAMES, DEFAULT_WEIGHTS, frameFor, frameIndex, LEVEL_FACTOR_LABEL, type LevelFrame, type LevelScore, type LevelWeights } from '../../lib/seteukLevel'
import Collapse from '../../components/Collapse'
import { useApp } from '../../state/AppContext'
import { LEVEL_TONE } from './seteukShared'

interface Props {
  group: ClassGroup
  basis: StudentBasis[]
  scores: Map<string, LevelScore>
  auto: Map<string, number>
  drafts: Map<string, SeteukDraft>
  onClose: () => void
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}`)

/**
 * 수준 나누기 (6-7): 비중 · 수준 수를 정하면 앱이 반 안 순위로 수준을 제안하고, 교사가 학생마다 고친다.
 * 표에 근거(수행평가 % · 활동 순위 · PAPS 등급 · 지도)를 같이 보여 줘 왜 그 수준인지 알 수 있게 한다.
 */
export default function LevelSheet({ group, basis, scores, auto, drafts, onClose }: Props) {
  const { settings, updateSettings, readOnly } = useApp()
  const [w, setW] = useState<LevelWeights>(settings.seteukWeights)
  const count = settings.seteukLevelCount
  const changed = (Object.keys(w) as (keyof LevelWeights)[]).some((k) => w[k] !== settings.seteukWeights[k])
  const rows = [...basis].sort((a, b) => (scores.get(b.student.id)?.score ?? 0) - (scores.get(a.student.id)?.score ?? 0))
  const overrides = basis.filter((b) => drafts.get(b.student.id)?.level !== undefined)
  const keyOf = (studentId: string) => ({ schoolYear: settings.schoolYear, groupId: group.id, studentId })
  return (
    <BottomSheet title="수준 나누기" sub={group.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="hint">
          아래 근거로 반 안에서 순위를 매겨 <b>{count}수준</b>으로 나눠요(위쪽이 높은 수준). 앱의 제안일 뿐이에요 — 학생 줄의 숫자를 눌러 선생님이 바꿔요. 지도 기록은 감점에만 쓰고 세특 글에는 넣지 않아요.
        </p>
        <section className="space-y-2">
          <p className="card-title">수준 수</p>
          <div className="segment" role="radiogroup" aria-label="수준 수">
            {[3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={count === n} disabled={readOnly} onClick={() => updateSettings({ seteukLevelCount: n })}>
                {n}수준
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <p className="card-title">비중</p>
          {(Object.keys(LEVEL_FACTOR_LABEL) as (keyof LevelWeights)[]).map((k) => (
            <label key={k} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm font-bold">{LEVEL_FACTOR_LABEL[k]}</span>
              <input type="range" min={0} max={k === 'guide' ? 30 : 100} step={5} value={w[k]} className="min-w-0 flex-1" disabled={readOnly} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} />
              <span className="w-10 text-right font-extrabold tabular-nums">{w[k]}</span>
            </label>
          ))}
          <p className="hint">PAPS는 건강 정보라 쓰지 않으려면 0으로 두세요. 채점 안 된 수행평가 · 미측정 PAPS는 그 학생 계산에서 빼고 나머지로 나눠요.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-soft" disabled={readOnly} onClick={() => setW(DEFAULT_WEIGHTS)}>
              기본값
            </button>
            <button type="button" className="btn btn-primary" disabled={readOnly || !changed} onClick={() => updateSettings({ seteukWeights: w })}>
              비중 적용
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="card-title flex-1">학생 {rows.length}명</p>
            {overrides.length > 0 && (
              <button type="button" className="btn btn-soft text-sm" disabled={readOnly} onClick={() => overrides.forEach((b) => setLevel(db, keyOf(b.student.id), undefined))}>
                고친 수준 {overrides.length}개 → 제안대로
              </button>
            )}
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-max min-w-full border-separate border-spacing-0 rounded-2xl bg-white text-center text-sm shadow-[var(--shadow-card)]">
              <thead>
                <tr className="text-ink-3">
                  <th className="sticky left-0 bg-white px-2 py-2 text-left">학생</th>
                  <th className="px-1.5">점수</th>
                  <th className="px-1.5">수행%</th>
                  <th className="px-1.5">활동</th>
                  <th className="px-1.5">PAPS</th>
                  <th className="px-1.5">지도</th>
                  <th className="px-2">수준</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const sc = scores.get(b.student.id)
                  const sug = auto.get(b.student.id) ?? 1
                  const lv = drafts.get(b.student.id)?.level ?? sug
                  return (
                    <tr key={b.student.id}>
                      <th className="sticky left-0 border-t border-line bg-white px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                        <span className="mr-1 font-extrabold tabular-nums">{memberNo(group, b.student)}</span>
                        {b.student.name}
                        {sc?.thin && <span className="ml-1 badge bg-caution-light text-caution">근거 부족</span>}
                      </th>
                      <td className="border-t border-line px-1.5 font-extrabold tabular-nums">{sc?.score ?? '—'}</td>
                      <td className="border-t border-line px-1.5 tabular-nums">{pct(b.signals.assess)}</td>
                      <td className="border-t border-line px-1.5 tabular-nums">
                        {b.signals.praise}·{b.signals.notes}
                      </td>
                      <td className="border-t border-line px-1.5 tabular-nums">{b.signals.paps ? `${b.signals.paps}등급` : '—'}</td>
                      <td className="border-t border-line px-1.5 tabular-nums">{b.signals.guide || ''}</td>
                      <td className="border-t border-line px-1 py-1">
                        <select
                          className={`field h-10 w-[4.6rem] px-2 text-sm font-extrabold ${LEVEL_TONE(lv, count)}`}
                          value={lv}
                          disabled={readOnly}
                          aria-label={`${b.student.name} 수준`}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setLevel(db, keyOf(b.student.id), v === sug ? undefined : v)
                          }}
                        >
                          {Array.from({ length: count }, (_, i) => count - i).map((k) => (
                            <option key={k} value={k}>
                              {k}
                              {k === sug ? '*' : ''} {frameFor(k, count, settings.seteukFrames).name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">활동 = 칭찬 수 · 메모 수. * = 앱 제안. 수준과 점수는 선생님 화면에만 보이고 AI로 보내지 않아요.</p>
        </section>
        <FramesEditor count={count} />
      </div>
    </BottomSheet>
  )
}

/** 수준별 쓰기 틀 고치기: 이름 · 목표 바이트 · 짜임 문구 · 초안 문장 수. 바꾼 틀만 설정에 둔다 */
function FramesEditor({ count }: { count: number }) {
  const { settings, updateSettings, readOnly } = useApp()
  const idx = [...new Set(Array.from({ length: count }, (_, i) => frameIndex(count - i, count)))]
  const save = (i: 1 | 2 | 3 | 4 | 5, f: LevelFrame) => updateSettings({ seteukFrames: { ...settings.seteukFrames, [i]: f } })
  const reset = (i: 1 | 2 | 3 | 4 | 5) => {
    const next = { ...settings.seteukFrames }
    delete next[i]
    updateSettings({ seteukFrames: next })
  }
  return (
    <Collapse title="수준별 쓰기 틀 고치기" sub="분량 · 짜임 · 초안 문장 수">
      <div className="space-y-3">
        {idx.map((i, n) => {
          const f = settings.seteukFrames[i] ?? DEFAULT_FRAMES[i]
          const lv = count - n
          return (
            <section key={i} className="space-y-2 rounded-2xl bg-fill p-3">
              <div className="flex items-center gap-2">
                <b className="w-6 text-lg">{lv}</b>
                <input className="field h-11 min-w-0 flex-1" value={f.name} disabled={readOnly} aria-label={`${lv}수준 이름`} onChange={(e) => save(i, { ...f, name: e.target.value })} />
                {settings.seteukFrames[i] && (
                  <button type="button" className="btn btn-ghost text-sm" disabled={readOnly} onClick={() => reset(i)}>
                    기본값
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {(
                  [
                    ['minBytes', '최소 바이트'],
                    ['maxBytes', '최대 바이트'],
                    ['maxParts', '초안 문장 수'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="label">{label}</span>
                    <input
                      className="field h-11"
                      inputMode="numeric"
                      value={f[k]}
                      disabled={readOnly}
                      onChange={(e) => {
                        const v = Number(e.target.value.replace(/[^0-9]/g, ''))
                        save(i, { ...f, [k]: k === 'maxBytes' ? Math.min(1500, v) : v })
                      }}
                    />
                  </label>
                ))}
              </div>
              <textarea className="field min-h-[80px] py-2 text-sm" value={f.guide} disabled={readOnly} aria-label={`${lv}수준 짜임`} onChange={(e) => save(i, { ...f, guide: e.target.value })} />
            </section>
          )
        })}
        <p className="hint">짜임 문구는 AI에도 그대로 보내요(수준 이름 · 숫자는 빼고). 부족한 점 · 지도 내용을 쓰라는 문구는 넣지 마세요.</p>
      </div>
    </Collapse>
  )
}
