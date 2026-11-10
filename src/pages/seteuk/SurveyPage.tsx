import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import Collapse from '../../components/Collapse'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { saveXlsx } from '../../lib/download'
import { readSurvey, summarize, SURVEY_KINDS, type Survey, type SurveyKind } from '../../lib/survey'
import { useApp } from '../../state/AppContext'

/**
 * 설문 · 자기평가 넣기 (2026-11-10): 구글 설문 응답 시트를 붙여 넣으면 학생마다 답을 맞춰 보관.
 * 세특 편집 창에 '학생이 쓴 글(참고만)'으로 보인다 — 초안 · AI에는 넣지 않음(기재요령 길라잡이). 계산 src/lib/survey.ts
 */
export default function SurveyPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const year = settings.schoolYear
  const list: Survey[] = settings.surveys?.[year] ?? []
  const save = (next: Survey[]) => updateSettings({ surveys: { ...(settings.surveys ?? {}), [year]: next } })
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(year).toArray(), [year])
  const nameOf = useMemo(() => new Map((students ?? []).map((s) => [s.id, `${s.grade}-${s.classNo}-${s.number} ${s.name}`])), [students])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<SurveyKind>('자기평가서')
  const [text, setText] = useState('')
  const [keep, setKeep] = useState<boolean[]>([])
  const read = useMemo(() => (text.trim() && students ? readSurvey(text, students) : null), [text, students])

  const reset = () => {
    setAdding(false)
    setTitle('')
    setText('')
    setKeep([])
  }
  const add = () => {
    if (!read || !read.rows.length) return
    const on = read.questions.map((_, i) => keep[i] ?? true)
    const sv: Survey = {
      id: `sv${Date.now().toString(36)}`,
      title: title.trim() || `${kind} ${new Date().toLocaleDateString('ko-KR')}`,
      kind,
      createdAt: Date.now(),
      questions: read.questions.filter((_, i) => on[i]),
      answers: Object.fromEntries(read.rows.map((r) => [r.studentId, r.answers.filter((_, i) => on[i])])),
    }
    void save([...list, sv])
    reset()
  }
  const exportXlsx = (s: Survey) =>
    void saveXlsx(`설문_${s.title}.xlsx`, [
      {
        name: '응답',
        rows: [['학생', ...s.questions], ...Object.entries(s.answers).map(([id, a]) => [nameOf.get(id) ?? '(명렬에 없음)', ...a])],
        widths: [16, ...s.questions.map(() => 30)],
      },
    ])

  return (
    <>
      <PageHeader title="설문 · 자기평가" sub={`${year}학년도 · ${list.length}개`} back />
      <div className="page space-y-4 pb-10">
        <p className="rounded-2xl bg-fill px-4 py-2 text-[0.85rem] font-semibold text-ink-3">
          구글 설문 응답 시트를 첫 줄(질문 줄)부터 복사해 붙여 넣으면 학번 · 이름으로 학생을 찾아 보관해요. 세특 쓰기 편집 창에 <b>학생이 쓴 글(참고만)</b>으로 보이고, 초안 · AI에는 넣지 않아요 — 기재요령상 학생이 써 낸 글은 참고만 하고 그대로 옮기지 않아요.
        </p>

        {!readOnly &&
          (adding ? (
            <section className="card space-y-3">
              <p className="card-title">설문 결과 넣기</p>
              <input className="field" placeholder="이름 (예: 배드민턴 단원 자기평가)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                {SURVEY_KINDS.map((k) => (
                  <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {k}
                  </button>
                ))}
              </div>
              <textarea className="field min-h-[8rem] font-mono text-sm" placeholder={'타임스탬프\t학번\t이름\t질문1\t질문2 …\n(응답 시트에서 머리글 줄부터 복사)'} value={text} onChange={(e) => setText(e.target.value)} />
              {read && (
                <div className="space-y-2 rounded-2xl bg-fill p-3 text-sm">
                  <p className="font-bold">
                    학생 {read.rows.length}명 찾음{read.idColumns.length ? ` (${read.idColumns.join(' · ')} 열로)` : ''}
                  </p>
                  {read.problems.length > 0 && (
                    <ul className="space-y-0.5 font-semibold text-caution">
                      {read.problems.slice(0, 8).map((p) => (
                        <li key={p}>· {p}</li>
                      ))}
                      {read.problems.length > 8 && <li>… 외 {read.problems.length - 8}건</li>}
                    </ul>
                  )}
                  {read.questions.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-bold">보관할 질문</p>
                      {read.questions.map((q, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input type="checkbox" className="h-5 w-5" checked={keep[i] ?? true} onChange={(e) => setKeep((k) => Object.assign([...k], { [i]: e.target.checked }))} />
                          <span className="min-w-0 flex-1 truncate">{q}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline" onClick={reset}>
                  그만두기
                </button>
                <button type="button" className="btn btn-primary flex-1" disabled={!read?.rows.length} onClick={add}>
                  보관하기 {read?.rows.length ? `(${read.rows.length}명)` : ''}
                </button>
              </div>
            </section>
          ) : (
            <button type="button" className="btn btn-primary w-full" onClick={() => setAdding(true)}>
              + 설문 결과 붙여 넣기
            </button>
          ))}

        {list.length === 0 && !adding && <p className="hint px-1">아직 넣은 설문이 없어요. 종목 선호도 조사 · 단원 자기평가 · 수업 소감 등을 넣어 두면 수업 계획과 세특 쓸 때 참고할 수 있어요.</p>}

        {list.map((s) => (
          <section key={s.id} className="card space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="badge bg-brand-light text-brand">{s.kind}</span>
                <p className="card-title mt-1">{s.title}</p>
                <p className="hint">
                  응답 {Object.keys(s.answers).length}명 · 질문 {s.questions.length}개
                </p>
              </div>
              <button type="button" className="btn btn-soft shrink-0 px-3 text-sm" onClick={() => exportXlsx(s)}>
                엑셀
              </button>
            </div>
            <Collapse title="질문별 모아 보기" sub="선택형은 답별 인원, 서술형은 응답 수">
              <div className="space-y-3">
                {summarize(s).map((q) => (
                  <div key={q.question}>
                    <p className="text-sm font-bold">{q.question}</p>
                    {q.kind === 'choice' ? (
                      <ul className="mt-1 space-y-1">
                        {q.counts.map((c) => (
                          <li key={c.answer} className="flex items-center gap-2 text-sm">
                            <span className="w-28 shrink-0 truncate">{c.answer}</span>
                            <span className="h-3 rounded bg-brand" style={{ width: `${(c.n / Math.max(1, q.counts[0].n)) * 50}%`, minWidth: '0.4rem' }} aria-hidden />
                            <span className="tabular-nums">{c.n}명</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">서술형 · 응답 {q.filled}개 (학생별 답은 세특 편집 창 · 엑셀에서)</p>
                    )}
                  </div>
                ))}
              </div>
            </Collapse>
            {!readOnly && (
              <button type="button" className="text-sm font-bold text-ink-3 underline" onClick={() => confirm(`'${s.title}' 설문을 지울까요?`) && void save(list.filter((x) => x.id !== s.id))}>
                지우기
              </button>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
