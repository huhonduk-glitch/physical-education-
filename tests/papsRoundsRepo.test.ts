import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { addRound, deleteRoundIfEmpty, EXCLUDED_KEY, loadClassPaps, loadRounds, setCell, setExcluded, setRoundDate } from '../src/db/papsRepo'

let n = 0
const fresh = () => new PeDatabase(`rounds-repo-${++n}`)
const cell = { key: 'shuttleRun' as const, attempt: null, side: null }

describe('PAPS 회차 저장 (예전 기록은 그대로 1회차)', () => {
  it('2회차에 저장해도 1회차 기록은 바뀌지 않는다', async () => {
    const db = fresh()
    await setCell(db, 2026, 's1', cell, 34) // 예전 방식 = 1회차
    const r2 = await addRound(db, 2026, 1, 1, '2026-06-02')
    await setCell(db, 2026, 's1', cell, 41, r2)
    await setCell(db, 2026, 's1', cell, 42, r2) // 같은 회차 같은 칸은 덮어쓰기
    const one = await loadClassPaps(db, 2026, 1, 1, ['s1'], null)
    const two = await loadClassPaps(db, 2026, 1, 1, ['s1'], r2)
    expect(one.results.map((r) => r.value)).toEqual([34])
    expect(one.results[0].roundId).toBeUndefined()
    expect(two.results.map((r) => r.value)).toEqual([42])
    expect((await loadClassPaps(db, 2026, 1, 1, ['s1'], 'all')).results.length).toBe(2)
  })

  it('1회차 칸을 지워도 2회차 칸은 남는다', async () => {
    const db = fresh()
    const r2 = await addRound(db, 2026, 1, 1, '2026-06-02')
    await setCell(db, 2026, 's1', cell, 34)
    await setCell(db, 2026, 's1', cell, 41, r2)
    await setCell(db, 2026, 's1', cell, undefined)
    expect((await loadClassPaps(db, 2026, 1, 1, ['s1'], r2)).results.map((r) => r.value)).toEqual([41])
  })

  it('측정 제외는 모든 회차에 보인다', async () => {
    const db = fresh()
    const r2 = await addRound(db, 2026, 1, 1, '2026-06-02')
    await setExcluded(db, 2026, 's1', true, '부상')
    for (const k of [null, r2]) {
      const rows = (await loadClassPaps(db, 2026, 1, 1, ['s1'], k)).results
      expect(rows.some((r) => r.eventId === EXCLUDED_KEY)).toBe(true)
    }
  })

  it('회차 목록: 번호 매기기 · 1회차 날짜 · 빈 회차만 지우기', async () => {
    const db = fresh()
    const r2 = await addRound(db, 2026, 1, 1, '2026-06-02')
    const r3 = await addRound(db, 2026, 1, 1, '2026-09-10')
    let list = await loadRounds(db, 2026, 1, 1)
    expect(list.map((r) => r.round)).toEqual([1, 2, 3])
    await setRoundDate(db, 2026, 1, 1, list[0], '2026-03-15')
    list = await loadRounds(db, 2026, 1, 1)
    expect(list[0]).toMatchObject({ id: null, round: 1, date: '2026-03-15' })
    await setCell(db, 2026, 's1', cell, 50, r2)
    expect(await deleteRoundIfEmpty(db, r2)).toBe(false) // 기록 있음 → 안 지움
    expect(await deleteRoundIfEmpty(db, r3)).toBe(true)
    expect((await loadRounds(db, 2026, 1, 1)).map((r) => r.round)).toEqual([1, 2])
    // 다른 반에는 영향 없음
    expect((await loadRounds(db, 2026, 1, 2)).length).toBe(1)
  })
})

describe('요인별 최고 내보내기 (2026-10-24): 실제 기준표 점수로 요인마다 회차를 고른다', () => {
  it('1회차 심폐 + 2회차 유연성, 신장·체중은 최근 회차', async () => {
    const { DEFAULT_STANDARDS } = await import('../src/lib/paps')
    const { indexResults, loadClassPapsFactorPicked, studentSummary } = await import('../src/db/papsRepo')
    const db = fresh()
    const r2 = await addRound(db, 2026, 1, 1, '2026-09-10')
    const sar = (attempt: number) => ({ key: 'sitAndReach' as const, attempt, side: null })
    const one = { key: 'height' as const, attempt: null, side: null }
    const w = { key: 'weight' as const, attempt: null, side: null }
    await setCell(db, 2026, 's1', cell, 60) // 1회차 왕복 60회
    await setCell(db, 2026, 's1', sar(1), 3)
    await setCell(db, 2026, 's1', sar(2), 4)
    await setCell(db, 2026, 's1', one, 170)
    await setCell(db, 2026, 's1', w, 60)
    await setCell(db, 2026, 's1', cell, 40, r2) // 2회차 왕복은 낮고
    await setCell(db, 2026, 's1', sar(1), 15, r2) // 유연성은 높다
    await setCell(db, 2026, 's1', sar(2), 14, r2)
    await setCell(db, 2026, 's1', one, 171, r2)
    await setCell(db, 2026, 's1', w, 62, r2)
    const selected = { 심폐지구력: 'shuttleRun', 유연성: 'sitAndReach' } as const
    const groups = [
      { key: '심폐지구력', events: ['shuttleRun'], mode: 'best' as const },
      { key: '유연성', events: ['sitAndReach'], mode: 'best' as const },
      { key: '비만', events: ['height', 'weight'], mode: 'latest' as const },
    ]
    const d = await loadClassPapsFactorPicked(db, 2026, 1, 1, ['s1'], () => groups, (sid, g, rs) => {
      const p = studentSummary(DEFAULT_STANDARDS, { grade: 1, gender: 'M' }, '고', selected, indexResults(rs).values.get(sid), 'regulation')
      return { complete: true, total: p?.factors.find((f) => f.factor === g)?.points ?? 0 }
    })
    expect(Object.fromEntries(d.pick.get('s1')!)).toMatchObject({ 심폐지구력: null, 유연성: r2, 비만: r2 })
    const v = indexResults(d.results).values.get('s1')!
    expect(Object.fromEntries(v)).toEqual({ 'shuttleRun||': 60, 'sitAndReach|1|': 15, 'sitAndReach|2|': 14, 'height||': 171, 'weight||': 62 })
  })
})
