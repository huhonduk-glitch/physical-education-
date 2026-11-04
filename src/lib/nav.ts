import type { IconName } from '../components/Icon'
import type { FeatureId } from '../db/settings'
import { featureOn } from './features'

/**
 * 메뉴 표 하나 (CLAUDE.md 6-12, 2026-11-04 교사 승인 — 파이스처럼 큰 메뉴 → 하위 메뉴 두 단계).
 * 폰 아래 탭 · PC 왼쪽 메뉴 · 큰 메뉴 화면(허브)이 모두 이 표를 쓴다. 기능을 더하면 여기 한 곳만 고친다.
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
  title: string
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
  { id: 'home', label: '홈', icon: 'home', to: '/', match: [], groups: [] },
  {
    id: 'class',
    label: '수업',
    icon: 'class',
    to: '/class',
    match: ['/class', '/groups', '/plans', '/sports', '/leagues', '/referee', '/timer', '/tools', '/more/absences', '/more/captains'],
    groups: [
      { title: '수업반', items: [{ to: '/groups', label: '내 수업반', icon: 'class', desc: '누가기록 · 출결 · 수업 일지', feature: 'records' }] },
      {
        title: '수업 준비',
        items: [
          { to: '/plans', label: '교과 진도표', icon: 'calendar', desc: '차시 계획 · 반별 진도', feature: 'plans' },
          { to: '/sports', label: '종목 수업자료', icon: 'book', desc: '규칙 · 슬라이드 · PPT', feature: 'sports' },
        ],
      },
      {
        title: '수업 중',
        items: [
          { to: '/timer', label: '타이머 · 스톱워치', icon: 'timer', desc: '카운트다운 · 인터벌 · 랩', feature: 'tools' },
          { to: '/tools/pick', label: '뽑기', icon: 'dice', desc: '발표 · 순서', feature: 'tools' },
          { to: '/tools/teams', label: '팀 나누기', icon: 'team', desc: '남녀 · 실력 고르게', feature: 'tools' },
          { to: '/referee', label: 'AI 보조심판', icon: 'flag', desc: '판정 · 점수 · 팀 파울', feature: 'sports' },
          { to: '/tools/video', label: '동작 영상', icon: 'eye', desc: '지연 재생 · 슬로모션', feature: 'tools' },
        ],
      },
      { title: '경기', items: [{ to: '/tools/apps', label: '대진표 · 팀 편성 · 전술 보드', icon: 'share', desc: 'SPORTS BRACKET · K-TacticBoard', feature: 'apps' }] },
      {
        title: '학생',
        items: [
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
    match: ['/eval', '/more/assessments', '/seteuk', '/more/keywords', '/students/summary'],
    groups: [
      {
        title: '수행평가',
        items: [
          { to: '/more/assessments', label: '수행평가', icon: 'clipboard', desc: '평가 목록 · 채점', feature: 'assess' },
          { to: '/more/assessments/from-plan', label: '평가계획서로 만들기', icon: 'upload', desc: 'PDF → 평가 · 채점 기준', feature: 'assess' },
          { to: '/more/assessments/rubric', label: '루브릭 만들기', icon: 'list', desc: '성취기준 → 판단 기준', feature: 'assess' },
          { to: '/more/assessments/export', label: '나이스 파일', icon: 'download', desc: '일괄입력 양식 채우기', feature: 'assess' },
        ],
      },
      {
        title: '세특',
        items: [
          { to: '/seteuk/write', label: '세특 쓰기', icon: 'edit', desc: '수준 · 초안 · 검사 · AI', feature: 'seteuk' },
          { to: '/more/keywords', label: '세특 키워드', icon: 'tag', desc: '근거 모아보기 · 사전', feature: 'seteuk' },
        ],
      },
      { title: '학생 기록', items: [{ to: '/students/summary', label: '반 요약', icon: 'list', desc: '칭찬 · 지도 상위 · 미측정', feature: 'records' }] },
    ],
  },
  {
    id: 'work',
    label: '업무',
    icon: 'medal',
    to: '/work',
    match: ['/work'],
    groups: [
      {
        title: '학교체육 업무',
        items: [
          { to: '/work/team', label: '학교운동부 · 학생선수', icon: 'medal', desc: '나이스 할 일 · 규정 · 양식' },
          { to: '/work/club', label: '학교스포츠클럽', icon: 'team', desc: '등록 · 활동내역 · 학생부' },
          { to: '/work/budget', label: '체육 예산 현황', icon: 'list', desc: '에듀파인 → 구글 시트' },
        ],
      },
    ],
  },
  {
    id: 'settings',
    label: '설정',
    icon: 'settings',
    to: '/more',
    match: ['/more', '/students', '/timetable', '/help'],
    groups: [
      {
        title: '기초 설정',
        items: [
          { to: '/more/settings', label: '학교 정보', icon: 'settings', desc: '학교 · 학년도 · PIN' },
          { to: '/students/import', label: '명렬 올리기', icon: 'upload', desc: '나이스 파일 · 붙여넣기' },
          { to: '/students', label: '전체 학생 명렬', icon: 'students', desc: '학생별 기록 · 리포트' },
          { to: '/groups/new', label: '수강반 만들기', icon: 'plus', desc: '선택과목 · 합반', feature: 'records' },
          { to: '/more/settings/timetable', label: '내 수업 시간표', icon: 'calendar', desc: '요일 · 교시마다 수업반' },
          { to: '/timetable/pe', label: '전체 체육 시간표', icon: 'grid', desc: '컴시간 · 체육관 겹침' },
          { to: '/more/settings/neis', label: '나이스에서 불러오기', icon: 'download', desc: '학급 · 시간표 · 학사일정' },
          { to: '/plans/new', label: '진도표 만들기', icon: 'calendar', desc: '평가계획서로 초안', feature: 'plans' },
        ],
      },
      {
        title: '앱',
        items: [
          { to: '/more/settings/buttons', label: '기록 버튼', icon: 'edit', desc: '칭찬 · 지도 항목', feature: 'records' },
          { to: '/more/data', label: '백업 · 학년도', icon: 'database', desc: '백업 · 복원 · 새 학년도' },
        ],
      },
      {
        title: '도움',
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

/** 아래 탭 · 왼쪽 메뉴에 보일 큰 메뉴 (항목이 다 꺼지면 숨김, 홈 · 설정은 늘) */
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

/** 왼쪽 메뉴에서 켤 하위 항목: 주소(물음표 앞)가 가장 길게 맞는 항목 */
export function activeItem(path: string, search: string, items: readonly NavItem[]): NavItem | undefined {
  const full = path + search
  const exact = items.find((i) => i.to === full)
  if (exact) return exact
  let best: NavItem | undefined
  for (const i of items) {
    const base = i.to.split('?')[0]
    if (i.to.includes('?')) continue
    if (hit(path, base) && (!best || base.length > best.to.length)) best = i
  }
  return best
}
