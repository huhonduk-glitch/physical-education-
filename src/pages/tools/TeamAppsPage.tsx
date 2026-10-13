import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GroupPicker from '../../components/GroupPicker'
import PageHeader from '../../components/PageHeader'
import { TeamSendPanel } from '../../components/TeamSendSheet'
import { todayStr } from '../../lib/dates'
import { memberNo, readLastGroup, saveLastGroup } from '../../lib/groups'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

/**
 * 팀 편성 · 전술 보드 (교사가 만든 두 앱과 연결, CLAUDE.md 4-10).
 * 수업반을 고르면 오늘 참여 학생 명단을 팀 편성 앱(복사·붙여넣기) · 전술 보드(링크)로 보낸다. 앱만 바로 열 수도 있다.
 */
export default function TeamAppsPage() {
  const { settings } = useApp()
  const { groups, membersOf } = useGroups()
  const [gid, setGid] = useState<string | null>(readLastGroup)
  const group = groups?.find((g) => g.id === gid) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const numberOf = useMemo(() => (group ? (s: Parameters<typeof memberNo>[1]) => memberNo(group, s) : () => ''), [group])
  return (
    <>
      <PageHeader title="팀 편성 · 전술 보드" back />
      <div className="page space-y-4 pb-8">
        <section className="card space-y-3">
          <p className="card-title">앱 바로 열기</p>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn btn-soft min-h-[64px] flex-col gap-0.5" href={settings.bracketUrl} target="_blank" rel="noopener noreferrer">
              <b>팀 편성 · 대진표</b>
              <span className="text-xs text-ink-3">SPORTS BRACKET</span>
            </a>
            <a className="btn btn-soft min-h-[64px] flex-col gap-0.5" href={settings.tacticUrl} target="_blank" rel="noopener noreferrer">
              <b>전술 보드</b>
              <span className="text-xs text-ink-3">K-TacticBoard</span>
            </a>
          </div>
          <p className="hint">
            아래에서 수업반을 고르면 오늘 참여 학생 명단을 넣은 채로 열 수 있어요. 앱 주소는 [더보기 → 설정 → 연동 앱 주소]에서 바꿀 수 있어요. 앱에서 팀을 나눈 뒤 전술 보드에 팀별로 넣고 싶으면{' '}
            <Link to="/tools/teams" className="font-bold text-brand underline">
              팀 나누기
            </Link>
            를 쓰세요.
          </p>
        </section>

        {groups && groups.length === 0 ? (
          <p className="card hint">
            수업반을 만들면 반 명단을 그대로 보낼 수 있어요.{' '}
            <Link to="/groups" className="font-bold text-brand underline">
              수업반 만들기
            </Link>
          </p>
        ) : (
          group && (
            <section className="card space-y-3">
              <p className="card-title">반 명단 보내기</p>
              <GroupPicker
                groups={groups ?? []}
                value={group.id}
                onChange={(id) => {
                  setGid(id)
                  saveLastGroup(id)
                }}
              />
              <TeamSendPanel key={group.id} students={members} date={todayStr()} groupName={group.name} numberOf={numberOf} />
            </section>
          )
        )}
      </div>
    </>
  )
}
