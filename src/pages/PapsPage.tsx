import { Link } from 'react-router-dom'
import ClassPicker, { classKeyStr } from '../components/ClassPicker'
import Icon, { type IconName } from '../components/Icon'
import NeisGuide from '../components/NeisGuide'
import PageHeader from '../components/PageHeader'
import { MEASURE_LABEL } from '../lib/neisHeaderParser'
import { cellId } from '../lib/papsLayout'
import { eventName, type EventId } from '../lib/paps'
import { useApp } from '../state/AppContext'
import { usePapsClass } from '../state/usePapsClass'
import { ReadinessBadge, measureGroups, useReadiness, usePapsClassKey } from './paps/common'

/** PAPS 탭 첫 화면: 반 고르기 · 업로드 준비 상태 · 진행률 · 종목별 입력 (CLAUDE.md 4-5) */
export default function PapsPage() {
  const { standards } = useApp()
  const { classes, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const ready = useReadiness(pc)
  const q = cls ? `?c=${classKeyStr(cls)}` : ''
  const groups = measureGroups(pc.cells)
  const noConfig = !pc.usingTemplate && Object.keys(pc.selected).length === 0

  const done = pc.students.filter((s) => !pc.excluded.has(s.id) && !ready.issues.some((i) => i.studentId === s.id && i.kind === 'missing')).length
  const excluded = pc.excluded.size
  const notYet = pc.students.length - done - excluded

  return (
    <>
      <PageHeader
        title="PAPS"
        right={
          <Link to={`/paps/setup${q}`} className="btn btn-soft" aria-label="측정 설정">
            <Icon name="settings" /> 설정
          </Link>
        }
      />
      <div className="page space-y-4 pb-6">
        {classes.length === 0 ? (
          <div className="card text-center">
            <p className="card-title">먼저 학생 명렬을 올려 주세요</p>
          </div>
        ) : (
          <>
            <ClassPicker classes={classes} value={cls} onChange={setCls} />

            <section className="card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="card-title">나이스 업로드 준비</p>
                <ReadinessBadge missing={ready.missing} bad={ready.bad} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { l: '측정 완료', n: done, c: 'text-ok' },
                  { l: '미측정', n: notYet, c: 'text-caution' },
                  { l: '측정 제외', n: excluded, c: 'text-ink-3' },
                ].map((x) => (
                  <div key={x.l} className="rounded-2xl bg-fill py-2">
                    <p className={`text-2xl font-extrabold tabular-nums ${x.c}`}>{x.n}</p>
                    <p className="text-[0.78rem] font-bold text-ink-3">{x.l}</p>
                  </div>
                ))}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-fill-2">
                <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pc.students.length ? (done / (pc.students.length - excluded || 1)) * 100 : 0}%` }} />
              </div>
              <p className="hint">{pc.usingTemplate ? '등록한 나이스 양식 기준이에요.' : '나이스 양식을 아직 등록하지 않았어요. [설정]에서 등록하면 칸이 양식과 똑같아져요.'}</p>
            </section>

            {noConfig ? (
              <Link to={`/paps/setup${q}`} className="card flex items-center gap-3 bg-brand-light shadow-none">
                <Icon name="settings" className="text-brand" />
                <span className="flex-1 font-bold text-brand">이 반의 측정 종목을 먼저 정해 주세요</span>
                <Icon name="chevronRight" className="text-brand" />
              </Link>
            ) : (
              <section className="card overflow-hidden p-0">
                <p className="card-title px-5 pt-4 pb-2">종목별 입력</p>
                {groups.map((g) => {
                  const filled = pc.students.filter((s) => !pc.excluded.has(s.id) && g.cells.every((c) => pc.values.get(s.id)?.has(cellId(c)))).length
                  const total = pc.students.length - excluded
                  const label = g.key === 'bmi' ? '체질량지수 (신장·체중)' : g.key === 'pushUp' ? eventName(standards, 'pushUp') : MEASURE_LABEL[g.key]
                  return (
                    <Link key={g.key} to={`/paps/input/${g.key}${q}`} className="list-row hover:bg-fill">
                      <span className="flex-1">
                        <span className="block font-bold">{label}</span>
                        <span className="hint">
                          {g.cells.length}칸 · {standards.events[g.key as EventId]?.factor ?? (g.key === 'bmi' ? '비만' : '')}
                        </span>
                      </span>
                      <span className={`badge ${filled === total && total > 0 ? 'bg-ok-light text-ok' : 'bg-fill text-ink-2'}`}>
                        {filled}/{total}
                      </span>
                      <Icon name="chevronRight" className="text-ink-3" />
                    </Link>
                  )
                })}
              </section>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['/paps/paste', 'clipboard', '붙여넣기 입력', '엑셀에서 복사한 기록'],
                  ['/paps/results', 'paps', '결과 · 등급', '종합점수와 등급'],
                  ['/paps/export', 'download', '나이스 내보내기', '업로드 파일 만들기'],
                  ['/paps/setup', 'settings', '측정 설정', '종목 · 나이스 양식'],
                ] as [string, IconName, string, string][]
              ).map(([to, icon, t, d]) => (
                <Link key={to} to={`${to}${q}`} className="card flex flex-col gap-2 transition-transform active:scale-[0.98]">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-brand">
                    <Icon name={icon} />
                  </span>
                  <span className="font-extrabold">{t}</span>
                  <span className="hint -mt-1">{d}</span>
                </Link>
              ))}
            </div>
            <NeisGuide kind="paps" />
          </>
        )}
      </div>
    </>
  )
}
