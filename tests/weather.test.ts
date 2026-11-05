import { describe, expect, it } from 'vitest'
// @ts-expect-error 순수 JS (Cloudflare Worker)
import { wxQuery } from '../relay/comcigan-worker.js'
import { fcstBase, itemsOf, ncstBase, outdoorAdvice, parseAir, parseFcst, parseNcst, stationNames, toGrid } from '../src/lib/weather'

describe('날씨 · 미세먼지', () => {
  it('위경도 → 기상청 격자 (서울시청 60,127 · 제주시청 53,38)', () => {
    expect(toGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 })
    expect(toGrid(33.4996, 126.5312)).toEqual({ nx: 53, ny: 38 })
  })
  it('기준 시각: 실황은 40분 뒤, 예보는 02시부터 3시간마다 10분 뒤', () => {
    expect(ncstBase(new Date(2026, 10, 6, 9, 30))).toEqual({ date: '20261106', time: '0800' })
    expect(ncstBase(new Date(2026, 10, 6, 9, 45))).toEqual({ date: '20261106', time: '0900' })
    expect(fcstBase(new Date(2026, 10, 6, 8, 5))).toEqual({ date: '20261106', time: '0500' })
    expect(fcstBase(new Date(2026, 10, 6, 1, 0))).toEqual({ date: '20261105', time: '2300' })
  })
  it('응답 읽기 · 오류', () => {
    const ok = { response: { header: { resultCode: '00' }, body: { items: { item: [{ category: 'T1H', obsrValue: '12.3' }, { category: 'PTY', obsrValue: '1' }, { category: 'RN1', obsrValue: '강수없음' }] } } } }
    const n = parseNcst(itemsOf(ok).items as never)
    expect(n).toMatchObject({ temp: 12.3, pty: 1, rain1h: 0 })
    expect(itemsOf({ response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } }).error).toContain('SERVICE_KEY')
  })
  it('예보: 오늘 최고 · 최저, 남은 시간 최고 강수확률', () => {
    const it = (category: string, fcstTime: string, fcstValue: string) => ({ category, fcstDate: '20261106', fcstTime, fcstValue })
    const f = parseFcst([it('TMX', '1500', '17.0'), it('TMN', '0600', '8.0'), it('POP', '0900', '80'), it('POP', '1500', '30'), it('SKY', '1500', '4')], '20261106', '1210')
    expect(f).toEqual({ tmx: 17, tmn: 8, pop: 30, sky: 4 })
  })
  it('미세먼지: 측정소 찾기 · 에어코리아 등급 그대로', () => {
    const items = [{ stationName: '이도동', pm10Value: '85', pm25Value: '40', pm10Grade1h: '3', pm25Grade1h: '3', dataTime: '2026-11-06 09:00' }, { stationName: '연동', pm10Value: '-', pm25Value: '-', pm10Grade1h: null, pm25Grade1h: null, dataTime: null }]
    expect(stationNames(items)).toEqual(['연동', '이도동'])
    expect(parseAir(items, '이도동')).toMatchObject({ pm10: 85, pm10Grade: 3 })
    expect(parseAir(items, '연동')?.pm10).toBeUndefined()
  })
  it('실외 수업 참고: 나쁨 → 주의, 매우나쁨 → 중단 검토, 비 · 폭염', () => {
    expect(outdoorAdvice({ temp: 20 }, { station: 'x', pm10Grade: 2 }).level).toBe('ok')
    expect(outdoorAdvice({ temp: 20 }, { station: 'x', pm25Grade: 3 }).level).toBe('caution')
    expect(outdoorAdvice({ temp: 20 }, { station: 'x', pm10Grade: 4 }).level).toBe('stop')
    expect(outdoorAdvice({ temp: 34, pty: 1 }, null).reasons).toHaveLength(2)
  })
  it('중계: 정해진 서비스 · 칸만', () => {
    const u = (q: string) => new URL(`https://relay.example/?${q}`)
    expect(wxQuery(u('wx=ncst&base_date=20261106&base_time=0900&nx=53&ny=38'))?.q.get('dataType')).toBe('JSON')
    expect(wxQuery(u('wx=air&sidoName=제주'))?.q.get('ver')).toBe('1.3')
    expect(wxQuery(u('wx=air&sidoName=없는곳'))).toBeNull()
    expect(wxQuery(u('wx=ncst&base_date=x&base_time=0900&nx=53&ny=38'))).toBeNull()
    expect(wxQuery(u('wx=other'))).toBeNull()
  })
})
