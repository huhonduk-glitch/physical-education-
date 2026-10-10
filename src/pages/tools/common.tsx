import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GroupPicker from '../../components/GroupPicker'
import type { ClassGroup, Student } from '../../db/types'
import { todayStr } from '../../lib/dates'
import { memberNo, readLastGroup, saveLastGroup } from '../../lib/groups'
import { useAbsentIds } from '../../state/useClassTools'
import { useGroups } from '../../state/useGroups'
import { NumberField } from '../timer/common'

/** 뽑기·팀 나누기에 넣는 한 사람 */
export interface ToolPerson {
  id: string
  /** 크게 보이는 이름 (명렬 없이 쓰면 'N번') */
  name: string
  /** 앞에 작게 붙는 번호 (학적반 번호 / 수강반 학번) */
  no: string
  gender: 'M' | 'F' | null
  student?: Student
}

type Source = 'group' | 'number'

/**
 * 누구를 대상으로 할지: 수업반(오늘 견학 학생은 빼기 선택) 또는 명렬 없이 번호만.
 * 주소의 ?g=수업반id 로 바로 열 수 있다 (수업반 화면의 [수업 도구]에서 넘어올 때).
 */
export function useToolPeople() {
  const [sp, setSp] = useSearchParams()
  const { groups, membersOf } = useGroups()
  const [source, setSource] = useState<Source>(sp.get('n') ? 'number' : 'group')
  const [count, setCount] = useState(Number(sp.get('n')) || 30)
  const [skipAbsent, setSkipAbsent] = useState(true)
  const want = sp.get('g') ?? readLastGroup()
  const group: ClassGroup | null = groups?.find((g) => g.id === want) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const absent = useAbsentIds(members, todayStr())
  const people: ToolPerson[] = useMemo(() => {
    if (source === 'number' || !group) {
      return Array.from({ length: count }, (_, i) => ({ id: `n${i + 1}`, name: `${i + 1}번`, no: '', gender: null }))
    }
    return members
      .filter((s) => !(skipAbsent && absent?.has(s.id)))
      .map((s) => ({ id: s.id, name: s.name, no: memberNo(group, s), gender: s.gender, student: s }))
  }, [source, group, members, count, skipAbsent, absent])
  const chooseGroup = (id: string) => {
    saveLastGroup(id)
    setSp((p) => (p.set('g', id), p.delete('n'), p), { replace: true })
  }
  return {
    groups: groups ?? [],
    loading: groups === undefined,
    source: groups && groups.length === 0 ? ('number' as const) : source,
    setSource,
    group,
    chooseGroup,
    count,
    setCount,
    skipAbsent,
    setSkipAbsent,
    absentCount: source === 'group' ? (absent?.size ?? 0) : 0,
    people,
  }
}

export type ToolPeople = ReturnType<typeof useToolPeople>

/** 대상 고르기 카드 */
export function SourceCard({ t }: { t: ToolPeople }) {
  const noGroups = !t.loading && t.groups.length === 0
  return (
    <section className="card space-y-3">
      {!noGroups && (
        <div className="segment" role="tablist" aria-label="누구를">
          <button type="button" role="tab" aria-selected={t.source === 'group'} onClick={() => t.setSource('group')}>
            수업반 학생
          </button>
          <button type="button" role="tab" aria-selected={t.source === 'number'} onClick={() => t.setSource('number')}>
            번호만 (명렬 없이)
          </button>
        </div>
      )}
      {t.source === 'group' ? (
        <>
          <GroupPicker groups={t.groups} value={t.group?.id ?? null} onChange={t.chooseGroup} />
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={t.skipAbsent} onChange={(e) => t.setSkipAbsent(e.target.checked)} />
            <span className="font-bold">오늘 견학 학생 빼기{t.absentCount ? ` (${t.absentCount}명)` : ''}</span>
          </label>
          <p className="hint">대상 {t.people.length}명</p>
        </>
      ) : (
        <>
          <NumberField label="몇 번까지" value={t.count} onChange={t.setCount} min={2} max={60} suffix="번" />
          {noGroups && (
            <p className="hint">
              명렬을 올리고 수업반을 만들면 이름으로 뽑을 수 있어요. <Link to="/groups" className="font-bold text-brand underline">수업반 만들기</Link>
            </p>
          )}
        </>
      )}
    </section>
  )
}
