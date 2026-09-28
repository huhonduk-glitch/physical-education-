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
}

export interface RubricItem {
  id: string
  label: string
  scale: 'AE' | 'score'
  maxScore?: number
}

export interface Assessment {
  id: string
  schoolYear: number
  title: string
  grade: number
  rubric: RubricItem[]
  altTaskEnabled: boolean
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
