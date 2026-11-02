import raw from '../data/achievement-standards.json'

/**
 * 체육과 성취기준 목록 (src/data/achievement-standards.json).
 * 교사가 준 교육과정 파일에서만 채운다 — 코드에서 성취기준 문장을 만들지 않는다.
 */
export interface Standard {
  code: string
  text: string
  /** 원문에 대한 메모 (예: 원문 코드 오기) */
  note?: string
}
export interface StandardArea {
  area: string
  standards: Standard[]
}
export interface StandardSubject {
  /** 중 / 고 */
  school: string
  /** 2015 / 2022 */
  curriculum: string
  /** 과목 이름 (예: 체육, 운동과 건강, 스포츠 생활1) */
  subject: string
  /** 과목 구분 (공통 / 일반 선택 / 진로 선택 / 융합 선택 / 체육 계열 진로 선택 …) */
  kind?: string
  areas: StandardArea[]
}
export interface StandardsData {
  source: string
  subjects: StandardSubject[]
}

export const STANDARDS = raw as unknown as StandardsData

export interface StandardHit extends Standard {
  kind?: string
  school: string
  curriculum: string
  subject: string
  area: string
}

/**
 * 2015 · 2022 개정 가운데 어느 판인지: 함께 나온 성취기준 번호 가운데 한 판에만 있는 번호가 더 많은 쪽 (2026-11-02).
 * 중학교 [9체01-01] · 고등 [12운건01-01]처럼 두 판의 번호가 겹치므로, 번호만으로 문장을 찾으면 판이 섞인다.
 * 가릴 수 없으면 2022.
 */
export function guessCurriculum(data: StandardsData, codes: readonly string[]): string {
  const by = new Map<string, Set<string>>()
  for (const sub of data.subjects) for (const a of sub.areas) for (const s of a.standards) {
    if (!by.has(s.code)) by.set(s.code, new Set())
    by.get(s.code)!.add(sub.curriculum)
  }
  const count: Record<string, number> = {}
  for (const c of codes) {
    const set = by.get(c)
    if (set?.size === 1) {
      const k = [...set][0]
      count[k] = (count[k] ?? 0) + 1
    }
  }
  return (count['2015'] ?? 0) > (count['2022'] ?? 0) ? '2015' : '2022'
}

/** 번호로 성취기준 문장 찾기 — 같은 번호가 두 판에 있으면 curriculum 판을 먼저 */
export function standardByCode(data: StandardsData, code: string, curriculum = '2022'): StandardHit | undefined {
  const all = findStandards(data, {}).filter((s) => s.code === code)
  return all.find((s) => s.curriculum === curriculum) ?? all[0]
}

/** 학교급·과목·찾는 말로 고르기 (띄어쓰기 무시) */
export function findStandards(data: StandardsData, q: { school?: string; subject?: string; text?: string }): StandardHit[] {
  const norm = (s: string) => s.replace(/\s+/g, '')
  const t = norm(q.text ?? '')
  const out: StandardHit[] = []
  for (const sub of data.subjects) {
    if (q.school && sub.school !== q.school) continue
    if (q.subject && sub.subject !== q.subject) continue
    for (const a of sub.areas)
      for (const s of a.standards) {
        if (t && !norm(`${s.code}${s.text}${a.area}`).includes(t)) continue
        out.push({ ...s, school: sub.school, curriculum: sub.curriculum, subject: sub.subject, kind: sub.kind, area: a.area })
      }
  }
  return out
}
