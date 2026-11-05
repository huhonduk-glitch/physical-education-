import { useMemo, useRef, useState } from 'react'
import Collapse from '../components/Collapse'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import {
  BudgetFileError,
  DEFAULT_LAYOUT,
  dropdownList,
  groupItems,
  isManual,
  isPicked,
  manualItem,
  mergeManual,
  money,
  nameRange,
  parseBudgetCard,
  parseCell,
  pasteRange,
  sheetLabel,
  sheetRows,
  toTsv,
  type BudgetItem,
  type SheetLayout,
} from '../lib/budget'
import { copyText, saveXlsx } from '../lib/download'
import { readGridsFromFile } from '../lib/rosterFile'
import { useApp } from '../state/AppContext'

const won = (n: number) => n.toLocaleString('ko-KR')
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '-')

/**
 * 체육 예산 현황 (6-11 D, 2026-11-04 교사 요청)
 * 에듀파인 사업관리카드(예산) 엑셀 → 체육 항목만 → 선생님들이 같이 쓰는 구글 시트의 예산 요약 표(수식 포함)로 복사.
 * 파일은 이 기기에서만 읽는다. 서버 · 인터넷 없음. 선생님별 신청은 지금처럼 구글 시트에서.
 */
export default function BudgetPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const saved = settings.budgetCard
  const picks = settings.budgetPicks
  const layout: SheetLayout = { ...DEFAULT_LAYOUT, ...settings.budgetLayout }
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const manual = settings.budgetManual ?? []
  const items = useMemo(() => mergeManual(saved?.card.items ?? [], manual), [saved, manual])
  const picked = useMemo(() => items.filter((x) => isPicked(x, picks)), [items, picks])
  const others = items.filter((x) => !isPicked(x, picks))
  const groups = groupItems(picked)
  const sum = picked.reduce((a, x) => ({ budget: a.budget + x.budget, spent: a.spent + x.spent, left: a.left + x.left }), { budget: 0, spent: 0, left: 0 })
  const rows = useMemo(() => sheetRows(picked, layout), [picked, layout])

  const onFile = async (f: File) => {
    setErr('')
    setMsg('')
    try {
      const sheets = await readGridsFromFile(await f.arrayBuffer(), f.name)
      let card = null
      for (const s of sheets) {
        try {
          card = parseBudgetCard(s.grid)
          break
        } catch {
          /* 다음 시트 */
        }
      }
      if (!card) card = parseBudgetCard(sheets[0]?.grid ?? [])
      await updateSettings({ budgetCard: { fetchedAt: Date.now(), fileName: f.name, card } })
      setMsg(`${card.items.length}개 항목을 읽었어요. 체육 항목을 확인해 주세요.`)
    } catch (e) {
      setErr(e instanceof BudgetFileError ? e.message : e instanceof Error ? e.message : '파일을 읽지 못했어요.')
    }
  }

  const [editing, setEditing] = useState<BudgetItem | null>(null)
  const saveManual = async (it: BudgetItem) => {
    const i = manual.findIndex((x) => x.key === it.key)
    await updateSettings({ budgetManual: i >= 0 ? manual.map((x, j) => (j === i ? it : x)) : [...manual, it] })
    setEditing(null)
    setMsg(i >= 0 ? `'${it.name}' 항목을 고쳤어요.` : `'${it.name}' 항목을 더했어요.`)
  }
  const removeManual = async (it: BudgetItem) => {
    if (!confirm(`'${it.name}' 항목을 지울까요?`)) return
    await updateSettings({ budgetManual: manual.filter((x) => x.key !== it.key) })
    setEditing(null)
  }
  const details = [...new Set(items.map((x) => x.detail.replace(/^\(통합\)/, '')))]

  const toggle = (it: BudgetItem) => void updateSettings({ budgetPicks: { ...picks, [it.key]: !isPicked(it, picks) } })
  const setLayout = (p: Partial<SheetLayout>) => void updateSettings({ budgetLayout: { ...layout, ...p } })

  const copy = async (text: string, done: string) => setMsg((await copyText(text)) ? done : '복사하지 못했어요. 엑셀로 받아서 붙여 넣어 주세요.')

  return (
    <>
      <PageHeader title="체육 예산 현황" sub={saved ? `${saved.fileName} · ${new Date(saved.fetchedAt).toLocaleDateString('ko-KR')}` : '에듀파인 사업관리카드'} back />
      <div className="page space-y-4 pb-10">
        <section className="card space-y-2">
          <p className="font-bold">에듀파인 → 사업관리카드(예산) 엑셀을 넣어 주세요</p>
          <p className="hint">
            체육 · 건강체력 · 스포츠 항목만 골라, 선생님들이 같이 쓰는 구글 시트의 예산 요약 표(수식 포함)로 만들어요. 파일은 이 기기에서만 읽고 인터넷으로 보내지 않아요.
          </p>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          <button type="button" className="btn btn-primary w-full" disabled={readOnly} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {saved ? '새 파일 넣기' : '파일 넣기'}
          </button>
          {err && <p className="text-sm font-bold text-danger">{err}</p>}
          {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
        </section>

        <Collapse
          key={editing?.key ?? 'new'}
          defaultOpen={!saved || !!editing}
          title={editing ? `'${editing.name}' 고치기` : '엑셀 없이 직접 입력'}
          sub="세부사업 · 산출내역 · 예산현액 · 집행액을 손으로 적어요"
        >
          <ManualForm
            initial={editing}
            details={details}
            disabled={readOnly}
            onSave={saveManual}
            onCancel={editing ? () => setEditing(null) : undefined}
            onRemove={editing ? () => void removeManual(editing) : undefined}
          />
        </Collapse>

        {items.length > 0 && (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="체육 예산현액" value={won(sum.budget)} />
              <Tile label="집행(원인행위)" value={won(sum.spent)} />
              <Tile label="남은 돈" value={won(sum.left)} warn={sum.left < 0} />
              <Tile label="집행률" value={pct(sum.spent, sum.budget)} />
            </section>

            <section className="space-y-2">
              <p className="px-1 text-sm font-bold text-ink-3">체육 항목 {picked.length}개 · 누르면 빼기 (직접 입력한 항목은 누르면 고치기)</p>
              {groups.length === 0 && <p className="card hint">고른 항목이 없어요. 아래 '다른 항목'에서 골라 주세요.</p>}
              {groups.map((g, gi) => (
                <div key={`${gi}-${g.unit}-${g.detail}`} className="card overflow-hidden p-0">
                  <div className="flex items-center justify-between gap-2 border-b border-line bg-fill px-4 py-2">
                    <b className="min-w-0 truncate">{g.detail.replace(/^\(통합\)/, '')}</b>
                    <span className={`shrink-0 text-sm font-bold ${g.left < 0 ? 'text-danger' : 'text-ink-2'}`}>잔액 {won(g.left)}</span>
                  </div>
                  {g.items.map((it) => (
                    <ItemRow
                      key={it.key}
                      it={it}
                      on
                      manual={isManual(it)}
                      onToggle={() => {
                        if (isManual(it)) {
                          setEditing(it)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        } else toggle(it)
                      }}
                      disabled={readOnly}
                    />
                  ))}
                </div>
              ))}
            </section>

            {others.length > 0 && (
              <Collapse title={`다른 항목 ${others.length}개`} sub="체육 항목인데 빠졌으면 눌러서 넣기 (예: 서포터즈 동아리)">
                <div className="card overflow-hidden p-0">
                  {others.map((it) => (
                    <ItemRow key={it.key} it={it} on={false} onToggle={() => toggle(it)} disabled={readOnly} />
                  ))}
                </div>
              </Collapse>
            )}

            <section className="card space-y-3">
              <p className="font-bold">구글 시트에 붙여 넣기</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                <li>
                  [표 복사] → 시트의 <b>{layout.startCell}</b> 칸을 누르고 붙여 넣기 (범위 {pasteRange(rows, layout)}). 예전 표가 있던 자리면 예전 표를 먼저 지우세요(지출 예정금액 메모는 따로 옮겨 두기).
                </li>
                <li>지출금액 · 예산잔액 · 총 잔액은 수식이라 품목을 적으면 바로 계산돼요.</li>
                <li>
                  품목의 '예산항목' 드롭다운: 데이터 → 데이터 확인 → 기준을 <b>범위의 드롭다운</b> {nameRange(picked.length, layout)}로 바꾸면 산출내역과 이름이 꼭 맞아요. 이름이 바뀐 예전 줄은 다시 골라 주세요(띄어쓰기 하나만 달라도 지출금액에 안 들어가요).
                </li>
                {layout.withEdufine && <li>'에듀파인 집행액'은 파일을 넣은 날 값이에요. 차이가 0이 아니면 시트와 에듀파인 중 빠진 품목이 있는지 보세요.</li>}
              </ol>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-primary" disabled={!picked.length} onClick={() => void copy(toTsv(rows), `표를 복사했어요. 시트 ${layout.startCell} 칸에 붙여 넣으세요.`)}>
                  <Icon name="copy" size={18} /> 표 복사
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!picked.length}
                  onClick={() =>
                    void saveXlsx(`체육예산_${new Date().toISOString().slice(0, 10)}.xlsx`, [
                      {
                        name: '예산 요약',
                        rows: [
                          ['세부사업', '산출내역', '예산현액', '에듀파인 집행액', '예산잔액', '집행률'],
                          ...picked.map((x) => [sheetLabel(x), x.name, x.budget, x.spent, x.left, pct(x.spent, x.budget)]),
                          ['합계', '', sum.budget, sum.spent, sum.left, pct(sum.spent, sum.budget)],
                        ],
                        widths: [40, 36, 14, 14, 14, 8],
                      },
                    ])
                  }
                >
                  <Icon name="download" size={18} /> 엑셀로 받기
                </button>
              </div>
              <button type="button" className="btn btn-ghost w-full" disabled={!picked.length} onClick={() => void copy(dropdownList(picked), '산출내역 목록을 복사했어요. 드롭다운 항목에 붙여 넣을 수 있어요.')}>
                산출내역 이름만 복사 (드롭다운용)
              </button>
            </section>

            <Collapse title="시트 모양이 다르면" sub={`붙일 칸 ${layout.startCell} · 품목 시트 '${layout.itemSheet}' · 예산항목 ${layout.itemCol}열 · 금액 ${layout.amountCol}열`}>
              <div className="card space-y-3">
                <Field label="요약 표 머리글 칸" hint="예: N5">
                  <input className="field" defaultValue={layout.startCell} onBlur={(e) => parseCell(e.target.value) && setLayout({ startCell: e.target.value.trim().toUpperCase() })} />
                </Field>
                <Field label="품목을 적는 시트(탭) 이름" hint="요약 표를 다른 탭에 붙여도 수식이 맞게">
                  <input className="field" defaultValue={layout.itemSheet} onBlur={(e) => setLayout({ itemSheet: e.target.value })} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="예산항목 열">
                    <input className="field" defaultValue={layout.itemCol} onBlur={(e) => /^[A-Za-z]{1,2}$/.test(e.target.value.trim()) && setLayout({ itemCol: e.target.value.trim().toUpperCase() })} />
                  </Field>
                  <Field label="금액 열">
                    <input className="field" defaultValue={layout.amountCol} onBlur={(e) => /^[A-Za-z]{1,2}$/.test(e.target.value.trim()) && setLayout({ amountCol: e.target.value.trim().toUpperCase() })} />
                  </Field>
                  <Field label="품목 첫 줄">
                    <input className="field" inputMode="numeric" defaultValue={layout.firstRow} onBlur={(e) => Number(e.target.value) > 0 && setLayout({ firstRow: Math.floor(Number(e.target.value)) })} />
                  </Field>
                </div>
                <label className="flex min-h-[48px] items-center gap-3">
                  <input type="checkbox" className="h-5 w-5" checked={layout.withEdufine} onChange={(e) => setLayout({ withEdufine: e.target.checked })} />
                  <span className="font-bold">에듀파인 집행액 · 차이 칸 같이 넣기</span>
                </label>
              </div>
            </Collapse>
          </>
        )}

        <p className="hint text-center">선생님별 사용 등록은 지금처럼 구글 시트에서 해요 · 예산 자료에는 학생 정보가 없어요</p>
      </div>
    </>
  )
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card px-3 py-3">
      <p className="text-sm font-bold text-ink-3">{label}</p>
      <p className={`text-[1.15rem] font-extrabold tabular-nums ${warn ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
}

function ItemRow({ it, on, manual, onToggle, disabled }: { it: BudgetItem; on: boolean; manual?: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="list-row min-h-[58px] w-full text-left hover:bg-fill" disabled={disabled} onClick={onToggle} aria-pressed={on}>
      {manual ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-light text-brand" title="직접 입력 · 누르면 고치기">
          <Icon name="edit" size={14} />
        </span>
      ) : (
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-brand bg-brand text-white' : 'border-line'}`}>{on && <Icon name="check" size={14} />}</span>
      )}
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 block break-keep">{it.name}</b>
        <span className="hint block truncate">
          {manual ? `직접 입력${it.cost ? ` · ${it.cost}` : ''}` : on ? it.cost : `${it.detail.replace(/^\(통합\)/, '')} · ${it.cost}`} · 현액 {won(it.budget)}
        </span>
      </span>
      <span className={`shrink-0 text-right text-sm font-bold tabular-nums ${it.left < 0 ? 'text-danger' : 'text-ink-2'}`}>
        {won(it.left)}
        <span className="block text-xs font-semibold text-ink-3">{pct(it.spent, it.budget)} 집행</span>
      </span>
    </button>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-ink-2">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  )
}

/** 엑셀 없이 손으로 적는 칸. 잔액 = 현액 − 집행 (저절로) */
function ManualForm({
  initial,
  details,
  disabled,
  onSave,
  onCancel,
  onRemove,
}: {
  initial: BudgetItem | null
  details: string[]
  disabled?: boolean
  onSave: (it: BudgetItem) => void | Promise<void>
  onCancel?: () => void
  onRemove?: () => void
}) {
  const [f, setF] = useState({
    unit: initial?.unit ?? '',
    detail: initial && initial.detail !== '직접 입력' ? initial.detail : '',
    cost: initial?.cost ?? '',
    name: initial?.name ?? '',
    budget: initial ? String(initial.budget) : '',
    spent: initial ? String(initial.spent) : '',
  })
  const [err, setErr] = useState('')
  const num = (v: string) => (v.trim() ? money(v) : 0)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const left = num(f.budget) - num(f.spent)

  const submit = async () => {
    if (!f.name.trim()) return setErr('산출내역(예산항목 이름)을 적어 주세요.')
    if (!f.budget.trim()) return setErr('예산현액을 적어 주세요.')
    if (!/^-?[\d,\s]+$/.test(f.budget.trim()) || (f.spent.trim() && !/^-?[\d,\s]+$/.test(f.spent.trim()))) return setErr('금액은 숫자로 적어 주세요.')
    const id = initial ? initial.key.slice('manual|'.length) : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const it = manualItem(id, { ...f, budget: num(f.budget), spent: num(f.spent) })
    if (!it) return setErr('금액은 숫자로 적어 주세요.')
    setErr('')
    await onSave(it)
    if (!initial) setF({ ...f, cost: '', name: '', budget: '', spent: '' })
  }

  return (
    <div className="card space-y-3">
      <Field label="세부사업" hint="예: 학교스포츠클럽활동 · 체육대회 (같은 세부사업끼리 묶여요)">
        <input className="field" list="budget-details" value={f.detail} onChange={set('detail')} placeholder="학교스포츠클럽활동" />
        <datalist id="budget-details">
          {details.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </Field>
      <Field label="산출내역 (예산항목 이름)" hint="구글 시트 품목의 '예산항목'과 글자가 똑같아야 해요">
        <input className="field" value={f.name} onChange={set('name')} placeholder="학교스포츠클럽 운영비" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="예산현액(원)">
          <input className="field" inputMode="numeric" value={f.budget} onChange={set('budget')} placeholder="1,000,000" />
        </Field>
        <Field label="집행액(원)" hint="없으면 비워 두기">
          <input className="field" inputMode="numeric" value={f.spent} onChange={set('spent')} placeholder="0" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="단위사업 (선택)">
          <input className="field" value={f.unit} onChange={set('unit')} placeholder="동아리활동" />
        </Field>
        <Field label="비목 (선택)">
          <input className="field" value={f.cost} onChange={set('cost')} placeholder="교육운영비" />
        </Field>
      </div>
      <p className={`text-sm font-bold ${left < 0 ? 'text-danger' : 'text-ink-2'}`}>잔액 {won(left)}원 (현액 − 집행)</p>
      {err && <p className="text-sm font-bold text-danger">{err}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={disabled} onClick={() => void submit()}>
        <Icon name={initial ? 'check' : 'plus'} size={18} /> {initial ? '고친 내용 저장' : '항목 더하기'}
      </button>
      {(onCancel || onRemove) && (
        <div className="grid grid-cols-2 gap-2">
          {onCancel && (
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              그만 고치기
            </button>
          )}
          {onRemove && (
            <button type="button" className="btn btn-danger" disabled={disabled} onClick={onRemove}>
              <Icon name="trash" size={18} /> 지우기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
