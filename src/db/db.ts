import Dexie, { type EntityTable } from 'dexie'
import type {
  Absence,
  Assessment,
  AssessmentScore,
  Captain,
  ClassRecord,
  Keyword,
  PapsConfig,
  PapsResult,
  SettingRow,
  Student,
  TimerPreset,
} from './types'

/**
 * 기기 안 저장소 (IndexedDB). 서버로 보내는 것은 없다.
 * 테이블 11개를 Phase 1에서 모두 만들어 두어, 뒤 Phase에서 저장 구조를 갈아엎지 않게 한다.
 */
export class PeDatabase extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>
  students!: EntityTable<Student, 'id'>
  records!: EntityTable<ClassRecord, 'id'>
  captains!: EntityTable<Captain, 'id'>
  absences!: EntityTable<Absence, 'id'>
  keywords!: EntityTable<Keyword, 'id'>
  papsConfigs!: EntityTable<PapsConfig, 'id'>
  papsResults!: EntityTable<PapsResult, 'id'>
  assessments!: EntityTable<Assessment, 'id'>
  assessmentScores!: EntityTable<AssessmentScore, 'id'>
  timerPresets!: EntityTable<TimerPreset, 'id'>

  constructor(name = 'pe-records') {
    super(name)
    this.version(1).stores({
      settings: 'key',
      students: 'id, schoolYear, [schoolYear+grade+classNo], [schoolYear+grade+classNo+number], studentCode, status',
      records: 'id, schoolYear, studentId, date, type, [studentId+date]',
      captains: 'id, schoolYear, [schoolYear+grade+classNo], studentId',
      absences: 'id, schoolYear, studentId, date',
      keywords: 'id, category, isActive, sortOrder',
      papsConfigs: 'id, [schoolYear+grade+classNo]',
      papsResults: 'id, schoolYear, studentId, eventId, [studentId+eventId]',
      assessments: 'id, schoolYear, grade',
      assessmentScores: 'id, assessmentId, studentId, [assessmentId+studentId]',
      timerPresets: 'id',
    })
  }
}

export const db = new PeDatabase()

export function newId(): string {
  return crypto.randomUUID()
}
