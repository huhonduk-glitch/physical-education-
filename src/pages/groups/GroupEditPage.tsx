import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db, newId } from '../../db/db'
import { createGroup, deleteGroup } from '../../db/groupsRepo'
import type { ClassGroup, Student } from '../../db/types'
import { COLOR_KEYS, GROUP_COLORS, groupMembers, homeroomName, matchMembers, SEMESTER_LABEL, type MemberMatch } from '../../lib/groups'
import { defaultGenderFor } from '../../lib/rosterValidate'
import { parsePastedRoster } from '../../lib/rosterParser'
import { makeStudentCode, pad2 } from '../../lib/text'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 체육 계열 과목 이름 (고르기 쉽게 보여 주는 예시. 직접 써도 된다) */
const SUBJECTS = ['체육', '체육1', '체육2', '운동과 건강', '스포츠 생활1', '스포츠 생활2', '스포츠 문화', '스포츠 과학', '스포츠 경기 체력', '스포츠 경기 기술', '스포츠 경기 분석', '체육 탐구']

/** 수업반 만들기(수강반) · 고치기(학적반·수강반) */
export default function GroupEditPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { settings, readOnly } = useApp()
  const { groups, students } = useGroups(true)
  const existing = id ? groups?.find((g) => g.id === id) : undefined

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('체육')
  const [semester, setSemester] = useState<ClassGroup['semester']>(0)
  const [color, setColor] = useState(COLOR_KEYS[0])
  const [memberIds, setMemberIds] = useState<string[]>([])
  /** 명렬에 없어 저장할 때 새로 만들 학생 (붙여넣기에서 온 것) */
  const [pendingNew, setPendingNew] = useState<Student[]>([])
  const [loaded, setLoaded] = useState(isNew)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (loaded || !existing) return
    setName(existing.name)
    setSubject(existing.subject)
    setSemester(existing.semester)
    setColor(existing.color)
    setMemberIds(existing.memberIds)
    setLoaded(true)
  }, [existing, loaded])

  const kind: ClassGroup['kind'] = existing?.kind ?? 'elective'
  const all = useMemo(() => [...(students ?? []), ...pendingNew], [students, pendingNew])
  const members = useMemo(() => {
    if (kind === 'homeroom' && existing) return groupMembers(existing, students ?? [])
    const ids = new Set(memberIds)
    return all.filter((s) => ids.has(s.id)).sort((a, b) => a.studentCode.localeCompare(b.studentCode))
  }, [kind, existing, students, all, memberIds])

  if (id && groups && !existing) {
    return (
      <>
        <PageHeader title="수업반" back />
        <p className="page card mt-2">이 수업반을 찾을 수 없어요.</p>
      </>
    )
  }

  const save = async () => {
    setErr('')
    if (!name.trim()) return setErr('수업반 이름을 적어 주세요')
    if (kind === 'elective' && members.length === 0) return setErr('학생을 한 명 이상 넣어 주세요')
    const keep = new Set(memberIds)
    const newcomers = pendingNew.filter((s) => keep.has(s.id))
    await db.transaction('rw', db.students, db.groups, async () => {
      if (newcomers.length) await db.students.bulkAdd(newcomers)
      const patch = { name: name.trim(), subject: subject.trim(), semester, color, memberIds: kind === 'elective' ? memberIds : [] }
      if (existing) await db.groups.update(existing.id, patch)
      else {
        const gid = await createGroup(db, { ...patch, schoolYear: settings.schoolYear, kind: 'elective', archived: false })
        navigate(`/groups/${gid}`, { replace: true })
        return
      }
      navigate(-1)
    })
  }

  const remove = async () => {
    if (!existing) return
    if (!confirm(`'${existing.name}' 수업반을 지울까요?\n\n· 학생 명렬과 학생별 기록은 그대로 남아요.\n· 시간표에서 이 반 칸만 비워져요.`)) return
    await deleteGroup(db, existing.id)
    navigate('/groups', { replace: true })
  }

  const archive = async () => {
    if (!existing) return
    await db.groups.update(existing.id, { archived: !existing.archived })
    navigate('/groups')
  }

  return (
    <>
      <PageHeader title={isNew ? '수강반 만들기' : `${existing?.name ?? ''} 고치기`} sub={isNew ? '여러 학적반 학생을 모은 수업 반' : existing?.kind === 'homeroom' ? '학적반' : '수강반'} back />
      <div className="page space-y-4 pb-32">
        <section className="card space-y-4">
          <label className="block">
            <span className="label">수업반 이름</span>
            <input className="field" value={name} placeholder="예: 2학년 스포츠생활 A반" onChange={(e) => setName(e.target.value)} disabled={readOnly} />
          </label>
          <label className="block">
            <span className="label">과목</span>
            <input className="field" list="pe-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={readOnly} />
            <datalist id="pe-subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <div>
            <span className="label">기간</span>
            <div className="segment" role="radiogroup" aria-label="기간">
              {([0, 1, 2] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={semester === v} onClick={() => setSemester(v)} disabled={readOnly}>
                  {v === 0 ? '1년 내내' : SEMESTER_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">색</span>
            <div className="flex gap-2">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`색 ${k}`}
                  aria-pressed={color === k}
                  className={`h-11 w-11 rounded-full ring-offset-2 transition ${color === k ? 'ring-3 ring-ink' : ''}`}
                  style={{ background: GROUP_COLORS[k].fg }}
                  onClick={() => setColor(k)}
                  disabled={readOnly}
                />
              ))}
            </div>
          </div>
        </section>

        {kind === 'homeroom' ? (
          <section className="card space-y-2">
            <p className="card-title">학생 {members.length}명</p>
            <p className="hint">학적반은 명렬을 따라가요. 학생을 바꾸려면 명렬을 다시 올리거나 학생 화면에서 고쳐 주세요.</p>
            <Link to="/students" className="btn btn-soft w-full">
              전체 학생 명렬
            </Link>
          </section>
        ) : (
          <MemberPicker
            all={all}
            memberIds={memberIds}
            setMemberIds={setMemberIds}
            readOnly={readOnly}
            onCreate={(rows) => {
              const made: Student[] = rows.map((r) => ({
                id: newId(),
                schoolYear: settings.schoolYear,
                grade: r.grade,
                classNo: r.classNo,
                classCode: pad2(r.classNo),
                number: r.number,
                name: r.name,
                gender: r.gender ?? defaultGenderFor(settings.schoolGenderType),
                studentCode: makeStudentCode(r.grade, r.classNo, r.number),
                status: '재학',
                memo: '',
              }))
              setPendingNew((p) => [...p, ...made])
              return made.map((s) => s.id)
            }}
          />
        )}

        {kind === 'elective' && members.length > 0 && (
          <section className="card space-y-2">
            <p className="card-title">넣은 학생 {members.length}명</p>
            <ul className="flex flex-wrap gap-1.5">
              {members.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="chip min-h-[40px] gap-1 px-3 text-sm tabular-nums"
                    onClick={() => setMemberIds((m) => m.filter((x) => x !== s.id))}
                    disabled={readOnly}
                    aria-label={`${s.studentCode} ${s.name} 빼기`}
                  >
                    {s.studentCode} {s.name}
                    {!readOnly && <Icon name="close" size={14} />}
                  </button>
                </li>
              ))}
            </ul>
            {pendingNew.some((p) => memberIds.includes(p.id)) && (
              <p className="hint">명렬에 없던 학생 {pendingNew.filter((p) => memberIds.includes(p.id)).length}명은 저장할 때 명렬에도 더해져요.</p>
            )}
          </section>
        )}

        {existing && !readOnly && (
          <section className="card space-y-2">
            <button type="button" className="btn btn-soft w-full" onClick={archive}>
              <Icon name="eye" /> {existing.archived ? '다시 보이기' : '숨기기 (학기가 끝난 반)'}
            </button>
            <button type="button" className="btn btn-danger-soft w-full" onClick={remove}>
              <Icon name="trash" /> 수업반 지우기
            </button>
          </section>
        )}
      </div>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 p-3 lg:bottom-0 lg:left-60">
          <div className="page space-y-2 rounded-2xl bg-white p-2 shadow-[var(--shadow-float)]">
            {err && (
              <p className="px-2 font-bold text-danger" role="alert">
                {err}
              </p>
            )}
            <button type="button" className="btn btn-primary w-full text-lg" onClick={save}>
              {isNew ? `수강반 만들기${members.length ? ` (${members.length}명)` : ''}` : '저장'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** 수강반 학생 넣기: 명렬에서 고르기 / 명단 붙여넣기 */
function MemberPicker({
  all,
  memberIds,
  setMemberIds,
  readOnly,
  onCreate,
}: {
  all: Student[]
  memberIds: string[]
  setMemberIds: (f: (m: string[]) => string[]) => void
  readOnly: boolean
  onCreate: (rows: MemberMatch['create']) => string[]
}) {
  const { settings } = useApp()
  // 명렬이 늦게 불러와져도 맞게: 교사가 고르기 전에는 명렬이 있으면 '고르기', 없으면 '붙여넣기'
  const [chosenMode, setMode] = useState<'pick' | 'paste' | null>(null)
  const mode = chosenMode ?? (all.length ? 'pick' : 'paste')
  const live = useMemo(() => all.filter((s) => s.status !== '전출'), [all])
  const classes = useMemo(() => {
    const m = new Map<string, { grade: number; classNo: number }>()
    for (const s of live) m.set(`${s.grade}-${s.classNo}`, { grade: s.grade, classNo: s.classNo })
    return [...m.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
  }, [live])
  const [cls, setCls] = useState<string>('')
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [match, setMatch] = useState<MemberMatch | null>(null)
  const on = new Set(memberIds)

  const shown = useMemo(() => {
    const qq = q.trim()
    return live
      .filter((s) => (qq ? s.name.includes(qq) || s.studentCode.includes(qq) : cls ? `${s.grade}-${s.classNo}` === cls : false))
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode))
  }, [live, cls, q])

  const toggle = (sid: string) => setMemberIds((m) => (m.includes(sid) ? m.filter((x) => x !== sid) : [...m, sid]))
  const allOn = shown.length > 0 && shown.every((s) => on.has(s.id))

  const check = () => setMatch(matchMembers(parsePastedRoster(text, { grade: null, classNo: null }).rows, all, settings.schoolYear))
  const apply = () => {
    if (!match) return
    const made = onCreate(match.create)
    setMemberIds((m) => [...new Set([...m, ...match.found.map((s) => s.id), ...made])])
    setMatch(null)
    setText('')
  }

  return (
    <section className="card space-y-3">
      <p className="card-title">학생 넣기</p>
      <div className="segment" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'pick'} onClick={() => setMode('pick')}>
          명렬에서 고르기
        </button>
        <button type="button" role="tab" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>
          명단 붙여넣기
        </button>
      </div>

      {mode === 'pick' ? (
        live.length === 0 ? (
          <p className="hint">아직 명렬이 없어요. [명단 붙여넣기]로 학번과 이름을 넣으면 명렬도 함께 만들어져요.</p>
        ) : (
          <>
            <input className="field" placeholder="이름이나 학번으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
            {!q.trim() && (
              <div className="-mx-1 flex flex-wrap gap-1.5">
                {classes.map((c) => {
                  const k = `${c.grade}-${c.classNo}`
                  const n = live.filter((s) => `${s.grade}-${s.classNo}` === k && on.has(s.id)).length
                  return (
                    <button key={k} type="button" aria-pressed={cls === k} className="chip min-h-[40px] px-3 text-sm tabular-nums" onClick={() => setCls(k)}>
                      {homeroomName(c.grade, c.classNo)}
                      {n > 0 && <span className="badge bg-brand text-white">{n}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {shown.length > 0 ? (
              <>
                <button
                  type="button"
                  className="btn btn-soft w-full"
                  disabled={readOnly}
                  onClick={() => setMemberIds((m) => (allOn ? m.filter((x) => !shown.some((s) => s.id === x)) : [...new Set([...m, ...shown.map((s) => s.id)])]))}
                >
                  {allOn ? '보이는 학생 모두 빼기' : `보이는 학생 ${shown.length}명 모두 넣기`}
                </button>
                <ul className="max-h-[50vh] overflow-y-auto rounded-2xl bg-fill">
                  {shown.map((s) => (
                    <li key={s.id}>
                      <label className="list-row min-h-[52px] cursor-pointer">
                        <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={on.has(s.id)} onChange={() => toggle(s.id)} disabled={readOnly} />
                        <span className="w-16 font-bold tabular-nums text-ink-3">{s.studentCode}</span>
                        <span className="flex-1 font-semibold">{s.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="hint">{q.trim() ? '찾는 학생이 없어요.' : '위에서 반을 고르세요.'}</p>
            )}
          </>
        )
      ) : (
        <>
          <p className="hint">
            한 줄에 한 명씩: <code>20312 홍길동</code>, <code>2-3-12 홍길동</code>, <code>2학년 3반 12번 홍길동</code>. 명렬에 있는 학생이면 이름만 써도 돼요. 나이스 수강반 명단을 엑셀에서 복사해 붙여도 돼요.
          </p>
          <textarea className="field min-h-[160px] font-mono text-sm" value={text} onChange={(e) => (setText(e.target.value), setMatch(null))} placeholder={'20312 홍길동\n20405 김철수'} disabled={readOnly} />
          <button type="button" className="btn btn-outline w-full" disabled={!text.trim() || readOnly} onClick={check}>
            확인하기
          </button>
          {match && (
            <div className="space-y-2 rounded-2xl bg-fill p-3">
              <p className="font-bold">
                명렬에서 찾음 {match.found.length}명 · 새로 만들 학생 {match.create.length}명
                {match.problems.length > 0 && <span className="text-danger"> · 확인 필요 {match.problems.length}줄</span>}
              </p>
              {match.create.length > 0 && (
                <p className="hint">
                  새로 만들 학생: {match.create.map((c) => `${makeStudentCode(c.grade, c.classNo, c.number)} ${c.name}`).join(', ')}
                </p>
              )}
              {match.problems.length > 0 && (
                <ul className="space-y-1 text-sm font-semibold text-danger">
                  {match.problems.map((p, i) => (
                    <li key={i}>
                      {p.source}: {p.text}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn btn-primary w-full" disabled={match.found.length + match.create.length === 0} onClick={apply}>
                {match.found.length + match.create.length}명 넣기{match.problems.length ? ' (확인 필요한 줄은 빼고)' : ''}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
