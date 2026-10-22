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
