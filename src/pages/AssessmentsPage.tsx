import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { itemMax, itemsOf } from '../lib/assessScore'
import { GROUP_COLORS, SEMESTER_LABEL } from '../lib/groups'
import { useApp } from '../state/AppContext'
import { useGroups } from '../state/useGroups'

/** 수행평가 목록 (재설계 3단계): 평가 1개 = 나이스 양식의 영역 1칸 */
export default function AssessmentsPage() {
  const { settings, readOnly } = useApp()
  const { groups } = useGroups(true)
  const list = useLiveQuery(() => db.assessments.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const byId = new Map((groups ?? []).map((g) => [g.id, g]))

  return (
    <>
      <PageHeader
        title="수행평가"
        back
        right={
          !readOnly && (
            <Link to="/more/assessments/new" className="btn btn-primary">
              <Icon name="plus" /> 새 평가
            </Link>
          )
        }
      />
      <div className="page space-y-4 pb-8">
        <Link to="/more/assessments/export" className="card flex min-h-[72px] items-center gap-3 bg-brand text-white transition-transform active:scale-[0.99]">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20">
            <Icon name="download" size={22} />
          </span>
          <span className="flex-1">
            <b className="block text-lg">나이스로 내보내기</b>
            <span className="text-sm opacity-90">나이스 수행평가 일괄입력 양식에 점수를 채워요</span>
          </span>
          <Icon name="chevronRight" />
        </Link>

        {list && list.length === 0 && (
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-light text-brand">
              <Icon name="clipboard" size={28} />
            </span>
            <p className="card-title">아직 만든 평가가 없어요</p>
            <p className="hint">
              평가 1개가 나이스 양식의 영역 1칸이에요. 영역 이름, 수업반, 채점 요소(등급표·기록표·점수)를 정하면 채점표가 만들어지고 점수가 자동으로 더해져요.
            </p>
            {!readOnly && (
              <Link to="/more/assessments/new" className="btn btn-primary w-full max-w-xs">
                첫 평가 만들기
              </Link>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {list?.map((a) => {
            const items = itemsOf(a)
            const max = items.reduce((n, it) => n + itemMax(it), 0)
            const legacy = !a.items
            return (
              <li key={a.id} className="card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Link to={`/more/assessments/${a.id}`} className="min-w-0 flex-1">
                    <p className="font-extrabold leading-snug">{a.title || '(이름 없음)'}</p>
                    <p className="hint">
                      만점 {max}점 · 요소 {items.length}개{a.semester ? ` · ${SEMESTER_LABEL[a.semester]}` : ''}
                    </p>
                  </Link>
                  {!readOnly && (
                    <Link to={`/more/assessments/${a.id}/edit`} className="btn btn-soft px-3" aria-label={`${a.title} 고치기`}>
                      <Icon name="edit" size={18} />
                    </Link>
                  )}
                </div>
                {legacy && <p className="rounded-xl bg-caution-light px-3 py-2 text-sm font-bold text-caution">예전 방식 평가예요. [고치기]에서 수업반과 등급 점수를 정해 주세요.</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(a.groupIds ?? []).map((gid) => {
                    const g = byId.get(gid)
                    if (!g) return null
                    const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
                    return (
                      <Link key={gid} to={`/more/assessments/${a.id}?g=${gid}`} className="badge min-h-[34px] px-3 text-sm" style={{ background: c.bg, color: c.fg }}>
                        {g.name}
                      </Link>
                    )
                  })}
                </div>
                <Link to={`/more/assessments/${a.id}`} className="btn btn-outline w-full">
                  채점하기
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
