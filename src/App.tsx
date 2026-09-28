import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import MiniTimer from './components/MiniTimer'
import { TimerProvider } from './state/TimerContext'
import { db } from './db/db'
import { loadSettings, saveSettings, type AppSettings } from './db/settings'
import { ensureKeywordSeed } from './db/recordsRepo'
import { DEFAULT_STANDARDS, type PapsStandards } from './lib/paps'
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
import StudentDetailPage from './pages/StudentDetailPage'
import CaptainsPage from './pages/CaptainsPage'
import AbsencesPage from './pages/AbsencesPage'
import RecordButtonsPage from './pages/RecordButtonsPage'
import TimetablePage from './pages/TimetablePage'
import { AppContext } from './state/AppContext'

/** 앱을 다른 앱으로 바꿔 두었다가 이 시간이 지나 돌아오면 다시 PIN을 묻는다. */
const RELOCK_AFTER_MS = 5 * 60 * 1000

export default function App() {
  const settings = useLiveQuery(() => loadSettings(db), [])
  const stdRow = useLiveQuery(() => db.settings.get('papsStandards').then((r) => r ?? null), [])
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

  // 세특 키워드 기본 사전 (처음 한 번만)
  useEffect(() => {
    void ensureKeywordSeed(db)
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => saveSettings(db, patch), [])
  const lock = useCallback(() => setUnlocked(false), [])
  const ctx = useMemo(() => {
    if (!settings) return null
    const standards = (stdRow?.value as PapsStandards | undefined) ?? DEFAULT_STANDARDS
    return { settings, updateSettings, lock, readOnly: settings.latestYear > settings.schoolYear, standards }
  }, [settings, updateSettings, lock, stdRow])

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
      <TimerProvider>
      <MiniTimer />
      <div className="min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
        <Routes>
          <Route path="/" element={<ClassPage />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/paps" element={<PapsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/import" element={<RosterImportPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/more/captains" element={<CaptainsPage />} />
          <Route path="/more/absences" element={<AbsencesPage />} />
          <Route path="/more/settings" element={<SettingsPage />} />
          <Route path="/more/settings/buttons" element={<RecordButtonsPage />} />
          <Route path="/more/settings/timetable" element={<TimetablePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
      </TimerProvider>
    </AppContext.Provider>
  )
}
