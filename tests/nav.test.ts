import { describe, expect, it } from 'vitest'
import { NAV, activeItem, sectionOf, visibleGroups, visibleSections } from '../src/lib/nav'

describe('메뉴 표 (6-12)', () => {
  it('큰 메뉴 6개 순서', () => {
    expect(NAV.map((s) => s.label)).toEqual(['홈', '수업', 'PAPS', '평가', '업무', '설정'])
  })
  it('주소 → 큰 메뉴 (가장 길게 맞는 것)', () => {
    expect(sectionOf('/')).toBe('home')
    expect(sectionOf('/groups/g1')).toBe('class')
    expect(sectionOf('/sports/basketball/slides')).toBe('class')
    expect(sectionOf('/timer')).toBe('class')
    expect(sectionOf('/paps/input/bmi')).toBe('paps')
    expect(sectionOf('/more/assessments/a1')).toBe('eval')
    expect(sectionOf('/students/summary')).toBe('eval')
    expect(sectionOf('/students/s1')).toBe('settings')
    expect(sectionOf('/more/settings/neis')).toBe('settings')
    expect(sectionOf('/more')).toBe('settings')
    expect(sectionOf('/work/team')).toBe('work')
  })
  it('끈 기능은 숨기고, 다 꺼진 큰 메뉴도 숨김', () => {
    const off = { paps: false }
    expect(visibleSections(off).map((s) => s.id)).not.toContain('paps')
    const cls = NAV.find((s) => s.id === 'class')!
    expect(visibleGroups(cls, { captains: false, absences: false }).map((g) => g.title)).not.toContain('학생')
  })
  it('켤 하위 항목', () => {
    const paps = NAV.find((s) => s.id === 'paps')!.groups.flatMap((g) => g.items)
    expect(activeItem('/paps/stats', '?c=1-1', paps)?.label).toBe('통계 · 그래프')
    expect(activeItem('/paps', '', paps)?.label).toBe('기록 입력')
    const cls = NAV.find((s) => s.id === 'class')!.groups.flatMap((g) => g.items)
    expect(activeItem('/groups/g1/journal', '', cls)?.label).toBe('내 수업반')
  })
  it('같은 주소가 한 큰 메뉴 안에서 두 번 나오지 않음', () => {
    for (const s of NAV) {
      const tos = s.groups.flatMap((g) => g.items.map((i) => i.to))
      expect(new Set(tos).size).toBe(tos.length)
    }
  })
})
