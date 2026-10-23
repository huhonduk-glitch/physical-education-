import { useMemo } from 'react'
import ClassPicker from '../../components/ClassPicker'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { qrModules, slipCode, type SlipResult } from '../../lib/linkCode'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { usePapsClassKey } from './common'
import RoundBar, { roundLabel } from './RoundBar'

const PER_SHEET = 12 // A4 한 장 = 3열 × 4행

const NO_CODE: Record<Exclude<SlipResult, { ok: true }>['reason'], string> = {
  excluded: '측정 제외',
  noGrades: '등급 없음',
  noDate: '측정일 없음',
  badDate: '측정일 범위 밖',
}

/**
 * 튼튼몬 연동 코드 쪽지 (PELOG_LINK_FORMAT.md). 반·회차를 고르면 학생마다 코드 + QR.
 * 코드에는 4개 요인 등급과 측정일만. 이름은 화면(선생님 확인용)에만 보이고 인쇄에는 나오지 않는다 —
 * 코드 형식이 공개돼 있어 코드만 있으면 등급을 풀 수 있으므로 이름과 코드를 같은 종이에 두지 않는다.
 * 코드는 저장하지 않고 열 때마다 다시 계산한다.
 */
export default function PapsLinkCodesPage() {
  const { readOnly } = useApp()
  const { classes, mine, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const date = pc.round.date

  const rows = useMemo(
    () => pc.students.map((s) => ({ s, r: slipCode(pc.summaries.get(s.id), pc.excluded.has(s.id), date) })),
    [pc.students, pc.summaries, pc.excluded, date],
  )
  const slips = rows.filter((x): x is { s: (typeof rows)[number]['s']; r: { ok: true; code: string } } => x.r.ok)
  const missing = rows.filter((x) => !x.r.ok)
  const sheets = Array.from({ length: Math.ceil(slips.length / PER_SHEET) }, (_, i) => slips.slice(i * PER_SHEET, (i + 1) * PER_SHEET))

  return (
    <>
      <PageHeader
        title="튼튼몬 연동 코드"
        sub={cls ? `${cls.grade}학년 ${cls.classNo}반 · ${roundLabel(pc.round)} · 쪽지 ${slips.length}장` : undefined}
        back
        right={
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!slips.length}>
            <Icon name="file" /> 인쇄
          </button>
        }
      />
      <div className="page space-y-4 pb-10 print:max-w-none print:space-y-0 print:p-0">
        <div className="space-y-4 print:hidden">
          <ClassPicker classes={classes} mine={mine} value={cls} onChange={setCls} />
          {cls && <RoundBar rounds={pc.rounds} readOnly={readOnly} />}
          <section className="card space-y-1.5">
            <p className="card-title">나눠 주기 전에</p>
            <p className="text-[0.95rem] text-ink-2">
              코드에는 이 회차의 <b>체력요인 4개 등급과 측정일만</b> 들어 있어요. 이름·학번·측정값·BMI는 없어요. 하지만 코드 형식이 공개돼 있어 <b>코드만 있으면 등급을 알 수 있어요</b>.
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-[0.95rem] text-ink-2">
              <li>쪽지에는 학년·반·번호, 코드, QR만 찍혀요. 이름은 이 화면에만 보이고 인쇄되지 않아요 — 번호를 보고 나눠 주세요.</li>
              <li>학생 본인에게만 주고, 코드 목록을 단체방 등에 올리지 마세요.</li>
              <li>기록을 고쳐 등급이 바뀌면 코드도 바뀌어요. 다시 인쇄해 주면 돼요(코드는 저장하지 않아요).</li>
            </ul>
            <p className="hint">한 장에 {PER_SHEET}명(3열 × 4행). 점선을 따라 잘라요. 나이스 산출값과 다르면 나이스 값이 우선이에요.</p>
          </section>
          {cls && !date && (
            <p className="rounded-2xl bg-caution-light px-4 py-3 font-bold text-caution">위 [측정 회차]에서 {pc.round.round}회차 측정한 날을 먼저 적어 주세요. 측정일이 코드에 들어가요.</p>
          )}
          {missing.length > 0 && date && (
            <section className="card">
              <p className="card-title mb-1">코드를 만들지 않은 학생 {missing.length}명</p>
              <ul className="space-y-0.5 text-ink-2">
                {missing.map(({ s, r }) => (
                  <li key={s.id}>
                    {s.number}번 {s.name} — {!r.ok && NO_CODE[r.reason]}
                  </li>
                ))}
              </ul>
              <p className="hint mt-1">측정 제외 학생과, 4개 요인 등급이 하나도 없는 학생은 코드가 없어요.</p>
            </section>
          )}
          {cls && !pc.loading && pc.students.length === 0 && <p className="card hint">이 반에 학생이 없어요.</p>}
        </div>

        {sheets.map((sheet, i) => (
          <div key={i} className="link-sheet print-page grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3 print:gap-0">
            {sheet.map(({ s, r }) => (
              <article key={s.id} className="link-slip card flex flex-col items-center gap-1 p-3 text-center print:rounded-none print:shadow-none" aria-label={`${s.number}번 연동 코드`}>
                <p className="font-extrabold tabular-nums">
                  {s.grade}학년 {s.classNo}반 {s.number}번
                  <span className="ml-1 font-semibold text-ink-3 print:hidden">{s.name}</span>
                </p>
                <Qr code={r.code} />
                <p className="font-mono text-xl font-extrabold tracking-[0.12em]">{r.code}</p>
                <p className="text-[0.75rem] leading-snug text-ink-2">튼튼몬 알 만들기에서 코드를 넣거나 QR을 찍어요.</p>
              </article>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

/** QR을 SVG 칸으로 직접 그린다 (부품은 앱 안에 묶여 있어 인터넷 없이도 됨) */
function Qr({ code }: { code: string }) {
  const m = useMemo(() => qrModules(code), [code])
  const n = m.length
  const q = 2 // 둘레 여백 칸
  let d = ''
  m.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + q} ${y + q}h1v1h-1z`)))
  return (
    <svg className="link-qr h-28 w-28" viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} shapeRendering="crispEdges" role="img" aria-label={`QR ${code}`}>
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}
