import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { db } from './db/db'
import { loadSettings, saveSettings, type AppSettings } from './db/settings'
import { PIN_SETTING_KEY, type StoredPin } from './lib/pin'
import ClassPage from './pages/ClassPage'
import LockPage from './pages/LockPage'
import MorePage from './pages/MorePage'
import PapsPage from './pages/PapsPage'
import RosterImportPage from './pages/RosterImportPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'
import StudentsPage from './pages/StudentsPage'
import TimerPage from './pages/TimerPage'
import { AppContext } from './state/AppContext'

/** 앱을 다른 앱으로 바꿔 두었다가 이 시간이 지나 돌아오면 다시 PIN을 묻는다. */
const RELOCK_AFTER_MS = 5 * 60 * 1000

export default function App() {
  const settings = useLiveQuery(() => loadSettings(db), [])
  const pinRow = useLiveQuery(() => db.settings.get(PIN_SETTING_KEY).then((r) => r ?? null), [])
  const [unlocked, setUnlocked] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  // 폰 분실 대비: 백그라운드에 오래 있다가 돌아오면 잠근다.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current !== null) {
        if (Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false)
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => saveSettings(db, patch), [])
  const lock = useCallback(() => setUnlocked(false), [])
  const ctx = useMemo(
    () => (settings ? { settings, updateSettings, lock } : null),
    [settings, updateSettings, lock],
  )

  if (settings === undefined || pinRow === undefined || !ctx) {
    return <div className="p-6 text-lg">불러오는 중…</div>
  }

  if (pinRow === null) {
    return (
      <AppContext.Provider value={ctx}>
        <SetupPage onDone={() => setUnlocked(true)} />
      </AppContext.Provider>
    )
  }

  if (!unlocked) {
    return <LockPage stored={pinRow.value as StoredPin} onUnlock={() => setUnlocked(true)} />
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Routes>
          <Route path="/" element={<ClassPage />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/paps" element={<PapsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/import" element={<RosterImportPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/more/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </AppContext.Provider>
  )
}
