import { useState } from 'react'
import BottomSheet from '../../components/BottomSheet'
import Icon from '../../components/Icon'
import type { PlanItem } from '../../db/types'
import { summarize, type ParsedPlan } from '../../lib/planImport'
import { fitToTarget, itemsFromWeeks, type WeekRow } from '../../lib/progressPlan'

/** 학기 초 진도표(평가계획서) 파일 · 붙여넣기 → 미리보기 → 차시로 넣기 */
export default function ImportSheet({
  target,
  weeklyHours,
  hasItems,
  onClose,
  onApply,
}: {
  target: number
  weeklyHours: number
  hasItems: boolean
  onClose: () => void
  onApply: (r: { items: PlanItem[]; extras: { when: string; label: string }[]; newTarget?: number }) => void
}) {
  const [mode, setMode] = useState<'file' | 'paste'>('file')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ParsedPlan | null>(null)
  const [err, setErr] = useState('')

  const readFile = async (f: File) => {
    setBusy(true)
    setErr('')
    try {
      const { readPlanFile } = await import('../../lib/planFile')
      setRes(await readPlanFile(f, weeklyHours))
    } catch (e) {
      setErr(`파일을 읽지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const readText = async () => {
    const { readPlanText } = await import('../../lib/planFile')
    setRes(readPlanText(text, weeklyHours))
  }
  const editWeek = (i: number, p: Partial<WeekRow>) => res && setRes({ ...res, weeks: res.weeks.map((w, k) => (k === i ? { ...w, ...p } : w)) })

  const sum = res ? summarize(res) : null
  const apply = (how: 'asis' | 'fit' | 'retarget') => {
    if (!res) return
    if (hasItems && !confirm('지금 차시를 모두 지우고 파일의 진도표로 바꿀까요?')) return
    let items = itemsFromWeeks(res.weeks).items
    if (how === 'fit') items = fitToTarget(items, target).items
    onApply({ items, extras: res.extras, newTarget: how === 'retarget' ? items.length : undefined })
    onClose()
  }

  return (
    <BottomSheet title="진도표 파일로 넣기" sub="평가계획서 PDF · 엑셀 · 표 붙여넣기" onClose={onClose}>
      {!res ? (
        <div className="space-y-3">
          <div className="segment" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'file'} onClick={() => setMode('file')}>
              파일
            </button>
            <button type="button" role="tab" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>
              붙여넣기
            </button>
          </div>
          {mode === 'file' ? (
            <>
              <label className="btn btn-primary w-full cursor-pointer">
                <Icon name="upload" /> {busy ? '읽는 중…' : '파일 고르기 (PDF · 엑셀)'}
                <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </label>
              <ul className="hint list-disc space-y-1 pl-5">
                <li>평가계획서의 &lsquo;교수학습 운영 계획&rsquo; 표(주 · 단원명 · 성취기준)를 찾아 읽어요.</li>
                <li>한글 파일은 [파일 → PDF로 저장]해서 넣으세요. 스캔한 PDF는 못 읽어요.</li>
                <li>파일은 이 기기 안에서만 읽어요. 어디로도 보내지 않아요.</li>
              </ul>
            </>
          ) : (
            <>
              <textarea className="field min-h-[160px] py-3 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={'엑셀에서 머리글 줄까지 복사해 붙여 넣으세요\n예)\n주\t단원\t성취기준\n1(1)\t오리엔테이션\t\n2(2)\t배드민턴 이해하기\t[12스생2-01-01]'} />
              <button type="button" className="btn btn-primary w-full" disabled={!text.trim()} onClick={readText}>
                읽기
              </button>
            </>
          )}
          {err && <p className="font-bold text-danger">{err}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {res.warnings.map((w) => (
            <p key={w} className="rounded-2xl bg-caution-light p-3 font-bold text-caution">
              {w}
            </p>
          ))}
          {res.weeks.length > 0 && sum && (
            <>
              <p className="font-bold">
                {res.weeks.length}주 · 차시 {sum.lessons}개{sum.eventWeeks ? ` · 고사·행사 ${sum.eventWeeks}주(차시 없음)` : ''}
              </p>
              <p className="hint">단원 이름은 PDF 줄바꿈 때문에 띄어쓰기가 어긋날 수 있어요. 여기서 고쳐 주세요.</p>
              <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto">
                {res.weeks.map((w, i) => (
                  <li key={`${w.week}-${i}`} className={`rounded-xl px-3 py-2 ${w.event ? 'bg-fill-2 text-ink-3' : 'bg-fill'}`}>
                    <div className="flex items-center gap-2">
                      <b className="w-12 shrink-0 tabular-nums">{w.week}주</b>
                      {w.event ? (
                        <span className="flex-1 font-bold">{w.event}</span>
                      ) : (
                        <>
                          <input className="field h-10 min-h-0 flex-1 py-1 text-sm" value={w.unit} onChange={(e) => editWeek(i, { unit: e.target.value })} aria-label={`${w.week}주 단원`} />
                          <input className="field h-10 min-h-0 w-14 py-1 text-center text-sm tabular-nums" type="number" min={0} max={9} value={w.hours} onChange={(e) => editWeek(i, { hours: Math.max(0, Number(e.target.value) || 0) })} aria-label={`${w.week}주 시수`} />
                        </>
                      )}
                    </div>
                    {!w.event && w.standards.length > 0 && <p className="hint mt-1 pl-14">{w.standards.join(' ')}</p>}
                  </li>
                ))}
              </ul>
              {res.extras.length > 0 && <p className="hint">범교과 연계 {res.extras.length}개(사회정서 · 안전 · 인성 등)도 함께 넣어요.</p>}
              <div className="space-y-2">
                {sum.lessons !== target ? (
                  <>
                    <p className="rounded-2xl bg-caution-light p-3 text-sm font-bold text-caution">
                      파일은 {sum.lessons}차시, 진도표 목표는 {target}차시예요.
                    </p>
                    <button type="button" className="btn btn-primary w-full" onClick={() => apply('retarget')}>
                      목표를 {sum.lessons}차시로 바꾸고 넣기
                    </button>
                    <button type="button" className="btn btn-soft w-full" onClick={() => apply('fit')}>
                      목표 {target}차시에 맞춰 넣기 ({sum.lessons > target ? `뒤 ${sum.lessons - target}차시는 빼요` : `빈 차시 ${target - sum.lessons}개를 더해요`})
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary w-full" onClick={() => apply('asis')}>
                    {sum.lessons}차시로 넣기
                  </button>
                )}
              </div>
            </>
          )}
          <button type="button" className="btn btn-ghost w-full" onClick={() => setRes(null)}>
            다른 파일 고르기
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
