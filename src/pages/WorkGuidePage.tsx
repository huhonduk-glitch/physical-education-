import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { NEIS_SCREEN_NOTE, WORK_DOCS, WORK_TOPICS, srcLabel, workTopic, type WorkLine, type WorkSrc } from '../data/peWork'

type Tab = 'neis' | 'calendar' | 'rules' | 'forms'
const TABS: { id: Tab; label: string }[] = [
  { id: 'neis', label: '나이스' },
  { id: 'calendar', label: '일정' },
  { id: 'rules', label: '규정' },
  { id: 'forms', label: '양식' },
]

/**
 * 학교체육 업무 안내 (6-11 G): 학교운동부 · 학교스포츠클럽.
 * 내용은 src/data/peWork.ts — 교사가 준 나이스 교육자료 · 학교체육 운영방향의 쪽수를 줄마다 단다.
 */
export default function WorkGuidePage() {
  const { topic: id = '' } = useParams()
  const topic = workTopic(id)
  const [tab, setTab] = useState<Tab>('neis')
  const [open, setOpen] = useState<string | null>(null)
  if (!topic) return <Navigate to="/more" replace />

  return (
    <>
      <PageHeader title={topic.title} sub="학교체육 업무" back />
      <div className="page space-y-4 pb-10">
        <p className="hint px-1">{topic.summary}</p>

        <div className="flex gap-2">
          {WORK_TOPICS.map((t) => (
            <Link key={t.id} to={`/work/${t.id}`} replace className={`btn flex-1 ${t.id === topic.id ? 'btn-primary' : 'btn-outline'}`}>
              {t.id === 'team' ? '학교운동부' : '스포츠클럽'}
            </Link>
          ))}
        </div>

        <div className="segment" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

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

        {tab === 'calendar' && (
          <section className="card overflow-hidden p-0">
            {topic.calendar.map((c, i) => (
              <div key={i} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="w-[5.5rem] shrink-0 text-sm font-extrabold text-brand">{c.when}</span>
                <Line line={{ text: c.what, src: c.src, local: c.local }} />
              </div>
            ))}
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
                </div>
              ))}
            </div>
            <p className="hint px-1">양식 원본은 교육청 공문에 붙은 '{WORK_DOCS.plan.name}' 파일의 그 쪽에 있어요. 공문 원본을 내려받아 쓰세요.</p>
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
    </>
  )
}

function Line({ line, prefix = '' }: { line: WorkLine; prefix?: string }) {
  return (
    <span className="min-w-0 flex-1 text-[0.95rem] leading-relaxed">
      {prefix}
      {line.text}
      {line.local && <span className="ml-1 rounded-md bg-caution-light px-1.5 py-0.5 text-xs font-bold text-ink-2">제주</span>}
      <Src src={line.src} />
    </span>
  )
}

function Src({ src }: { src: WorkSrc }) {
  return <span className="ml-1 text-xs font-semibold whitespace-nowrap text-ink-3">({srcLabel(src)})</span>
}
