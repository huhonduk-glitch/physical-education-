import type { PeDatabase } from './db'
import neisRanges from '../data/neis-valid-ranges.json'
import type { Ranges } from '../lib/neisExport'
import type { CellSpec } from '../lib/papsLayout'
import type { FlexMode, StepMethod } from '../lib/paps'
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
  grade: number
  classNo: number
}

/** 버튼 기본값 (CLAUDE.md 4-2, 4-3). '기타'는 누르면 메모를 받는다 */
export const DEFAULT_RECORD_BUTTONS: RecordButtons = {
  unprepared: ['체육복', '실내화', '교구', '기타'],
  exemplary: ['정리정돈', '친구 도움', '리더십', '안전 지킴', '적극 참여', '기타'],
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
