import { createContext, useContext } from 'react'
import type { AppSettings } from '../db/settings'

export interface AppContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  lock: () => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const v = useContext(AppContext)
  if (!v) throw new Error('AppContext 밖에서 useApp을 불렀어요')
  return v
}
