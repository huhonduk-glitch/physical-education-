import type { IconName } from '../components/Icon'
import { visibleGroups, visibleSections, type NavSection } from './nav'

/**
 * 메뉴 찾기 (2026-11-25, 슈퍼스쿨 '전체 메뉴' 검색 창 참고 — 코드는 새로 씀).
 * 메뉴 표(nav.ts) 하나만 읽는다 → 메뉴를 고치면 찾기도 저절로 따라간다. 끈 기능은 나오지 않는다.
 */

export interface MenuEntry {
  to: string
  label: string
  desc: string
  icon: IconName
  /** 위치 표시: '수업 › 수업 도구' */
  where: string
  section: string
}

/** 선생님들이 다른 말로 찾을 때 (찾는 말 → 메뉴에 쓰인 말) */
const SYNONYMS: Record<string, string[]> = {
  출석: ['출결'],
  지각: ['출결'],
  결석: ['출결'],
  생기부: ['세특'],
  생활기록부: ['세특'],
  특기사항: ['세특'],
  체력: ['paps'],
  팝스: ['paps'],
  점수: ['채점', '수행평가'],
  성적: ['채점', '수행평가'],
  평가: ['수행평가'],
  명단: ['명렬'],
  학생명단: ['명렬'],
  규칙: ['종목'],
  피피티: ['종목', '슬라이드'],
  ppt: ['종목', '슬라이드'],
  시합: ['대진표', '리그'],
  토너먼트: ['대진표'],
  예약: ['체육관', '예약'],
  대여: ['교구'],
  돈: ['예산'],
  품의: ['견적서'],
  설문: ['설문'],
  역할: ['수업반'],
  당번: ['수업반'],
  팀: ['팀'],
  모둠: ['팀'],
  스톱워치: ['타이머'],
  백업: ['백업'],
  동기화: ['백업'],
  비밀번호: ['잠금', 'pin'],
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** 지금 켜진 메뉴 전부 (같은 화면이 여러 곳에 있으면 처음 것 하나) */
export function menuEntries(sections: readonly NavSection[], features: Parameters<typeof visibleSections>[0]): MenuEntry[] {
  const seen = new Set<string>()
  const out: MenuEntry[] = []
  for (const s of sections) {
    for (const g of visibleGroups(s, features)) {
      for (const i of g.items) {
        if (seen.has(i.to)) continue
        seen.add(i.to)
        out.push({ to: i.to, label: i.label, desc: i.desc ?? '', icon: i.icon, where: g.solo ? s.label : `${s.label} › ${g.title}`, section: s.label })
      }
    }
  }
  return out
}

/** 찾기: 이름이 그 말로 시작 > 이름에 들어감 > 비슷한 말 > 설명 · 위치에 들어감. 빈 말이면 빈 목록 */
export function searchMenu(entries: readonly MenuEntry[], query: string, limit = 30): MenuEntry[] {
  const q = norm(query)
  if (!q) return []
  const alt = Object.entries(SYNONYMS)
    .filter(([k]) => q.includes(norm(k)))
    .flatMap(([, v]) => v.map(norm))
  const scored: { e: MenuEntry; score: number; i: number }[] = []
  entries.forEach((e, i) => {
    const label = norm(e.label)
    const rest = norm(`${e.desc} ${e.where}`)
    let score = 0
    if (label.startsWith(q)) score = 4
    else if (label.includes(q)) score = 3
    else if (alt.some((a) => label.includes(a))) score = 2
    else if (rest.includes(q) || alt.some((a) => rest.includes(a))) score = 1
    if (score) scored.push({ e, score, i })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e)
}
