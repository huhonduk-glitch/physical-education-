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
