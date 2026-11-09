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
}

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
    .map(([schoolYear, list]) => ({ schoolYear, student: list.length === 1 ? list[0] : null, candidates: list.length }))
}
