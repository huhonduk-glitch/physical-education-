import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Collapse from '../../components/Collapse'
import GroupPicker from '../../components/GroupPicker'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { setDone, toggleGroupSkip, updatePlan } from '../../db/plansRepo'
import type { PlanItem } from '../../db/types'
import { shortDateLabel, todayStr } from '../../lib/dates'
import { saveXlsx } from '../../lib/download'
import { fitToTarget, groupProgress, itemsFromUnits, meetings, moveItem, newItemId, planRows, schedule, standardCoverage, unitBlocks } from '../../lib/progressPlan'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'
import ImportSheet from './ImportSheet'
import ItemSheet, { subjectStandards } from './ItemSheet'

type Tab = 'items' | 'dates' | 'compare'

/** 진도표: 차시 계획 · 반별 날짜와 진도 · 반별 비교 (6-5) */
export default function PlanPage() {
  const { id = '' } = useParams()
  const { settings, readOnly } = useApp()
  const plan = useLiveQuery(() => db.progressPlans.get(id), [id])
  const { groups } = useGroups(true)
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('t') as Tab) || 'items'
  const setTab = (t: Tab) => setSp((p) => (p.set('t', t), p), { replace: true })
  const planGroups = useMemo(() => (groups ?? []).filter((g) => plan?.groupIds.includes(g.id)), [groups, plan])
  const gid = sp.get('g') && planGroups.some((g) => g.id === sp.get('g')) ? sp.get('g')! : (planGroups[0]?.id ?? null)
  const setGid = (g: string) => setSp((p) => (p.set('g', g), p), { replace: true })
  const [editing, setEditing] = useState<number | null>(null)
  const [quick, setQuick] = useState(false)
  const [importing, setImporting] = useState(false)
  const today = todayStr()

  if (plan === undefined) return <PageHeader title="진도표" back />
  if (plan === null || !plan) return <PageHeader title="진도표를 찾을 수 없어요" back />

  const items = plan.items
  const saveItems = (next: PlanItem[]) => updatePlan(db, plan.id, { items: next })
  const units = [...new Set(items.map((i) => i.unit).filter(Boolean))]
  const stdCodes = subjectStandards(plan.subject, settings.schoolLevel).map((s) => s.code)
  const coverage = standardCoverage(items, stdCodes)

  const schedFor = (groupId: string) => schedule(items, meetings(groupId, settings.timetable, plan, plan.skips[groupId]))

  const exportXlsx = async () => {
    const sheets = planGroups.length
      ? planGroups.map((g) => ({ name: g.name.slice(0, 28), rows: planRows(schedFor(g.id), plan.done[g.id] ?? []), widths: [5, 11, 5, 18, 40, 22, 12, 22, 5] }))
      : [{ name: '진도표', rows: planRows(schedule(items, [])), widths: [5, 11, 5, 18, 40, 22, 12, 22, 5] }]
    await saveXlsx(`진도표_${plan.title.replace(/\s+/g, '')}_${plan.schoolYear}-${plan.semester}.xlsx`, sheets)
  }

  const fit = () => {
    const r = fitToTarget(items, plan.target)
    if (r.cut && !confirm(`목표 ${plan.target}차시보다 ${r.cut}차시 많아요. 맨 뒤 ${r.cut}차시를 지울까요?`)) return
    saveItems(r.items)
  }

  return (
    <>
      <PageHeader
        title={plan.title}
        sub={`${plan.grade ? `${plan.grade}학년 · ` : ''}${plan.semester}학기 · 주 ${plan.weeklyHours}시간 · ${items.length}/${plan.target}차시`}
        back
        right={
          <>
            <button type="button" className="btn btn-soft" onClick={exportXlsx} aria-label="엑셀로 받기">
              <Icon name="download" />
            </button>
            <Link to={`/plans/${plan.id}/setup`} className="btn btn-soft" aria-label="진도표 설정">
              <Icon name="settings" />
            </Link>
          </>
        }
      />
      <div className="page space-y-4 pb-8">
        <div className="segment" role="tablist">
          {(
            [
              ['items', '차시 계획'],
              ['dates', '날짜 · 진도'],
              ['compare', '반별 비교'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <>
            {items.length !== plan.target && (
              <section className="flex items-center gap-3 rounded-2xl bg-caution-light p-4">
                <p className="flex-1 font-bold text-caution">
                  목표 {plan.target}차시인데 {items.length}차시예요 ({items.length > plan.target ? `${items.length - plan.target} 많음` : `${plan.target - items.length} 모자람`}).
                </p>
                {!readOnly && (
                  <button type="button" className="btn btn-soft shrink-0" onClick={fit}>
                    맞추기
                  </button>
                )}
              </section>
            )}
            {!readOnly && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`btn col-span-2 ${items.length ? 'btn-soft' : 'btn-primary'}`} onClick={() => setImporting(true)}>
                  <Icon name="upload" /> 평가계획서 · 진도표 파일로 넣기
                </button>
                <button type="button" className="btn btn-soft" onClick={() => setQuick(true)}>
                  <Icon name="layers" /> 단원으로 만들기
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => {
                    saveItems([...items, { id: newItemId(), unit: items[items.length - 1]?.unit ?? '', content: '', standards: [] }])
                    setEditing(items.length)
                  }}
                >
                  <Icon name="plus" /> 차시 더하기
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <p className="hint px-1">아직 차시가 없어요. [단원으로 빨리 만들기]로 단원과 시수만 적으면 차시가 한 번에 생겨요.</p>
            ) : (
              <section className="card overflow-hidden p-0">
                <ul>
                  {unitBlocks(items).map((b) => (
                    <li key={`${b.from}-${b.unit}`}>
                      <p className="bg-fill px-5 py-2 text-sm font-extrabold text-ink-2">
                        {b.unit || '단원 없음'} <span className="font-semibold text-ink-3 tabular-nums">· {b.from === b.to ? `${b.from}차시` : `${b.from}~${b.to}차시`}</span>
                      </p>
                      <ul>
                        {items.slice(b.from - 1, b.to).map((it, k) => {
                          const i = b.from - 1 + k
                          return (
                            <li key={it.id}>
                              <button type="button" className="list-row w-full text-left hover:bg-fill" onClick={() => setEditing(i)}>
                                <span className="w-10 shrink-0 text-center font-extrabold text-ink-2 tabular-nums">{i + 1}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">{it.content || <span className="text-ink-3">내용 없음</span>}</span>
                                  {(it.standards.length > 0 || it.method || it.evalNote) && (
                                    <span className="hint block truncate">{[it.standards.join(' '), it.method, it.evalNote].filter(Boolean).join(' · ')}</span>
                                  )}
                                </span>
                                {it.lockedDate && (
                                  <span className="badge bg-brand-light text-brand">
                                    <Icon name="lock" size={14} /> {shortDateLabel(it.lockedDate)}
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(plan.extras?.length ?? 0) > 0 && (
              <Collapse title="범교과 연계" sub={`${plan.extras!.length}개 · 사회정서 · 안전 · 인성 등`}>
                <ul className="space-y-1.5">
                  {plan.extras!.map((e, i) => (
                    <li key={i} className="flex gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
                      <b className="w-24 shrink-0">{e.when}</b>
                      <span className="flex-1">{e.label}</span>
                    </li>
                  ))}
                </ul>
              </Collapse>
            )}

            {stdCodes.length > 0 && (
              <Collapse title="성취기준 진도" sub={`${coverage.filter((c) => c.count > 0).length}/${coverage.length}개를 계획에 넣음`}>
                <ul className="space-y-1.5">
                  {coverage.map((c) => (
                    <li key={c.code} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${c.count ? 'bg-fill' : 'bg-caution-light'}`}>
                      <b className="tabular-nums">{c.code}</b>
                      <span className="flex-1" />
                      <span className={c.count ? 'text-ink-2' : 'font-bold text-caution'}>{c.count ? `${c.count}차시` : '아직 없음'}</span>
                    </li>
                  ))}
                </ul>
              </Collapse>
            )}
          </>
        )}

        {tab === 'dates' && (
          <>
            {planGroups.length === 0 ? (
              <section className="card space-y-2">
                <p className="font-bold">이 진도표를 쓰는 수업반이 없어요.</p>
                <Link to={`/plans/${plan.id}/setup`} className="btn btn-soft w-full">
                  수업반 고르기
                </Link>
              </section>
            ) : (
              <>
                <GroupPicker groups={planGroups} value={gid} onChange={setGid} />
                {gid && <GroupDates key={gid} planId={plan.id} groupId={gid} sched={schedFor(gid)} done={plan.done[gid] ?? []} skips={plan.skips[gid] ?? []} today={today} readOnly={readOnly} noSlots={!settings.timetable.some((t) => t.groupId === gid)} />}
              </>
            )}
          </>
        )}

        {tab === 'compare' && (
          <section className="card overflow-hidden p-0">
            {planGroups.length === 0 && <p className="hint p-5">연결한 수업반이 없어요.</p>}
            <ul>
              {planGroups.map((g) => {
                const pr = groupProgress(schedFor(g.id), plan.done[g.id] ?? [], today)
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="list-row w-full text-left hover:bg-fill"
                      onClick={() => {
                        setGid(g.id)
                        setTab('dates')
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{g.name}</b>
                        <span className="hint">
                          끝냄 {pr.done}차시 · 오늘까지 계획 {pr.planned}차시{pr.overflow ? ` · 학기 안에 자리 없음 ${pr.overflow}` : ''}
                        </span>
                      </span>
                      <span className={`badge ${pr.diff < 0 ? 'bg-danger-light text-danger' : pr.diff > 0 ? 'bg-brand-light text-brand' : 'bg-ok-light text-ok'}`}>
                        {pr.diff < 0 ? `${-pr.diff}차시 늦음` : pr.diff > 0 ? `${pr.diff}차시 빠름` : '계획대로'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {editing !== null && items[editing] && (
        <ItemSheet
          key={items[editing].id}
          item={items[editing]}
          no={editing + 1}
          subject={plan.subject}
          school={settings.schoolLevel}
          units={units}
          readOnly={readOnly}
          onClose={() => setEditing(null)}
          onSave={(it) => saveItems(items.map((x) => (x.id === it.id ? it : x)))}
          onMove={(dir) => {
            const to = editing + dir
            if (to < 0 || to >= items.length) return
            saveItems(moveItem(items, editing, to))
            setEditing(to)
          }}
          onInsertAfter={() => {
            const a = [...items]
            a.splice(editing + 1, 0, { id: newItemId(), unit: items[editing].unit, content: '', standards: [...items[editing].standards] })
            saveItems(a)
            setEditing(editing + 1)
          }}
          onDelete={() => {
            if (!confirm(`${editing + 1}차시를 지울까요? 뒤 차시가 한 칸씩 당겨져요.`)) return
            saveItems(items.filter((_, i) => i !== editing))
            setEditing(null)
          }}
        />
      )}
      {importing && (
        <ImportSheet
          target={plan.target}
          weeklyHours={plan.weeklyHours}
          hasItems={items.length > 0}
          onClose={() => setImporting(false)}
          onApply={(r) => updatePlan(db, plan.id, { items: r.items, extras: r.extras.length ? r.extras : plan.extras, ...(r.newTarget ? { target: r.newTarget } : {}) })}
        />
      )}
      {quick && <QuickSheet hasItems={items.length > 0} target={plan.target} onClose={() => setQuick(false)} onApply={(next, mode) => saveItems(mode === 'replace' ? next : [...items, ...next])} />}
    </>
  )
}

/** 한 수업반의 차시별 날짜 · 끝냄 · 빠짐(밀기) */
function GroupDates({
  planId,
  groupId,
  sched,
  done,
  skips,
  today,
  readOnly,
  noSlots,
}: {
  planId: string
  groupId: string
  sched: ReturnType<typeof schedule>
  done: string[]
  skips: string[]
  today: string
  readOnly: boolean
  noSlots: boolean
}) {
  const doneSet = new Set(done)
  const pr = groupProgress(sched, done, today)
  if (noSlots)
    return (
      <section className="card space-y-2">
        <p className="font-bold">수업 시간표에 이 반 칸이 없어요.</p>
        <p className="hint">시간표에 요일·교시를 넣으면 차시마다 날짜가 채워져요.</p>
        <Link to="/more/settings/timetable" className="btn btn-soft w-full">
          수업 시간표 열기
        </Link>
      </section>
    )
  return (
    <>
      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          { l: '끝낸 차시', n: pr.lastDone, c: 'text-ink' },
          { l: '오늘까지 계획', n: pr.planned, c: 'text-ink-2' },
          { l: pr.diff < 0 ? '늦음' : '빠름', n: Math.abs(pr.diff), c: pr.diff < 0 ? 'text-danger' : 'text-brand' },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl bg-fill py-3">
            <p className={`text-2xl font-extrabold tabular-nums ${x.c}`}>{x.n}</p>
            <p className="text-[0.75rem] font-bold text-ink-3">{x.l}</p>
          </div>
        ))}
      </section>
      <p className="hint px-1">행사·휴강으로 수업이 빠지면 그 줄의 [빠짐]을 누르세요. 뒤 차시가 한 칸씩 밀려요. 다시 누르면 되돌아와요.</p>
      <section className="card overflow-hidden p-0">
        <ul>
          {sched.map((s) => {
            const isToday = s.meeting?.date === today
            const on = doneSet.has(s.item.id)
            return (
              <li key={s.item.id} className={isToday ? 'bg-brand-light' : ''}>
                <div className="list-row">
                  <button
                    type="button"
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? 'bg-ok text-white' : 'bg-fill text-ink-3'}`}
                    aria-pressed={on}
                    aria-label={`${s.no}차시 ${on ? '끝냄 취소' : '끝냄'}`}
                    onClick={() => setDone(db, planId, groupId, s.item.id, !on)}
                    disabled={readOnly}
                  >
                    <Icon name="check" size={20} />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      <b className="tabular-nums">{s.no}차시</b> {s.item.content || s.item.unit}
                    </span>
                    <span className={`hint block ${s.meeting ? '' : 'font-bold text-danger'}`}>
                      {s.meeting ? `${shortDateLabel(s.meeting.date)} ${s.meeting.period}교시${isToday ? ' · 오늘' : ''}` : '학기 안에 자리 없음'}
                      {s.item.lockedDate ? ' · 고정' : ''}
                    </span>
                  </span>
                  {s.meeting && !s.item.lockedDate && !readOnly && (
                    <button type="button" className="btn btn-ghost shrink-0 px-3 text-sm" onClick={() => toggleGroupSkip(db, planId, groupId, s.meeting!)}>
                      빠짐
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      {skips.length > 0 && (
        <section className="card space-y-2">
          <p className="card-title">빠진 수업 {skips.length}번</p>
          <div className="flex flex-wrap gap-1.5">
            {skips.map((k) => {
              const [date, period] = k.split('|')
              return (
                <button key={k} type="button" className="badge bg-fill text-ink-2" onClick={() => toggleGroupSkip(db, planId, groupId, { date, period: Number(period) })} disabled={readOnly}>
                  {shortDateLabel(date)} {period}교시 · 되돌리기
                </button>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

/** 단원 이름 + 시수만 적어 차시 만들기 */
function QuickSheet({ hasItems, target, onClose, onApply }: { hasItems: boolean; target: number; onClose: () => void; onApply: (items: PlanItem[], mode: 'replace' | 'append') => void }) {
  const [rows, setRows] = useState([{ unit: '', hours: '' }])
  const units = rows.filter((r) => r.unit.trim() && Number(r.hours) > 0).map((r) => ({ unit: r.unit, hours: Number(r.hours) }))
  const total = units.reduce((n, u) => n + u.hours, 0)
  const apply = (mode: 'replace' | 'append') => {
    if (mode === 'replace' && hasItems && !confirm('지금 차시를 모두 지우고 새로 만들까요?')) return
    onApply(itemsFromUnits(units), mode)
    onClose()
  }
  return (
    <BottomSheet title="단원으로 빨리 만들기" sub="단원 이름과 시수만 적으면 차시가 생겨요" onClose={onClose}>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className="field flex-1" value={r.unit} placeholder={i === 0 ? '예: 오리엔테이션' : '단원 이름'} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))} />
            <input className="field w-20 tabular-nums" type="number" inputMode="numeric" min={1} value={r.hours} placeholder="시수" onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, hours: e.target.value } : x)))} />
          </div>
        ))}
        <button type="button" className="btn btn-soft w-full" onClick={() => setRows([...rows, { unit: '', hours: '' }])}>
          <Icon name="plus" /> 단원 더하기
        </button>
        <p className={`text-center font-bold tabular-nums ${total === target ? 'text-ok' : 'text-ink-2'}`}>
          합계 {total}차시 / 목표 {target}차시
        </p>
        <div className={`grid gap-2 ${hasItems ? 'grid-cols-2' : ''}`}>
          {hasItems && (
            <button type="button" className="btn btn-soft" disabled={!total} onClick={() => apply('append')}>
              뒤에 붙이기
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={!total} onClick={() => apply('replace')}>
            {hasItems ? '새로 만들기' : '만들기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}


