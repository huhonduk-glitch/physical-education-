import { describe, expect, it } from 'vitest'
import type { ClassRecord, Keyword, Student } from '../src/db/types'
import { evidenceLine, scoreTotal, seteukRows } from '../src/lib/seteuk'

const st = (id: string, number: number, name: string): Student => ({
  id, schoolYear: 2026, grade: 1, classNo: 3, classCode: '03', number, name, gender: 'F', studentCode: `103${String(number).padStart(2, '0')}`, status: '재학', memo: '',
})
const kw: Keyword[] = [
  { id: 'k1', label: '책임감', category: '리더십', isActive: true, sortOrder: 0 },
  { id: 'k2', label: '배려', category: '배려', isActive: true, sortOrder: 1 },
]
let n = 0
const rec = (p: Partial<ClassRecord>): ClassRecord => ({
  id: `r${++n}`, schoolYear: 2026, studentId: 'a', date: '2026-04-01', type: 'exemplary', category: '정리정돈', keywordIds: [], createdAt: n, updatedAt: n, ...p,
})

describe('세특 키워드 내보내기 (문장 생성 없음)', () => {
  const records = [
    rec({ keywordIds: ['k1'], note: '공 정리', date: '2026-04-02' }),
    rec({ keywordIds: ['k1', 'k2'], category: '친구 도움', date: '2026-04-05' }),
    rec({ type: 'unprepared', category: '체육복', date: '2026-04-03' }),
    rec({ type: 'observation', category: '관찰', note: '모둠 역할 나눔', keywordIds: ['k2'], date: '2026-04-10' }),
    rec({ studentId: 'b', type: 'unprepared', category: '실내화' }),
  ]
  it('학생 1명당 1행: 학번·이름·키워드(빈도순)·근거', () => {
    const rows = seteukRows([st('b', 2, '나다라'), st('a', 1, '가나다')], records, kw, { includeNegative: false })
    expect(rows.map((r) => r.name)).toEqual(['가나다', '나다라'])
    expect(rows[0]).toMatchObject({ studentCode: '10301', keywords: '책임감(2), 배려(2)' })
    expect(rows[0].evidence.split('\n')).toEqual([
      '4/2(목) 솔선수범(정리정돈) — 공 정리 [책임감]',
      '4/5(일) 솔선수범(친구 도움) [책임감, 배려]',
      '4/10(금) 관찰 — 모둠 역할 나눔 [배려]',
    ])
  })
  it('미준비 같은 부정 기록은 기본 제외, 옵션을 켜면 포함', () => {
    expect(seteukRows([st('b', 2, '나다라')], records, kw, { includeNegative: false })[0].evidence).toBe('')
    expect(seteukRows([st('b', 2, '나다라')], records, kw, { includeNegative: true })[0].evidence).toContain('미준비(실내화)')
  })
  it('근거 한 줄 모양', () => {
    expect(evidenceLine(rec({ type: 'captain', category: '출석 확인', date: '2026-09-28' }), new Map())).toBe('9/28(월) 체육부장(출석 확인)')
  })
})

describe('수행평가 합계', () => {
  it('점수형 요소만 더하고, 비어 있으면 null', () => {
    const items = [
      { id: 'a', scale: 'score' as const },
      { id: 'b', scale: 'score' as const },
      { id: 'c', scale: 'AE' as const },
    ]
    expect(scoreTotal(items, { a: 8, b: '7', c: 'A' })).toBe(15)
    expect(scoreTotal(items, { c: 'B' })).toBeNull()
  })
})
