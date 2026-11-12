import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import PdfPageViewer, { countPdfPages, forgetPdf } from '../components/PdfPageViewer'
import WorkFlowChart, { AuthorDocsCard } from '../components/WorkFlowChart'
import WorkTopicSwitch from '../components/WorkTopicSwitch'
import { AUTHOR_DOCS } from '../data/authorDocs'
import { workFlow } from '../data/peFlows'
import { listDocs, removeDoc, saveDoc, type StoredDocMeta } from '../db/docStore'
import { NEIS_SCREEN_NOTE, WORK_DOCS, srcLabel, workTopic, type WorkDoc, type WorkLine, type WorkSrc } from '../data/peWork'

/** 넣어 둔 자료 파일이 있으면 쪽 표시를 눌러 그 쪽을 연다 */
const OpenCtx = createContext<{ has: (d: WorkDoc) => boolean; open: (src: WorkSrc, title: string) => void }>({ has: () => false, open: () => undefined })

/** 업무 하나의 하위 메뉴 (2026-11-12 교사 결정): 주소 /work/<업무>/<하위> — 왼쪽 메뉴 · 뒤로 가기와 같이 움직인다. 일정은 흐름도로 합침 */
type Tab = 'flow' | 'neis' | 'edu' | 'rules' | 'forms' | 'docs'
const TABS: { id: Tab; label: string }[] = [
  { id: 'flow', label: '흐름도' },
  { id: 'neis', label: '나이스 할 일' },
  { id: 'edu', label: '교육' },
  { id: 'rules', label: '지침' },
  { id: 'forms', label: '양식' },
  { id: 'docs', label: '현장 양식' },
]

/**
 * 학교체육 업무 안내 (6-11 G): 학교운동부 · 학교스포츠클럽.
 * 내용은 src/data/peWork.ts — 교사가 준 나이스 교육자료 · 학교체육 운영방향의 쪽수를 줄마다 단다.
 */
export default function WorkGuidePage() {
  const { topic: id = '', tab: tabParam } = useParams()
  const topic = workTopic(id)
  const navigate = useNavigate()
  // 이 업무에 있는 하위 메뉴만 (나이스 메뉴 · 교육 · 현장 양식은 자료가 있을 때)
  const tabs = topic
    ? TABS.filter((t) => (t.id !== 'neis' || topic.menus.length > 0) && (t.id !== 'edu' || (topic.trainings?.length ?? 0) > 0) && (t.id !== 'docs' || AUTHOR_DOCS[topic.id].length > 0))
    : []
  // 처음에는 1년 흐름부터
  const tab = (tabParam ?? 'flow') as Tab
  const [open, setOpen] = useState<string | null>(null)
  const [docs, setDocs] = useState<StoredDocMeta[]>([])
  const [viewer, setViewer] = useState<{ doc: WorkDoc; page: number; title: string } | null>(null)
  const refresh = () => listDocs().then(setDocs).catch(() => setDocs([]))
  useEffect(() => {
    void refresh()
  }, [])
  const has = (d: WorkDoc) => docs.some((x) => x.key === d)
  const openSrc = (src: WorkSrc, title: string) => setViewer({ doc: src.doc, page: Array.isArray(src.page) ? src.page[0] : src.page, title })
  if (!topic) return <Navigate to="/work" replace />
  if (!tabs.some((t) => t.id === tab)) return <Navigate to={`/work/${topic.id}`} replace />
  const tabLabel = tabs.find((t) => t.id === tab)!.label

  return (
    <OpenCtx.Provider value={{ has, open: openSrc }}>
      <PageHeader title={topic.title} sub={`학교체육 업무 · ${tabLabel}`} back />
      <div className="page space-y-4 pb-10">
        <p className="hint px-1">{topic.summary}</p>

        <WorkTopicSwitch current={topic.id} />

        {topic.id === 'committee' && (
          <Link to="/work/committee/meetings" className="card flex min-h-[64px] items-center gap-3 active:bg-fill">
            <Icon name="edit" className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <b className="block">회의 기록 · 회의록</b>
              <span className="hint">위원 명단 · 학기별 정기회의 현황 · 회의록 인쇄</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        )}
        <Link to="/work/docs" className="block px-1 text-sm font-bold text-brand">
          나이스와 따로, 매년 기안해야 하는 계획 · 제출 일정 · 양식 ›
        </Link>

        <DocFiles docs={docs} onChange={() => void refresh()} />

        <div className="segment overflow-x-auto [scrollbar-width:none] [&>button]:shrink-0 [&>button]:px-3 [&>button]:whitespace-nowrap" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => navigate(t.id === 'flow' ? `/work/${topic.id}` : `/work/${topic.id}/${t.id}`, { replace: true })}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'flow' && workFlow(topic.id) && <WorkFlowChart flow={workFlow(topic.id)!} />}
        {tab === 'docs' && <AuthorDocsCard id={topic.id} title={topic.title} />}

        {tab === 'neis' && (
          <section className="space-y-2">
            <p className="rounded-2xl bg-caution-light px-4 py-3 text-sm font-bold text-ink-2">⚠️ {NEIS_SCREEN_NOTE}</p>
            {topic.menus.map((m, i) => {
              const on = open === m.id
              return (
                <div key={m.id} className="card overflow-hidden p-0">
                  <button type="button" className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={on} onClick={() => setOpen(on ? null : m.id)}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-extrabold text-brand">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block">{m.title}</b>
                      <span className="hint block truncate">{m.path[m.path.length - 1]}</span>
                    </span>
                    <Icon name="chevronDown" size={18} className={`shrink-0 text-ink-3 transition-transform ${on ? 'rotate-180' : ''}`} />
                  </button>
                  {on && (
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      <p className="flex flex-wrap items-center gap-1 text-sm font-bold text-ink-2">
                        {m.path.map((p, j) => (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && <span className="text-ink-3">›</span>}
                            <span className="rounded-lg bg-fill px-2 py-0.5">{p}</span>
                          </span>
                        ))}
                      </p>
                      {m.who && <p className="text-sm font-bold text-brand">누가: {m.who}</p>}
                      <ol className="space-y-2">
                        {m.steps.map((s, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fill text-xs font-bold text-ink-2">{j + 1}</span>
                            <Line line={s} />
                          </li>
                        ))}
                      </ol>
                      {m.tips?.map((t, j) => (
                        <div key={j} className="rounded-xl bg-fill px-3 py-2">
                          <Line line={t} prefix="💡 " />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {tab === 'edu' && (
          <section className="space-y-2">
            <p className="hint px-1">운영방향에 ‘법적 의무교육’ · ‘의무’ · ‘필수’로 적힌 교육이에요. 표시는 원문 그대로 옮겼어요.</p>
            {(topic.trainings ?? []).map((t) => (
              <div key={t.name} className="card space-y-1.5">
                <p className="flex flex-wrap items-center gap-2">
                  <b>{t.name}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.kind === '선택' ? 'bg-fill text-ink-2' : t.kind === '법적 의무' ? 'bg-brand text-white' : 'bg-brand-light text-brand'}`}>{t.kind}</span>
                </p>
                <p className="text-sm font-bold text-ink-2">
                  {t.who} · <span className="text-brand">{t.times}</span>
                </p>
                {t.basis && <p className="hint">근거: {t.basis}</p>}
                <Line line={{ text: t.how ?? '', src: t.src, local: t.local }} />
              </div>
            ))}
            {(topic.trainingNotes?.length ?? 0) > 0 && (
              <div className="card space-y-2">
                <p className="font-extrabold">알아 둘 것</p>
                <ul className="space-y-2">
                  {(topic.trainingNotes ?? []).map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      <Line line={l} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === 'rules' &&
          topic.rules.map((r) => (
            <section key={r.title} className="card space-y-2">
              <p className="font-extrabold">{r.title}</p>
              <ul className="space-y-2">
                {r.lines.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <Line line={l} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {tab === 'forms' && (
          <section className="space-y-2">
            <div className="card overflow-hidden p-0">
              {topic.forms.map((f, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <Icon name="file" size={18} className="mt-0.5 shrink-0 text-brand" />
                  <Line line={f} />
                  {has(f.src.doc) && (
                    <button type="button" className="btn btn-soft h-10 min-h-0 shrink-0 px-3 text-sm" onClick={() => openSrc(f.src, f.text)}>
                      열기
                    </button>
                  )}
                </div>
              ))}
            </div>
            {(topic.formGroups ?? []).map((g) => (
              <div key={g.title} className="card space-y-2">
                <p className="font-extrabold">{g.title}</p>
                <ul className="space-y-2">
                  {g.lines.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      <Line line={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="hint px-1">
              {has('plan')
                ? '[열기]로 넣어 둔 파일의 그 쪽을 봐요. 한글 · 엑셀 서식은 공문 첨부 파일에서 받아 쓰세요.'
                : `양식은 교육청 공문에 붙은 '${WORK_DOCS.plan.name}' 파일의 그 쪽에 있어요. 위 [자료 파일]에 넣어 두면 여기서 바로 열려요.`}
            </p>
          </section>
        )}

        <section className="card space-y-1">
          <p className="text-sm font-bold text-ink-2">출처</p>
          {(Object.keys(WORK_DOCS) as (keyof typeof WORK_DOCS)[]).map((k) => (
            <p key={k} className="hint">
              · {WORK_DOCS[k].short}: 「{WORK_DOCS[k].name}」
            </p>
          ))}
          <p className="hint">· '제주' 표시는 제주교육청 2026 기준이에요. 다른 시도는 자기 교육청 학교체육 운영 계획을 확인하세요.</p>
        </section>
      </div>
      {viewer && <PdfPageViewer key={`${viewer.doc}-${viewer.page}-${viewer.title}`} docKey={viewer.doc} page={viewer.page} title={`${WORK_DOCS[viewer.doc].short} · ${viewer.title}`} onClose={() => setViewer(null)} />}
    </OpenCtx.Provider>
  )
}

/** 자료 파일 넣기: 이 기기에만 둔다 (공개 저장소에 원본을 넣지 않음) */
function DocFiles({ docs, onChange }: { docs: StoredDocMeta[]; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<WorkDoc>('plan')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [show, setShow] = useState(false)
  const keys = Object.keys(WORK_DOCS) as WorkDoc[]
  const missing = keys.filter((k) => !docs.some((d) => d.key === k))
  // 파일을 안 넣었어도 처음에는 접어 둔다(펼쳐 두면 폰 첫 화면을 다 차지해 나이스 할 일이 밀려남)
  const expanded = show

  const onFile = async (f: File) => {
    setBusy(true)
    setMsg('')
    setShow(true)
    try {
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') throw new Error('PDF 파일을 넣어 주세요.')
      const pages = await countPdfPages(await f.arrayBuffer())
      forgetPdf(target)
      await saveDoc(target, f, pages, f.name)
      const want = WORK_DOCS[target].pages
      setMsg(pages === want ? `넣었어요 (${pages}쪽).` : `넣었어요. 다만 이 파일은 ${pages}쪽이라 안내의 ${want}쪽 판과 달라요. 쪽이 안 맞을 수 있어요.`)
      onChange()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '파일을 넣지 못했어요.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (k: WorkDoc) => {
    if (!confirm('이 기기에서 파일을 지울까요?')) return
    forgetPdf(k)
    await removeDoc(k)
    onChange()
  }

  return (
    <section className="card space-y-2">
      <button type="button" className="flex min-h-[48px] w-full items-center gap-3 text-left" aria-expanded={expanded} onClick={() => setShow((v) => !v)}>
        <Icon name="file" size={20} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <b className="block">자료 파일 (이 기기에만)</b>
          <span className="hint block">{missing.length ? `${keys.length - missing.length}/${keys.length}개 넣음 · 공문 PDF를 넣으면 쪽 표시를 눌러 바로 열려요` : '넣어 둔 파일의 쪽을 바로 열 수 있어요'}</span>
        </span>
        <Icon name="chevronDown" size={18} className={`shrink-0 text-ink-3 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="space-y-2">
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          {keys.map((k) => {
            const d = docs.find((x) => x.key === k)
            return (
              <div key={k} className="rounded-2xl bg-fill px-3 py-2">
                <p className="text-sm font-bold">{WORK_DOCS[k].name}</p>
                <p className="hint">{d ? `넣음 · ${d.name} · ${d.pages}쪽 · ${(d.size / 1048576).toFixed(1)}MB` : '아직 안 넣음 (교육청 공문 첨부 PDF)'}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline h-11 min-h-0 flex-1 text-sm"
                    disabled={busy}
                    onClick={() => {
                      setTarget(k)
                      input.current?.click()
                    }}
                  >
                    {d ? '바꾸기' : 'PDF 넣기'}
                  </button>
                  {d && (
                    <button type="button" className="btn btn-ghost h-11 min-h-0 px-3 text-sm text-danger" disabled={busy} onClick={() => void remove(k)}>
                      지우기
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {busy && <p className="hint">읽는 중…</p>}
          {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
          <p className="hint">파일은 이 기기 브라우저에만 저장되고 인터넷으로 보내지 않아요. 백업 파일에는 들어가지 않으니 기기를 바꾸면 다시 넣어 주세요.</p>
        </div>
      )}
    </section>
  )
}

function Line({ line, prefix = '' }: { line: WorkLine; prefix?: string }) {
  return (
    <span className="min-w-0 flex-1 text-[0.95rem] leading-relaxed">
      {prefix}
      {line.text}
      {line.local && <span className="ml-1 rounded-md bg-caution-light px-1.5 py-0.5 text-xs font-bold text-ink-2">제주</span>}
      <Src src={line.src} title={line.text.length > 30 ? `${line.text.slice(0, 30)}…` : line.text} />
    </span>
  )
}

function Src({ src, title }: { src: WorkSrc; title: string }) {
  const { has, open } = useContext(OpenCtx)
  if (!has(src.doc)) return <span className="ml-1 text-xs font-semibold whitespace-nowrap text-ink-3">({srcLabel(src)})</span>
  return (
    <button type="button" className="ml-1 rounded-md bg-brand-light px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-brand active:opacity-70" onClick={() => open(src, title)}>
      {srcLabel(src)} 열기
    </button>
  )
}
