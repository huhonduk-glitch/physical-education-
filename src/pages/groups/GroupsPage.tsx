import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { addHomeroomGroups } from '../../db/groupsRepo'
import type { ClassGroup } from '../../db/types'
import { GROUP_COLORS, homeroomName, missingHomerooms, SEMESTER_LABEL } from '../../lib/groups'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/** 수업반 목록: 학적반 · 수강반 (고교학점제) */
export default function GroupsPage() {
  const { settings, readOnly } = useApp()
  const [showArchived, setShowArchived] = useState(false)
  const { groups, students, membersOf } = useGroups(true)
  const allGroups = useMemo(() => groups ?? [], [groups])
  const missing = useMemo(() => missingHomerooms(students ?? [], allGroups, settings.schoolYear), [students, allGroups, settings.schoolYear])
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const chosen = picked ?? new Set(allGroups.length === 0 ? missing.map((c) => `${c.grade}-${c.classNo}`) : [])

  const visible = allGroups.filter((g) => showArchived || !g.archived)
  const archivedCount = allGroups.filter((g) => g.archived).length
  const bySemester = ([0, 1, 2] as const).map((sem) => ({ sem, list: visible.filter((g) => g.semester === sem) })).filter((x) => x.list.length > 0)

  const toggle = (k: string) => {
    const n = new Set(chosen)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    setPicked(n)
  }
  const addChosen = async () => {
    await addHomeroomGroups(
      db,
      settings.schoolYear,
      missing.filter((c) => chosen.has(`${c.grade}-${c.classNo}`)),
    )
    setPicked(new Set())
  }

  return (
    <>
      <PageHeader
        title="수업반"
        sub={`${settings.schoolYear}학년도`}
        right={
          !readOnly && (
            <Link to="/groups/new" className="btn btn-primary px-4">
              <Icon name="plus" size={20} /> 수강반
            </Link>
          )
        }
      />
      <div className="page space-y-5 pb-8">
        <p className="hint px-1">
          <b className="text-ink-2">학적반</b>은 명렬의 반 그대로, <b className="text-ink-2">수강반</b>은 여러 반 학생을 모은 수업 반이에요(고교학점제 선택과목·합반).
        </p>

        {students?.length === 0 && (
          <div className="card space-y-3">
            <p className="font-extrabold">먼저 학생 명렬을 올려 주세요</p>
            <p className="hint">나이스 명렬 파일을 올리면 학적반이 바로 생겨요. 수강반 명단만 있으면 [수강반]에서 바로 붙여넣어도 돼요.</p>
            <Link to="/students/import" className="btn btn-primary w-full">
              <Icon name="upload" /> 명렬 올리기
            </Link>
          </div>
        )}

        {!readOnly && missing.length > 0 && (
          <section className="card space-y-3">
            <div>
              <p className="card-title">명렬에 있는 반을 수업반으로 추가</p>
              <p className="hint">내가 수업하는 반만 골라 주세요. 나중에 언제든 더할 수 있어요.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {missing.map((c) => {
                const k = `${c.grade}-${c.classNo}`
                return (
                  <button key={k} type="button" aria-pressed={chosen.has(k)} className="chip tabular-nums" onClick={() => toggle(k)}>
                    {chosen.has(k) && <Icon name="check" size={18} />}
                    {homeroomName(c.grade, c.classNo)}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-soft" onClick={() => setPicked(chosen.size === missing.length ? new Set() : new Set(missing.map((c) => `${c.grade}-${c.classNo}`)))}>
                {chosen.size === missing.length ? '모두 해제' : '모두'}
              </button>
              <button type="button" className="btn btn-primary flex-1" disabled={chosen.size === 0} onClick={addChosen}>
                {chosen.size}개 반 추가
              </button>
            </div>
          </section>
        )}

        {bySemester.map(({ sem, list }) => (
          <section key={sem} className="space-y-2">
            <h2 className="px-1 text-sm font-bold text-ink-3">{sem === 0 ? '1년 내내' : SEMESTER_LABEL[sem]}</h2>
            <div className="card overflow-hidden p-0">
              {list.map((g) => (
                <GroupRow key={g.id} g={g} count={membersOf(g).length} />
              ))}
            </div>
          </section>
        ))}

        {archivedCount > 0 && (
          <button type="button" className="btn btn-ghost w-full text-ink-3" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? '숨긴 수업반 감추기' : `숨긴 수업반 ${archivedCount}개 보기`}
          </button>
        )}

        <section className="card overflow-hidden p-0">
          <Link to="/students" className="list-row min-h-[60px] hover:bg-fill">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-fill-2 text-ink-2">
              <Icon name="students" size={20} />
            </span>
            <span className="flex-1">
              <b className="block">전체 학생 명렬</b>
              <span className="hint">학적반별 명단 · 전출 · 학생별 기록</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
          {!readOnly && (
            <Link to="/students/import" className="list-row min-h-[60px] hover:bg-fill">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-brand">
                <Icon name="upload" size={20} />
              </span>
              <span className="flex-1">
                <b className="block">명렬 올리기</b>
                <span className="hint">나이스 명렬 파일 · 복사·붙여넣기</span>
              </span>
              <Icon name="chevronRight" className="text-ink-3" />
            </Link>
          )}
          <Link to="/more/settings/timetable" className="list-row min-h-[60px] hover:bg-fill">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-fill-2 text-ink-2">
              <Icon name="calendar" size={20} />
            </span>
            <span className="flex-1">
              <b className="block">수업 시간표</b>
              <span className="hint">요일·교시별 수업반 → 홈에 오늘 수업</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
          {!readOnly && (
            <Link to="/more/settings/neis" className="list-row min-h-[60px] hover:bg-fill">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ok-light text-ok">
                <Icon name="download" size={20} />
              </span>
              <span className="flex-1">
                <b className="block">나이스에서 불러오기</b>
                <span className="hint">학급 · 내 체육 시간표 · 학사일정 자동</span>
              </span>
              <Icon name="chevronRight" className="text-ink-3" />
            </Link>
          )}
        </section>
      </div>
    </>
  )
}

function GroupRow({ g, count }: { g: ClassGroup; count: number }) {
  const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
  return (
    <div className={`flex items-center ${g.archived ? 'opacity-50' : ''}`}>
      <Link to={`/groups/${g.id}`} className="list-row min-h-[68px] flex-1 hover:bg-fill">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
          <Icon name={g.kind === 'elective' ? 'layers' : 'class'} size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate">{g.name}</b>
          <span className="hint block truncate">
            {g.kind === 'elective' ? '수강반' : '학적반'}
            {g.subject ? ` · ${g.subject}` : ''} · {count}명{g.archived ? ' · 숨김' : ''}
          </span>
        </span>
      </Link>
      <Link to={`/groups/${g.id}/edit`} className="btn btn-ghost mr-2 px-3 text-ink-3" aria-label={`${g.name} 고치기`}>
        <Icon name="edit" size={20} />
      </Link>
    </div>
  )
}
