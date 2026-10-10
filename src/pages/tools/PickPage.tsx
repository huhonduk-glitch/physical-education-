import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { pickRandom } from '../../lib/teams'
import { NumberField } from '../timer/common'
import { SourceCard, useToolPeople, type ToolPerson } from './common'

const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** 뽑기: 발표·시범·순서 정하기. 뽑힌 학생은 다음 차례에서 빼고 뽑을 수 있다 */
export default function PickPage() {
  const t = useToolPeople()
  const [n, setN] = useState(1)
  const [noRepeat, setNoRepeat] = useState(true)
  const [picked, setPicked] = useState<ToolPerson[]>([])
  const [result, setResult] = useState<ToolPerson[]>([])
  const [rolling, setRolling] = useState<ToolPerson | null>(null)
  const [big, setBig] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // 대상이 바뀌면 뽑은 기록도 처음부터
  const key = `${t.source}|${t.group?.id}|${t.count}`
  useEffect(() => {
    setPicked([])
    setResult([])
  }, [key])
  useEffect(() => () => window.clearInterval(timer.current), [])

  const pickedIds = new Set(picked.map((p) => p.id))
  const pool = noRepeat ? t.people.filter((p) => !pickedIds.has(p.id)) : t.people

  const draw = () => {
    if (pool.length === 0 || rolling) return
    const out = pickRandom(pool, n)
    const finish = () => {
      setRolling(null)
      setResult(out)
      setPicked((l) => [...l, ...out.filter((p) => !l.some((x) => x.id === p.id))])
      navigator.vibrate?.(60)
    }
    if (reduceMotion()) return finish()
    let k = 0
    timer.current = window.setInterval(() => {
      setRolling(pool[Math.floor(Math.random() * pool.length)])
      if (++k >= 14) {
        window.clearInterval(timer.current)
        finish()
      }
    }, 65)
  }

  const face = (
    <div className="flex min-h-[9rem] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center" aria-live="polite">
      {rolling ? (
        <span className="text-[min(14vw,5rem)] font-extrabold text-ink-3">{rolling.name}</span>
      ) : result.length ? (
        result.map((p) => (
          <span key={p.id} className="anim-pop text-[min(14vw,5rem)] leading-tight font-extrabold text-brand">
            {p.no && <small className="mr-2 text-[0.45em] text-ink-3 tabular-nums">{p.no}</small>}
            {p.name}
          </span>
        ))
      ) : (
        <p className="text-xl font-bold text-ink-3">아래 [뽑기]를 누르세요</p>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title="뽑기"
        back
        right={
          <button type="button" className="btn btn-soft" onClick={() => setBig(true)}>
            <Icon name="expand" /> 크게
          </button>
        }
      />
      <div className="page space-y-4 pb-8">
        <SourceCard t={t} />

        <section className="card space-y-4">
          {face}
          <button type="button" className="btn btn-primary h-16 w-full text-xl" onClick={draw} disabled={pool.length === 0 || !!rolling}>
            <Icon name="dice" size={26} /> 뽑기
          </button>
          {pool.length === 0 && t.people.length > 0 && <p className="text-center font-bold text-caution">모두 한 번씩 뽑았어요. [처음부터]를 누르세요.</p>}
          <div className="space-y-2">
            <NumberField label="한 번에" value={n} onChange={setN} min={1} max={Math.max(1, Math.min(10, t.people.length))} suffix="명" />
            <label className="flex min-h-[48px] items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
              <span className="font-bold">뽑힌 사람은 빼기</span>
            </label>
          </div>
        </section>

        {picked.length > 0 && (
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="card-title">
                뽑힌 순서 · {picked.length}/{t.people.length}명
              </p>
              <button type="button" className="btn btn-ghost text-ink-3" onClick={() => (setPicked([]), setResult([]))}>
                <Icon name="reset" size={18} /> 처음부터
              </button>
            </div>
            <ol className="flex flex-wrap gap-2">
              {picked.map((p, i) => (
                <li key={p.id} className="badge bg-fill text-ink-2">
                  <b className="mr-1 text-ink-3 tabular-nums">{i + 1}</b>
                  {p.name}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {big && (
        <div className="anim-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-8 bg-white p-6" role="dialog" aria-modal="true" aria-label="뽑기 크게 보기">
          <div className="w-full [&_span]:!text-[min(16vw,10rem)]">{face}</div>
          <div className="flex gap-3">
            <button type="button" className="btn btn-primary min-h-[64px] min-w-[160px] text-xl" onClick={draw} disabled={pool.length === 0 || !!rolling}>
              뽑기
            </button>
            <button type="button" className="btn btn-soft min-h-[64px] px-6 text-xl" onClick={() => setBig(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
