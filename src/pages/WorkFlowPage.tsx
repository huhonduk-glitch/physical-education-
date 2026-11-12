import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import WorkFlowChart, { AuthorDocsCard } from '../components/WorkFlowChart'
import { AUTHOR_DOCS } from '../data/authorDocs'
import { WORK_FLOWS, workFlow } from '../data/peFlows'

/**
 * 업무 흐름도 (2026-11-12 교사 요청): 운동부 · 스포츠클럽 · 소위원회 · PAPS · 건강체력교실 · 체육대회의 1년 흐름.
 * ?f=club 처럼 고른 흐름을 주소에 둬서 다른 화면(PAPS · 건강체력교실)에서 바로 연다.
 */
export default function WorkFlowPage() {
  const [sp, setSp] = useSearchParams()
  const flow = workFlow(sp.get('f') ?? '') ?? WORK_FLOWS[0]
  return (
    <>
      <PageHeader
        title="업무 흐름도"
        sub="1년 동안 무엇을 언제 · 어디서"
        back
        right={
          <button type="button" className="btn btn-ghost px-2" aria-label="인쇄 · PDF로 저장" onClick={() => window.print()}>
            <Icon name="download" />
          </button>
        }
      />
      <div className="page space-y-4 pb-10">
        <div className="flex flex-wrap gap-1.5 print:hidden" role="radiogroup" aria-label="업무 고르기">
          {WORK_FLOWS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={f.id === flow.id} className="chip" onClick={() => setSp({ f: f.id }, { replace: true })}>
              {f.short}
            </button>
          ))}
        </div>
        <WorkFlowChart flow={flow} />
        <AuthorDocsCard id={flow.id} title={flow.short} />
        <p className="hint text-center print:hidden">위 [인쇄] 버튼으로 이 흐름도를 PDF로 저장해 업무 인계 자료로 쓸 수 있어요.</p>
      </div>
    </>
  )
}

/** 제작자가 실제로 쓴 문서 — 업무별로 한 화면에 */
export function AuthorDocsPage() {
  const total = WORK_FLOWS.reduce((n, f) => n + AUTHOR_DOCS[f.id].length, 0)
  return (
    <>
      <PageHeader title="제작자 실제 문서" sub={total ? `${total}개 · 개인정보 지운 사본` : '개인정보 지운 사본을 올릴 예정'} back />
      <div className="page space-y-3 pb-10">
        <p className="hint px-1">PE LOG를 만든 현직 체육교사가 실제 업무에 쓴 계획서 · 양식이에요. 받아서 학교 상황에 맞게 고쳐 쓰세요.</p>
        {total === 0 ? (
          <section className="card space-y-2">
            <p className="font-extrabold">아직 올린 문서가 없어요</p>
            <p className="hint">아래 업무별로, 실제로 쓴 양식을 개인정보를 지워 차례로 올릴 예정이에요.</p>
            <div className="flex flex-wrap gap-1.5">
              {WORK_FLOWS.map((f) => (
                <span key={f.id} className="rounded-lg bg-fill px-2 py-1 text-sm font-bold text-ink-2">
                  {f.short}
                </span>
              ))}
            </div>
          </section>
        ) : (
          WORK_FLOWS.filter((f) => AUTHOR_DOCS[f.id].length > 0).map((f) => <AuthorDocsCard key={f.id} id={f.id} title={f.short} />)
        )}
      </div>
    </>
  )
}
