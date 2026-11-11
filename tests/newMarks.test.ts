import { describe, expect, it } from 'vitest'
import type { ChangeEntry } from '../src/lib/changelog'
import { newRoutes, nextSeen, seenKey, unseenRoutes, visitedRoutes } from '../src/lib/newMarks'

const entries: ChangeEntry[] = [
  { id: 'c', date: '2026-11-12', title: '', items: [{ text: '', to: '/attend/neis' }, { text: '', to: '/timer' }, { text: '', to: '/' }, { text: '' }] },
  { id: 'b', date: '2026-11-11', title: '', items: [{ text: '', to: '/work/team' }, { text: '', to: '/timer' }] },
  { id: 'a', date: '2026-11-10', title: '', items: [{ text: '', to: '/seteuk/survey' }] },
]

describe('메뉴의 새 기능 점', () => {
  it('최근 소식 2개 · 14일 안, 홈은 빼고, 같은 주소는 더 새 소식 날짜', () => {
    const r = newRoutes(entries, '2026-11-12')
    expect([...r]).toEqual([
      ['/attend/neis', '2026-11-12'],
      ['/timer', '2026-11-12'],
      ['/work/team', '2026-11-11'],
    ])
    expect(newRoutes(entries, '2026-11-26').size).toBe(2 + 0) // 11-12 것만 14일째, 11-11은 15일째
    expect(newRoutes(entries, '2026-11-27').size).toBe(0)
    expect(newRoutes(entries, '2026-11-01').size).toBe(0) // 날짜가 앞선 기기 시계
    expect(newRoutes([{ id: 'x', date: '어제', title: '', items: [{ text: '', to: '/a' }] }], '2026-11-12').size).toBe(0)
  })
  it('한 번 열면 사라지고, 아래 화면을 열어도 본 것', () => {
    const r = newRoutes(entries, '2026-11-12')
    expect(visitedRoutes(r, '/work/team')).toEqual(['/work/team'])
    expect(visitedRoutes(r, '/timer/x')).toEqual(['/timer'])
    expect(visitedRoutes(r, '/work')).toEqual([])
    const seen = nextSeen(r, ['/old@2026-01-01'], ['/timer'])
    expect(seen).toEqual([seenKey('/timer', '2026-11-12')]) // 죽은 표시는 버림
    expect([...unseenRoutes(r, seen)]).toEqual(['/attend/neis', '/work/team'])
  })
  it('나중 소식이 같은 화면을 또 가리키면 다시 뜬다', () => {
    const r = newRoutes(entries, '2026-11-12')
    expect(unseenRoutes(r, [seenKey('/timer', '2026-11-11')]).has('/timer')).toBe(true)
  })
})
