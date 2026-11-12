import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../components/Collapse'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { AiError, manualPromptText, runAi } from '../lib/aiPolish'
import { isPicked, mergeManual, type BudgetItem } from '../lib/budget'
import { copyText, saveXlsx } from '../lib/download'
import {
  QuoteError,
  QuoteScanError,
  draftText,
  draftTitle,
  itemRows,
  parseQuoteAnswer,
  parseQuoteText,
  quoteAiPrompt,
  quoteSum,
  recalc,
  type Quote,
  type QuoteItem,
} from '../lib/quote'
import { cropToImage, fileToCanvas, readQuoteFile } from '../lib/quoteFile'
import { useApp } from '../state/AppContext'
import { aiSettingsOf } from './seteuk/AiSetupCard'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const STORE = 'pelog.quote'
const budgetText = (b: BudgetItem) => `${b.detail.replace(/^\(통합\)\s*/, '')} - ${b.cost} (${b.name})`

interface Saved {
  quote: Quote
  addVat: boolean
  title: string
  purpose: string
  vendor: string
  budgetKey: string
}

function load(): Saved | null {
  try {
    const t = sessionStorage.getItem(STORE)
    return t ? (JSON.parse(t) as Saved) : null
  } catch {
    return null
  }
}

/**
 * 견적서 → 품의 초안 (6-21, 2026-11-12 교사 요청)
 * 1단계: 엑셀 · 글자 있는 PDF · 붙여넣기를 이 기기 안에서 읽는다.
 * 2단계: 사진 · 스캔본은 선생님이 누를 때만 AI로 읽는다(위아래를 잘라 업체 연락처를 빼고 보냄).
 * 에듀파인에 자동으로 넣지 않는다 — 품목 표와 품의 내용을 복사해서 붙여 넣는다.
 */
export default function QuotePage() {
  const { settings } = useApp()
  const saved = useMemo(load, [])
  const [quote, setQuote] = useState<Quote | null>(saved?.quote ?? null)
  const [addVat, setAddVat] = useState(saved?.addVat ?? false)
  const [title, setTitle] = useState(saved?.title ?? '')
  const [purpose, setPurpose] = useState(saved?.purpose ?? '')
  const [vendor, setVendor] = useState(saved?.vendor ?? '')
  const [budgetKey, setBudgetKey] = useState(saved?.budgetKey ?? '')
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState<{ canvas: HTMLCanvasElement; url: string; name: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      if (quote) sessionStorage.setItem(STORE, JSON.stringify({ quote, addVat, title, purpose, vendor, budgetKey } satisfies Saved))
      else sessionStorage.removeItem(STORE)
    } catch {
      /* 저장 못 해도 화면은 그대로 */
    }
  }, [quote, addVat, title, purpose, vendor, budgetKey])

  const budgets = useMemo(() => mergeManual(settings.budgetCard?.card.items ?? [], settings.budgetManual ?? []).filter((x) => isPicked(x, settings.budgetPicks)), [settings.budgetCard, settings.budgetManual, settings.budgetPicks])
  const budget = budgets.find((b) => b.key === budgetKey) ?? null

  const take = (q: Quote, how: string) => {
    setQuote(q)
    setAddVat(q.vat === 'separate')
    setVendor(q.vendor)
    setTitle('')
    setScan(null)
    setErr('')
    setMsg(`${how} 품목 ${q.items.length}줄을 읽었어요. 아래에서 견적서와 맞는지 확인해 주세요.`)
  }

  const onFile = async (f: File) => {
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      take(await readQuoteFile(f), '파일에서')
    } catch (e) {
      if (e instanceof QuoteScanError) {
        try {
          const canvas = await fileToCanvas(f)
          setScan({ canvas, url: canvas.toDataURL('image/jpeg', 0.7), name: f.name })
          setMsg('글자를 바로 읽을 수 없는 사진 · 스캔본이에요. 아래 [AI로 읽기]를 쓰거나, 품목을 붙여 넣어 주세요.')
        } catch (e2) {
          setErr(e2 instanceof QuoteError ? e2.message : '파일을 열지 못했어요.')
        }
      } else setErr(e instanceof QuoteError ? e.message : '파일을 읽지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const onPaste = () => {
    try {
      take(parseQuoteText(paste), '붙여 넣은 글에서')
      setPaste('')
    } catch (e) {
      setErr(e instanceof QuoteError ? e.message : '읽지 못했어요.')
    }
  }

  const setItem = (i: number, p: Partial<QuoteItem>, again = false) =>
    setQuote((q) => q && { ...q, items: q.items.map((x, j) => (j === i ? (again ? recalc(x, { ...x, ...p }) : { ...x, ...p }) : x)) })
  const removeItem = (i: number) => setQuote((q) => q && { ...q, items: q.items.filter((_, j) => j !== i) })
  const addItem = () => setQuote((q) => ({ ...(q ?? { vendor: '', date: '', stated: 0, vat: 'unknown', warnings: [] }), items: [...(q?.items ?? []), { name: '', spec: '', unit: '개', qty: 1, price: 0, amount: 0, note: '' }] }))

  const items = (quote?.items ?? []).filter((x) => x.name.trim())
  const sum = quoteSum(items, addVat)
  const draft = draftText({ title: title || draftTitle(items), purpose, items, addVat, vendor, budget: budget ? budgetText(budget) : '' })
  const copy = async (text: string, done: string) => setMsg((await copyText(text)) ? done : '복사하지 못했어요. 엑셀로 받아 주세요.')

  return (
    <>
      <PageHeader title="견적서 → 품의" sub="품목 표 · 품의 초안 · 예산 잔액" back />
      <div className="page space-y-4 pb-10">
        <section className="card space-y-3">
          <p className="font-bold">업체 견적서를 넣어 주세요</p>
          <p className="hint">엑셀 · PDF · 사진을 넣어요. 엑셀 · PDF는 이 기기 안에서 읽고 인터넷으로 보내지 않아요. 견적서 양식은 업체마다 달라서 머리글(품명 · 규격 · 수량 · 단가 · 금액)로 칸을 찾아요.</p>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,image/*" className="hidden" onChange={(e) => (e.target.files?.[0] && void onFile(e.target.files[0]), (e.target.value = ''))} />
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {busy ? '읽는 중…' : '파일 · 사진 넣기'}
          </button>
          <Collapse title="글로 붙여 넣기" sub="메신저로 받은 견적 · 엑셀에서 복사한 표">
            <div className="space-y-2">
              <textarea
                className="field min-h-[110px] py-3 text-sm"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'예)\n배드민턴 셔틀콕 10 통 15,000 150,000\n농구공 7호 5 35,000 175,000'}
                aria-label="견적 붙여 넣기"
              />
              <button type="button" className="btn btn-soft w-full" disabled={!paste.trim()} onClick={onPaste}>
                붙여 넣은 글 읽기
              </button>
            </div>
          </Collapse>
          {err && <p className="text-sm font-bold text-danger">{err}</p>}
          {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
        </section>

        {scan && <ScanReader scan={scan} onDone={(q) => take(q, 'AI가')} onCancel={() => setScan(null)} />}

        {quote && (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="min-w-0 text-sm font-bold text-ink-3">품목 {items.length}줄 · 수량이나 단가를 고치면 금액을 다시 계산해요</p>
                <button type="button" className="btn btn-ghost min-h-[40px] shrink-0 whitespace-nowrap px-2 text-brand" onClick={addItem}>
                  <Icon name="plus" size={18} /> 줄 더하기
                </button>
              </div>
              {quote.items.map((x, i) => (
                <div key={i} className="card space-y-2 py-3">
                  <div className="flex gap-2">
                    <input className="field min-w-0 flex-[2] font-bold" value={x.name} placeholder="품명" aria-label={`${i + 1}번 품명`} onChange={(e) => setItem(i, { name: e.target.value })} />
                    <input className="field min-w-0 flex-1" value={x.spec} placeholder="규격" aria-label={`${i + 1}번 규격`} onChange={(e) => setItem(i, { spec: e.target.value })} />
                    <button type="button" className="btn btn-ghost min-h-[48px] shrink-0 px-2 text-ink-3" aria-label={`${i + 1}번 줄 지우기`} onClick={() => removeItem(i)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[0.8fr_0.7fr_1.2fr_1.3fr]">
                    <NumField label="수량" value={x.qty} onChange={(v) => setItem(i, { qty: v }, true)} />
                    <label className="block">
                      <span className="text-xs font-bold text-ink-3">단위</span>
                      <input className="field" value={x.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                    </label>
                    <NumField label="단가" value={x.price} onChange={(v) => setItem(i, { price: v }, true)} />
                    <NumField label="금액" value={x.amount} onChange={(v) => setItem(i, { amount: v })} />
                  </div>
                </div>
              ))}
            </section>

            <section className="card space-y-2">
              <div className="flex justify-between">
                <span className="font-bold text-ink-2">품목 금액 합</span>
                <b className="tabular-nums">{won(sum.items)}</b>
              </div>
              <label className="flex min-h-[48px] items-center gap-3">
                <input type="checkbox" className="h-5 w-5" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} />
                <span className="font-bold">부가세 10% 더하기 (견적서가 &lsquo;부가세 별도&rsquo;일 때)</span>
              </label>
              {sum.vatAdded > 0 && (
                <div className="flex justify-between text-ink-2">
                  <span>부가세</span>
                  <span className="tabular-nums">{won(sum.vatAdded)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-lg">
                <span className="font-extrabold">품의 금액</span>
                <b className="tabular-nums">{won(sum.total)}</b>
              </div>
              {quote.stated > 0 && <p className={`text-sm font-bold ${Math.abs(quote.stated - sum.total) > 1 ? 'text-caution' : 'text-ok'}`}>견적서 합계 {won(quote.stated)}{Math.abs(quote.stated - sum.total) > 1 ? ' — 다름' : ' — 같음'}</p>}
              {quote.warnings.length > 0 && (
                <ul className="space-y-1 rounded-2xl bg-caution-light p-3 text-sm font-semibold text-caution">
                  {quote.warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card space-y-2">
              <p className="font-bold">어느 예산에서 쓸까요?</p>
              {budgets.length === 0 ? (
                <p className="hint">
                  <Link to="/work/budget" className="font-bold text-brand underline">
                    체육 예산 현황
                  </Link>
                  에 에듀파인 사업관리카드를 넣으면 여기서 고르고 남는 돈을 바로 봐요.
                </p>
              ) : (
                <>
                  <select className="field" value={budgetKey} onChange={(e) => setBudgetKey(e.target.value)} aria-label="예산 항목">
                    <option value="">고르지 않음</option>
                    {budgets.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.detail.replace(/^\(통합\)\s*/, '')} · {b.name} (남은 {b.left.toLocaleString('ko-KR')}원)
                      </option>
                    ))}
                  </select>
                  {budget && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Mini label="지금 잔액" value={won(budget.left)} />
                      <Mini label="이번 품의" value={won(sum.total)} />
                      <Mini label="쓰고 난 뒤" value={won(budget.left - sum.total)} warn={budget.left - sum.total < 0} />
                    </div>
                  )}
                  {budget && budget.left - sum.total < 0 && <p className="text-sm font-bold text-danger">예산이 모자라요. 다른 항목을 고르거나 품목을 줄여 주세요.</p>}
                  <p className="hint">잔액은 사업관리카드를 넣은 날 기준이에요. 그 뒤 품의한 것은 빠져 있을 수 있어요.</p>
                </>
              )}
            </section>

            <section className="card space-y-3">
              <p className="font-bold">품의 초안</p>
              <label className="block">
                <span className="label">제목</span>
                <input className="field" value={title} placeholder={draftTitle(items)} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">목적 (선생님이 써 주세요)</span>
                <input className="field" value={purpose} placeholder="예: 2학기 체육 수업(배드민턴 단원) 교구 확보" onChange={(e) => setPurpose(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">견적 업체</span>
                <input className="field" value={vendor} placeholder="상호" onChange={(e) => setVendor(e.target.value)} />
              </label>
              <pre className="whitespace-pre-wrap rounded-2xl bg-fill p-3 font-sans text-sm leading-relaxed">{draft}</pre>
              <p className="hint">학교마다 품의 서식이 달라요. 에듀파인 품의 화면에 붙여 넣은 뒤 학교 양식에 맞게 고쳐 주세요. 금액은 행정업무 편람 방식(숫자 + 한글)으로 적었어요.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-primary" disabled={!items.length} onClick={() => void copy(draft, '품의 내용을 복사했어요.')}>
                  <Icon name="copy" size={18} /> 내용 복사
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!items.length}
                  onClick={() => void copy(itemRows(items, addVat).map((r) => r.join('\t')).join('\n'), '품목 표를 복사했어요. 엑셀 · 한글 표에 붙여 넣으세요.')}
                >
                  <Icon name="copy" size={18} /> 품목 표 복사
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost w-full"
                disabled={!items.length}
                onClick={() =>
                  void saveXlsx(`품의_${(title || draftTitle(items)).replace(/[\\/:*?"<>|]/g, '').slice(0, 30)}.xlsx`, [{ name: '품목', rows: itemRows(items, addVat), widths: [6, 28, 18, 8, 8, 12, 14, 16] }])
                }
              >
                <Icon name="download" size={18} /> 품목 표 엑셀로 받기
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full text-ink-3"
                onClick={() => {
                  if (!confirm('지금 견적을 비울까요?')) return
                  setQuote(null)
                  setMsg('')
                }}
              >
                새 견적서로 다시 하기
              </button>
            </section>
          </>
        )}
        {!quote && (
          <button type="button" className="btn btn-ghost w-full text-brand" onClick={addItem}>
            견적서 없이 품목을 직접 적기
          </button>
        )}
        <p className="hint text-center">에듀파인에 대신 입력하지 않아요 · 견적서에는 학생 정보가 없어요</p>
      </div>
    </>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? value.toLocaleString('ko-KR') : '')
  useEffect(() => {
    const n = Number(text.replace(/[,\s]/g, ''))
    if (n !== value) setText(value ? value.toLocaleString('ko-KR') : '')
  }, [value])
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-ink-3">{label}</span>
      <input
        className="field text-right tabular-nums"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value.replace(/[,\s원]/g, ''))
          if (Number.isFinite(n)) onChange(n)
        }}
        onBlur={() => setText(value ? value.toLocaleString('ko-KR') : '')}
      />
    </label>
  )
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-fill px-2 py-2">
      <p className="text-xs font-bold text-ink-3">{label}</p>
      <p className={`text-sm font-extrabold tabular-nums ${warn ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
}

/** 2단계: 사진 · 스캔본을 AI로 읽기. 위아래를 잘라 업체 연락처 칸을 빼고 보낸다 */
function ScanReader({ scan, onDone, onCancel }: { scan: { canvas: HTMLCanvasElement; url: string; name: string }; onDone: (q: Quote) => void; onCancel: () => void }) {
  const { settings } = useApp()
  const ai = aiSettingsOf(settings)
  const manual = ai.provider === 'manual'
  const ready = ai.provider === 'claude' ? !!ai.claudeApiKey : ai.provider === 'openrouter' ? !!(ai.openrouterApiKey && ai.openrouterModel) : true
  const [top, setTop] = useState(0)
  const [bottom, setBottom] = useState(100)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)

  const run = async () => {
    setErr('')
    if (manual) {
      const ok = await copyText(manualPromptText(quoteAiPrompt()))
      setAnswer('')
      if (!ok) setErr('복사하지 못했어요.')
      return
    }
    setBusy(true)
    try {
      const image = cropToImage(scan.canvas, top / 100, bottom / 100)
      const res = await runAi(ai, { ...quoteAiPrompt(), images: [image] })
      onDone(parseQuoteAnswer(res.text))
    } catch (e) {
      setErr(e instanceof AiError || e instanceof QuoteError ? e.message : 'AI 요청 중 문제가 생겼어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-bold">사진 · 스캔본 AI로 읽기 · {scan.name}</p>
        <button type="button" className="btn btn-ghost min-h-[40px] shrink-0 px-2 text-ink-3" onClick={onCancel}>
          닫기
        </button>
      </div>
      {!manual && (
        <>
          <p className="hint">업체 전화 · 주소 · 계좌 · 대표자 칸은 위아래를 잘라서 빼고 보내세요. 어두운 부분은 보내지 않아요.</p>
          <div className="relative overflow-hidden rounded-2xl border border-line">
            <img src={scan.url} alt="견적서" className="block w-full" />
            <div className="absolute inset-x-0 top-0 bg-ink/60" style={{ height: `${top}%` }} />
            <div className="absolute inset-x-0 bottom-0 bg-ink/60" style={{ height: `${100 - bottom}%` }} />
          </div>
          <label className="block">
            <span className="label">위에서 자르기 {top}%</span>
            <input type="range" className="w-full" min={0} max={90} value={top} onChange={(e) => setTop(Math.min(Number(e.target.value), bottom - 5))} />
          </label>
          <label className="block">
            <span className="label">아래에서 자르기 {100 - bottom}%</span>
            <input type="range" className="w-full" min={0} max={90} value={100 - bottom} onChange={(e) => setBottom(Math.max(100 - Number(e.target.value), top + 5))} />
          </label>
        </>
      )}
      <button type="button" className="btn btn-primary w-full" disabled={busy || !ready} onClick={() => void run()}>
        <Icon name="bolt" /> {busy ? 'AI가 읽는 중…' : manual ? '요청문 복사 (무료 챗봇에 사진과 같이 붙여 넣기)' : 'AI로 읽기'}
      </button>
      {!ready && (
        <p className="hint">
          AI 연결은{' '}
          <Link to="/seteuk/write" className="font-bold text-brand underline">
            세특 쓰기 → AI 연결
          </Link>
          과 같이 써요. OpenRouter는 &lsquo;사진 읽기&rsquo; 표시가 있는 모델이어야 해요.
        </p>
      )}
      <p className="hint">
        보내는 것: {manual ? '선생님이 챗봇에 올리는 사진' : '잘라 낸 견적서 그림'}과 &lsquo;품목 표만 옮겨 달라&rsquo;는 요청문. 학생 정보는 없어요. AI는 그림에 없는 값을 지어내지 않게 했지만, 읽은 값은 꼭 견적서와 맞춰 보세요.
      </p>
      {answer !== null && (
        <div className="space-y-2 rounded-2xl bg-fill p-3">
          <p className="text-sm font-bold">요청문을 복사했어요. 챗봇에 견적서 사진(품목 표 부분)과 함께 붙여 넣고, 받은 답을 여기에 붙여 넣으세요.</p>
          <textarea className="field min-h-[100px] py-3 text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="챗봇 답" />
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!answer.trim()}
            onClick={() => {
              try {
                onDone(parseQuoteAnswer(answer))
              } catch (e) {
                setErr(e instanceof QuoteError ? e.message : '답을 읽지 못했어요.')
              }
            }}
          >
            답 읽기
          </button>
        </div>
      )}
      {err && <p className="text-sm font-bold text-danger">{err}</p>}
    </section>
  )
}
