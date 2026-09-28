import { createContext, useContext } from 'react'
import type { AppSettings } from '../db/settings'
import type { PapsStandards } from '../lib/paps'

export interface AppContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  lock: () => void
  /** 지난 학년도를 보고 있으면 true — 기록·수정 버튼을 막는다 */
  readOnly: boolean
  /** 지금 쓰는 PAPS 기준표 (기본은 공식 JSON, 설정에서 교체 가능) */
  standards: PapsStandards
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const v = useContext(AppContext)
  if (!v) throw new Error('AppContext 밖에서 useApp을 불렀어요')
  return v
}
