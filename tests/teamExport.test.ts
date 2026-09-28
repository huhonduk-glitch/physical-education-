import { describe, expect, it } from 'vitest'
import { bracketCsv, bracketText, tacticBoardJson, tacticBoardLink } from '../src/lib/teamExport'

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

describe('전술 보드 바로 열기 링크', () => {
  it('전술 보드가 읽는 방식(atob → escape → decodeURIComponent)으로 되읽으면 같은 명단', () => {
    const json = tacticBoardJson([{ number: 3, name: '학생가', gender: 'F', level: null }], { includeName: true, group: '1-2반' })
    const link = tacticBoardLink('https://k-tacticboard.netlify.app/', json)
    expect(link.startsWith('https://k-tacticboard.netlify.app/static/index.html#tactic=')).toBe(true)
    const enc = link.split('#tactic=')[1]
    // K-TacticBoard static/app.js 부트 코드와 같은 해독 방법
    const back = JSON.parse(decodeURIComponent(escape(atob(enc))))
    expect(back).toEqual(JSON.parse(json))
  })
  it('주소 끝의 / 나 # 가 있어도 한 번만 붙는다', () => {
    expect(tacticBoardLink('https://x.app///#old', '{}')).toBe('https://x.app/static/index.html#tactic=' + btoa('{}'))
  })
  it('앱 화면 주소를 직접 적었으면 그대로 쓴다', () => {
    expect(tacticBoardLink('https://x.app/static/index.html', '{}')).toBe('https://x.app/static/index.html#tactic=' + btoa('{}'))
  })
})
