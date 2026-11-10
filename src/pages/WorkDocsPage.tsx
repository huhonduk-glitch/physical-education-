import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import PdfPageViewer from '../components/PdfPageViewer'
import { DRAFT_DOCS, draftText, FORMS, mergeEvents, NOT_DRAFT, PLAN_BOARD_URL, submitEvents, SUBMITS, type DraftDoc } from '../data/peDocs'
import { WORK_DOCS } from '../data/peWork'
import { db } from '../db/db'
import { listDocs } from '../db/docStore'
import { loadSchoolPaps } from '../db/reportRepo'
import { draftFacts } from '../lib/draftFacts'
import { eventName, type EventId } from '../lib/paps'
import { PLAN_FIELDS } from '../lib/clinic'
import { copyText } from '../lib/download'
import { useApp } from '../state/AppContext'

type Tab = 'draft' | 'submit' | 'forms'
const MUST_TONE: Record<DraftDoc['must'], string> = {
  '법정 의무': 'bg-danger-light text-danger',
  필수: 'bg-brand-light text-brand',
  '해당 학교': 'bg-fill text-ink-2',
  권장: 'bg-fill text-ink-3',
}
// 붙은 쪽은 범위(23~24쪽), 떨어진 쪽은 따로(19 · 156쪽)
const pageLabel = (p: number | [number, number]) => (Array.isArray(p) ? `${p[0]}${p[1] - p[0] > 3 ? " · " : "~"}${p[1]}쪽` : `${p}쪽`)

/**
 * 매년 기안 · 제출 문서 (2026-11-09 교사 요청): 나이스와 상관없이 학교장 결재로 세우는 계획, 교육청 제출 일정, 양식 · 서식.
 * 근거 src/data/peDocs.ts (제주교육청 2026 운영방향 누리집 PDF 쪽).
 */
export default function WorkDocsPage() {
  const { settings, standards, updateSettings, readOnly } = useApp()
  const [tab, setTab] = useState<Tab>('draft')
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [hasFinal, setHasFinal] = useState(false)
  const [viewer, setViewer] = useState<{ page: number; title: string } | null>(null)
  useEffect(() => {
    listDocs()
      .then((d) => setHasFinal(d.some((x) => x.key === 'final')))
      .catch(() => setHasFinal(false))
  }, [])
  const year = settings.schoolYear

  const copyDraft = async (d: DraftDoc) => {
    // 건강체력교실은 이 기기에 적은 운영계획을 채운다
    const plan = settings.clinic?.[year]?.plan
    const planLines = d.id === 'clinic' && plan && PLAN_FIELDS.some((f) => plan[f.key]) ? ['  (앱에 적은 운영계획)', ...PLAN_FIELDS.filter((f) => plan[f.key]).map((f) => `   · ${f.label}: ${plan[f.key]}`)] : []
    // 현황 줄: 앱에 있는 학생 수 · PAPS · 측정 종목 · 소위원회 (2026-11-10)
    const ctx = { standards, schoolLevel: settings.schoolLevel, flexMode: settings.papsFlexMode }
    const [students, paps, lastPaps, configs, rounds] = await Promise.all([
      db.students.where('schoolYear').equals(year).toArray(),
      loadSchoolPaps(db, year, ctx),
      loadSchoolPaps(db, year - 1, ctx),
      db.papsConfigs.toArray(),
      db.papsRounds.where('schoolYear').equals(year).toArray(),
    ])
    const facts = draftFacts(d.id, {
      year,
      schoolLevel: settings.schoolLevel,
      students: students.filter((s) => s.status === '재학').map((s) => ({ grade: s.grade, gender: s.gender })),
      paps,
      lastPaps,
      rule: settings.clinicRule,
      configs: configs.filter((c) => c.schoolYear === year).map((c) => ({ grade: c.grade, events: Object.values(c.selectedEvents).map((e) => eventName(standards, e as EventId)) })),
      rounds: rounds.map((r) => ({ grade: r.grade, round: r.round, date: r.date })),
      clinic: settings.clinic?.[year],
      committee: settings.committee?.[year],
    })
    const extra = [...facts, ...planLines]
    if (await copyText(draftText(d, { schoolName: settings.schoolName, year, extra }))) {
      setCopied(d.id)
      setTimeout(() => setCopied(null), 2000)
    }
  }
  const addToCalendar = () => {
    const r = mergeEvents(settings.workEvents ?? [], submitEvents(year))
    void updateSettings({ workEvents: r.list })
    setMsg(r.added ? `업무 달력에 ${r.added}개를 넣었어요.` : '이미 다 들어가 있어요.')
  }

  return (
    <>
      <PageHeader title="매년 기안 · 제출 문서" sub="학교체육 업무 · 나이스와 따로" back />
      <div className="page space-y-4 pb-10">
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          제주교육청 「2026학년도 학교체육 운영방향」(누리집 PDF)에서 학교장 결재로 매년 세워야 하는 계획과 교육청 제출 일정을 모았어요. 다른 시도는 자기 교육청 운영방향을 확인하세요.{' '}
          <a href={PLAN_BOARD_URL} target="_blank" rel="noreferrer" className="font-bold text-brand">
            원본 · 양식 받기 ›
          </a>
        </p>
        <div className="segment" role="tablist">
          {(
            [
              ['draft', `기안 문서 ${DRAFT_DOCS.length}`],
              ['submit', '제출 일정'],
              ['forms', '양식 · 서식'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'draft' &&
          DRAFT_DOCS.map((d) => {
            const on = open === d.id
            return (
              <section key={d.id} className="card space-y-2">
                <button type="button" className="flex w-full items-start gap-2 text-left" aria-expanded={on} onClick={() => setOpen(on ? null : d.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${MUST_TONE[d.must]}`}>{d.must}</span>
                      <span className="text-sm font-bold text-ink-3">{d.when}</span>
                    </span>
                    <b className="mt-1 block leading-snug">{d.title}</b>
                  </span>
                  <Icon name="chevronRight" className={`mt-1 shrink-0 text-ink-3 transition-transform ${on ? 'rotate-90' : ''}`} />
                </button>
                {on && (
                  <div className="space-y-2 text-[0.92rem]">
                    <div>
                      <p className="text-sm font-bold text-ink-3">근거</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {d.basis.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-3">꼭 넣을 내용</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {d.include.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    {d.after && (
                      <p>
                        <span className="text-sm font-bold text-ink-3">결재 뒤 </span>
                        {d.after}
                      </p>
                    )}
                    <p className="hint">운영방향(누리집 PDF) {pageLabel(d.page)}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary flex-1" onClick={() => void copyDraft(d)}>
                        <Icon name="copy" size={18} /> {copied === d.id ? '복사했어요' : '기안문 초안 복사'}
                      </button>
                      {hasFinal && (
                        <button type="button" className="btn btn-soft" onClick={() => setViewer({ page: Array.isArray(d.page) ? d.page[0] : d.page, title: d.title })}>
                          원문 쪽 열기
                        </button>
                      )}
                      {d.app && (
                        <Link to={d.app.to} className="btn btn-soft">
                          {d.app.label} ›
                        </Link>
                      )}
                    </div>
                    <p className="hint">
                      초안은 근거와 꼭 넣을 내용을 골자로 만든 것이에요. {['girls', 'clinic', 'paps', 'committee'].includes(d.id) ? '현황 줄(학생 수 · PAPS · 측정 종목 · 위원)은 이 기기 자료로 채워 넣어요(학생 이름은 넣지 않음). ' : ''}( ) 빈칸은 학교 상황에 맞게 채워 결재 시스템 본문에 붙여 넣으세요.
                    </p>
                  </div>
                )}
              </section>
            )
          })}

        {tab === 'draft' && (
          <section className="card space-y-2">
            <p className="font-bold">참고: 따로 기안하지 않는 것</p>
            <p className="hint">운영방향에 '계획 수립'이라고 나오지만 필수 · 의무 표시가 없고, 다른 계획에 담거나 점검 기록으로 하는 것이에요.</p>
            <ul className="space-y-1.5 text-[0.92rem]">
              {NOT_DRAFT.map((n) => (
                <li key={n.title}>
                  <b>{n.title}</b> — {n.text} <span className="text-xs font-semibold whitespace-nowrap text-ink-3">({n.page}쪽)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'submit' && (
          <section className="space-y-2">
            <div className="card overflow-hidden p-0">
              {SUBMITS.map((s) => (
                <div key={s.what} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="w-[4.6rem] shrink-0 text-sm font-extrabold text-brand tabular-nums">{s.due.length ? s.due.map((d) => d.replace('-', '/')).join(' · ') : '수시'}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block leading-snug">{s.what}</b>
                    <span className="text-sm text-ink-2">
                      {s.how}
                      {s.form ? ` · ${s.form}` : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="hint px-1">날짜는 고등학교 기준이에요(초 · 중은 교육지원청으로 며칠 빨라요). 운영방향(누리집 PDF) 98쪽.</p>
            {!readOnly && (
              <button type="button" className="btn btn-primary w-full" onClick={addToCalendar}>
                {year}학년도 제출 일정을 업무 달력에 넣기
              </button>
            )}
            {msg && (
              <p className="text-center text-sm font-bold text-ok" role="status">
                {msg}{' '}
                <Link to="/work/calendar" className="text-brand">
                  업무 달력 ›
                </Link>
              </p>
            )}
          </section>
        )}

        {tab === 'forms' && (
          <section className="space-y-2">
            <div className="card overflow-hidden p-0">
              {FORMS.map((f) => (
                <div key={f.no} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span className="w-14 shrink-0 text-sm font-extrabold text-brand">{f.no}</span>
                  <span className="min-w-0 flex-1 leading-snug">
                    {f.title}
                    {f.page ? <span className="text-sm text-ink-3"> ({f.page}쪽)</span> : null}
                  </span>
                  {f.app ? (
                    <Link to={f.app.to} className="btn btn-soft h-10 min-h-0 shrink-0 px-3 text-sm">
                      {f.app.label}
                    </Link>
                  ) : f.page && hasFinal ? (
                    <button type="button" className="btn btn-soft h-10 min-h-0 shrink-0 px-3 text-sm" onClick={() => setViewer({ page: f.page!, title: f.title })}>
                      열기
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="hint px-1">
              양식 1~8은 운영방향 PDF 안에, 엑셀 서식 1~15는 같은 게시글의 '서식.xls'에 있어요.{' '}
              <a href={PLAN_BOARD_URL} target="_blank" rel="noreferrer" className="font-bold text-brand">
                교육청 게시판에서 받기 ›
              </a>{' '}
              {hasFinal ? '' : `PDF를 [업무 → 학교운동부]의 자료 파일 '${WORK_DOCS.final.short}'에 넣어 두면 쪽을 바로 열 수 있어요.`}
            </p>
          </section>
        )}
      </div>
      {viewer && <PdfPageViewer docKey="final" page={viewer.page} title={`운영방향 · ${viewer.title}`} onClose={() => setViewer(null)} />}
    </>
  )
}
