import { describe, expect, it } from 'vitest'
import { bracketCsv, bracketText, tacticBoardJson } from '../src/lib/teamExport'

const list = [
  { number: 1, name: '김민수', gender: 'M' as const, level: '상' as const },
  { number: 2, name: '이 서연', gender: 'F' as const, level: null },
  { number: 3, name: '박지훈', gender: null, level: '하' as const },
]

describe('팀 편성 앱 형식 (SPORTS BRACKET 일괄 입력: 번호 이름 성별 수준)', () => {
  it('수준 끔(기본): 번호 이름 성별, 머리줄 없음', () => {
    expect(bracketText(list, false)).toBe('1 김민수 남\n2 이서연 여\n3 박지훈')
  })
  it('수준 켬: 미측정은 비움, 성별 없이 수준만 있으면 자리 표시', () => {
    expect(bracketText(list, true)).toBe('1 김민수 남 상\n2 이서연 여\n3 박지훈 - 하')
  })
  it('CSV: BOM + 열 이름', () => {
    const csv = bracketCsv(list, true)
    expect(csv.startsWith('﻿"번호","이름","성별","수준"')).toBe(true)
    expect(csv).toContain('"1","김민수","남","상"')
  })
})

describe('전술 보드 명단 파일', () => {
  it('기본은 번호만 (이름 대신 N번)', () => {
    const j = JSON.parse(tacticBoardJson(list, { includeName: false, group: '1-3반' }))
    expect(j.roster[0]).toEqual({ id: 'r-pe-1', name: '1번', number: 1, position: '', group: '1-3반' })
    expect(JSON.stringify(j)).not.toContain('김민수')
  })
  it('이름 넣기 선택 시 이름 포함', () => {
    expect(JSON.parse(tacticBoardJson(list, { includeName: true, group: '' })).roster[0].name).toBe('김민수')
  })
})
