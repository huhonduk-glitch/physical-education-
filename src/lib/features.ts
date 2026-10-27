import type { IconName } from '../components/Icon'
import type { FeatureId } from '../db/settings'

/** 홈에서 켜고 끄는 기능 목록. 끈 기능은 홈·탭·더보기에서만 숨기고 자료는 그대로 둔다. */
export interface FeatureInfo {
  id: FeatureId
  label: string
  /** 홈 바로가기 칸에 쓰는 짧은 이름 */
  short: string
  desc: string
  icon: IconName
  tone: string
  /** 열 화면 */
  to: string
  /** 학생 명렬이 있어야 쓸 수 있는지 */
  needsRoster: boolean
}

export const FEATURES: FeatureInfo[] = [
  { id: 'records', label: '누가기록', short: '누가기록', desc: '수업반별 학생 카드 · 체크 · 메모', icon: 'class', tone: 'bg-brand-light text-brand', to: '/groups', needsRoster: true },
  { id: 'plans', label: '교과 진도표', short: '진도표', desc: '차시 계획 · 날짜 자동 · 반별 진도 비교', icon: 'calendar', tone: 'bg-brand-light text-brand', to: '/plans', needsRoster: false },
  { id: 'paps', label: 'PAPS', short: 'PAPS', desc: '측정 입력 · 자동 등급 · 나이스 파일', icon: 'paps', tone: 'bg-brand-light text-brand', to: '/paps', needsRoster: true },
  { id: 'assess', label: '수행평가', short: '수행평가', desc: '평가 만들기 · 채점표 · 엑셀', icon: 'clipboard', tone: 'bg-brand-light text-brand', to: '/more/assessments', needsRoster: true },
  { id: 'sports', label: '종목 수업자료', short: '종목', desc: '18종목 규칙 · 경기 방법 · 리그전 · 토너먼트 안내', icon: 'book', tone: 'bg-brand-light text-brand', to: '/sports', needsRoster: false },
  { id: 'tools', label: '수업 도구', short: '수업 도구', desc: '타이머 · 뽑기 · 팀 나누기 · PAPS 신호음', icon: 'timer', tone: 'bg-brand-light text-brand', to: '/tools', needsRoster: false },
  { id: 'apps', label: '팀 편성 · 전술 보드', short: '팀 편성', desc: '반 명단을 팀 편성 앱 · 전술 보드로 한 번에', icon: 'share', tone: 'bg-brand-light text-brand', to: '/tools/apps', needsRoster: false },
  { id: 'absences', label: '견학', short: '견학', desc: '견학 목록 · 대체 과제', icon: 'bandage', tone: 'bg-brand-light text-brand', to: '/more/absences', needsRoster: true },
  { id: 'captains', label: '체육부장', short: '체육부장', desc: '지정 · 교체 이력 · 활동 체크', icon: 'medal', tone: 'bg-brand-light text-brand', to: '/more/captains', needsRoster: true },
  { id: 'seteuk', label: '세특 키워드', short: '세특', desc: '키워드 사전 · 근거 모아보기', icon: 'tag', tone: 'bg-brand-light text-brand', to: '/more/keywords', needsRoster: true },
]

export const featureOn = (features: Partial<Record<FeatureId, boolean>> | undefined, id: FeatureId) => features?.[id] !== false
