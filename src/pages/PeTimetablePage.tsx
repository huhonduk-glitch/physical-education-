import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { addDays, shortDateLabel, todayStr } from '../lib/dates'
import { fetchWeekTimetable, looksLikePe, NeisError, slotGroups, weekOf } from '../lib/neisOpenApi'
import { groupLabel, maxPeriod, peCells, peSummary } from '../lib/peTimetable'
import { useApp } from '../state/AppContext'
import ComciTimetable from './ComciTimetable'

const DAYS = ['월', '화', '수', '목', '금']

/**
 * 전체 체육 시간표: 같은 시각 체육 수업이 겹치는지 본다.
 * - 컴시간(기본): 학교 + 내 이름 → 선생님 이름까지 (교사 계정 중계를 거침, 공개 시간표만)
 * - 나이스(대신): 학교 공개 자료. 선생님 이름이 없어 수업 수로만 본다
 * 교사가 누를 때만 받고, 받은 표는 이 기기에 둔다.
 */
export default function PeTimetablePage() {
  const { settings } = useApp()
  const [src, setSrc] = useState<'comci' | 'neis'>(!settings.comciWeek && settings.neisPeWeek ? 'neis' : 'comci')
  return (
    <>
      <PageHeader title="전체 체육 시간표" sub={src === 'comci' ? (settings.comciSchool?.name ?? '컴시간') : (settings.neisSchool?.name ?? '나이스')} back />
      <div className="page space-y-4 pb-10">
        <div className="segment" role="tablist">
          <button type="button" role="tab" aria-selected={src === 'comci'} onClick={() => setSrc('comci')}>
            컴시간 · 선생님 이름
          </button>
          <button type="button" role="tab" aria-selected={src === 'neis'} onClick={() => setSrc('neis')}>
            나이스
          </button>
        </div>
        {src === 'comci' ? <ComciTimetable /> : <NeisPe />}
      </div>
    </>
  )
}

/** 나이스 공개 시간표에서 체육 칸만 모아 겹침(같은 시각 체육 수업 2개 이상)을 본다 */
function NeisPe() {
  const { settings, updateSettings, readOnly } = useApp()
  const school = settings.neisSchool
  const saved = settings.neisPeWeek
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState('')
  const [err, setErr] = useState('')
  const [onlyOverlap, setOnlyOverlap] = useState(false)

  const cells = useMemo(() => peCells(saved?.slots ?? [], settings.timetable), [saved, settings.timetable])
  const sum = peSummary(cells)
  const periods = maxPeriod(cells)

  const load = async (date: string) => {
    if (!school) return
    setBusy(true)
    setErr('')
    try {
      const lessons = await fetchWeekTimetable(school, date, { key: settings.neisApiKey, onProgress: (d, t) => setProg(`${d}/${t}`) })
      const slots = slotGroups(lessons, looksLikePe)
      if (!lessons.length) setErr('그 주 시간표가 없어요(방학 · 시험 기간이거나 아직 등록 전). 다른 주를 받아 보세요.')
      await updateSettings({ neisPeWeek: { fetchedAt: Date.now(), from: weekOf(date)[0], slots } })
    } catch (e) {
      setErr(e instanceof NeisError ? e.message : '나이스에서 받아 오지 못했어요. 인터넷과 인증키를 확인해 주세요.')
    } finally {
      setBusy(false)
      setProg('')
    }
  }

  return (
    <>
        {!school ? (
          <section className="card space-y-2">
            <p className="font-bold">나이스에서 우리 학교를 먼저 찾아 주세요.</p>
            <Link to="/more/settings/neis" className="btn btn-primary w-full">
              나이스에서 불러오기
            </Link>
          </section>
        ) : (
          <section className="card space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-primary" onClick={() => load(todayStr())} disabled={busy || readOnly}>
                <Icon name="download" /> 이번 주 받기
              </button>
              <button type="button" className="btn btn-soft" onClick={() => load(addDays(todayStr(), 7))} disabled={busy || readOnly}>
                다음 주 받기
              </button>
            </div>
            {busy && <p className="hint">받는 중… {prog}</p>}
            {!settings.neisApiKey && <p className="hint">나이스 인증키가 없으면 일부만 받아져요. [나이스에서 불러오기]에서 인증키를 넣어 주세요(무료).</p>}
            {err && <p className="font-bold text-danger">{err}</p>}
            <p className="hint">학교 공개 시간표(나이스)에서 체육 과목 칸만 모아요. 나이스 공개 자료에는 담당 선생님 이름이 없어서, 같은 시각에 따로 하는 체육 수업 수로 겹침을 봐요(합반은 하나로 셈).</p>
          </section>
        )}

        {saved && (
          <>
            <section className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: '겹치는 칸', n: sum.overlaps, c: sum.overlaps ? 'text-danger' : 'text-ok' },
                { l: '내 수업과 겹침', n: sum.mineOverlaps, c: sum.mineOverlaps ? 'text-danger' : 'text-ok' },
                { l: '한 시각 최대', n: sum.peak, c: 'text-ink' },
              ].map((x) => (
                <div key={x.l} className="rounded-2xl bg-fill py-3">
                  <p className={`text-2xl font-extrabold tabular-nums ${x.c}`}>{x.n}</p>
                  <p className="text-[0.75rem] font-bold text-ink-3">{x.l}</p>
                </div>
              ))}
            </section>
            <div className="flex items-center gap-2">
              <p className="hint flex-1">
                {shortDateLabel(saved.from)} 주 · {new Date(saved.fetchedAt).toLocaleDateString('ko-KR')} 받음 · 체육 수업 {sum.lessons}개
              </p>
              <button type="button" className="chip min-h-[40px] text-sm" aria-pressed={onlyOverlap} onClick={() => setOnlyOverlap(!onlyOverlap)}>
                겹침만
              </button>
            </div>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-[0.8rem]">
                <thead>
                  <tr>
                    <th className="w-8" />
                    {DAYS.map((d) => (
                      <th key={d} className="py-1 font-extrabold text-ink-2">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                    <tr key={p}>
                      <th className="text-center font-extrabold text-ink-3 tabular-nums">{p}</th>
                      {DAYS.map((_, di) => {
                        const c = cells.get(`${di + 1}|${p}`)
                        const show = c && (!onlyOverlap || c.count >= 2)
                        const tone = !show ? 'bg-fill/50' : c.count >= 2 ? 'bg-danger-light text-danger' : c.count === 1 ? 'bg-brand-light text-brand-ink' : 'bg-fill'
                        return (
                          <td key={di} className={`h-14 rounded-lg p-1 align-top ${tone} ${show && c.mine ? 'ring-2 ring-ink' : ''}`}>
                            {show && (
                              <>
                                {c.count >= 2 && <b className="block">겹침 {c.count}</b>}
                                {c.groups.map((g) => (
                                  <span key={g.key} className="block truncate leading-tight" title={groupLabel(g)}>
                                    {groupLabel(g)}
                                  </span>
                                ))}
                                {c.mine && <span className="block font-extrabold">내 수업</span>}
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint px-1">빨간 칸 = 같은 시각에 체육 수업이 2개 이상(체육관 · 운동장 · 교구를 나눠 써야 할 수 있어요). 검은 테두리 = 내 시간표에 있는 칸.</p>
          </>
        )}
    </>
  )
}
