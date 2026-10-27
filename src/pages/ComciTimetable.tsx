import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Collapse from '../components/Collapse'
import Icon from '../components/Icon'
import { db } from '../db/db'
import { applyNeisTimetable } from '../db/neisRepo'
import {
  COMCI_RELAY_DEFAULT,
  ComciError,
  comciConfig,
  comciLoad,
  comciSearch,
  findTeacher,
  myPicks,
  peGrid,
  peTeacherNos,
  periodStarts,
  teacherLessons,
  type ComciPeCell,
  type ComciSchool,
} from '../lib/comcigan'
import { useApp } from '../state/AppContext'

const DAYS = ['월', '화', '수', '목', '금']

const errText = (e: unknown) => (e instanceof ComciError ? e.message : '컴시간에서 받아 오지 못했어요. 잠시 뒤 다시 해 보세요.')

/**
 * 컴시간알리미에서 학교 + 내 이름으로 시간표 가져오기 (2026-10-26 교사 결정).
 * 교사 계정의 중계(relay/comcigan-worker.js)를 거친다. 오가는 것: 학교 이름 · 학교 코드 · 컴시간 공개 시간표. 학생 정보 없음.
 */
export default function ComciTimetable() {
  const { settings, updateSettings, readOnly } = useApp()
  const relay = settings.comciRelayUrl || COMCI_RELAY_DEFAULT
  const school = settings.comciSchool
  const saved = settings.comciWeek
  const [name, setName] = useState(settings.comciTeacherName)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [timesMsg, setTimesMsg] = useState('')
  const [onlyOverlap, setOnlyOverlap] = useState(false)
  const [replaceAll, setReplaceAll] = useState(true)

  const load = async (next: boolean) => {
    if (!school) return
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const cfg = await comciConfig(relay)
      const week = Number(cfg.r) + (next ? 1 : 0)
      const data = await comciLoad(relay, cfg, school.code, week)
      const found = findTeacher(data, name)
      const myNo = found.length === 1 ? found[0] : null
      const peNos = [...new Set([...peTeacherNos(data), ...(myNo ? [myNo] : [])])].sort((a, b) => a - b)
      const label = data.weeks.find((w) => w[0] === week)?.[1] ?? ''
      // 교시 시작 시각도 컴시간대로 (나이스 시간표에는 시각이 없다). 지금 수업 · 오늘 시간표 표시에 쓰인다
      const starts = periodStarts(data)
      const timesChanged = starts.length > 0 && starts.join() !== settings.periodStarts.join()
      await updateSettings({ comciTeacherName: name.trim(), comciWeek: { fetchedAt: Date.now(), week, label, myNo, peNos, data }, ...(timesChanged ? { periodStarts: starts } : {}) })
      setTimesMsg('')
      if (timesChanged) setTimesMsg(`교시 시각도 컴시간대로 맞췄어요: ${starts.map((t, i) => `${i + 1}교시 ${t}`).join(' · ')}`)
      if (!name.trim()) setErr('내 이름을 넣으면 내 수업을 찾아 시간표에 넣을 수 있어요.')
      else if (found.length === 0) setErr(`컴시간 시간표에서 '${name.trim()}' 선생님을 찾지 못했어요. 아래 [나는 누구]에서 골라 주세요.`)
      else if (found.length > 1) setErr(`같은 이름이 ${found.length}명이에요. 아래 [나는 누구]에서 골라 주세요.`)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const setMe = (no: number | null) => {
    setErr('')
    if (!saved) return
    const peNos = no && !saved.peNos.includes(no) ? [...saved.peNos, no].sort((a, b) => a - b) : saved.peNos
    void updateSettings({ comciWeek: { ...saved, myNo: no, peNos } })
  }
  const togglePe = (no: number) => {
    if (!saved) return
    const peNos = saved.peNos.includes(no) ? saved.peNos.filter((x) => x !== no) : [...saved.peNos, no].sort((a, b) => a - b)
    void updateSettings({ comciWeek: { ...saved, peNos } })
  }

  const grid = useMemo(() => (saved ? peGrid(saved.data, saved.peNos) : new Map<string, ComciPeCell>()), [saved])
  const mine = useMemo(() => (saved?.myNo ? teacherLessons(saved.data, saved.myNo) : []), [saved])
  const periods = Math.max(0, ...[...grid.values()].map((c) => c.period), saved?.data.periodTimes.length ?? 0)
  const cells = [...grid.values()]
  const overlaps = cells.filter((c) => c.items.length >= 2).length
  const roomClashes = cells.filter((c) => c.roomClash.length).length
  const mineOverlaps = saved?.myNo ? cells.filter((c) => c.items.length >= 2 && c.items.some((x) => x.teacherNo === saved.myNo)).length : 0

  const apply = async () => {
    if (!saved?.myNo) return
    const picks = myPicks(saved.data, saved.myNo)
    const r = await applyNeisTimetable(db, { schoolYear: settings.schoolYear, picks, current: settings.timetable, replaceAll })
    await updateSettings({ timetable: r.timetable })
    setMsg(
      `시간표 ${r.slots}칸을 넣었어요.${r.createdHomerooms ? ` 새 학적반 ${r.createdHomerooms}개.` : ''}${
        r.createdElectives.length ? ` 합반 수강반 ${r.createdElectives.length}개(${r.createdElectives.join(', ')}) — 선택과목이라 일부 학생만 듣는다면 수업반에서 학생을 고쳐 주세요.` : ''
      }`,
    )
  }

  return (
    <>
      {!relay ? (
        <section className="card space-y-2">
          <p className="font-bold">컴시간 중계 주소가 아직 없어요.</p>
          <p className="hint">컴시간은 학교 밖 앱에서 바로 부를 수 없어 중계를 거쳐요. 아래 [중계 주소]에 넣거나, 그동안은 [나이스] 탭을 쓰세요.</p>
        </section>
      ) : (
        <SchoolPicker relay={relay} school={school} onPick={(s) => updateSettings({ comciSchool: s, comciWeek: null })} />
      )}

      {relay && school && (
        <section className="card space-y-2">
          <label className="block">
            <span className="label">내 이름 (컴시간에 나오는 이름)</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" autoComplete="off" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" onClick={() => load(false)} disabled={busy || readOnly}>
              <Icon name="download" /> 이번 주 받기
            </button>
            <button type="button" className="btn btn-soft" onClick={() => load(true)} disabled={busy || readOnly}>
              다음 주 받기
            </button>
          </div>
          {busy && <p className="hint">받는 중…</p>}
          {err && <p className="font-bold text-danger">{err}</p>}
          {timesMsg && (
            <p className="font-bold text-ok" role="status">
              {timesMsg}
            </p>
          )}
          <p className="hint">컴시간알리미의 공개 시간표(과목 · 선생님 이름 · 교실)를 받아요. 학생 정보는 보내지도 받지도 않아요. 받은 표는 이 기기에만 둬요.</p>
        </section>
      )}

      {saved && (
        <>
          <section className="grid grid-cols-3 gap-2 text-center">
            {[
              { l: '겹치는 칸', n: overlaps, c: overlaps ? 'text-danger' : 'text-ok' },
              { l: '내 수업과 겹침', n: mineOverlaps, c: mineOverlaps ? 'text-danger' : 'text-ok' },
              { l: '같은 교실 겹침', n: roomClashes, c: roomClashes ? 'text-danger' : 'text-ok' },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-fill py-3">
                <p className={`text-2xl font-extrabold tabular-nums ${x.c}`}>{x.n}</p>
                <p className="text-[0.75rem] font-bold text-ink-3">{x.l}</p>
              </div>
            ))}
          </section>

          <Collapse title="체육 선생님 · 나는 누구" sub={`${saved.peNos.length}명 비교 중${saved.myNo ? ` · 나: ${saved.data.teachers[saved.myNo]}` : ' · 나를 골라 주세요'}`} defaultOpen={!saved.myNo}>
            <div className="space-y-3 px-1 pb-2">
              <label className="block">
                <span className="label">나는 누구</span>
                <select className="field" value={saved.myNo ?? ''} onChange={(e) => setMe(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">고르세요</option>
                  {saved.data.teachers.map((t, i) =>
                    i > 0 && t ? (
                      <option key={i} value={i}>
                        {t}
                        {saved.peNos.includes(i) ? ' (체육)' : ''}
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
              <div>
                <p className="label">겹침을 볼 선생님 (과목 · 교실로 체육 선생님을 먼저 골라 뒀어요)</p>
                <div className="flex flex-wrap gap-1.5">
                  {saved.data.teachers.map((t, i) =>
                    i > 0 && t && (saved.peNos.includes(i) || teacherLessons(saved.data, i).some((l) => /체육|운동|스포츠/.test(l.subject))) ? (
                      <button key={i} type="button" className="chip" aria-pressed={saved.peNos.includes(i)} onClick={() => togglePe(i)}>
                        {t}
                        {i === saved.myNo ? ' (나)' : ''}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          </Collapse>

          <div className="flex items-center gap-2">
            <p className="hint flex-1">
              {saved.label || `${saved.week}주`} · {new Date(saved.fetchedAt).toLocaleDateString('ko-KR')} 받음
            </p>
            <button type="button" className="chip min-h-[40px] text-sm" aria-pressed={onlyOverlap} onClick={() => setOnlyOverlap(!onlyOverlap)}>
              겹침만
            </button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[600px] table-fixed border-separate border-spacing-1 text-[0.8rem]">
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
                      const c = grid.get(`${di + 1}|${p}`)
                      const n = c?.items.length ?? 0
                      const show = c && (!onlyOverlap || n >= 2)
                      const isMine = !!c && c.items.some((x) => x.teacherNo === saved.myNo)
                      const tone = !show ? 'bg-fill/50' : n >= 2 ? 'bg-danger-light text-danger' : 'bg-brand-light text-brand-ink'
                      return (
                        <td key={di} className={`h-14 rounded-lg p-1 align-top ${tone} ${show && isMine ? 'ring-2 ring-ink' : ''}`}>
                          {show && (
                            <>
                              {n >= 2 && <b className="block">겹침 {n}</b>}
                              {c.items.map((x) => (
                                <span key={`${x.teacherNo}|${x.subject}`} className="block leading-tight" title={`${x.teacher} ${x.subject} ${x.classes.join('·')} ${x.room ?? ''}`}>
                                  <b className={x.teacherNo === saved.myNo ? 'underline' : ''}>{x.teacher}</b> {x.classes.join('·')}
                                  {x.room && <span className="block truncate text-[0.7rem]">{x.room}</span>}
                                  {x.changed && <span className="text-[0.7rem] font-bold"> 변경</span>}
                                </span>
                              ))}
                              {c.roomClash.length > 0 && <b className="block text-[0.7rem]">{c.roomClash.join('·')} 같이 씀</b>}
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
          <p className="hint px-1">빨간 칸 = 같은 시각에 체육 수업 2개 이상. '같이 씀' = 같은 교실(체육관 등)을 둘 이상이 써요. 검은 테두리 = 내 수업. '변경' = 이번 주 바뀐 수업.</p>

          {saved.myNo && (
            <section className="card space-y-2">
              <p className="card-title">내 시간표로 넣기</p>
              <p className="hint">
                {saved.data.teachers[saved.myNo]} 선생님 수업 {mine.length}시간을 앱 시간표 · 수업반으로 넣어요(같은 시각 여러 반이면 합반 수강반).
              </p>
              <label className="flex min-h-[48px] items-center gap-3">
                <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
                <span>
                  <b>지금 시간표를 비우고 새로 채우기</b>
                  <span className="hint block">끄면 내 수업 칸만 바꾸고 나머지는 그대로 둬요.</span>
                </span>
              </label>
              <button type="button" className="btn btn-primary w-full" onClick={apply} disabled={readOnly || mine.length === 0}>
                내 시간표로 넣기
              </button>
              {msg && (
                <p className="font-bold text-ok" role="status">
                  {msg}{' '}
                  <Link to="/more/settings/timetable" className="text-brand underline">
                    시간표 보기
                  </Link>
                </p>
              )}
            </section>
          )}
        </>
      )}

      <Collapse title="중계 주소" sub={relay ? '설정됨' : '없음'}>
        <RelayField value={settings.comciRelayUrl} onSave={(v) => updateSettings({ comciRelayUrl: v })} />
      </Collapse>
    </>
  )
}

function SchoolPicker({ relay, school, onPick }: { relay: string; school: ComciSchool | null; onPick: (s: ComciSchool) => void }) {
  const [editing, setEditing] = useState(!school)
  const [q, setQ] = useState('')
  const [list, setList] = useState<ComciSchool[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const search = async () => {
    if (q.trim().length < 2) return setErr('학교 이름을 두 글자 이상 넣어 주세요.')
    setBusy(true)
    setErr('')
    try {
      const cfg = await comciConfig(relay)
      const r = await comciSearch(relay, cfg, q)
      setList(r)
      if (!r.length) setErr('컴시간에서 그 학교를 찾지 못했어요. 컴시간을 쓰지 않는 학교면 [나이스] 탭을 쓰세요.')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (school && !editing)
    return (
      <section className="card flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold">{school.name}</p>
          <p className="hint">컴시간 · {school.region}</p>
        </div>
        <button type="button" className="btn btn-soft" onClick={() => setEditing(true)}>
          바꾸기
        </button>
      </section>
    )
  return (
    <section className="card space-y-2">
      <p className="card-title">컴시간에서 우리 학교 찾기</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <input className="field flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 시연고" autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '찾는 중…' : '찾기'}
        </button>
      </form>
      {err && <p className="font-bold text-danger">{err}</p>}
      {list && list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((s) => (
            <li key={s.code}>
              <button
                type="button"
                className="btn btn-soft w-full justify-start"
                onClick={() => {
                  onPick(s)
                  setEditing(false)
                }}
              >
                {s.name} <span className="hint">{s.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RelayField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="space-y-2 px-1 pb-2">
      <p className="hint">
        컴시간은 http로만 열리고 다른 사이트에서 부르는 것을 막아 두어, 선생님 계정의 무료 중계(Cloudflare Worker)를 거쳐요. 비워 두면 앱에 들어 있는 기본 중계를 써요. 중계는 컴시간 시간표 주소만 전달하고 아무것도 저장하지
        않아요(같은 요청 10분 캐시).
      </p>
      <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://….workers.dev" inputMode="url" autoComplete="off" />
      <button type="button" className="btn btn-soft w-full" onClick={() => onSave(v.trim())} disabled={v.trim() === value || (!!v.trim() && !/^https:\/\//.test(v.trim()))}>
        저장
      </button>
    </div>
  )
}
