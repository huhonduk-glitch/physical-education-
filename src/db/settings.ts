import type { PeDatabase } from './db'
import neisRanges from '../data/neis-valid-ranges.json'
import type { Ranges } from '../lib/neisExport'
import type { CellSpec } from '../lib/papsLayout'
import type { FlexMode, StepMethod } from '../lib/paps'
import type { NeisEvent, NeisSchool, SlotGroup } from '../lib/neisOpenApi'
import type { TermsAgreement } from '../lib/terms'
import type { ComciData, ComciSchool } from '../lib/comcigan'
import type { SchoolGenderType, SchoolLevel } from './types'

/** 설정 화면에서 바꾸는 값들. settings 테이블에 key 하나씩 저장한다. */
export interface AppSettings {
  schoolName: string
  schoolLevel: SchoolLevel
  schoolGenderType: SchoolGenderType
  schoolYear: number
  /** 명렬표에 과정명·계열명·학과명이 없을 때만 쓰는 기본값 (나이스 양식 값) */
  defaultCourse: string
  defaultTrack: string
  defaultDept: string
  /** 연동 앱 주소 (CLAUDE.md 4-10) */
  bracketUrl: string
  tacticUrl: string
  /** 빠른 기록 버튼 항목 (설정에서 추가·수정·순서 변경) */
  recordButtons: RecordButtons
  /** 수업 시간표: 요일·교시별 담당 반 */
  timetable: TimetableEntry[]
  /** 교시 시작 시각 'HH:MM' (1교시부터). 학교마다 달라서 설정에서 고친다 */
  periodStarts: string[]
  /** 한 교시 길이(분) */
  periodMinutes: number
  /** 지금까지 만든 가장 최근 학년도. 이보다 이전 학년도를 보면 읽기 전용 (4-11) */
  latestYear: number
  /** 종합유연성 점수 방식: 법령(기본) / 기준표 (4-5) */
  papsFlexMode: FlexMode
  /** 스텝검사 심박 측정 방식: 촉진법 / 심박계 */
  papsStepMethod: StepMethod
  /** 나이스 입력 허용 범위·소수 자릿수 (추정값에서 시작, 교사가 고침) */
  neisRanges: Ranges
  /** 학년도별 나이스 PAPS 양식 (헤더 + 교사가 직접 지정한 칸) */
  neisTemplates: Record<string, NeisTemplate>
  /** 마지막 백업 시각 (ms) */
  lastBackupAt: number
  /** 켜 둔 기능 (끈 기능은 홈·메뉴에서 숨긴다. 자료는 지우지 않는다) */
  features: Record<FeatureId, boolean>
  /** 나이스 공개 자료로 불러올 우리 학교 (학교 공개 정보만. 2026-10-10 교사 승인) */
  neisSchool: NeisSchool | null
  /** 나이스 교육정보 개방 포털 인증키 (선택. 이 기기에만 저장) */
  neisApiKey: string
  /** 불러온 학사일정 (인터넷이 없어도 홈에 보이도록 기기에 둔다) */
  neisSchedule: { fetchedAt: number; events: NeisEvent[] } | null
  /** 전체 체육 시간표: 나이스에서 받은 한 주의 체육 칸 (인터넷 없어도 보이게 기기에 둔다) */
  neisPeWeek: { fetchedAt: number; from: string; slots: SlotGroup[] } | null
  /** 컴시간 중계 주소 (교사 계정의 Cloudflare Worker, relay/). 컴시간 공개 시간표만 오간다 */
  comciRelayUrl: string
  /** 컴시간에서 찾은 우리 학교 */
  comciSchool: ComciSchool | null
  /** 컴시간 시간표에서 찾을 내 이름 */
  comciTeacherName: string
  /** 컴시간에서 받은 한 주 (공개 시간표 · 인터넷 없어도 보이게 기기에 둔다). peNos = 겹침을 볼 체육 선생님 */
  comciWeek: { fetchedAt: number; week: number; label: string; myNo: number | null; peNos: number[]; data: ComciData } | null
  /** 이용 안내에 동의한 판·시각 (판이 오르면 다시 확인받는다) */
  termsAgreed: TermsAgreement | null
  /** 세특 AI 다듬기용 Claude API 키 (선택. 이 기기에만 저장 · 백업 파일에는 넣지 않는다) */
  claudeApiKey: string
  /** 세특 AI 연결: claude(API 키) · openrouter(원하는 모델) · manual(키 없이 무료 챗봇에 복사) */
  aiProvider: 'claude' | 'openrouter' | 'manual'
  /** OpenRouter 키 (이 기기에만 · 백업 제외) */
  openrouterApiKey: string
  openrouterModel: string
  /** 선생님 세특 예시 (AI가 문체만 참고. 이 기기에만) */
  seteukStyle: string
  /** 세특 수준 나누기 (6-7): 수준 수(2~5) · 비중 · 수준별 쓰기 틀(바꾼 것만) */
  seteukLevelCount: number
  seteukWeights: import('../lib/seteukLevel').LevelWeights
  seteukFrames: Partial<Record<1 | 2 | 3 | 4 | 5, import('../lib/seteukLevel').LevelFrame>>
  /** 보조심판 '우리 반 규칙' (종목 id → 글). 공식 규칙을 줄여 쓰는 수업 규칙 */
  refHouseRules: Record<string, string>
  /** 체육 예산 현황 (6-11 D): 에듀파인 사업관리카드에서 읽은 항목 · 교사가 고친 고르기 · 시트 붙일 자리. 학생 정보 없음 */
  budgetCard: { fetchedAt: number; fileName: string; card: import('../lib/budget').BudgetCard } | null
  budgetPicks: Record<string, boolean>
  /** 엑셀 없이 손으로 적은 예산 항목 (늘 체육 항목) */
  budgetManual: import('../lib/budget').BudgetItem[]
  budgetLayout: import('../lib/budget').SheetLayout
  /** 건강체력교실 대상 기준 (학교 지침에 맞게, 기본 종합 4·5등급 · 경도 · 고도비만) */
  clinicRule: import('../lib/schoolPaps').ClinicRule
  /** 건강체력교실 운영 (학년도 → 운영계획 · 참여 학생 · 활동 기록). 학생 id가 들어가 백업에 함께 간다 */
  clinic: Record<string, import('../lib/clinic').ClinicYear>
  /** 학년별 PAPS 이어 붙이기를 교사가 고친 것 ('학생id|학년도' → 다른 학년도 학생 id 또는 'none') */
  yearLinks: import('../lib/yearLink').YearLinkOverrides
  /** 학교체육소위원회 (학년도 → 위원 · 회의 기록). 교직원 · 학부모 이름만, 학생 정보 없음 */
  committee: Record<string, import('../lib/committee').CommitteeYear>
  /** 설문 · 자기평가 (학년도 → 설문 목록). 학생이 써 낸 답이라 세특에는 참고만 */
  surveys: Record<string, import('../lib/survey').Survey[]>
  /** 업무 달력 일정 (같이 쓰기 6-13, 이 기기에만 · 학생 정보 없음) */
  workEvents: import('../lib/workCal').WorkEvent[]
  /** 학교 공유 공간 연결 (0-4 예외 6-13). 비밀번호가 있어 백업 파일에서 뺀다(SECRET_KEYS) */
  space: import('../lib/space').SpaceConn | null
  /** 날씨 · 미세먼지 (6-11 H, 0-4 예외): 학교 위치(기상청 격자 · 측정소)와 마지막으로 받은 값 */
  weatherLoc: import('../lib/weather').WeatherLoc | null
  weatherCache: { fetchedAt: number; ncst?: import('../lib/weather').Ncst; fcst?: import('../lib/weather').Fcst; air?: import('../lib/weather').Air } | null
}

export interface NeisTemplate {
  headers: string[]
  /** 알아보지 못한 열을 교사가 지정한 것: 열 번호 → 칸 (null이면 무시) */
  overrides?: Record<number, CellSpec | null>
  registeredAt: number
}

export interface RecordButtons {
  unprepared: string[]
  exemplary: string[]
  captain: string[]
}

export interface TimetableEntry {
  /** 1=월 … 5=금 */
  day: number
  period: number
  /** 그 교시에 수업하는 수업반 (v3부터. 예전 '학년·반'은 저장소를 열 때 수업반으로 옮긴다) */
  groupId: string
}

/** 홈에서 켜고 끄는 기능 */
export type FeatureId = 'records' | 'plans' | 'paps' | 'assess' | 'sports' | 'tools' | 'apps' | 'absences' | 'captains' | 'seteuk' | 'work'
export const FEATURE_IDS: FeatureId[] = ['records', 'plans', 'paps', 'assess', 'sports', 'tools', 'apps', 'absences', 'captains', 'seteuk', 'work']

/** 버튼 기본값 (CLAUDE.md 4-2, 4-3). '기타'는 누르면 메모를 받는다 */
export const DEFAULT_RECORD_BUTTONS: RecordButtons = {
  unprepared: ['체육복', '실내화', '교구', '기타'],
  exemplary: ['정리정돈', '용구 정리', '친구 도움', '리더십', '안전 지킴', '적극 참여', '기타'],
  captain: ['준비운동 인솔', '교구 준비·정리', '출석 확인', '기타'],
}

/** 학년도는 3월에 바뀐다. 1~2월이면 지난해가 학년도다. */
export function currentSchoolYear(now = new Date()): number {
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear()
}

export function defaultSettings(): AppSettings {
  return {
    schoolName: '',
    schoolLevel: '고',
    schoolGenderType: '공학',
    schoolYear: currentSchoolYear(),
    defaultCourse: '주간',
    defaultTrack: '일반계',
    defaultDept: '일반학과',
    bracketUrl: 'https://sports-bracket.netlify.app',
    tacticUrl: 'https://k-tacticboard.netlify.app',
    recordButtons: structuredClone(DEFAULT_RECORD_BUTTONS),
    timetable: [],
    periodStarts: ['09:00', '10:00', '11:00', '12:00', '13:50', '14:50', '15:50'],
    periodMinutes: 50,
    latestYear: 0,
    papsFlexMode: 'regulation',
    papsStepMethod: 'palpation',
    neisRanges: structuredClone((neisRanges as { ranges: Ranges }).ranges),
    neisTemplates: {},
    lastBackupAt: 0,
    features: { records: true, plans: true, paps: true, assess: true, sports: true, tools: true, apps: true, absences: true, captains: true, seteuk: true, work: true },
    neisSchool: null,
    neisApiKey: '',
    neisSchedule: null,
    neisPeWeek: null,
    comciRelayUrl: '',
    comciSchool: null,
    comciTeacherName: '',
    comciWeek: null,
    termsAgreed: null,
    claudeApiKey: '',
    aiProvider: 'manual',
    openrouterApiKey: '',
    openrouterModel: '',
    seteukStyle: '',
    seteukLevelCount: 5,
    seteukWeights: { assess: 50, activity: 35, paps: 15, guide: 10 },
    seteukFrames: {},
    refHouseRules: {},
    budgetCard: null,
    budgetPicks: {},
    budgetManual: [],
    workEvents: [],
    clinicRule: { lowGrades: [4, 5], obeseLabels: ['경도비만', '고도비만'] },
    clinic: {},
    yearLinks: {},
    committee: {},
    surveys: {},
    space: null,
    weatherLoc: null,
    weatherCache: null,
    budgetLayout: { startCell: 'N5', itemSheet: '물품구입 시트', itemCol: 'H', amountCol: 'F', firstRow: 4, withEdufine: true },
  }
}

export const SETTING_KEYS = Object.keys(defaultSettings()) as (keyof AppSettings)[]

export async function loadSettings(db: PeDatabase): Promise<AppSettings> {
  const rows = await db.settings.bulkGet(SETTING_KEYS)
  const s = defaultSettings()
  rows.forEach((row, i) => {
    if (row && row.value !== undefined && row.value !== null) {
      ;(s as unknown as Record<string, unknown>)[SETTING_KEYS[i]] = row.value
    }
  })
  return s
}

export async function saveSettings(db: PeDatabase, patch: Partial<AppSettings>): Promise<void> {
  const rows = Object.entries(patch)
    .filter(([k]) => (SETTING_KEYS as string[]).includes(k))
    .map(([key, value]) => ({ key, value }))
  await db.settings.bulkPut(rows)
}
