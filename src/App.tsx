import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import MiniTimer from './components/MiniTimer'
import { TimerProvider } from './state/TimerContext'
import { db } from './db/db'
import { loadSettings, saveSettings, type AppSettings } from './db/settings'
import { ensureKeywordSeed } from './db/recordsRepo'
import { DEFAULT_STANDARDS, type PapsStandards } from './lib/paps'
import { PIN_SETTING_KEY, type StoredPin } from './lib/pin'
import HomePage from './pages/HomePage'
const LockPage = lazy(() => import('./pages/LockPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const PapsPage = lazy(() => import('./pages/PapsPage'))
const RosterImportPage = lazy(() => import('./pages/RosterImportPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TimerPage = lazy(() => import('./pages/TimerPage'))
const JournalPage = lazy(() => import('./pages/groups/JournalPage'))
const NeisSyncPage = lazy(() => import('./pages/NeisSyncPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const RubricPage = lazy(() => import('./pages/RubricPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const PickPage = lazy(() => import('./pages/tools/PickPage'))
const TeamsPage = lazy(() => import('./pages/tools/TeamsPage'))
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage'))
const CaptainsPage = lazy(() => import('./pages/CaptainsPage'))
const AbsencesPage = lazy(() => import('./pages/AbsencesPage'))
const RecordButtonsPage = lazy(() => import('./pages/RecordButtonsPage'))
const TimetablePage = lazy(() => import('./pages/TimetablePage'))
const PapsInputPage = lazy(() => import('./pages/paps/PapsInputPage'))
const PapsPastePage = lazy(() => import('./pages/paps/PapsPastePage'))
const PapsResultsPage = lazy(() => import('./pages/paps/PapsResultsPage'))
const PapsExportPage = lazy(() => import('./pages/paps/PapsExportPage'))
const PapsSetupPage = lazy(() => import('./pages/paps/PapsSetupPage'))
const KeywordsPage = lazy(() => import('./pages/KeywordsPage'))
const AssessmentsPage = lazy(() => import('./pages/AssessmentsPage'))
const AssessmentGradePage = lazy(() => import('./pages/AssessmentGradePage'))
const AssessmentEditPage = lazy(() => import('./pages/AssessmentEditPage'))
const AssessExportPage = lazy(() => import('./pages/AssessExportPage'))
const ClassSummaryPage = lazy(() => import('./pages/ClassSummaryPage'))
const DataPage = lazy(() => import('./pages/DataPage'))
const EvalPage = lazy(() => import('./pages/EvalPage'))
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage'))
const GroupBoardPage = lazy(() => import('./pages/groups/GroupBoardPage'))
const GroupEditPage = lazy(() => import('./pages/groups/GroupEditPage'))
const GroupStatsPage = lazy(() => import('./pages/groups/GroupStatsPage'))
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
        <Suspense fallback={null}>
          <SetupPage onDone={() => setUnlocked(true)} />
        </Suspense>
      </AppContext.Provider>
    )
  }

  if (!unlocked) {
    return (
      <Suspense fallback={null}>
        <LockPage stored={pinRow.value as StoredPin} onUnlock={() => setUnlocked(true)} />
      </Suspense>
    )
  }

  return (
    <AppContext.Provider value={ctx}>
      <TimerProvider>
      <MiniTimer />
      <div className="min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60 print:p-0">
        <Suspense fallback={<div className="p-6 text-ink-3">불러오는 중…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/new" element={<GroupEditPage />} />
          <Route path="/groups/:id" element={<GroupBoardPage />} />
          <Route path="/groups/:id/edit" element={<GroupEditPage />} />
          <Route path="/groups/:id/stats" element={<GroupStatsPage />} />
          <Route path="/groups/:id/journal" element={<JournalPage />} />
          <Route path="/groups/:id/report" element={<ReportPage scope="group" />} />
          <Route path="/eval" element={<EvalPage />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/tools/pick" element={<PickPage />} />
          <Route path="/tools/teams" element={<TeamsPage />} />
          <Route path="/paps" element={<PapsPage />} />
          <Route path="/paps/input/:key" element={<PapsInputPage />} />
          <Route path="/paps/paste" element={<PapsPastePage />} />
          <Route path="/paps/results" element={<PapsResultsPage />} />
          <Route path="/paps/export" element={<PapsExportPage />} />
          <Route path="/paps/setup" element={<PapsSetupPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/import" element={<RosterImportPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/students/summary" element={<ClassSummaryPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/students/:id/report" element={<ReportPage scope="student" />} />
          <Route path="/more/keywords" element={<KeywordsPage />} />
          <Route path="/more/data" element={<DataPage />} />
          <Route path="/more/assessments" element={<AssessmentsPage />} />
          <Route path="/more/assessments/new" element={<AssessmentEditPage />} />
          <Route path="/more/assessments/rubric" element={<RubricPage />} />
          <Route path="/more/assessments/export" element={<AssessExportPage />} />
          <Route path="/more/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/more/assessments/:id" element={<AssessmentGradePage />} />
          <Route path="/more/captains" element={<CaptainsPage />} />
          <Route path="/more/absences" element={<AbsencesPage />} />
          <Route path="/more/settings" element={<SettingsPage />} />
          <Route path="/more/settings/buttons" element={<RecordButtonsPage />} />
          <Route path="/more/settings/timetable" element={<TimetablePage />} />
          <Route path="/more/settings/neis" element={<NeisSyncPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
      <BottomNav />
      </TimerProvider>
    </AppContext.Provider>
  )
}
