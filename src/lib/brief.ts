/**
 * 땅콩이 오늘 브리핑 (2026-11-11 교사 승인 — 스쿨보드 '오늘 브리핑' 참고, 문구 · 코드는 새로 씀).
 * 기기 안 자료를 세기만 한다(AI · 인터넷 없음). 학생 이름은 넣지 않는다 — 홈 화면은 학생이 볼 수도 있어서 수만.
 */

export interface BriefInput {
  /** 오늘 내 수업 (교시순) */
  lessons: readonly { period: number; start?: string; group: string }[]
  /** 남은 수업을 가리려고: 지금 시각 'HH:MM' */
  nowHHMM: string
  /** 나이스에 아직 안 옮긴 수업 출결 줄 수 */
  pendingNeis: number
  /** 진도가 늦은 반 */
  behind: readonly { group: string; late: number }[]
  /** 채점이 덜 끝난 평가 */
  grading: readonly { title: string; left: number }[]
  /** 다가오는 업무 일정 (오늘 포함 7일) */
  events: readonly { title: string; dday: string }[]
  /** 마지막 백업 뒤 지난 날 (한 번도 안 했으면 null) */
  backupDays: number | null
  /** 명렬이 있는지 (없으면 백업 얘기를 하지 않는다) */
  hasStudents: boolean
}

export interface BriefLine {
  icon: string
  text: string
  to?: string
}

const MAX_NAMES = 3
const list = (names: readonly string[]) => (names.length > MAX_NAMES ? `${names.slice(0, MAX_NAMES).join(', ')} 외 ${names.length - MAX_NAMES}` : names.join(', '))
const hhmm = (s: string) => s.padStart(5, '0')

/** 브리핑 줄. 알릴 것이 없으면 빈 배열 */
export function briefLines(i: BriefInput): BriefLine[] {
  const out: BriefLine[] = []
  if (i.lessons.length) {
    const say = (ls: BriefInput['lessons']) => ls.map((l) => `${l.period}교시 ${l.group}`).join(' · ')
    const left = i.lessons.filter((l) => !l.start || hhmm(l.start) >= hhmm(i.nowHHMM))
    const n = i.lessons.length
    out.push({
      icon: '🏃',
      text: left.length === n ? `오늘 수업 ${n}시간: ${say(i.lessons)}` : left.length ? `오늘 수업 ${n}시간 가운데 ${left.length}시간 남았어요: ${say(left)}` : `오늘 수업 ${n}시간을 모두 마쳤어요. 수고하셨어요!`,
      to: '/groups',
    })
  }
  if (i.pendingNeis > 0) out.push({ icon: '📝', text: `나이스에 아직 안 옮긴 출결이 ${i.pendingNeis}건 있어요.`, to: '/attend/neis' })
  if (i.behind.length) out.push({ icon: '📚', text: `진도가 늦은 반: ${list(i.behind.map((b) => `${b.group}(${b.late}차시)`))}`, to: '/plans' })
  if (i.grading.length) out.push({ icon: '✏️', text: `채점이 남은 평가: ${list(i.grading.map((g) => `${g.title}(${g.left}명)`))}`, to: '/more/assessments' })
  if (i.events.length) out.push({ icon: '📅', text: `다가오는 업무: ${list(i.events.map((e) => `${e.title} ${e.dday}`))}`, to: '/work/calendar' })
  if (i.hasStudents && (i.backupDays === null || i.backupDays >= 7)) out.push({ icon: '💾', text: i.backupDays === null ? '아직 백업을 한 번도 안 했어요.' : `백업한 지 ${i.backupDays}일 지났어요.`, to: '/more/backup' })
  return out
}

/** 대화 창에 넣을 글 */
export function briefText(lines: readonly BriefLine[]): string {
  if (!lines.length) return '오늘은 따로 알려 드릴 게 없어요. 편안한 하루 보내세요 🥜'
  return ['오늘 브리핑이에요 🥜', ...lines.map((l) => `${l.icon} ${l.text}`)].join('\n')
}

export const BRIEF_LINK_LABELS: Record<string, string> = {
  '/groups': '수업반',
  '/attend/neis': '옮길 출결',
  '/plans': '진도표',
  '/more/assessments': '수행평가',
  '/work/calendar': '업무 달력',
  '/more/backup': '백업',
}

/** 바로가기 (같은 화면은 한 번만) */
export function briefLinks(lines: readonly BriefLine[], labels: Record<string, string> = BRIEF_LINK_LABELS): { to: string; label: string }[] {
  const seen = new Set<string>()
  const out: { to: string; label: string }[] = []
  for (const l of lines) {
    if (!l.to || seen.has(l.to)) continue
    seen.add(l.to)
    out.push({ to: l.to, label: labels[l.to] ?? '열기' })
  }
  return out
}
