// 데이터 모델 (CLAUDE.md 3장). 여기의 모양을 바꾸면 db.ts의 버전도 올려야 한다.

export type Gender = 'M' | 'F'
export type StudentStatus = '재학' | '전출' | '휴학'
export type SchoolGenderType = '남' | '여' | '공학'
export type SchoolLevel = '초' | '중' | '고'

export interface SettingRow {
  key: string
  value: unknown
}

export interface Student {
  id: string
  schoolYear: number
  grade: number
  classNo: number
  /** 반코드. 나이스 양식 그대로 2자리 텍스트('01') */
  classCode: string
  number: number
  name: string
  gender: Gender | null
  /** 학년 + 반(2자리) + 번호(2자리). 예: 1학년 3반 12번 → '10312' */
  studentCode: string
  course?: string
  track?: string
  dept?: string
  status: StudentStatus
  memo: string
}

/**
 * 수업반 (고교학점제 대응). 실제로 수업하는 학생 묶음이다.
 * - homeroom: 학적반 그대로 (학년·반으로 학생을 찾는다 → 명렬을 다시 올려도 자동 반영)
 * - elective: 수강반·합반 (여러 학적반 학생을 골라 memberIds에 담는다)
 */
export interface ClassGroup {
  id: string
  schoolYear: number
  /** 0 = 1년 내내, 1·2 = 학기 */
  semester: 0 | 1 | 2
  kind: 'homeroom' | 'elective'
  name: string
  /** 과목명 (체육, 운동과 건강, 스포츠 생활 …). 비어 있어도 된다 */
  subject: string
  grade?: number
  classNo?: number
  /** elective만 쓴다. 학생 id 목록 */
  memberIds: string[]
  /** 카드 색 이름 (palette 키) */
  color: string
  sortOrder: number
  archived: boolean
  createdAt: number
}

export type RecordType = 'unprepared' | 'exemplary' | 'captain' | 'observation'

export interface ClassRecord {
  id: string
  schoolYear: number
  studentId: string
  date: string
  period?: number
  type: RecordType
  category: string
  note?: string
  keywordIds: string[]
  /** 어느 수업반 수업에서 남긴 기록인지 (v3부터) */
  groupId?: string
  createdAt: number
  updatedAt: number
}

export interface Captain {
  id: string
  schoolYear: number
  grade: number
  classNo: number
  studentId: string
  role: '부장' | '부부장'
  from: string
  to?: string
}

export interface Absence {
  id: string
  schoolYear: number
  studentId: string
  date: string
  period?: number
  reason: '부상' | '생리' | '질병' | '기타'
  detail?: string
  altTaskId?: string
  altTaskDone: boolean
  /** 어느 수업반 수업에서 견학했는지 (v3부터) */
  groupId?: string
}

export interface Keyword {
  id: string
  label: string
  category: string
  isActive: boolean
  sortOrder: number
}

export interface PapsConfig {
  id: string
  schoolYear: number
  grade: number
  classNo: number
  selectedEvents: Record<string, string>
}

export interface PapsResult {
  id: string
  schoolYear: number
  studentId: string
  eventId: string
  /** 차수 (1차·2차, 심박수는 1~3회) */
  attempt: number | null
  side: 'R' | 'L' | null
  value?: number
  excluded: boolean
  excludeReason?: string
  measuredAt: number
  /**
   * 측정 회차 (재설계 B-5). 없으면 1회차 — 예전 기록은 고치지 않고 그대로 1회차로 읽는다.
   * 2회차부터는 papsRounds의 id. 측정 제외(EXCLUDED_KEY) 행은 회차와 상관없이 그 학년도 전체에 적용된다.
   */
  roundId?: string
}

/** PAPS 측정 회차 (반마다). 1회차는 행이 없어도 있는 것으로 본다(날짜만 적으려면 행을 만든다) */
export interface PapsRound {
  id: string
  schoolYear: number
  grade: number
  classNo: number
  /** 1, 2, 3 … */
  round: number
  /** 측정한 날 YYYY-MM-DD */
  date: string
  createdAt: number
}

export interface RubricItem {
  id: string
  label: string
  scale: 'AE' | 'score'
  maxScore?: number
}

/**
 * 수행평가 채점 요소 (재설계 3단계).
 * - level : 등급표 (A=10, B=8 …). 입력값은 등급 글자
 * - record: 기록표 (줄넘기 120회 이상=10점 …). 입력값은 기록(숫자)
 * - direct: 점수 직접 입력 (0 ~ max)
 */
export type AssessMethod = 'level' | 'record' | 'direct'
export interface AssessLevel {
  label: string
  points: number
  /** 루브릭: 이 등급의 판단 기준 (예: 패스·드리블을 정확하고 일관되게 수행한다) */
  desc?: string
}
export interface RecordBand {
  /** 높을수록: 이 기록 '이상'이면 / 낮을수록: 이 기록 '이하'면 */
  limit: number
  points: number
}
export interface AssessItem {
  id: string
  label: string
  method: AssessMethod
  /** direct일 때 만점 */
  max?: number
  levels?: AssessLevel[]
  unit?: string
  better?: 'higher' | 'lower'
  bands?: RecordBand[]
  /** 기록표에서 어느 구간에도 들지 못할 때 점수 (기본 점수) */
  basePoints?: number
  /** 여학생 기준이 따로 있으면 (평가계획서의 '남자 20회 이상, 여자 15회 이상'). 없으면 bands를 함께 쓴다 */
  bandsF?: RecordBand[]
  basePointsF?: number
  /** '미참여'로 입력하면 받는 점수 (자발적 미참여 · 장기 미인정 결석) */
  nonPartPoints?: number
  /** 체크리스트: 평가 요소 목록. 기록 = 만족한 개수 */
  checks?: string[]
}

export interface Assessment {
  id: string
  schoolYear: number
  /** 평가 이름 = 나이스 양식의 영역 이름 (예: 나를 지키는 상황별 실전 호신술) */
  title: string
  /** 예전 방식(학년 단위) 평가에서만 쓴다 */
  grade: number
  /** 예전 방식 채점 요소. 새 평가는 items를 쓴다 (id가 같아 예전 점수도 그대로 읽힌다) */
  rubric: RubricItem[]
  altTaskEnabled: boolean
  /** 재설계: 이 평가를 하는 수업반 */
  groupIds?: string[]
  /** 재설계: 채점 요소 */
  items?: AssessItem[]
  semester?: 0 | 1 | 2
  /** 5단계: 이 평가가 근거로 삼은 성취기준 (루브릭 만들기에서 고른 것) */
  standards?: { code: string; text: string }[]
  /** 6-5 ②: 평가계획서에서 읽은 정보 (평가요소 · 평가방법 · 시기 · 반영비율 · 성취수준별 수행 특성) */
  plan?: { elements?: string; methods?: string[]; when?: string; ratio?: string; levelDescs?: { label: string; desc: string }[] }
}

export interface AssessmentScore {
  id: string
  assessmentId: string
  studentId: string
  scores: Record<string, string | number>
  note?: string
}

export interface TimerPreset {
  id: string
  name: string
  mode: string
  config: Record<string, unknown>
}

export interface AudioFile {
  id: string
  name: string
  blob: Blob
  addedAt: number
}

/** 수업 일지 (재설계 5단계): 수업반 · 날짜마다 한 줄 */
/** 진도표 한 차시 (6-5, v6). 날짜는 저장하지 않고 시간표·쉬는 날로 그때그때 계산한다 */
export interface PlanItem {
  id: string
  /** 단원명 */
  unit: string
  /** 학습 내용 · 활동 */
  content: string
  /** 성취기준 코드 ([12스생2-01-01] …) */
  standards: string[]
  /** 수업 방법 (강의식 · 모둠별 · 협동식 …) */
  method?: string
  /** 평가 연계 · 메모 */
  evalNote?: string
  /** 이 날짜에 고정 (평가일 등). 밀기를 해도 움직이지 않는다 */
  lockedDate?: string
}

/** 진도표: 과목·학년·학기 하나에 한 개. 여러 수업반이 같은 진도표를 쓴다 */
export interface ProgressPlan {
  id: string
  schoolYear: number
  semester: 1 | 2
  title: string
  subject: string
  grade?: number
  /** 주당 시간(학점) · 주 수 → 목표 차시 = 둘을 곱한 값 */
  weeklyHours: number
  weeks: number
  /** 목표 차시 (보통 weeklyHours × weeks, 교사가 바꿀 수 있다) */
  target: number
  /** 학기 첫날 · 끝날 (YYYY-MM-DD) */
  startDate: string
  endDate: string
  /** 수업이 없는 날 (공휴일 · 방학 · 고사 · 행사) */
  offDays: string[]
  /** 이 진도표를 쓰는 수업반 */
  groupIds: string[]
  items: PlanItem[]
  /** 수업반별로 빠진 수업 'YYYY-MM-DD|교시' (밀기) */
  skips: Record<string, string[]>
  /** 수업반별로 끝낸 차시 id */
  done: Record<string, string[]>
  /** 범교과 연계 (사회정서 · 안전 · 인성 …) — 시기와 주제만 */
  extras?: { when: string; label: string }[]
  createdAt: number
  updatedAt: number
}

/** 세특 쓰기 (6-5 ③, v7): 학생 · 수업반마다 한 줄. 교사가 쓴 글과 AI가 다듬은 글을 나눠 둔다 */
export interface SeteukDraft {
  id: string
  schoolYear: number
  studentId: string
  groupId: string
  /** 지금 글 (교사가 고치는 칸) */
  text: string
  /** AI가 마지막으로 다듬어 준 글 — 교사가 고쳤는지 비교한다 (기재요령: AI 글을 그대로 입력 금지) */
  aiText?: string
  aiUsed?: boolean
  /** AI 도움을 받았을 때 교사 확인 (AI_CONFIRM_ITEMS 순서) */
  aiConfirm?: boolean[]
  status: 'draft' | 'confirmed'
  /** 교사가 정한 수준 (1~수준 수, 높을수록 잘함). 없으면 그때그때 계산한 앱 제안을 쓴다 (6-7) */
  level?: number
  /** 중요 표시한 근거 id (초안 · AI에서 먼저 살림) */
  important?: string[]
  /** 초안에서 뺀 근거 id */
  excluded?: string[]
  /** 초안을 만들 때 근거 모양 — 근거가 바뀌면 '다시 만들기'를 알린다 */
  basisKey?: string
  confirmedText?: string
  confirmedAt?: number
  updatedAt: number
}

/** 리그전 (6-5 ④, v8): 수업반(선택) 안 팀끼리 돌아가며 겨룬다. 순위는 저장하지 않고 볼 때마다 계산 (src/lib/league.ts) */
export interface League {
  id: string
  schoolYear: number
  groupId?: string
  sport: import('../lib/league').SportId
  name: string
  rules: import('../lib/league').LeagueRules
  /** 두 번씩(홈 · 원정 바꿔) */
  double: boolean
  teams: import('../lib/league').LeagueTeam[]
  matches: import('../lib/league').LeagueMatch[]
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export interface Lesson {
  id: string
  schoolYear: number
  groupId: string
  date: string
  period?: number
  /** 단원 · 주제 */
  unit?: string
  /** 한 일 (활동 내용) */
  activity: string
  /** 다음 시간 · 준비물 · 메모 */
  note?: string
  createdAt: number
  updatedAt: number
}

/** 수업 출결 (v9, 2026-10-30 교사 요청). 출석이 기본이라 결석 · 지각 · 조퇴 · 결과만 한 줄씩 저장한다 (나이스 출결 용어) */
export type AttendStatus = 'absent' | 'late' | 'early' | 'result'
export type AttendReason = '질병' | '인정' | '미인정' | '기타'
export interface Attendance {
  id: string
  schoolYear: number
  groupId: string
  studentId: string
  date: string
  /** 그날 이 반 수업이 두 교시면 교시마다 따로 (없으면 그날 한 번) */
  period?: number
  status: AttendStatus
  /** 건강 정보일 수 있어 목록에서는 가린다 */
  reason?: AttendReason
  createdAt: number
  updatedAt: number
}
