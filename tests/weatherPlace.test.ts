import { describe, expect, it } from 'vitest'
import { KMA_GRID } from '../src/data/kmaGrid'
import { toGrid } from '../src/lib/weather'
import { GRID_SIDO, airSido, placeFromAddress, placeFromGrid, rowOf, suggestStation } from '../src/lib/weatherPlace'

describe('날씨 위치 정하기', () => {
  it('공식 격자표(2026-09 판, 전남광주 통합): 16개 시도 · 시군구 250개 넘음', () => {
    expect(GRID_SIDO).toHaveLength(16)
    expect(KMA_GRID.length).toBeGreaterThan(250)
    expect(rowOf('제주특별자치도', '제주시')).toMatchObject({ x: 53, y: 38 })
    expect(rowOf('서울특별시', '종로구')).toMatchObject({ x: 60, y: 127 })
  })
  it('에어코리아 시도: 통합 전남광주는 옛 광주 구만 광주', () => {
    expect(airSido({ s: '전남광주통합특별시', g: '광산구' })).toBe('광주')
    expect(airSido({ s: '전남광주통합특별시', g: '목포시' })).toBe('전남')
    expect(airSido({ s: '강원특별자치도', g: '춘천시' })).toBe('강원')
    // 모든 줄이 에어코리아 시도 이름을 가짐
    expect(KMA_GRID.every((r) => airSido(r))).toBe(true)
  })
  it('나이스 학교 주소 → 시군구 (옛 시도 이름 · 띄어 쓴 구 · 세종)', () => {
    expect(placeFromAddress('제주특별자치도 제주시 연삼로 1 (이도이동)').row?.g).toBe('제주시')
    expect(placeFromAddress('경기도 수원시 장안구 정조로 1').row?.g).toBe('수원시장안구')
    expect(placeFromAddress('광주광역시 북구 대천로 1').row).toMatchObject({ s: '전남광주통합특별시', g: '북구' })
    expect(placeFromAddress('전라북도 전주시 완산구 1').row?.g).toBe('전주시완산구')
    expect(placeFromAddress('세종특별자치시 한누리대로 1').row?.g).toBe('세종특별자치시')
    expect(placeFromAddress('없는 주소')).toEqual({})
  })
  it('현재 위치 → 가까운 시군구', () => {
    const g = toGrid(33.4996, 126.5312)
    expect(placeFromGrid(g.nx, g.ny).g).toBe('제주시')
  })
  it('측정소 추천: 읍면동 이름이 같은 측정소', () => {
    const row = rowOf('제주특별자치도', '제주시')!
    expect(suggestStation(['동홍동', '연동', '이도동'], row)).toBe('연동')
    expect(suggestStation(['동홍동', '이도동'], row)).toBe('이도동')
    expect(suggestStation(['장안', '정자동'], rowOf('경기도', '수원시장안구'))).not.toBe('')
    expect(suggestStation([], row)).toBe('')
  })
  it('격자 번호가 남한 범위 안', () => {
    expect(KMA_GRID.every((r) => r.x > 0 && r.x < 150 && r.y > 0 && r.y < 260)).toBe(true)
  })
})
