import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AUTHOR_DOCS, AUTHOR_KIND_LABEL } from '../data/authorDocs'
import { FLOW_KIND, type FlowStep, type WorkFlow } from '../data/peFlows'
import { WORK_DOCS, srcLabel, type WorkDoc, type WorkSrc } from '../data/peWork'
import { listDocs, type StoredDocMeta } from '../db/docStore'
import type { FlowId } from '../data/peFlows'
import Icon from './Icon'
import PdfPageViewer from './PdfPageViewer'

const BASE = import.meta.env.BASE_URL

/**
 * 업무 흐름도 (2026-11-12): 단계마다 시기 · 어디서 하는 일(꼬리표) · 할 일 · 근거 쪽 · 앱 바로가기.
 * 자료 파일(운영방향 · 나이스 교육자료 PDF)을 이 기기에 넣어 두었으면 쪽 표시를 눌러 그 쪽이 열린다.
 */
export default function WorkFlowChart({ flow }: { flow: WorkFlow }) {
  const [docs, setDocs] = useState<StoredDocMeta[]>([])
  const [viewer, setViewer] = useState<{ doc: WorkDoc; page: number; title: string } | null>(null)
  useEffect(() => {
    listDocs()
      .then(setDocs)
      .catch(() => setDocs([]))
  }, [])
  const has = (d: WorkDoc) => docs.some((x) => x.key === d)
  const used = new Set(flow.phases.flatMap((p) => p.steps.map((s) => s.kind)))

  return (
    <section className="space-y-3">
      <div className="card space-y-2">
        <p className="font-extrabold">{flow.title} 1년 흐름</p>
        <p className="text-sm leading-relaxed text-ink-2">{flow.summary}</p>
        <div className="flex flex-wrap gap-1.5 print:hidden" aria-label="꼬리표 뜻">
          {Object.entries(FLOW_KIND)
            .filter(([k]) => used.has(k as FlowStep['kind']))
            .map(([k, v]) => (
              <span key={k} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${v.tone}`}>
                {v.label}
              </span>
            ))}
        </div>
      </div>

      {flow.phases.map((ph, pi) => (
        <div key={ph.title} className="break-inside-avoid-page">
          <p className="mb-2 px-1 text-sm font-extrabold text-ink-3">
            {pi + 1}. {ph.title}
          </p>
          <ol className="relative space-y-2 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[0.6rem] before:w-0.5 before:rounded before:bg-[#cfd6de]">
            {ph.steps.map((s, si) => (
              <li key={`${s.title}-${si}`} className="relative break-inside-avoid">
                <span className={`absolute top-4 -left-[1.05rem] h-3 w-3 rounded-full ring-4 ring-bg ${FLOW_KIND[s.kind].dot}`} aria-hidden />
                <div className="card space-y-1.5 py-3">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${FLOW_KIND[s.kind].tone}`}>{FLOW_KIND[s.kind].label}</span>
                    <span className="text-sm font-extrabold text-ink-2 tabular-nums">{s.when}</span>
                    {s.local && <span className="rounded-md bg-caution-light px-1.5 py-0.5 text-xs font-bold text-ink-2">제주</span>}
                    {s.school && <span className="rounded-md bg-fill-2 px-1.5 py-0.5 text-xs font-bold text-ink-3">학교마다 달라요</span>}
                  </p>
                  <p className="leading-snug font-bold">{s.title}</p>
                  {s.detail && <p className="text-[0.92rem] leading-relaxed text-ink-2">{s.detail}</p>}
                  {(s.src || s.links?.length) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {srcList(s.src).map((src) => (
                        <SrcChip key={srcLabel(src)} src={src} has={has} onOpen={() => setViewer({ doc: src.doc, page: Array.isArray(src.page) ? src.page[0] : src.page, title: s.title })} />
                      ))}
                      {s.links?.map((l) => (
                        <Link key={l.to + l.label} to={l.to} className="rounded-lg bg-brand-light px-2 py-1 text-xs font-bold text-brand print:hidden active:opacity-70">
                          {l.label} ›
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <p className="hint px-1">
        쪽 표시는 {WORK_DOCS.final.short}(176쪽판) · {WORK_DOCS.plan.short} · {WORK_DOCS.neis.short}의 쪽이에요. &lsquo;제주&rsquo;는 제주교육청 2026 기준이라 다른 시도는 자기 교육청 계획을 확인하세요. 학교 업무 담당자 · 관리자 지시가 먼저예요.
      </p>
      {viewer && (
        <PdfPageViewer key={`${viewer.doc}-${viewer.page}`} docKey={viewer.doc} page={viewer.page} title={`${WORK_DOCS[viewer.doc].short} · ${viewer.title}`} onClose={() => setViewer(null)} />
      )}
    </section>
  )
}

function srcList(src: FlowStep['src']): WorkSrc[] {
  if (!src) return []
  return Array.isArray(src) ? src : [src]
}

function SrcChip({ src, has, onOpen }: { src: WorkSrc; has: (d: WorkDoc) => boolean; onOpen: () => void }) {
  if (!has(src.doc)) return <span className="text-xs font-semibold whitespace-nowrap text-ink-3">({srcLabel(src)})</span>
  return (
    <button type="button" className="rounded-lg bg-fill px-2 py-1 text-xs font-bold whitespace-nowrap text-ink-2 print:hidden active:opacity-70" onClick={onOpen}>
      {srcLabel(src)} 열기
    </button>
  )
}

/** 현장 양식: 제작자(현직 체육교사)가 실제로 쓴 문서 — 개인정보 지운 사본, public/docs/ */
export function AuthorDocsCard({ id, title }: { id: FlowId; title: string }) {
  const list = AUTHOR_DOCS[id]
  return (
    <section className="card space-y-2">
      <p className="flex items-center gap-2 font-extrabold">
        <Icon name="file" size={20} className="text-brand" /> 현장 양식 · {title}
      </p>
      {list.length === 0 ? (
        <p className="hint">아직 올린 양식이 없어요. PE LOG를 만든 현직 체육교사가 실제 업무에 쓴 양식을 개인정보를 지워 차례로 올릴 예정이에요.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((d) => (
            <li key={d.file} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0 rounded-md bg-fill px-1.5 py-0.5 text-xs font-bold text-ink-2">{AUTHOR_KIND_LABEL[d.kind]}</span>
              <span className="min-w-0 flex-1">
                <b className="block leading-snug">{d.title}</b>
                {(d.desc || d.year) && <span className="hint block">{[d.year ? `${d.year}학년도` : '', d.desc ?? ''].filter(Boolean).join(' · ')}</span>}
              </span>
              <a href={`${BASE}${d.file}`} download className="btn btn-soft h-10 min-h-0 shrink-0 px-3 text-sm">
                <Icon name="download" size={16} /> 받기
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">현직 체육교사가 실제로 쓴 양식이에요(개인정보 지운 사본). 학교마다 양식이 달라요 — 받아서 학교 상황에 맞게 고쳐 쓰세요.</p>
    </section>
  )
}
