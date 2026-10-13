import type { Absence, ClassRecord, Lesson } from '../db/types'

/**
 * 수업 일지 (재설계 5단계). 순수 함수.
 * 일지 한 줄 = 수업반 · 날짜 하나. 그날 누가기록(칭찬·지도·견학)은 따로 적지 않아도 기록에서 세어 붙인다.
 */

export interface DayCount {
  exemplary: number
  unprepared: number
  absent: number
}

export function countsByDate(records: readonly ClassRecord[], absences: readonly Absence[]): Map<string, DayCount> {
  const m = new Map<string, DayCount>()
  const get = (d: string) => m.get(d) ?? m.set(d, { exemplary: 0, unprepared: 0, absent: 0 }).get(d)!
  for (const r of records) {
    if (r.type === 'exemplary') get(r.date).exemplary++
    else if (r.type === 'unprepared') get(r.date).unprepared++
  }
  const seen = new Set<string>()
  for (const a of absences) {
    const k = `${a.date}|${a.studentId}`
    if (seen.has(k)) continue
    seen.add(k)
    get(a.date).absent++
  }
  return m
}

/** 이 날짜보다 앞선 일지 중 가장 최근 것 (지난 시간 메모 보여 주기) */
export function previousLesson(lessons: readonly Lesson[], date: string): Lesson | undefined {
  return [...lessons].filter((l) => l.date < date).sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** 엑셀 표: 날짜 순. 일지가 없어도 기록이 있는 날은 줄을 만든다 */
export function journalRows(lessons: readonly Lesson[], counts: Map<string, DayCount>, memberCount: number): (string | number)[][] {
  const dates = [...new Set([...lessons.map((l) => l.date), ...counts.keys()])].sort()
  const byDate = new Map(lessons.map((l) => [l.date, l]))
  return [
    ['날짜', '교시', '단원·주제', '한 일', '다음 시간·메모', '참여', '견학', '칭찬', '지도'],
    ...dates.map((d) => {
      const l = byDate.get(d)
      const c = counts.get(d) ?? { exemplary: 0, unprepared: 0, absent: 0 }
      return [d, l?.period ?? '', l?.unit ?? '', l?.activity ?? '', l?.note ?? '', Math.max(0, memberCount - c.absent), c.absent, c.exemplary, c.unprepared]
    }),
  ]
}

/** 지금까지 적은 단원 이름 (입력 칸 자동 완성용, 최근 것 먼저) */
export function unitSuggestions(lessons: readonly Lesson[]): string[] {
  const out: string[] = []
  for (const l of [...lessons].sort((a, b) => b.date.localeCompare(a.date))) {
    const u = l.unit?.trim()
    if (u && !out.includes(u)) out.push(u)
  }
  return out
}
