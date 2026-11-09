import type { IconName } from '../components/Icon'
import type { FeatureId } from '../db/settings'
import { featureOn } from './features'

/**
 * 메뉴 표 하나 (CLAUDE.md 6-12). 폰 아래 탭 · PC 위 메뉴 · 왼쪽 하위 메뉴 · 큰 메뉴 화면이 모두 이 표를 쓴다.
 * 2026-11-05 다시 짬 (교사: "메뉴 구성이 별로, 심사숙고해서"):
 *  - 한 칸짜리 묶음을 없애고 '하는 일'로 묶음: 수업 = 내 수업반 · 수업 자료 · 수업 도구 · 학생 관리
 *  - 학기 초 한 번 하는 기초 설정은 교사 가안대로 '홈' 아래로, '설정'은 앱 설정 · 도움만
 *  - '내 수업반' 묶음에는 실제 반 이름이 하위 메뉴로 들어간다(BottomNav가 채움)
 * 기존 화면 주소는 그대로 두고 메뉴로 묶기만 한다(자료 · 기능 변화 없음).
 */

export type SectionId = 'home' | 'class' | 'paps' | 'eval' | 'work' | 'settings'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  desc?: string
  /** 끈 기능이면 숨긴다 */
  feature?: FeatureId
}

export interface NavGroup {
  /** 'classes'면 내 수업반 이름으로 채운다 */
  id?: 'classes'
  title: string
  icon: IconName
  items: NavItem[]
}

export interface NavSection {
  id: SectionId
  label: string
  icon: IconName
  /** 큰 메뉴를 누르면 여는 화면 */
  to: string
  /** 이 주소들로 시작하면 이 큰 메뉴에 있는 것으로 본다 (가장 길게 맞는 것이 이긴다) */
  match: string[]
  groups: NavGroup[]
}

export const NAV: NavSection[] = [
  {
    id: 'home',
    label: '홈',
    icon: 'home',
    to: '/',
    match: ['/students/import', '/groups/new', '/more/settings/timetable', '/more/settings/neis', '/timetable', '/plans/new', '/more/assessments/from-plan'],
    groups: [
      {
        title: '기초 설정',
        icon: 'settings',
        items: [
          { to: '/students/import', label: '명렬 올리기', icon: 'upload', desc: '나이스 파일 · 붙여넣기' },
          { to: '/groups/new', label: '수업반 만들기', icon: 'plus', desc: '학적반 · 수강반', feature: 'records' },
          { to: '/more/settings/timetable', label: '내 수업 시간표', icon: 'calendar', desc: '요일 · 교시마다 수업반' },
          { to: '/more/settings/neis', label: '나이스에서 불러오기', icon: 'download', desc: '학급 · 시간표 · 학사일정' },
          { to: '/timetable/pe', label: '전체 체육 시간표', icon: 'grid', desc: '컴시간 · 체육관 겹침' },
        ],
      },
      {
        title: '평가계획서 넣기',
        icon: 'file',
        items: [
          { to: '/plans/new', label: '진도표 초안 만들기', icon: 'calendar', desc: '평가계획서 진도표로', feature: 'plans' },
          { to: '/more/assessments/from-plan', label: '수행평가 만들기', icon: 'clipboard', desc: '평가계획서 채점 기준으로', feature: 'assess' },
        ],
      },
    ],
  },
  {
    id: 'class',
    label: '수업',
    icon: 'class',
    to: '/class',
    match: ['/class', '/groups', '/plans', '/sports', '/leagues', '/referee', '/timer', '/tools', '/more/absences', '/more/captains', '/students'],
    groups: [
      {
        id: 'classes',
        title: '내 수업반',
        icon: 'class',
        items: [
          { to: '/groups', label: '수업반 목록', icon: 'class', desc: '누가기록 · 출결 · 일지', feature: 'records' },
          { to: '/weekly', label: '이번 주 요약', icon: 'list', desc: '지난주 비교 · 챙길 학생', feature: 'records' },
        ],
      },
      {
        title: '수업 자료',
        icon: 'book',
        items: [
          { to: '/sports', label: '종목 수업자료', icon: 'book', desc: '규칙 · 슬라이드 · PPT', feature: 'sports' },
          { to: '/plans', label: '교과 진도표', icon: 'calendar', desc: '차시 계획 · 반별 진도', feature: 'plans' },
        ],
      },
      {
        title: '수업 도구',
        icon: 'timer',
        items: [
          { to: '/timer', label: '타이머 · 스톱워치', icon: 'timer', desc: '카운트다운 · 인터벌 · 랩', feature: 'tools' },
          { to: '/tools/pick', label: '뽑기', icon: 'dice', desc: '발표 · 순서', feature: 'tools' },
          { to: '/tools/teams', label: '팀 나누기', icon: 'team', desc: '남녀 · 실력 고르게', feature: 'tools' },
          { to: '/referee', label: 'AI 보조심판', icon: 'flag', desc: '판정 · 점수 · 팀 파울', feature: 'sports' },
          { to: '/tools/video', label: '동작 영상', icon: 'eye', desc: '지연 재생 · 슬로모션', feature: 'tools' },
          { to: '/tools/apps', label: '대진표 · 팀 편성', icon: 'share', desc: 'SPORTS BRACKET · 전술 보드', feature: 'apps' },
        ],
      },
      {
        title: '학생 관리',
        icon: 'students',
        items: [
          { to: '/students', label: '전체 학생 명렬', icon: 'students', desc: '학생별 기록 · 리포트' },
          { to: '/students/summary', label: '반 요약', icon: 'list', desc: '칭찬 · 지도 상위 · 미측정', feature: 'records' },
          { to: '/more/absences', label: '견학', icon: 'bandage', desc: '목록 · 대체 과제', feature: 'absences' },
          { to: '/more/captains', label: '체육부장', icon: 'medal', desc: '지정 · 활동 체크', feature: 'captains' },
        ],
      },
    ],
  },
  {
    id: 'paps',
    label: 'PAPS',
    icon: 'paps',
    to: '/paps',
    match: ['/paps'],
    groups: [
      {
        title: '측정',
        icon: 'edit',
        items: [
          { to: '/paps', label: '기록 입력', icon: 'edit', desc: '반 · 종목별 입력', feature: 'paps' },
          { to: '/paps/paste', label: '붙여넣기 입력', icon: 'clipboard', desc: '엑셀에서 복사한 기록', feature: 'paps' },
          { to: '/timer?tab=paps&aid=shuttle', label: '왕복오래달리기', icon: 'flag', desc: '신호마다 한 번 누르기', feature: 'paps' },
          { to: '/timer?tab=paps', label: 'PAPS 신호음', icon: 'volume', desc: '윗몸말아올리기 · 스텝', feature: 'paps' },
          { to: '/paps/setup', label: '측정 설정', icon: 'settings', desc: '종목 · 나이스 양식', feature: 'paps' },
        ],
      },
      {
        title: '결과',
        icon: 'paps',
        items: [
          { to: '/paps/results', label: '결과 · 등급', icon: 'paps', desc: '종합점수 · 등급', feature: 'paps' },
          { to: '/paps/stats', label: '통계 · 그래프', icon: 'grid', desc: '분포 · 회차별 변화', feature: 'paps' },
          { to: '/paps/export', label: '나이스 파일', icon: 'download', desc: '업로드 파일 만들기', feature: 'paps' },
          { to: '/paps/codes', label: '튼튼몬 코드', icon: 'share', desc: '학생별 코드 · QR', feature: 'paps' },
        ],
      },
    ],
  },
  {
    id: 'eval',
    label: '평가',
    icon: 'clipboard',
    to: '/eval',
    match: ['/eval', '/more/assessments', '/seteuk', '/more/keywords'],
    groups: [
      {
        title: '수행평가',
        icon: 'clipboard',
        items: [
          { to: '/more/assessments', label: '평가 목록 · 채점', icon: 'clipboard', desc: '수업반별 채점표', feature: 'assess' },
          { to: '/more/assessments/rubric', label: '루브릭 만들기', icon: 'list', desc: '성취기준 → 판단 기준', feature: 'assess' },
          { to: '/more/assessments/export', label: '나이스 파일', icon: 'download', desc: '일괄입력 양식 채우기', feature: 'assess' },
        ],
      },
      {
        title: '세특',
        icon: 'edit',
        items: [
          { to: '/seteuk/write', label: '세특 쓰기', icon: 'edit', desc: '수준 · 초안 · 검사 · AI', feature: 'seteuk' },
          { to: '/more/keywords', label: '세특 키워드', icon: 'tag', desc: '근거 모아보기 · 사전', feature: 'seteuk' },
        ],
      },
    ],
  },
  {
    id: 'work',
    label: '업무',
    icon: 'medal',
    to: '/work',
    match: ['/work', '/share'],
    groups: [
      {
        title: '학교체육 업무',
        icon: 'medal',
        items: [
          { to: '/work/team', label: '학교운동부 · 학생선수', icon: 'medal', desc: '나이스 할 일 · 규정 · 양식', feature: 'work' },
          { to: '/work/club', label: '학교스포츠클럽', icon: 'team', desc: '등록 · 활동내역 · 학생부', feature: 'work' },
          { to: '/work/budget', label: '체육 예산 현황', icon: 'list', desc: '에듀파인 → 구글 시트', feature: 'work' },
        ],
      },
      {
        title: '같이 쓰기',
        icon: 'share',
        items: [
          { to: '/work/calendar', label: '업무 달력', icon: 'calendar', desc: 'PAPS · 나이스 마감 · 대회 일정' },
          { to: '/work/lend', label: '교구 대여 장부', icon: 'list', desc: '빌린 것 · 남은 수량 · 반납' },
          { to: '/work/book', label: '체육관 · 운동장 예약', icon: 'grid', desc: '요일 × 교시 예약표' },
          { to: '/work/space', label: '학교 공유 공간', icon: 'share', desc: '공유 코드로 같은 학교 선생님과 연결' },
          { to: '/share', label: '받은 자료 넣기', icon: 'download', desc: '다른 선생님이 보낸 진도표 · 수행평가 · 일정' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    label: '설정',
    icon: 'settings',
    to: '/more',
    match: ['/more', '/help'],
    groups: [
      {
        title: '앱 설정',
        icon: 'settings',
        items: [
          { to: '/more/settings', label: '학교 정보 · PIN', icon: 'settings', desc: '학교 · 학년도 · 잠금' },
          { to: '/more/settings/buttons', label: '기록 버튼', icon: 'edit', desc: '칭찬 · 지도 항목', feature: 'records' },
          { to: '/more/data', label: '백업 · 학년도', icon: 'database', desc: '백업 · 복원 · 새 학년도' },
        ],
      },
      {
        title: '도움',
        icon: 'info',
        items: [
          { to: '/help', label: '사용법', icon: 'info', desc: '하루 수업 흐름 · 질문' },
          { to: '/more/changelog', label: '업데이트 소식', icon: 'bolt', desc: '새로 바뀐 기능' },
          { to: '/more/terms', label: '이용 안내', icon: 'lock', desc: '자료 보관 · 개인정보' },
        ],
      },
    ],
  },
]

type Features = Parameters<typeof featureOn>[0]

/** 끈 기능을 뺀 묶음 (빈 묶음도 뺀다) */
export function visibleGroups(s: NavSection, f: Features): NavGroup[] {
  return s.groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.feature || featureOn(f, i.feature)) })).filter((g) => g.items.length > 0)
}

/** 아래 탭 · 위 메뉴에 보일 큰 메뉴 (항목이 다 꺼지면 숨김, 홈 · 설정은 늘) */
export function visibleSections(f: Features): NavSection[] {
  return NAV.filter((s) => s.id === 'home' || s.id === 'settings' || visibleGroups(s, f).length > 0)
}

const hit = (path: string, m: string) => path === m || path.startsWith(`${m}/`)

/** 지금 주소가 어느 큰 메뉴인지 (가장 길게 맞는 것) */
export function sectionOf(path: string): SectionId {
  if (path === '/' || path === '') return 'home'
  let best: { id: SectionId; len: number } | null = null
  for (const s of NAV) for (const m of s.match) if (hit(path, m) && (!best || m.length > best.len)) best = { id: s.id, len: m.length }
  return best?.id ?? 'home'
}

/** 켤 하위 항목: 주소가 똑같은 것 → 아니면 주소 앞부분이 가장 길게 맞는 것 (물음표가 붙은 항목은 똑같을 때만) */
export function activeItem(path: string, search: string, items: readonly NavItem[]): NavItem | undefined {
  const exact = items.find((i) => i.to === path + search) ?? items.find((i) => i.to === path)
  if (exact) return exact
  let best: NavItem | undefined
  for (const i of items) {
    if (i.to.includes('?') || i.to === '/') continue
    if (hit(path, i.to) && (!best || i.to.length > best.to.length)) best = i
  }
  return best
}
