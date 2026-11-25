import { describe, expect, it } from 'vitest'
import { menuEntries, searchMenu } from '../src/lib/menuSearch'
import { NAV, visibleSections } from '../src/lib/nav'

const all = menuEntries(visibleSections(undefined), undefined)

describe('메뉴 찾기', () => {
  it('메뉴 표에서 켜진 메뉴를 모두 · 같은 화면은 한 번만 · 위치 표시', () => {
    expect(all.length).toBeGreaterThan(30)
    expect(new Set(all.map((e) => e.to)).size).toBe(all.length)
    const neis = all.find((e) => e.to === '/attend/neis')
    expect(neis?.where).toBe('수업 › 내 수업반')
  })
  it('끈 기능의 메뉴는 나오지 않는다', () => {
    const off = { paps: false } as const
    const list = menuEntries(visibleSections(off), off)
    expect(list.some((e) => e.to.startsWith('/paps'))).toBe(false)
    expect(all.some((e) => e.to.startsWith('/paps'))).toBe(true)
  })
  it('이름이 그 말로 시작하는 것이 먼저 · 띄어쓰기 무시 · 비슷한 말(출석 → 출결, 생기부 → 세특)', () => {
    expect(searchMenu(all, '세특')[0].label.startsWith('세특')).toBe(true)
    expect(searchMenu(all, '팀 나누기')[0].label).toBe('팀 나누기')
    expect(searchMenu(all, '팀나누기')[0].label).toBe('팀 나누기')
    expect(searchMenu(all, '출석').some((e) => e.label.includes('출결'))).toBe(true)
    expect(searchMenu(all, '생기부').some((e) => e.label.includes('세특'))).toBe(true)
    expect(searchMenu(all, '')).toEqual([])
    expect(searchMenu(all, '없는메뉴이름')).toEqual([])
  })
  it('메뉴 표 모든 항목이 찾기 목록에 들어 있다 (켠 상태)', () => {
    const tos = new Set(all.map((e) => e.to))
    for (const s of NAV) for (const g of s.groups) for (const i of g.items) expect(tos.has(i.to), i.to).toBe(true)
  })
})
