// 날짜는 모두 기기 시간대 기준 'YYYY-MM-DD' 글자로 다룬다 (UTC로 바꾸면 밤 9시 이후 날짜가 밀린다).

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(now = new Date()): string {
  return toDateStr(now)
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** 'YYYY-MM' → '4월' 같은 짧은 이름 */
export function monthLabel(month: string): string {
  return `${Number(month.slice(5, 7))}월`
}

/** 'YYYY-MM-DD' → '4/15(화)' */
export function shortDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = '일월화수목금토'[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${wd})`
}

/** 하루 전 날짜 */
export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d - 1))
}

/** n일 뒤(음수면 앞) 날짜 */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

/** 'YYYY-MM' 달의 다음/이전 달 */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 달력 한 달치 칸 (일요일 시작, 6주 고정이 아니라 필요한 주만큼).
 * 그 달이 아닌 날은 null.
 */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const days = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(y, m - 1, d)))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** '2026-09-28' → '9월 28일 (월)' */
export function longDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = '일월화수목금토'[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${wd})`
}
