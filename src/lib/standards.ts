import raw from '../data/achievement-standards.json'

/**
 * 체육과 성취기준 목록 (src/data/achievement-standards.json).
 * 교사가 준 교육과정 파일에서만 채운다 — 코드에서 성취기준 문장을 만들지 않는다.
 */
export interface Standard {
  code: string
  text: string
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
  areas: StandardArea[]
}
export interface StandardsData {
  source: string
  subjects: StandardSubject[]
}

export const STANDARDS = raw as unknown as StandardsData

export interface StandardHit extends Standard {
  school: string
  curriculum: string
  subject: string
  area: string
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
        out.push({ ...s, school: sub.school, curriculum: sub.curriculum, subject: sub.subject, area: a.area })
      }
  }
  return out
}
