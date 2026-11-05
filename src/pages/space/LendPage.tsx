import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { addDays, todayStr } from '../../lib/dates'
import { SpaceError, deleteItem, gearLeft, lendStatus, putItem, rowId, type Gear, type Lend, type SpaceRow } from '../../lib/space'
import { useSpace } from '../../state/useSpace'

/**
 * 교구 · 시설 대여 장부 (학교 공유 공간 6-13): 교구 목록 · 지금 빌린 것 · 지난 기록.
 * 같은 공간의 선생님 모두가 같은 장부를 본다(30초마다 새로 받음). 학생 정보는 적지 않는다.
 */
export default function LendPage() {
  const gear = useSpace<Gear>('gear')
  const lend = useSpace<Lend>('lend')
  const [tab, setTab] = useState<'out' | 'gear' | 'past'>('out')
  const [sheet, setSheet] = useState<{ kind: 'gear'; row?: SpaceRow<Gear> } | { kind: 'lend'; gear?: SpaceRow<Gear> } | null>(null)
  const [err, setErr] = useState('')
  const today = todayStr()
  const conn = gear.conn

  if (!conn)
    return (
      <>
        <PageHeader title="교구 대여 장부" back />
        <div className="page">
          <Link to="/work/space" className="card flex items-center gap-3">
            <Icon name="share" className="text-brand" />
            <span className="flex-1 font-bold">먼저 학교 공유 공간에 연결해 주세요</span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        </div>
      </>
    )

  const gears = gear.rows ?? []
  const lends = [...(lend.rows ?? [])].sort((a, b) => b.data.from.localeCompare(a.data.from))
  const left = gearLeft(gears, lends)
  const out = lends.filter((l) => !l.data.returned)
  const past = lends.filter((l) => l.data.returned)
  const act = async (f: () => Promise<unknown>) => {
    setErr('')
    try {
      await f()
      await Promise.all([gear.reload(), lend.reload()])
    } catch (e) {
      setErr(e instanceof SpaceError ? e.message : '저장하지 못했어요.')
    }
  }

  return (
    <>
      <PageHeader
        title="교구 대여 장부"
        sub={`${conn.name} · 같이 보는 장부`}
        back
        right={
          <button type="button" className="btn btn-soft" aria-label="새로 받기" onClick={() => void Promise.all([gear.reload(), lend.reload()])}>
            <Icon name="reset" />
          </button>
        }
      />
      <div className="page space-y-4 pb-10">
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: '빌려 간 것', n: out.length, c: '' },
            { l: '반납 늦음', n: out.filter((x) => lendStatus(x.data, today) === 'overdue').length, c: 'text-danger' },
            { l: '교구 종류', n: gears.length, c: '' },
          ].map((s) => (
            <div key={s.l} className="card px-3 py-3 text-center">
              <p className={`text-2xl font-black tabular-nums ${s.n && s.c ? s.c : ''}`}>{s.n}</p>
              <p className="text-xs font-bold text-ink-3">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="segment" role="tablist">
          {(
            [
              ['out', `빌린 것 ${out.length}`],
              ['gear', '교구 목록'],
              ['past', '지난 기록'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        {(gear.err || lend.err || err) && <p className="rounded-2xl bg-danger-light px-4 py-3 font-bold text-danger">{gear.err || lend.err || err}</p>}

        {tab === 'out' && (
          <section className="space-y-2">
            <button type="button" className="btn btn-primary w-full" disabled={!gears.length} onClick={() => setSheet({ kind: 'lend' })}>
              <Icon name="plus" size={18} /> 빌려 가기 기록
            </button>
            {!gears.length && <p className="hint px-1">먼저 [교구 목록]에서 교구를 넣어 주세요.</p>}
            <div className="card overflow-hidden p-0">
              {out.map((l) => {
                const st = lendStatus(l.data, today)
                return (
                  <div key={l.id} className="list-row min-h-[64px]">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">
                        {l.data.gearName} {l.data.qty}개 · {l.data.teacher}
                      </b>
                      <span className={`block text-sm ${st === 'overdue' ? 'font-bold text-danger' : 'text-ink-3'}`}>
                        {l.data.from.slice(5).replace('-', '/')} 빌림 · 반납 {l.data.due.slice(5).replace('-', '/')}
                        {st === 'overdue' ? ' (늦음)' : ''}
                        {l.data.memo ? ` · ${l.data.memo}` : ''}
                      </span>
                    </span>
                    <button type="button" className="btn btn-outline h-11 min-h-0 shrink-0 px-3 text-sm" onClick={() => void act(() => putItem(conn, 'lend', l.id, { ...l.data, returned: today }))}>
                      반납
                    </button>
                  </div>
                )
              })}
              {out.length === 0 && <p className="hint p-4">빌려 간 교구가 없어요.</p>}
            </div>
          </section>
        )}

        {tab === 'gear' && (
          <section className="space-y-2">
            <button type="button" className="btn btn-primary w-full" onClick={() => setSheet({ kind: 'gear' })}>
              <Icon name="plus" size={18} /> 교구 넣기
            </button>
            <div className="card overflow-hidden p-0">
              {gears.map((g) => {
                const n = left.get(g.id) ?? g.data.qty
                return (
                  <div key={g.id} className="list-row min-h-[60px]">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSheet({ kind: 'gear', row: g })}>
                      <b className="block truncate">{g.data.name}</b>
                      <span className="hint block">
                        {g.data.place ? `${g.data.place} · ` : ''}전체 {g.data.qty}개
                      </span>
                    </button>
                    <span className={`shrink-0 text-right font-black tabular-nums ${n <= 0 ? 'text-danger' : n < g.data.qty ? 'text-caution' : 'text-ok'}`}>
                      {n}
                      <span className="block text-xs font-bold text-ink-3">남음</span>
                    </span>
                    <button type="button" className="btn btn-soft h-11 min-h-0 shrink-0 px-3 text-sm" disabled={n <= 0} onClick={() => setSheet({ kind: 'lend', gear: g })}>
                      빌리기
                    </button>
                  </div>
                )
              })}
              {gears.length === 0 && <p className="hint p-4">교구가 아직 없어요. 농구공 · 배구공 · 콘 · 조끼처럼 넣어 주세요.</p>}
            </div>
          </section>
        )}

        {tab === 'past' && (
          <div className="card overflow-hidden p-0">
            {past.slice(0, 100).map((l) => (
              <div key={l.id} className="list-row min-h-[56px]">
                <span className="min-w-0 flex-1">
                  <b className="block truncate">
                    {l.data.gearName} {l.data.qty}개 · {l.data.teacher}
                  </b>
                  <span className="hint block">
                    {l.data.from.slice(5).replace('-', '/')} ~ {l.data.returned?.slice(5).replace('-', '/')} 반납
                  </span>
                </span>
                <button type="button" className="btn btn-ghost h-10 min-h-0 px-2 text-ink-3" aria-label="기록 지우기" onClick={() => confirm('이 기록을 지울까요?') && void act(() => deleteItem(conn, 'lend', l.id))}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
            {past.length === 0 && <p className="hint p-4">지난 기록이 없어요.</p>}
          </div>
        )}
        <p className="hint text-center">같은 공유 공간의 선생님 모두가 이 장부를 봐요 · 30초마다 새로 받아요 · 학생 이름은 적지 마세요</p>
      </div>

      {sheet?.kind === 'gear' && (
        <GearSheet
          row={sheet.row}
          onClose={() => setSheet(null)}
          onSave={(g) => act(() => putItem(conn, 'gear', sheet.row?.id ?? rowId(), g)).then(() => setSheet(null))}
          onRemove={sheet.row ? () => act(() => deleteItem(conn, 'gear', sheet.row!.id)).then(() => setSheet(null)) : undefined}
        />
      )}
      {sheet?.kind === 'lend' && (
        <LendSheet
          gears={gears}
          left={left}
          first={sheet.gear}
          me={conn.me}
          today={today}
          onClose={() => setSheet(null)}
          onSave={(l) => act(() => putItem(conn, 'lend', rowId(), l)).then(() => {
            setSheet(null)
            setTab('out')
          })}
        />
      )}
    </>
  )
}

function GearSheet({ row, onClose, onSave, onRemove }: { row?: SpaceRow<Gear>; onClose: () => void; onSave: (g: Gear) => void; onRemove?: () => void }) {
  const [g, setG] = useState<Gear>(row?.data ?? { name: '', qty: 1 })
  return (
    <BottomSheet title={row ? '교구 고치기' : '교구 넣기'} onClose={onClose}>
      <div className="space-y-3 px-5 pb-5">
        <input className="field w-full" placeholder="교구 이름 (예: 농구공 7호)" value={g.name} autoFocus onChange={(e) => setG({ ...g, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" inputMode="numeric" placeholder="수량" value={g.qty || ''} onChange={(e) => setG({ ...g, qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
          <input className="field" placeholder="보관 장소 (선택)" value={g.place ?? ''} onChange={(e) => setG({ ...g, place: e.target.value || undefined })} />
        </div>
        <button type="button" className="btn btn-primary w-full" disabled={!g.name.trim() || g.qty < 1} onClick={() => onSave({ ...g, name: g.name.trim() })}>
          저장
        </button>
        {onRemove && (
          <button type="button" className="btn btn-ghost w-full text-danger" onClick={() => confirm('이 교구를 목록에서 뺄까요?') && onRemove()}>
            <Icon name="trash" size={18} /> 목록에서 빼기
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

function LendSheet({ gears, left, first, me, today, onClose, onSave }: { gears: SpaceRow<Gear>[]; left: Map<string, number>; first?: SpaceRow<Gear>; me: string; today: string; onClose: () => void; onSave: (l: Lend) => void }) {
  const [gid, setGid] = useState(first?.id ?? gears[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [due, setDue] = useState(addDays(today, 7))
  const [memo, setMemo] = useState('')
  const g = gears.find((x) => x.id === gid)
  const max = g ? (left.get(g.id) ?? g.data.qty) : 0
  return (
    <BottomSheet title="빌려 가기 기록" sub={`${me} 선생님 · 오늘`} onClose={onClose}>
      <div className="space-y-3 px-5 pb-5">
        <select className="field w-full" value={gid} onChange={(e) => setGid(e.target.value)}>
          {gears.map((x) => (
            <option key={x.id} value={x.id}>
              {x.data.name} (남음 {left.get(x.id) ?? x.data.qty})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-sm font-bold text-ink-2">수량</span>
            <input className="field w-full" inputMode="numeric" value={qty || ''} onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-ink-2">반납 예정</span>
            <input className="field w-full" type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <input className="field w-full" placeholder="용도 (선택, 예: 2학년 농구 수업) — 학생 이름은 적지 마세요" value={memo} onChange={(e) => setMemo(e.target.value)} />
        {qty > max && <p className="text-sm font-bold text-danger">남은 수량({max}개)보다 많아요.</p>}
        <button type="button" className="btn btn-primary w-full" disabled={!g || qty < 1 || qty > max} onClick={() => g && onSave({ gearId: g.id, gearName: g.data.name, qty, teacher: me, from: today, due, ...(memo.trim() ? { memo: memo.trim().slice(0, 60) } : {}) })}>
          빌려 가기
        </button>
      </div>
    </BottomSheet>
  )
}
