import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PeanutBot from './components/PeanutBot'
import BottomNav, { ContentFrame } from './components/BottomNav'
import DemoBanner from './components/DemoBanner'
import { AfterUpdate } from './components/WhatsNew'
import MiniTimer from './components/MiniTimer'
import { IS_DEMO } from './lib/demo'
import { TimerProvider } from './state/TimerContext'
import { db } from './db/db'
import { loadSettings, saveSettings, type AppSettings } from './db/settings'
import { ensureKeywordSeed } from './db/recordsRepo'
import { requestPersistentStorage } from './lib/school'
import { termsAccepted } from './lib/terms'
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
const PlansPage = lazy(() => import('./pages/plans/PlansPage'))
const PlanPage = lazy(() => import('./pages/plans/PlanPage'))
const PlanSetupPage = lazy(() => import('./pages/plans/PlanSetupPage'))
const NeisSyncPage = lazy(() => import('./pages/NeisSyncPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const RubricPage = lazy(() => import('./pages/RubricPage'))
const AssessFromPlanPage = lazy(() => import('./pages/AssessFromPlanPage'))
const TeamAppsPage = lazy(() => import('./pages/tools/TeamAppsPage'))
const VideoPage = lazy(() => import('./pages/tools/VideoPage'))
const SportsPage = lazy(() => import('./pages/sports/SportsPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const SportGuidePage = lazy(() => import('./pages/sports/SportGuidePage'))
const SlidesPage = lazy(() => import('./pages/sports/SlidesPage'))
const RefereePage = lazy(() => import('./pages/sports/RefereePage'))
const RefereePick = lazy(() => import('./pages/sports/RefereePage').then((m) => ({ default: m.RefereePick })))
const LeaguePage = lazy(() => import('./pages/sports/LeaguePage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const TermsGate = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsGate })))
const SectionHubPage = lazy(() => import('./pages/SectionHubPage'))
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
const PapsStatsPage = lazy(() => import('./pages/paps/PapsStatsPage'))
const PapsSchoolPage = lazy(() => import('./pages/paps/PapsSchoolPage'))
const ClinicPage = lazy(() => import('./pages/paps/ClinicPage'))
const WeeklyPage = lazy(() => import('./pages/WeeklyPage'))
const NeisCarryPage = lazy(() => import('./pages/NeisCarryPage'))
const PapsExportPage = lazy(() => import('./pages/paps/PapsExportPage'))
const PapsSetupPage = lazy(() => import('./pages/paps/PapsSetupPage'))
const PapsLinkCodesPage = lazy(() => import('./pages/paps/PapsLinkCodesPage'))
const KeywordsPage = lazy(() => import('./pages/KeywordsPage'))
const SeteukWritePage = lazy(() => import('./pages/SeteukWritePage'))
const AiGuidePage = lazy(() => import('./pages/AiGuidePage'))
const PeTimetablePage = lazy(() => import('./pages/PeTimetablePage'))
const AssessmentsPage = lazy(() => import('./pages/AssessmentsPage'))
const AssessmentGradePage = lazy(() => import('./pages/AssessmentGradePage'))
const AssessSheetPrintPage = lazy(() => import('./pages/AssessSheetPrintPage'))
const AssessmentEditPage = lazy(() => import('./pages/AssessmentEditPage'))
const AssessExportPage = lazy(() => import('./pages/AssessExportPage'))
const ClassSummaryPage = lazy(() => import('./pages/ClassSummaryPage'))
const DataPage = lazy(() => import('./pages/DataPage'))
const BudgetPage = lazy(() => import('./pages/BudgetPage'))
const QuotePage = lazy(() => import('./pages/QuotePage'))
const WorkFlowPage = lazy(() => import('./pages/WorkFlowPage'))
const AuthorDocsPage = lazy(() => import('./pages/WorkFlowPage').then((m) => ({ default: m.AuthorDocsPage })))
const SportsDayPage = lazy(() => import('./pages/SportsDayPage'))
const WorkGuidePage = lazy(() => import('./pages/WorkGuidePage'))
const WorkDocsPage = lazy(() => import('./pages/WorkDocsPage'))
const SurveyPage = lazy(() => import('./pages/seteuk/SurveyPage'))
const CommitteePage = lazy(() => import('./pages/CommitteePage'))
const SharePage = lazy(() => import('./pages/SharePage'))
const WorkCalendarPage = lazy(() => import('./pages/WorkCalendarPage'))
const SpacePage = lazy(() => import('./pages/space/SpacePage'))
const LendPage = lazy(() => import('./pages/space/LendPage'))
const BookPage = lazy(() => import('./pages/space/BookPage'))
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
  // 시연 모드는 잠금 없이 바로 연다 (가상 자료뿐)
  const [unlocked, setUnlocked] = useState(IS_DEMO)
  const hiddenAt = useRef<number | null>(null)

  // 폰 분실 대비: 백그라운드에 오래 있다가 돌아오면 잠근다.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current !== null) {
        if (!IS_DEMO && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false)
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 세특 키워드 기본 사전 (처음 한 번만)
  // 저장 공간 보호 요청: 브라우저가 공간이 모자랄 때 이 앱 자료를 지우지 않게 (켤 때마다 확인, 이미 켜져 있으면 그대로)
  useEffect(() => {
    void ensureKeywordSeed(db)
    void requestPersistentStorage()
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

  // 이용 안내를 아직 안 읽었으면 먼저 (처음 쓰는 사람도, 이미 쓰던 사람도 한 번)
  if (!termsAccepted(settings.termsAgreed)) {
    return (
      <AppContext.Provider value={ctx}>
        <Suspense fallback={null}>
          <TermsGate />
        </Suspense>
      </AppContext.Provider>
    )
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
      <ContentFrame>
        <DemoBanner />
        <AfterUpdate />
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
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/attend/neis" element={<NeisCarryPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/new" element={<PlanSetupPage />} />
          <Route path="/plans/:id" element={<PlanPage />} />
          <Route path="/plans/:id/setup" element={<PlanSetupPage />} />
          <Route path="/class" element={<SectionHubPage section="class" />} />
          <Route path="/eval" element={<SectionHubPage section="eval" />} />
          <Route path="/work" element={<SectionHubPage section="work" />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/tools" element={<Navigate to="/class" replace />} />
          <Route path="/tools/pick" element={<PickPage />} />
          <Route path="/tools/teams" element={<TeamsPage />} />
          <Route path="/tools/apps" element={<TeamAppsPage />} />
          <Route path="/tools/video" element={<VideoPage />} />
          <Route path="/sports" element={<SportsPage />} />
          <Route path="/more/changelog" element={<ChangelogPage />} />
          <Route path="/sports/:sport" element={<SportGuidePage />} />
          <Route path="/sports/:sport/slides" element={<SlidesPage />} />
          <Route path="/sports/:sport/referee" element={<RefereePage />} />
          <Route path="/referee" element={<RefereePick />} />
          {/* 리그전 새로 만들기는 SPORTS BRACKET으로 (2026-10-27 교사 결정). 이미 만든 리그전은 /leagues/:id 로 계속 본다 */}
          <Route path="/leagues/new" element={<Navigate to="/sports" replace />} />
          <Route path="/leagues/:id" element={<LeaguePage />} />
          <Route path="/paps" element={<PapsPage />} />
          <Route path="/paps/input/:key" element={<PapsInputPage />} />
          <Route path="/paps/paste" element={<PapsPastePage />} />
          <Route path="/paps/results" element={<PapsResultsPage />} />
          <Route path="/paps/stats" element={<PapsStatsPage />} />
          <Route path="/paps/school" element={<PapsSchoolPage />} />
          <Route path="/paps/clinic" element={<ClinicPage />} />
          <Route path="/paps/export" element={<PapsExportPage />} />
          <Route path="/paps/setup" element={<PapsSetupPage />} />
          <Route path="/paps/codes" element={<PapsLinkCodesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/import" element={<RosterImportPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/more/terms" element={<TermsPage />} />
          <Route path="/students/summary" element={<ClassSummaryPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/students/:id/report" element={<ReportPage scope="student" />} />
          <Route path="/more/keywords" element={<KeywordsPage />} />
          <Route path="/seteuk/write" element={<SeteukWritePage />} />
          <Route path="/seteuk/survey" element={<SurveyPage />} />
          <Route path="/seteuk/ai-guide" element={<AiGuidePage />} />
          <Route path="/timetable/pe" element={<PeTimetablePage />} />
          <Route path="/more/data" element={<DataPage />} />
          <Route path="/work/budget" element={<BudgetPage />} />
          <Route path="/work/quote" element={<QuotePage />} />
          <Route path="/work/flow" element={<WorkFlowPage />} />
          <Route path="/work/author-docs" element={<AuthorDocsPage />} />
          <Route path="/work/calendar" element={<WorkCalendarPage />} />
          <Route path="/work/space" element={<SpacePage />} />
          <Route path="/work/lend" element={<LendPage />} />
          <Route path="/work/book" element={<BookPage />} />
          <Route path="/work/docs" element={<WorkDocsPage />} />
          <Route path="/work/committee/meetings" element={<CommitteePage />} />
          <Route path="/work/sportsday" element={<SportsDayPage />} />
          <Route path="/work/sportsday/:tab" element={<SportsDayPage />} />
          <Route path="/work/:topic" element={<WorkGuidePage />} />
          <Route path="/work/:topic/:tab" element={<WorkGuidePage />} />
          <Route path="/paps/flow" element={<WorkFlowPage only="paps" />} />
          <Route path="/paps/clinic/flow" element={<WorkFlowPage only="clinic" />} />
          <Route path="/paps/docs" element={<AuthorDocsPage ids={['paps', 'clinic']} />} />
          <Route path="/share" element={<SharePage />} />
          <Route path="/more/assessments" element={<AssessmentsPage />} />
          <Route path="/more/assessments/new" element={<AssessmentEditPage />} />
          <Route path="/more/assessments/rubric" element={<RubricPage />} />
          <Route path="/more/assessments/from-plan" element={<AssessFromPlanPage />} />
          <Route path="/more/assessments/export" element={<AssessExportPage />} />
          <Route path="/more/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/more/assessments/:id/sheet" element={<AssessSheetPrintPage />} />
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
      </ContentFrame>
      <PeanutBot />
      <BottomNav />
      </TimerProvider>
    </AppContext.Provider>
  )
}
