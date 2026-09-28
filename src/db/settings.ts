import type { PeDatabase } from './db'
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
