import type { TimetableEntry } from '../db/settings'
import { currentPeriod, todaysLessons } from './timetable'

/**
 * 홈 화면 계산 (화면과 떼어 테스트할 수 있게).
 * - 시작 준비: 처음 쓰는 사람이 무엇부터 할지 순서대로 보여 주는 체크리스트
 * - 지금/다음 수업: 시간표에서 지금 하는 수업, 없으면 오늘 남은 다음 수업
 */
export interface SetupStep {
  id: 'roster' | 'groups' | 'timetable' | 'backup'
  label: string
  desc: string
  to: string
  done: boolean
  /** 안 해도 쓸 수 있는 단계 */
  optional?: boolean
}

export function setupSteps(s: { students: number; groups: number; timetable: number; lastBackupAt: number }): SetupStep[] {
  return [
    { id: 'roster', label: '학생 명렬 올리기', desc: '나이스 명렬 파일이나 복사·붙여넣기', to: '/students/import', done: s.students > 0 },
    { id: 'groups', label: '수업반 만들기', desc: '내가 수업하는 반 고르기 · 수강반', to: '/groups', done: s.groups > 0 },
    { id: 'timetable', label: '수업 시간표 정하기', desc: '수업 시간에 그 반이 바로 열려요', to: '/more/settings/timetable', done: s.timetable > 0, optional: true },
    { id: 'backup', label: '첫 백업 받기', desc: '자료는 이 기기에만 있어요', to: '/more/data', done: s.lastBackupAt > 0 },
  ]
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; next: SetupStep | null } {
  const done = steps.filter((s) => s.done).length
  return { done, total: steps.length, next: steps.find((s) => !s.done) ?? null }
}

function minutesOf(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** 지금 수업(now) 또는 오늘 남은 다음 수업(next). 없으면 null */
export function lessonFocus(
  now: Date,
  timetable: readonly TimetableEntry[],
  periodStarts: readonly string[],
  periodMinutes: number,
): { entry: TimetableEntry; status: 'now' | 'next'; start: string } | null {
  const lessons = todaysLessons(now, timetable)
  if (!lessons.length) return null
  const cur = currentPeriod(now, periodStarts, periodMinutes)
  const live = cur === null ? undefined : lessons.find((l) => l.period === cur)
  if (live) return { entry: live, status: 'now', start: periodStarts[live.period - 1] ?? '' }
  const mins = now.getHours() * 60 + now.getMinutes()
  const next = lessons.find((l) => {
    const s = minutesOf(periodStarts[l.period - 1])
    return s !== null && s > mins
  })
  return next ? { entry: next, status: 'next', start: periodStarts[next.period - 1] ?? '' } : null
}
