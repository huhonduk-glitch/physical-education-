import { Link } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Icon, { type IconName } from '../../components/Icon'
import type { ClassGroup } from '../../db/types'
import { featureOn } from '../../lib/features'
import { useApp } from '../../state/AppContext'

/** 수업반 화면의 [수업 도구]: 이 반 학생으로 바로 뽑기 · 팀 나누기 · PAPS · 다른 앱으로 보내기 */
export default function ClassToolsSheet({ group, onClose, onTeamSend }: { group: ClassGroup; onClose: () => void; onTeamSend: () => void }) {
  const { settings } = useApp()
  const tools = featureOn(settings.features, 'tools')
  const paps = featureOn(settings.features, 'paps') && group.kind === 'homeroom'
  const links: { to: string; icon: IconName; title: string; desc: string; show: boolean }[] = [
    { to: `/tools/pick?g=${group.id}`, icon: 'dice', title: '뽑기', desc: '오늘 참여 학생 중에서', show: tools },
    { to: `/tools/teams?g=${group.id}`, icon: 'shuffle', title: '팀 나누기', desc: '무작위 · 남녀 고르게 · 실력 고르게', show: tools },
    { to: `/paps?c=${group.grade}-${group.classNo}`, icon: 'paps', title: 'PAPS', desc: '이 반 측정 입력 · 등급', show: paps },
    { to: `/groups/${group.id}/journal`, icon: 'book', title: '수업 일지', desc: '단원 · 한 일 · 다음 시간 메모', show: true },
    { to: `/more/keywords?g=${group.id}`, icon: 'tag', title: '세특 모아보기', desc: '학생별 키워드 · 근거 기록', show: featureOn(settings.features, 'seteuk') },
    { to: `/groups/${group.id}/report`, icon: 'file', title: '학생 리포트 인쇄', desc: '한 장에 한 명 · 상담·피드백용', show: true },
  ]
  return (
    <BottomSheet title="수업 도구" sub={group.name} onClose={onClose}>
      <div className="space-y-2">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-fill px-4 active:bg-fill-2">
              <Icon name={l.icon} className="text-brand" />
              <span className="flex-1">
                <b className="block">{l.title}</b>
                <span className="hint">{l.desc}</span>
              </span>
              <Icon name="chevronRight" className="text-ink-3" />
            </Link>
          ))}
        <button type="button" className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-fill px-4 text-left active:bg-fill-2" onClick={onTeamSend}>
          <Icon name="share" className="text-brand" />
          <span className="flex-1">
            <b className="block">팀 편성 · 전술 보드 앱으로 보내기</b>
            <span className="hint">SPORTS BRACKET · K-TacticBoard</span>
          </span>
          <Icon name="chevronRight" className="text-ink-3" />
        </button>
      </div>
    </BottomSheet>
  )
}
