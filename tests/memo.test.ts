import { describe, expect, it } from 'vitest'
import type { HomeMemo } from '../src/db/settings'
import { memoTone, MEMO_TONES, removeMemo, saveMemo, splitMemo } from '../src/lib/memo'

describe('홈 메모', () => {
  it('첫 줄(빈 줄 건너뜀) = 제목, 나머지 = 내용', () => {
    expect(splitMemo('\n  체육대회 물품\n줄넘기 30개\n조끼 4색 ')).toEqual({ title: '체육대회 물품', body: '줄넘기 30개\n조끼 4색' })
    expect(splitMemo('한 줄만')).toEqual({ title: '한 줄만', body: '' })
    expect(splitMemo('   \n ')).toEqual({ title: '', body: '' })
    expect(splitMemo('윈도\r\n줄바꿈')).toEqual({ title: '윈도', body: '줄바꿈' })
  })
  it('저장: 새 메모는 맨 앞 · 있던 메모는 그 자리 · 빈 글이면 지움', () => {
    const a: HomeMemo = { id: 'a', text: '옛 메모', tone: 0, createdAt: 1, updatedAt: 1 }
    const added = saveMemo([a], { id: 'b', text: '  새 메모  ', tone: 2 }, 5)
    expect(added).toEqual([{ id: 'b', text: '새 메모', tone: 2, createdAt: 5, updatedAt: 5 }, a])
    const edited = saveMemo(added, { id: 'a', text: '고친 메모', tone: 1 }, 9)
    expect(edited[1]).toEqual({ id: 'a', text: '고친 메모', tone: 1, createdAt: 1, updatedAt: 9 })
    expect(edited[0].id).toBe('b')
    expect(saveMemo(edited, { id: 'a', text: '   ', tone: 1 }, 10).map((m) => m.id)).toEqual(['b'])
    expect(saveMemo([], { id: 'x', text: '', tone: 0 }, 1)).toEqual([])
    expect(removeMemo(edited, 'b').map((m) => m.id)).toEqual(['a'])
  })
  it('색 번호가 범위를 벗어나도 색이 있다', () => {
    expect(memoTone(0)).toBe(MEMO_TONES[0])
    expect(memoTone(5)).toBe(MEMO_TONES[1])
    expect(memoTone(-1)).toBe(MEMO_TONES[3])
  })
})
