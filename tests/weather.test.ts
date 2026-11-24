import { describe, expect, it } from 'vitest'
// @ts-expect-error 순수 JS (Cloudflare Worker)
import { wxQuery } from '../relay/comcigan-worker.js'
import { dailyBase, fcstBase, hourWarn, itemsOf, lessonHour, mergeHours, ncstBase, outdoorAdvice, parseAir, parseFcst, parseHours, parseNcst, stationNames, toGrid } from '../src/lib/weather'

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
    expect(dailyBase(new Date(2026, 10, 6, 13, 0))).toEqual({ date: '20261106', time: '0200' })
    expect(dailyBase(new Date(2026, 10, 6, 1, 0))).toEqual({ date: '20261105', time: '2300' })
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
  it('교시별 날씨: 시간별 값 꺼내기 · 새 예보 덮어 합치기', () => {
    const it = (category: string, fcstDate: string, fcstTime: string, fcstValue: string) => ({ category, fcstDate, fcstTime, fcstValue })
    const daily = parseHours(
      [it('TMP', '20261125', '0900', '1'), it('SKY', '20261125', '0900', '1'), it('TMP', '20261125', '1100', '3'), it('POP', '20261125', '1100', '20'), it('TMX', '20261125', '1500', '9.0'), it('TMP', '20261126', '0900', '5')],
      '20261125',
    )
    // 다른 날 · 시간별이 아닌 칸(TMX)은 빼고 시각순
    expect(daily).toEqual([{ time: '0900', tmp: 1, sky: 1 }, { time: '1100', tmp: 3, pop: 20 }])
    const newer = parseHours([it('TMP', '20261125', '1100', '4'), it('PTY', '20261125', '1100', '4'), it('TMP', '20261125', '1200', '5')], '20261125')
    expect(mergeHours(daily, newer)).toEqual([{ time: '0900', tmp: 1, sky: 1 }, { time: '1100', tmp: 4, pop: 20, pty: 4 }, { time: '1200', tmp: 5 }])
  })
  it('교시별 날씨: 수업 가운데에 가까운 정시 · 90분 넘으면 없음 · 주의 한마디', () => {
    const hours = [{ time: '0900', tmp: 1 }, { time: '1000', tmp: 2 }, { time: '1100', tmp: 3 }, { time: '1500', tmp: 8 }]
    // 10:40 + 50분 → 가운데 11:05 → 11시
    expect(lessonHour('10:40', 50, hours)?.time).toBe('1100')
    // 08:30 + 50분 → 08:55 → 9시
    expect(lessonHour('8:30', 50, hours)?.time).toBe('0900')
    // 13:00 + 50분 → 13:25: 11시는 145분 · 15시는 95분 떨어짐 → 없음
    expect(lessonHour('13:00', 50, hours)).toBeNull()
    expect(lessonHour(undefined, 50, hours)).toBeNull()
    expect(lessonHour('09:00', 50, [])).toBeNull()
    expect(hourWarn({ time: '1100', pty: 4 })).toBe('소나기')
    expect(hourWarn({ time: '1100', pop: 60 })).toBe('비 60%')
    expect(hourWarn({ time: '1100', pop: 50, tmp: 34 })).toBe('폭염 주의')
    expect(hourWarn({ time: '1100', tmp: -12 })).toBe('한파 주의')
    expect(hourWarn({ time: '1100', tmp: 10, pop: 30, sky: 4 })).toBeNull()
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
