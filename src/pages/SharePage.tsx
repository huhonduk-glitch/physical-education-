import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { Assessment, ProgressPlan } from '../db/types'
import { SHARE_LABEL, ShareError, decodePack, unpackAssessment, unpackCalendar, unpackPlan, type SharePack } from '../lib/share'
import { WORK_KIND, mergeEvents } from '../lib/workCal'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)

/**
 * 받은 자료 넣기 (같이 쓰기 6-13): 링크(#/share?d=…)로 열리거나, 코드 · 파일을 넣는다.
 * 미리 보고 → 내 수업반을 골라 → 내 진도표 · 수행평가로 넣는다. 받은 자료는 이 기기에만 저장된다.
 */
export default function SharePage() {
  const { settings, readOnly, updateSettings } = useApp()
  const { groups } = useGroups()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [pack, setPack] = useState<SharePack | null>(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [pick, setPick] = useState<string[]>([])
  const file = useRef<HTMLInputElement>(null)

  const read = async (code: string) => {
    setErr('')
    try {
      setPack(await decodePack(code))
    } catch (e) {
      setPack(null)
      setErr(e instanceof ShareError ? e.message : '자료를 읽지 못했어요.')
    }
  }
  useEffect(() => {
    const d = sp.get('d')
    if (d) void read(d)
  }, [sp])

  const summary = (p: SharePack): string => {
    if (p.type === 'plan') {
      const d = p.data as Partial<ProgressPlan>
      return `${d.subject ?? ''} · ${d.semester ?? ''}학기 · 주 ${d.weeklyHours ?? '?'}시간 · 차시 ${d.items?.length ?? 0}개`
    }
    if (p.type === 'assessment') {
      const d = p.data as Partial<Assessment>
      const n = d.items?.length ?? d.rubric?.length ?? 0
      return `채점 요소 ${n}개${d.texts?.length ? ` · 글 칸 ${d.texts.length}개` : ''}${d.plan?.levelDescs?.length ? ` · 수행 특성 ${d.plan.levelDescs.length}개` : ''}`
    }
    return ''
  }

  const take = async () => {
    if (!pack) return
    try {
      if (pack.type === 'plan') {
        const p = unpackPlan(pack, { id: newId(), schoolYear: settings.schoolYear, groupIds: pick, now: Date.now() })
        await db.progressPlans.add(p)
        nav(`/plans/${p.id}`, { replace: true })
      } else if (pack.type === 'assessment') {
        const a = unpackAssessment(pack, { id: newId(), schoolYear: settings.schoolYear, groupIds: pick })
        await db.assessments.add(a)
        nav(`/more/assessments/${a.id}`, { replace: true })
      }
    } catch (e) {
      setErr(e instanceof ShareError ? e.message : '넣지 못했어요.')
    }
  }

  return (
    <>
      <PageHeader title="받은 자료 넣기" sub="다른 선생님이 보낸 진도표 · 수행평가 틀 · 업무 일정" back />
      <div className="page space-y-4 pb-10">
        {!pack && (
          <section className="card space-y-3">
            <p className="font-bold">받은 링크를 누르면 여기서 바로 열려요. 코드나 파일로 받았다면 넣어 주세요.</p>
            <textarea className="field min-h-[96px] w-full" placeholder="받은 링크나 코드를 붙여 넣기" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void read(text)}>
                읽기
              </button>
              <button type="button" className="btn btn-outline" onClick={() => file.current?.click()}>
                <Icon name="upload" size={18} /> 파일 고르기
              </button>
            </div>
            <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => e.target.files?.[0] && void read(await e.target.files[0].text())} />
          </section>
        )}
        {err && <p className="rounded-2xl bg-danger-light px-4 py-3 font-bold text-danger">{err}</p>}

        {pack && pack.type === 'calendar' && (
          <section className="card space-y-3">
            <div>
              <p className="text-sm font-bold text-brand">{SHARE_LABEL.calendar}</p>
              <p className="text-xl font-extrabold">{pack.name}</p>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
              {unpackCalendar(pack).map((e, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-b-0">
                  <span className="w-24 shrink-0 text-sm font-bold tabular-nums">
                    {e.date.slice(5).replace('-', '/')}
                    {e.end && e.end !== e.date ? `~${e.end.slice(5).replace('-', '/')}` : ''}
                  </span>
                  <span className="rounded px-1.5 text-xs font-bold" style={{ background: WORK_KIND[e.kind]?.bg, color: WORK_KIND[e.kind]?.fg }}>
                    {WORK_KIND[e.kind]?.label ?? '기타'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                </div>
              ))}
            </div>
            <p className="hint">내 달력에 더해요. 같은 날 · 같은 제목인 일정은 건너뛰어요.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setPack(null)}>
                다시 고르기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={readOnly}
                onClick={async () => {
                  const r = mergeEvents(settings.workEvents ?? [], unpackCalendar(pack), newId)
                  await updateSettings({ workEvents: r.list })
                  nav('/work/calendar', { replace: true })
                }}
              >
                <Icon name="calendar" size={18} /> 내 달력에 더하기
              </button>
            </div>
          </section>
        )}

        {pack && pack.type !== 'calendar' && (
          <section className="card space-y-4">
            <div>
              <p className="text-sm font-bold text-brand">{SHARE_LABEL[pack.type]}</p>
              <p className="text-xl font-extrabold">{pack.name}</p>
              <p className="hint">{summary(pack)} · 보낸 날 {new Date(pack.createdAt).toLocaleDateString('ko-KR')}</p>
            </div>
            <div className="space-y-2">
              <p className="font-bold">넣을 내 수업반 (나중에 바꿀 수 있어요)</p>
              <div className="flex flex-wrap gap-2">
                {(groups ?? []).map((g) => {
                  const on = pick.includes(g.id)
                  return (
                    <button key={g.id} type="button" className="chip" aria-pressed={on} onClick={() => setPick(on ? pick.filter((x) => x !== g.id) : [...pick, g.id])}>
                      {g.name}
                    </button>
                  )
                })}
                {(groups ?? []).length === 0 && <p className="hint">수업반이 아직 없어요. 넣은 뒤에 연결해도 돼요.</p>}
              </div>
            </div>
            <p className="hint">{pack.type === 'plan' ? '차시 계획만 들어오고, 끝낸 차시 · 빠진 수업은 처음부터예요. 학기 날짜는 설정에서 내 학교에 맞게 고쳐 주세요.' : '채점 기준만 들어오고, 점수는 내 학생으로 새로 채점해요.'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-outline" onClick={() => setPack(null)}>
                다시 고르기
              </button>
              <button type="button" className="btn btn-primary" disabled={readOnly} onClick={() => void take()}>
                <Icon name="download" size={18} /> 내 것으로 넣기
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
