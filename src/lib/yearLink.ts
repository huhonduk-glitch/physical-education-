/**
 * 학년도를 넘어 같은 학생 찾기 (2026-11-09 교사 승인 — 인더스쿨 '학년별 이력 관리'에서 착안).
 *
 * 학생은 학년도마다 명렬을 새로 올려 id · 학번 · 번호가 바뀐다. 그래서 다른 학년도에서
 * **이름 · 성별이 같고 학년이 학년도 차이만큼 다른** 학생을 같은 사람으로 본다
 * (예: 2026 고2 김하늘 ↔ 2025 고1 김하늘). 그 학년도에 그런 학생이 둘 이상이면 이어 붙이지 않고 알려 준다.
 * 저장하지 않고 볼 때마다 찾는다(저장 구조 그대로).
 */
export interface YearStudent {
  id: string
  schoolYear: number
  grade: number
  classNo: number
  name: string
  gender: 'M' | 'F' | null | undefined
}

export interface YearLink<S extends YearStudent = YearStudent> {
  schoolYear: number
  /** 그 학년도의 같은 학생 (같은 이름이 여럿이면 null) */
  student: S | null
  /** 같은 이름 · 성별 · 학년 후보 수 (2 이상이면 이어 붙이지 않음) */
  candidates: number
  /** 후보 학생들 (교사가 고를 때) */
  options: S[]
  /** 교사가 직접 고르거나 끊었는지 */
  manual?: boolean
}

/** 교사가 고친 연결: '학생id|학년도' → 다른 학년도 학생 id 또는 'none'(잇지 않기) */
export type YearLinkOverrides = Record<string, string>
export const overrideKey = (studentId: string, schoolYear: number) => `${studentId}|${schoolYear}`

const norm = (s: string) => s.replace(/\s+/g, '')

/** 다른 학년도의 같은 학생들 (학년도 순). 후보가 없는 학년도는 빠진다 */
export function linkAcrossYears<S extends YearStudent>(me: YearStudent, all: readonly S[]): YearLink<S>[] {
  const byYear = new Map<number, S[]>()
  for (const s of all) {
    if (s.schoolYear === me.schoolYear) continue
    const grade = me.grade + (s.schoolYear - me.schoolYear)
    if (s.grade !== grade || norm(s.name) !== norm(me.name)) continue
    if (me.gender && s.gender && me.gender !== s.gender) continue
    byYear.set(s.schoolYear, [...(byYear.get(s.schoolYear) ?? []), s])
  }
  return [...byYear]
    .sort((a, b) => a[0] - b[0])
    .map(([schoolYear, list]) => ({ schoolYear, student: list.length === 1 ? list[0] : null, candidates: list.length, options: list }))
}

/**
 * 교사가 고친 연결을 덮어씀 (2026-11-09): 'none'이면 그 학년도는 끊고, 학생 id면 그 학생으로(후보에 없어도 — 개명 · 전학 등).
 * 자동으로 못 찾은 학년도라도 교사가 이은 학생이 있으면 더한다.
 */
export function applyOverrides<S extends YearStudent>(me: YearStudent, links: readonly YearLink<S>[], all: readonly S[], ov: YearLinkOverrides | undefined): YearLink<S>[] {
  if (!ov) return [...links]
  const out = links.map((l) => {
    const v = ov[overrideKey(me.id, l.schoolYear)]
    if (v === undefined) return l
    if (v === 'none') return { ...l, student: null, manual: true }
    return { ...l, student: all.find((s) => s.id === v) ?? null, manual: true }
  })
  for (const [k, v] of Object.entries(ov)) {
    const [sid, y] = k.split('|')
    if (sid !== me.id || v === 'none' || out.some((l) => l.schoolYear === Number(y))) continue
    const s = all.find((x) => x.id === v)
    if (s) out.push({ schoolYear: Number(y), student: s, candidates: 0, options: [], manual: true })
  }
  return out.sort((a, b) => a.schoolYear - b.schoolYear)
}
