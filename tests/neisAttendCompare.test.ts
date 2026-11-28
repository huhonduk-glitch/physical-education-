import { describe, expect, it } from 'vitest'
import { compareAttend, pelogCounts, readNeisAttend, type NeisAttendFile } from '../src/lib/neisAttendCompare'

// 나이스 학급별출결현황 모양(가상): 위 제목 줄 · 두 줄 머리글(결석/지각/조퇴/결과 아래 질병 · 미인정 · 기타 · 인정) · 총계
const head1 = ['번호', '성명', '수업일수', '결석', '', '', '', '지각', '', '', '', '조퇴', '', '', '', '결과', '', '', '', '결석총계', '지각총계', '조퇴총계', '결과총계']
const head2 = ['', '', '', '질병', '미인정', '기타', '인정', '질병', '미인정', '기타', '인정', '질병', '미인정', '기타', '인정', '질병', '미인정', '기타', '인정', '', '', '', '']
const row = (no: number, name: string, cells: Record<number, number>) => {
  const r: (string | number)[] = [no, name, 20, ...Array(20).fill(0)]
  for (const [i, v] of Object.entries(cells)) r[Number(i)] = v
  return r
}
const grid = [
  ['학급별 출결현황'],
  ['2026학년도 3학년 9반', '', '11월'],
  [],
  head1,
  head2,
  row(1, '학생가', { 3: 1, 19: 1 }), // 결석 질병 1
  row(2, '학생나', { 16: 1, 22: 1 }), // 결과 미인정 1
  row(3, '학생다', {}),
  ['', '계'],
]

describe('나이스 학급별출결현황 읽기', () => {
  it('두 줄 머리글 · 인정 칸 · 학급 · 수업일수 · 합계 줄 건너뜀', () => {
    const f = readNeisAttend(grid) as NeisAttendFile
    expect(f).toMatchObject({ grade: 3, classNo: 9, hasRecognized: true })
    expect(f.rows.map((r) => [r.no, r.name, r.days])).toEqual([
      [1, '학생가', 20],
      [2, '학생나', 20],
      [3, '학생다', 20],
    ])
    expect(f.rows[0].counts).toEqual({ 'absent|질병': 1 })
    expect(f.rows[1].counts).toEqual({ 'result|미인정': 1 })
  })
  it('인정 칸이 없는 예전 양식 · 한 칸에 \'결석-질병\'으로 쓴 머리글도', () => {
    const old = readNeisAttend([
      ['번호', '성명', '수업일수', '결석', '', '', '지각', '', '', '조퇴', '', '', '결과', '', ''],
      ['', '', '', '질병', '미인정', '기타', '질병', '미인정', '기타', '질병', '미인정', '기타', '질병', '미인정', '기타'],
      [1, '학생가', 20, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]) as NeisAttendFile
    expect(old.hasRecognized).toBe(false)
    expect(old.rows[0].counts).toEqual({ 'absent|미인정': 2 })
    const flat = readNeisAttend([
      ['번호', '성명', '결석-질병', '결과-미인정'],
      [4, '학생라', 1, 3],
    ]) as NeisAttendFile
    expect(flat.rows[0].counts).toEqual({ 'absent|질병': 1, 'result|미인정': 3 })
  })
  it('머리글이 없으면 오류', () => {
    expect(readNeisAttend([['아무 표'], [1, 2]])).toHaveProperty('error')
  })
})

describe('체육 출결과 맞춰 보기', () => {
  const students = [
    { id: 'a', number: 1, name: '학생가' },
    { id: 'b', number: 2, name: '학생나' },
    { id: 'c', number: 3, name: '학생다' },
  ]
  it('같은 날 같은 종류는 한 번 · 사유 없으면 합계에만 · 다른 달은 뺌', () => {
    const pe = pelogCounts(
      [
        { studentId: 'b', date: '2026-11-03', status: 'result', reason: '미인정' },
        { studentId: 'b', date: '2026-11-03', status: 'result', reason: '미인정' }, // 같은 날 두 교시
        { studentId: 'b', date: '2026-11-10', status: 'result', reason: '미인정' },
        { studentId: 'c', date: '2026-11-12', status: 'late' },
        { studentId: 'c', date: '2026-10-30', status: 'absent', reason: '질병' },
      ],
      '2026-11',
    )
    expect(pe.get('b')).toEqual({ counts: { 'result|미인정': 2 }, totals: { result: 2 } })
    expect(pe.get('c')).toEqual({ counts: {}, totals: { late: 1 } })
  })
  it('체육 기록이 나이스보다 많은 칸만 알림 (적은 것은 다른 교과라 정상) · 못 이은 줄', () => {
    const f = readNeisAttend([...grid.slice(0, 7), row(7, '없는학생', {})]) as NeisAttendFile
    const pe = pelogCounts(
      [
        { studentId: 'a', date: '2026-11-05', status: 'absent', reason: '질병' }, // 나이스에도 질병 결석 1 → 같음
        { studentId: 'b', date: '2026-11-03', status: 'result', reason: '미인정' },
        { studentId: 'b', date: '2026-11-10', status: 'result', reason: '기타' }, // 나이스 결과는 미인정 1뿐
      ],
      '2026-11',
    )
    const r = compareAttend(f, students, pe)
    expect(r.matched).toBe(2)
    expect(r.unmatched).toEqual(['7 없는학생'])
    expect(r.lines).toEqual([{ studentId: 'b', no: 2, name: '학생나', more: [{ label: '결과 합계', pe: 2, neis: 1 }] }])
  })
})
