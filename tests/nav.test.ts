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
    expect(sectionOf('/students/summary')).toBe('class')
    expect(sectionOf('/students/s1')).toBe('class')
    expect(sectionOf('/students/import')).toBe('home')
    expect(sectionOf('/more/settings/neis')).toBe('home')
    expect(sectionOf('/more/settings')).toBe('settings')
    expect(sectionOf('/plans/new')).toBe('home')
    expect(sectionOf('/plans/p1')).toBe('class')
    expect(sectionOf('/more')).toBe('settings')
    expect(sectionOf('/work/team')).toBe('work')
  })
  it('끈 기능은 숨기고, 다 꺼진 큰 메뉴도 숨김', () => {
    const off = { paps: false }
    expect(visibleSections(off).map((s) => s.id)).not.toContain('paps')
    const cls = NAV.find((s) => s.id === 'class')!
    expect(visibleGroups(cls, { tools: false, sports: false, apps: false }).map((g) => g.title)).not.toContain('수업 도구')
  })
  it('켤 하위 항목', () => {
    const paps = NAV.find((s) => s.id === 'paps')!.groups.flatMap((g) => g.items)
    expect(activeItem('/paps/stats', '?c=1-1', paps)?.label).toBe('통계 · 그래프')
    expect(activeItem('/paps', '', paps)?.label).toBe('기록 입력')
    const cls = NAV.find((s) => s.id === 'class')!.groups.flatMap((g) => g.items)
    expect(activeItem('/groups/g1/journal', '', cls)?.label).toBe('수업반 목록')
  })
  it('같은 주소가 한 큰 메뉴 안에서 두 번 나오지 않음', () => {
    for (const s of NAV) {
      const tos = s.groups.flatMap((g) => g.items.map((i) => i.to))
      expect(new Set(tos).size).toBe(tos.length)
    }
  })
})

describe('업무 역할로 기능 고르기 (2026-11-09)', () => {
  it('고른 역할의 기능만 켜고, 업무 역할을 끄면 업무 메뉴의 운동부 · 클럽 · 예산이 숨는다', async () => {
    const { featuresForRoles, rolesOf } = await import('../src/lib/features')
    const { NAV, visibleGroups } = await import('../src/lib/nav')
    const f = featuresForRoles(['teach', 'paps'])
    expect(f.records && f.paps && f.assess).toBe(true)
    expect(f.work || f.captains).toBe(false)
    expect(rolesOf(f)).toEqual(['teach', 'paps'])
    const work = NAV.find((s) => s.id === 'work')!
    expect(visibleGroups(work, f).flatMap((g) => g.items.map((i) => i.to))).not.toContain('/work/budget')
    expect(visibleGroups(work, featuresForRoles(['work'])).flatMap((g) => g.items.map((i) => i.to))).toContain('/work/budget')
    // 아무것도 안 고른 처음 상태는 모든 역할이 켜져 있다
    expect(rolesOf(undefined)).toEqual(['teach', 'paps', 'captain', 'work'])
  })
})
