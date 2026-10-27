import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { parseChangelog, unseen } from '../src/lib/changelog'

const list = parseChangelog(JSON.parse(fs.readFileSync('public/changelog.json', 'utf8')))

describe('업데이트 소식', () => {
  it('파일 형식: 최신이 맨 위, id 겹침 없음, 내용 있음', () => {
    expect(list.length).toBeGreaterThan(0)
    expect(new Set(list.map((e) => e.id)).size).toBe(list.length)
    expect([...list.map((e) => e.date)]).toEqual([...list.map((e) => e.date)].sort().reverse())
    for (const e of list) expect(e.items.length).toBeGreaterThan(0)
  })
  it('본 것 다음부터 새 소식, 처음이거나 모르는 id면 최신 하나', () => {
    const l = [{ id: 'c', date: '3', title: 'c', items: [] }, { id: 'b', date: '2', title: 'b', items: [] }, { id: 'a', date: '1', title: 'a', items: [] }]
    expect(unseen(l, 'a').map((e) => e.id)).toEqual(['c', 'b'])
    expect(unseen(l, 'c')).toEqual([])
    expect(unseen(l, null).map((e) => e.id)).toEqual(['c'])
    expect(unseen(l, 'zzz').map((e) => e.id)).toEqual(['c'])
    expect(parseChangelog({ entries: 'x' })).toEqual([])
  })
})
