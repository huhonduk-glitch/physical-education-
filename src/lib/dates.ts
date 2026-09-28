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
