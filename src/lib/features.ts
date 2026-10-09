import type { IconName } from '../components/Icon'
import type { FeatureId } from '../db/settings'

/** 홈에서 켜고 끄는 기능 목록. 끈 기능은 홈·탭·더보기에서만 숨기고 자료는 그대로 둔다. */
export interface FeatureInfo {
  id: FeatureId
  label: string
  desc: string
  icon: IconName
  tone: string
  /** 열 화면 */
  to: string
  /** 학생 명렬이 있어야 쓸 수 있는지 */
  needsRoster: boolean
}

export const FEATURES: FeatureInfo[] = [
  { id: 'records', label: '누가기록', desc: '수업반별 학생 카드 · 체크 · 메모', icon: 'class', tone: 'bg-brand-light text-brand', to: '/groups', needsRoster: true },
  { id: 'paps', label: 'PAPS', desc: '측정 입력 · 자동 등급 · 나이스 파일', icon: 'paps', tone: 'bg-ok-light text-ok', to: '/paps', needsRoster: true },
  { id: 'assess', label: '수행평가', desc: '평가 만들기 · 채점표 · 엑셀', icon: 'clipboard', tone: 'bg-caution-light text-caution', to: '/more/assessments', needsRoster: true },
  { id: 'tools', label: '수업 도구', desc: '타이머 · 스톱워치 · PAPS 신호음', icon: 'timer', tone: 'bg-fill-2 text-ink-2', to: '/timer', needsRoster: false },
  { id: 'absences', label: '견학 · 열외', desc: '견학 목록 · 대체 과제', icon: 'bandage', tone: 'bg-fill-2 text-ink-2', to: '/more/absences', needsRoster: true },
  { id: 'captains', label: '체육부장', desc: '지정 · 교체 이력 · 활동 체크', icon: 'medal', tone: 'bg-caution-light text-caution', to: '/more/captains', needsRoster: true },
  { id: 'seteuk', label: '세특 키워드', desc: '키워드 사전 · 근거 모아보기', icon: 'tag', tone: 'bg-ok-light text-ok', to: '/more/keywords', needsRoster: true },
]

export const featureOn = (features: Partial<Record<FeatureId, boolean>> | undefined, id: FeatureId) => features?.[id] !== false
