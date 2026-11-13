import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { PeDatabase } from '../src/db/db'
import { addRound, saveConfig, setCell, setExcluded } from '../src/db/papsRepo'
import { loadKingStudents } from '../src/db/reportRepo'
import { defaultSettings } from '../src/db/settings'
import { DEFAULT_KING_CONF, EXAMPLE_CUTS, customPoints, cutKey, cutsFor, cutsInOrder, officialCuts, parseCuts, quotaOf, rankKings, winners, winnersText, type KingConf, type KingStudent } from '../src/lib/fitKing'
import { DEFAULT_STANDARDS as std } from '../src/lib/paps'

const ctx = { std, schoolLevel: '고', flexMode: 'regulation' as const }
const EVENTS = { 심폐지구력: 'shuttleRun', '근력·근지구력': 'gripStrength', 순발력: 'standingLongJump', 유연성: 'sitAndReach' } as const

/** 예시 기준(교사 엑셀 표)을 3학년 공통 기준으로 */
const exampleConf = (over: Partial<KingConf> = {}): KingConf => ({
  ...DEFAULT_KING_CONF,
  cuts: Object.fromEntries(Object.entries(EXAMPLE_CUTS).map(([e, c]) => [cutKey(3, e, 'A'), c!])),
  ...over,
})

let seq = 0
/** 가상 학생: [왕복, 악력, 멀리뛰기, 앉아윗몸] */
const st = (rec: (number | null)[], over: Partial<KingStudent> = {}): KingStudent => {
  seq++
  const best: KingStudent['best'] = {}
  ;(['shuttleRun', 'gripStrength', 'standingLongJump', 'sitAndReach'] as const).forEach((e, i) => {
    if (rec[i] !== null) best[e] = rec[i]!
  })
  return { studentId: `s${seq}`, grade: 3, classNo: 1, number: seq, name: `학생${seq}`, gender: 'M', excluded: false, events: { ...EVENTS }, best, ...over }
}

describe('체력왕 점수 (학교 자체 기준)', () => {
  it('넘은 기준 하나에 5점 — 교사 엑셀의 LOOKUP과 같은 값', () => {
    const c = EXAMPLE_CUTS.shuttleRun!
    expect([39, 40, 44, 45, 59, 60, 106].map((v) => customPoints(c, v, false))).toEqual([0, 5, 5, 10, 20, 25, 25])
    expect(customPoints(EXAMPLE_CUTS.gripStrength!, 29.5, false)).toBe(15)
    expect(customPoints(EXAMPLE_CUTS.sitAndReach!, -3, false)).toBe(0)
  })
  it('낮을수록 좋은 종목은 기준 이하', () => {
    expect([9.6, 9.5, 8.2, 7.4].map((v) => customPoints([9.5, 9.0, 8.5, 8.0, 7.5], v, true))).toEqual([0, 5, 15, 25])
  })
  it('성별 기준이 있으면 그것, 없으면 공통', () => {
    const conf = { cuts: { [cutKey(3, 'shuttleRun', 'A')]: [1, 2], [cutKey(3, 'shuttleRun', 'F')]: [3] } }
    expect(cutsFor(conf, 3, 'shuttleRun', 'F')).toEqual([3])
    expect(cutsFor(conf, 3, 'shuttleRun', 'M')).toEqual([1, 2])
    expect(cutsFor(conf, 2, 'shuttleRun', 'M')).toBeNull()
  })
  it('공식 등급 경계로 채우기: 기준표의 4 · 3 · 2 · 1등급 기록 그대로', () => {
    expect(officialCuts(std, 'gripStrength', '고3', 'F')).toEqual([18, 25, 29.5, 37.5])
    expect(officialCuts(std, 'shuttleRun', '고3', 'M')).toEqual([30, 46, 60, 74])
    // 낮을수록 좋은 종목: 그 등급에서 가장 느린 기록, 느린 것부터 빨라진다
    const sprint = officialCuts(std, 'sprint50m', '고1', 'M')!
    expect(cutsInOrder(sprint, true)).toBe(true)
    for (const [i, g] of [4, 3, 2, 1].entries()) {
      const band = std.table.sprint50m['고1'].M.filter((b) => b.grade === g)
      expect(sprint[i]).toBe(Math.max(...band.map((b) => b.max)))
    }
  })
  it('기준 입력 글 읽기 · 순서 검사', () => {
    expect(parseCuts('40, 45 50,55')).toEqual([40, 45, 50, 55])
    expect(parseCuts('40, 사십')).toBeNull()
    expect(cutsInOrder([40, 45, 45], false)).toBe(false)
    expect(cutsInOrder([9.5, 9, 8.5], true)).toBe(true)
  })
})

describe('체력왕 순위 · 시상', () => {
  it('합계 순위, 동점은 왕복 → 멀리뛰기 → 악력 기록으로 (교사 엑셀 순위키)', () => {
    const a = st([106, 43.4, 215, 30.8]) // 100
    const b = st([117, 47.5, 220, 23.5]) // 95
    const c = st([90, 38.5, 195, 27.5]) // 90 왕복 90
    const d = st([81, 47.7, 200, 17.5]) // 90 왕복 81
    const e = st([56, 39.1, 205, 27.6]) // 90 왕복 56
    const r = rankKings(ctx, exampleConf({ count: 5 }), [e, d, c, b, a]).groups[0]
    expect(r.rows.map((x) => x.student.studentId)).toEqual([a, b, c, d, e].map((x) => x.studentId))
    expect(r.rows.map((x) => x.total)).toEqual([100, 95, 90, 90, 90])
    expect(r.rows.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5])
    expect(r.rows.map((x) => x.award)).toEqual(['최우수상', '우수상', '우수상', '장려상', '장려상'])
  })
  it('시상 인원은 최우수까지 포함해 기본 20% (측정 제외 학생은 빼고 셈)', () => {
    expect(DEFAULT_KING_CONF.percent).toBe(20)
    expect(quotaOf(DEFAULT_KING_CONF, 194)).toBe(39)
    expect(quotaOf(DEFAULT_KING_CONF, 3)).toBe(1)
    expect(quotaOf({ percent: 20, count: 41 }, 194)).toBe(41)
    expect(quotaOf(DEFAULT_KING_CONF, 0)).toBe(0)
    // 20명(제외 1명 빼면 20명) → 4명: 최우수 1 · 우수 2 · 장려 1
    const list = Array.from({ length: 20 }, (_, i) => st([40 + i * 2, 20 + i, 150 + i * 3, i]))
    const g = rankKings(ctx, exampleConf(), [...list, st([120, 50, 230, 30], { excluded: true })]).groups[0]
    expect(g.eligible).toBe(20)
    expect(g.quota).toBe(4)
    expect(winners(g).map((r) => r.award)).toEqual(['최우수상', '우수상', '우수상', '장려상'])
  })
  it('한 종목이라도 안 쟀으면 수상 제외, 측정 제외 학생도 제외', () => {
    const full = st([60, 42, 200, 25])
    const part = st([120, 50, null, 30])
    const none = st([null, null, null, null])
    const ex = st([120, 50, 230, 30], { excluded: true })
    const g = rankKings(ctx, exampleConf({ count: 4 }), [part, none, ex, full]).groups[0]
    expect(g.rows.map((r) => [r.student.studentId, r.status, r.award])).toEqual([
      [full.studentId, '측정완료', '최우수상'],
      [part.studentId, '일부 미측정', null],
      [none.studentId, '미측정', null],
      [ex.studentId, '측정 제외', null],
    ])
    expect(g.eligible).toBe(3)
  })
  it('장려상: 같은 순위 묶음이 인원을 넘으면 통째로 뺀다', () => {
    const top = [st([110, 45, 210, 26]), st([100, 45, 210, 26]), st([90, 45, 210, 26])]
    // 기록까지 똑같은 세 명 = 같은 4위
    const tie = [1, 2, 3].map(() => st([50, 30, 180, 15]))
    const g5 = rankKings(ctx, exampleConf({ count: 5 }), [...top, ...tie]).groups[0]
    expect(g5.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 4, 4])
    expect(winners(g5).length).toBe(3)
    expect(g5.cutTies).toBe(3)
    const g6 = rankKings(ctx, exampleConf({ count: 6 }), [...top, ...tie]).groups[0]
    expect(winners(g6).length).toBe(6)
  })
  it('남녀 한 순위: 기준은 남녀 따로, 동점은 기록이 아니라 그 종목 점수로 가린다', () => {
    const cuts = {
      ...exampleConf().cuts,
      [cutKey(3, 'shuttleRun', 'M')]: [60, 70, 80, 90, 100],
      [cutKey(3, 'gripStrength', 'M')]: [30, 35, 40, 45, 50],
    }
    const boy = st([80, 45, 200, 25], { gender: 'M' }) // 15 + 20 + 25 + 25 = 85
    const girl = st([55, 37.5, 190, 25], { gender: 'F' }) // 20 + 20 + 20 + 25 = 85
    const conf = exampleConf({ cuts, count: 2 })
    const one = rankKings(ctx, conf, [boy, girl])
    expect(one.groups.length).toBe(1)
    // 합계 같음 → 심폐 점수 20 > 15 라서 여학생이 앞 (기록은 남학생이 높지만 견주지 않음)
    expect(one.groups[0].rows.map((r) => r.student.studentId)).toEqual([girl.studentId, boy.studentId])
    const two = rankKings(ctx, { ...conf, split: true }, [boy, girl])
    expect(two.groups.map((g) => [g.label, g.rows[0].award])).toEqual([
      ['남학생', '최우수상'],
      ['여학생', '최우수상'],
    ])
  })
  it('기준이 없는 종목은 알려 주고 순위에서 뺀다', () => {
    const s = st([60, 42, 200, 25])
    const r = rankKings(ctx, { ...DEFAULT_KING_CONF, cuts: { [cutKey(3, 'shuttleRun', 'A')]: [40] } }, [s])
    expect(r.groups[0].rows[0].status).toBe('기준 없음')
    expect(r.missing.map((m) => m.eventId).sort()).toEqual(['gripStrength', 'sitAndReach', 'standingLongJump'])
  })
  it('공식 PAPS 점수: 기준표 점수의 합 (BMI 제외 80점 만점)', () => {
    // 고3 남 최고 구간 기록 → 종목마다 20점
    const top = (e: string) => std.table[e]['고3'].M.at(-1)!.min
    const s = st([top('shuttleRun'), top('gripStrength'), top('standingLongJump'), top('sitAndReach')])
    const r = rankKings(ctx, { ...DEFAULT_KING_CONF, mode: 'official' }, [s])
    expect(r.groups[0].rows[0].total).toBe(80)
    expect(r.max).toBe(80)
  })
  it('수상자 명단 글', () => {
    const g = rankKings(ctx, exampleConf({ count: 2 }), [st([106, 43.4, 215, 30.8], { name: '가나다', classNo: 4, number: 15 }), st([60, 30, 180, 20], { name: '라마바', classNo: 2, number: 7 })])
    expect(winnersText('2026학년도 고3 체력왕 수상자', g.groups)).toBe('2026학년도 고3 체력왕 수상자\n최우수상 (1명): 3-4 15번 가나다\n우수상 (1명): 3-2 7번 라마바')
  })
})

describe('체력왕 자료 읽기', () => {
  it('모든 회차 · 차수 · 좌우 가운데 가장 좋은 기록, BMI · 안 고른 종목은 빼고', async () => {
    const db = new PeDatabase('fit-king-1')
    const base = { schoolYear: 2026, grade: 3, classNo: 1, classCode: '01', status: '재학' as const, memo: '' }
    await db.students.bulkAdd([
      { ...base, id: 'a', number: 1, name: '학생A', gender: 'M', studentCode: '30101' },
      { ...base, id: 'b', number: 2, name: '학생B', gender: 'F', studentCode: '30102' },
      { ...base, id: 'c', number: 3, name: '학생C', gender: 'M', studentCode: '30103', status: '전출' },
      { ...base, id: 'd', grade: 2, number: 1, name: '학생D', gender: 'M', studentCode: '20101' },
    ])
    await saveConfig(db, 2026, 3, 1, { 심폐지구력: 'shuttleRun', '근력·근지구력': 'gripStrength', 순발력: 'sprint50m', 유연성: 'sitAndReach' })
    const r2 = await addRound(db, 2026, 3, 1, '2026-09-01')
    await setCell(db, 2026, 'a', { key: 'shuttleRun', attempt: null, side: null }, 70)
    await setCell(db, 2026, 'a', { key: 'shuttleRun', attempt: null, side: null }, 64, r2)
    await setCell(db, 2026, 'a', { key: 'gripStrength', attempt: 1, side: 'R' }, 38.6)
    await setCell(db, 2026, 'a', { key: 'gripStrength', attempt: 2, side: 'L' }, 43.4, r2)
    await setCell(db, 2026, 'a', { key: 'sprint50m', attempt: 1, side: null }, 7.9)
    await setCell(db, 2026, 'a', { key: 'sprint50m', attempt: 1, side: null }, 7.6, r2)
    await setCell(db, 2026, 'a', { key: 'standingLongJump', attempt: 1, side: null }, 230)
    await setCell(db, 2026, 'a', { key: 'height', attempt: null, side: null }, 175)
    await setExcluded(db, 2026, 'b', true, '부상')
    const list = await loadKingStudents(db, 2026, 3, std)
    expect(list.map((s) => s.studentId)).toEqual(['a', 'b'])
    expect(list[0].best).toEqual({ shuttleRun: 70, gripStrength: 43.4, sprint50m: 7.6 })
    expect(list[0].events).toEqual({ 심폐지구력: 'shuttleRun', '근력·근지구력': 'gripStrength', 순발력: 'sprint50m', 유연성: 'sitAndReach' })
    expect(list[1].excluded).toBe(true)
  })
  it('설정 기본값이 저장되는 자리에 있다', () => {
    expect(defaultSettings().fitKing).toEqual(DEFAULT_KING_CONF)
  })
})
