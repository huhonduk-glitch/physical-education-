import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import type { AssessItem } from '../src/db/types'
import { assessmentProblems, itemMax, itemPoints, itemsFromRubric, levelPreset, totalOf } from '../src/lib/assessScore'
import { assessWorkbook, buildAssessGrid, fillTemplateGrid, headerMerges, layoutOf, matchAreaTitle, matchTemplateRows, parseAssessTemplate } from '../src/lib/neisAssess'

const level: AssessItem = { id: 'a', label: '자세', method: 'level', levels: [{ label: 'A', points: 30 }, { label: 'B', points: 24 }, { label: 'C', points: 18 }] }
const rope: AssessItem = { id: 'b', label: '줄넘기', method: 'record', unit: '회', better: 'higher', basePoints: 10, bands: [{ limit: 100, points: 40 }, { limit: 120, points: 50 }, { limit: 80, points: 30 }] }
const run: AssessItem = { id: 'c', label: '50m', method: 'record', unit: '초', better: 'lower', basePoints: 4, bands: [{ limit: 8, points: 20 }, { limit: 9, points: 16 }] }
const direct: AssessItem = { id: 'd', label: '태도', method: 'direct', max: 20 }

describe('수행평가 점수', () => {
  it('요소 만점', () => {
    expect([level, rope, run, direct].map(itemMax)).toEqual([30, 50, 20, 20])
  })
  it('등급표', () => {
    expect(itemPoints(level, 'B')).toBe(24)
    expect(itemPoints(level, 'Z')).toBeNull()
    expect(itemPoints(level, '')).toBeNull()
  })
  it('기록표: 높을수록 (경계 포함, 구간 순서 무관, 못 미치면 기본 점수)', () => {
    expect(itemPoints(rope, 120)).toBe(50)
    expect(itemPoints(rope, 119)).toBe(40)
    expect(itemPoints(rope, 100)).toBe(40)
    expect(itemPoints(rope, 80)).toBe(30)
    expect(itemPoints(rope, 79)).toBe(10)
    expect(itemPoints(rope, '125')).toBe(50)
  })
  it('기록표: 낮을수록', () => {
    expect(itemPoints(run, 7.9)).toBe(20)
    expect(itemPoints(run, 8)).toBe(20)
    expect(itemPoints(run, 8.01)).toBe(16)
    expect(itemPoints(run, 9.5)).toBe(4)
  })
  it('합계·만점·완료', () => {
    const items = [level, rope, run, direct]
    expect(totalOf(items, { a: 'A', b: 110, c: 8.5, d: 15 })).toEqual({ total: 101, max: 120, complete: true, done: 4 })
    expect(totalOf(items, { a: 'A' })).toMatchObject({ total: 30, complete: false, done: 1 })
  })
  it('예전 방식 평가는 id를 지켜 바꾼다', () => {
    const it2 = itemsFromRubric([{ id: 'x', label: '드리블', scale: 'AE' }, { id: 'y', label: '슛', scale: 'score', maxScore: 5 }])
    expect(it2[0]).toMatchObject({ id: 'x', method: 'level' })
    expect(it2[1]).toMatchObject({ id: 'y', method: 'direct', max: 5 })
    expect(itemPoints(it2[1], 4)).toBe(4)
  })
  it('등급 기본안과 설정 확인', () => {
    expect(levelPreset(['A', 'B', 'C', 'D', 'E'], 100).map((l) => l.points)).toEqual([100, 80, 60, 40, 20])
    expect(assessmentProblems('', [])).toHaveLength(2)
    expect(assessmentProblems('호신술', [level, direct])).toEqual([])
    expect(assessmentProblems('x', [{ id: 'z', label: 'q', method: 'direct' }])).toContain('q: 만점을 적어 주세요')
  })
})

describe('나이스 수행평가 일괄입력 양식 (references/neis-assessment-template.xlsx · 가명)', () => {
  const wb = XLSX.read(readFileSync('references/neis-assessment-template.xlsx'))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
  const tpl = parseAssessTemplate(grid)!

  it('머리글 3줄과 영역·만점을 읽는다', () => {
    expect(wb.SheetNames).toEqual(['empty0'])
    expect(tpl.headerRow).toBe(0)
    expect(tpl.dataStart).toBe(3)
    expect(tpl.cols).toEqual({ subject: 0, cls: 1, number: 2, name: 3 })
    expect(tpl.areas).toEqual([
      { col: 4, title: '나를 지키는 상황별 실전 호신술', max: 100 },
      { col: 5, title: '미래를 설계하는 진로 융합 주제 탐구 활동', max: 100 },
    ])
    expect(tpl.rows).toHaveLength(33)
    expect(tpl.rows[0]).toEqual({ row: 3, subject: '운동과 건강(2)', cls: '1', number: '1', name: '학생가' })
  })

  it('영역 이름은 띄어쓰기가 달라도 맞춘다', () => {
    expect(matchAreaTitle('나를지키는 상황별  실전호신술', [{ id: '1', title: '나를 지키는 상황별 실전 호신술' }])?.id).toBe('1')
  })

  it('학생 맞추기: 이름 → 같은 이름이면 번호, 학적반은 번호가 다르면 문제', () => {
    const members = [
      { id: 's1', name: '학생가', number: 1 },
      { id: 's2', name: '학생나', number: 5 },
      { id: 's3', name: '없는학생', number: 40 },
    ]
    const small = { ...tpl, rows: tpl.rows.slice(0, 3) }
    const r = matchTemplateRows(small, members, true)
    expect(r.matches.map((m) => m.studentId)).toEqual(['s1', null, null])
    expect(r.matches[1].problem).toMatch(/번호가 달라요/)
    expect(r.matches[2].problem).toBe('이 수업반에 없는 학생이에요')
    expect(r.missing.map((m) => m.id)).toEqual(['s2', 's3'])
    // 수강반은 번호를 따지지 않는다
    expect(matchTemplateRows(small, members, false).matches[1].studentId).toBe('s2')
  })

  it('점수를 채워 내려받은 파일 = 원래 양식 + 점수 (다시 읽어도 같다)', () => {
    const cells = tpl.rows.map((r, i) => ({ row: r.row, col: 4, value: String(70 + (i % 30)) }))
    const filled = fillTemplateGrid(grid, cells)
    const out = assessWorkbook(XLSX, filled, layoutOf(ws, wb.SheetNames[0]))
    const back = XLSX.read(XLSX.write(out, { type: 'array', bookType: 'xlsx' }), { cellNF: true })
    const bws = back.Sheets[back.SheetNames[0]]
    const bgrid = XLSX.utils.sheet_to_json<string[]>(bws, { header: 1, raw: false, defval: '' })
    expect(back.SheetNames).toEqual(['empty0'])
    expect(bgrid.slice(0, 3)).toEqual(grid.slice(0, 3))
    expect(bgrid[3]).toEqual(['운동과 건강(2)', '1', '1', '학생가', '70', ''])
    expect(bgrid.map((r) => r.slice(0, 4))).toEqual(grid.map((r) => r.slice(0, 4)))
    expect(bws['!merges']).toEqual(ws['!merges'])
    expect(bws['E4'].t).toBe('s')
    expect(bws['E4'].z).toBe('@')
  })

  it('양식 없이 만들어도 같은 모양 (머리글 3줄·병합)', () => {
    const g = buildAssessGrid('운동과 건강(2)', [{ cls: '1', number: '1', name: '학생가', scores: ['95'] }], [{ title: '나를 지키는 상황별 실전 호신술', max: 100 }])
    expect(g.slice(0, 3)).toEqual(grid.slice(0, 3).map((r) => r.slice(0, 5)))
    expect(headerMerges(3)).toEqual(ws['!merges'])
  })
})
