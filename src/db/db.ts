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
  AudioFile,
  ClassGroup,
  Lesson,
  PapsRound,
} from './types'
import { migrateToGroups } from './groupsRepo'
import { dbName } from '../lib/demo'

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
  audioFiles!: EntityTable<AudioFile, 'id'>
  groups!: EntityTable<ClassGroup, 'id'>
  lessons!: EntityTable<Lesson, 'id'>
  papsRounds!: EntityTable<PapsRound, 'id'>

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
    // v2: 왕복오래달리기 음원(교사가 올린 mp3)을 기기에 보관
    this.version(2).stores({ audioFiles: 'id' })
    // v3: 수업반(학적반·수강반). 기록·견학에 수업반 표시를 붙이고, 예전 자료를 학적반 수업반으로 옮긴다
    this.version(3)
      .stores({
        groups: 'id, schoolYear, kind, [schoolYear+grade+classNo]',
        records: 'id, schoolYear, studentId, date, type, [studentId+date], groupId, [groupId+date]',
        absences: 'id, schoolYear, studentId, date, groupId, [groupId+date]',
      })
      .upgrade((tx) =>
        migrateToGroups({
          students: tx.table('students'),
          groups: tx.table('groups'),
          records: tx.table('records'),
          absences: tx.table('absences'),
          settings: tx.table('settings'),
        }),
      )
    // v4: 수업 일지
    this.version(4).stores({ lessons: 'id, schoolYear, groupId, date, [groupId+date]' })
    // v5: PAPS 측정 회차. 표 하나만 더한다 — 기존 표·기록은 건드리지 않는다(회차 없는 기록 = 1회차).
    // 이 버전으로 처음 열기 전에 main.tsx가 옛 저장소를 통째로 자동 백업한다(autoBackup.ts)
    this.version(5).stores({ papsRounds: 'id, schoolYear, [schoolYear+grade+classNo]' })
  }
}

// 시연 모드(?demo=1)면 따로 된 저장소를 쓴다 → 실제 학생 자료와 섞이지 않는다 (src/lib/demo.ts)
export const db = new PeDatabase(dbName())

export function newId(): string {
  return crypto.randomUUID()
}
