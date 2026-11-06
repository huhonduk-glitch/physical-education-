/**
 * 날씨 · 미세먼지 (2026-11-06 교사 결정, CLAUDE.md 0-4 예외 · 6-11 H). 순수 함수 + 중계 호출.
 * - 기상청 단기예보 조회서비스(초단기실황 · 단기예보) · 에어코리아 대기오염정보(시도별 실시간)를 교사 Cloudflare 중계로 받는다(?wx=).
 * - 보내는 것: 기상청 격자(nx · ny) · 날짜 · 시각 / 시도 이름. 학생 정보 없음.
 * - 미세먼지 등급은 에어코리아가 매긴 등급(pm10Grade · pm25Grade, 1 좋음 ~ 4 매우나쁨)을 그대로 쓴다(앱이 기준을 만들지 않음).
 * - 실외 수업 안내는 참고: '나쁨' 이상 = 야외 수업 자제 권고(교육부 2017 학교 미세먼지 대책),
 *   기온은 학교체육 운영방향(제주 2026) 53~54쪽의 폭염 · 한파 특보 기준 온도를 참고로만(특보 자체가 아님).
 */

export interface WeatherLoc {
  nx: number
  ny: number
  /** 에어코리아 시도 이름 (서울 · 제주 …) */
  sido: string
  /** 측정소 이름 */
  station: string
  label?: string
}

export interface Ncst {
  temp?: number
  rain1h?: number
  /** 강수형태 PTY: 0 없음 1 비 2 비/눈 3 눈 5 빗방울 6 빗방울눈날림 7 눈날림 */
  pty?: number
  humidity?: number
  wind?: number
}
export interface Fcst {
  tmx?: number
  tmn?: number
  /** 오늘 남은 시간 최고 강수확률 */
  pop?: number
  /** 하늘 SKY 1 맑음 3 구름많음 4 흐림 (지금 가까운 시각) */
  sky?: number
}
export interface Air {
  station: string
  pm10?: number
  pm25?: number
  pm10Grade?: number
  pm25Grade?: number
  time?: string
}

export const SIDO_LIST = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '세종'] as const
export const GRADE_LABEL: Record<number, string> = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' }
export const PTY_LABEL: Record<number, string> = { 0: '', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울 · 눈날림', 7: '눈날림' }
export const SKY_LABEL: Record<number, string> = { 1: '맑음', 3: '구름 많음', 4: '흐림' }

/** 위도 · 경도 → 기상청 격자 (기상청 단기예보 활용 가이드의 LCC 변환, 격자 5 km) */
export function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877 / 5.0
  const DEG = Math.PI / 180
  const slat1 = 30 * DEG
  const slat2 = 60 * DEG
  const olon = 126 * DEG
  const olat = 38 * DEG
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (RE * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * DEG * 0.5)
  ra = (RE * sf) / Math.pow(ra, sn)
  let theta = lon * DEG - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return { nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5) }
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

/** 초단기실황 기준 시각: 매시 정각 자료가 40분쯤 뒤에 나온다 → 40분 전이면 한 시간 전 */
export function ncstBase(now: Date): { date: string; time: string } {
  const d = new Date(now)
  if (d.getMinutes() < 40) d.setHours(d.getHours() - 1)
  return { date: ymd(d), time: `${pad(d.getHours())}00` }
}

/** 단기예보 기준 시각: 02 · 05 · 08 · 11 · 14 · 17 · 20 · 23시, 발표 10분 뒤부터 */
export function fcstBase(now: Date): { date: string; time: string } {
  const d = new Date(now)
  const mins = d.getHours() * 60 + d.getMinutes()
  const slots = [2, 5, 8, 11, 14, 17, 20, 23]
  const ok = slots.filter((h) => h * 60 + 10 <= mins)
  if (!ok.length) {
    d.setDate(d.getDate() - 1)
    return { date: ymd(d), time: '2300' }
  }
  return { date: ymd(d), time: `${pad(ok[ok.length - 1])}00` }
}

/** 오늘 최저 · 최고를 담은 예보: 그날 02시 발표(02:10 전이면 전날 23시) */
export function dailyBase(now: Date): { date: string; time: string } {
  const d = new Date(now)
  if (d.getHours() * 60 + d.getMinutes() < 2 * 60 + 10) {
    d.setDate(d.getDate() - 1)
    return { date: ymd(d), time: '2300' }
  }
  return { date: ymd(d), time: '0200' }
}

type Item = { category: string; obsrValue?: string; fcstValue?: string; fcstDate?: string; fcstTime?: string }

/** 공공데이터포털 응답에서 항목 목록 꺼내기 (오류면 메시지) */
export function itemsOf(json: unknown): { items: unknown[]; error?: string } {
  const r = (json as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: unknown[] } | unknown[] } } })?.response
  if (!r) return { items: [], error: '날씨 응답을 읽지 못했어요(인증키가 아직 켜지지 않았을 수 있어요).' }
  if (r.header?.resultCode && r.header.resultCode !== '00') return { items: [], error: `날씨 서비스: ${r.header.resultMsg ?? r.header.resultCode}` }
  const it = r.body?.items
  return { items: Array.isArray(it) ? it : (it?.item ?? []) }
}

const num = (v: string | undefined) => {
  if (v === undefined || v === null) return undefined
  if (/없음|-/.test(v)) return 0
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

export function parseNcst(items: readonly Item[]): Ncst {
  const g = (c: string) => num(items.find((i) => i.category === c)?.obsrValue)
  return { temp: g('T1H'), rain1h: g('RN1'), pty: g('PTY'), humidity: g('REH'), wind: g('WSD') }
}

/** 오늘(YYYYMMDD) 최고 · 최저, 지금 이후 최고 강수확률, 지금 가까운 하늘 */
export function parseFcst(items: readonly Item[], today: string, nowHHmm: string): Fcst {
  const todays = items.filter((i) => i.fcstDate === today)
  const val = (c: string) => todays.filter((i) => i.category === c)
  const tmx = num(val('TMX')[0]?.fcstValue)
  const tmn = num(val('TMN')[0]?.fcstValue)
  const later = (c: string) => val(c).filter((i) => (i.fcstTime ?? '') >= nowHHmm.slice(0, 2) + '00')
  const pops = later('POP').map((i) => num(i.fcstValue) ?? 0)
  const sky = num(later('SKY')[0]?.fcstValue ?? val('SKY').slice(-1)[0]?.fcstValue)
  return { tmx, tmn, pop: pops.length ? Math.max(...pops) : undefined, sky }
}

export function parseAir(items: readonly Record<string, string | null>[], station: string): Air | null {
  const it = items.find((i) => i.stationName === station)
  if (!it) return null
  const n = (v: string | null | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined)
  return { station, pm10: n(it.pm10Value), pm25: n(it.pm25Value), pm10Grade: n(it.pm10Grade1h ?? it.pm10Grade), pm25Grade: n(it.pm25Grade1h ?? it.pm25Grade), time: it.dataTime ?? undefined }
}

export function stationNames(items: readonly Record<string, string | null>[]): string[] {
  return [...new Set(items.map((i) => i.stationName ?? '').filter(Boolean))].sort()
}

export interface Advice {
  level: 'ok' | 'caution' | 'stop'
  reasons: string[]
}

/** 실외 수업 참고 안내 (판단은 학교 · 교사가) */
export function outdoorAdvice(n: Ncst | undefined, a: Air | null | undefined, f?: Fcst): Advice {
  const reasons: string[] = []
  let level: Advice['level'] = 'ok'
  const up = (l: Advice['level']) => {
    if (l === 'stop' || (l === 'caution' && level === 'ok')) level = l
  }
  const g = Math.max(a?.pm10Grade ?? 0, a?.pm25Grade ?? 0)
  if (g >= 4) {
    up('stop')
    reasons.push('미세먼지 매우나쁨: 실외 수업 중단 · 실내 대체를 검토하세요')
  } else if (g === 3) {
    up('caution')
    reasons.push('미세먼지 나쁨: 실외 수업 자제 권고(교육부 학교 미세먼지 대책)')
  }
  if (n?.pty && n.pty > 0) {
    up('caution')
    reasons.push(`지금 ${PTY_LABEL[n.pty] || '비 · 눈'}: 운동장 · 바닥 미끄럼 주의`)
  } else if ((f?.pop ?? 0) >= 60) {
    up('caution')
    reasons.push(`오늘 강수확률 ${f!.pop}%`)
  }
  const t = n?.temp
  if (t !== undefined && t >= 33) {
    up('caution')
    reasons.push(`기온 ${t}℃: 폭염 주의 — 그늘 · 물 · 휴식 (폭염주의보 기준 체감온도 33℃ 참고)`)
  } else if (t !== undefined && t <= -12) {
    up('caution')
    reasons.push(`기온 ${t}℃: 한파 주의 — 준비운동 충분히 (한파 특보 기준 참고)`)
  }
  return { level, reasons }
}

/** 중계 호출 */
export async function fetchWx(relay: string, q: Record<string, string>): Promise<{ items: unknown[]; error?: string }> {
  const url = `${relay.replace(/\/$/, '')}/?${new URLSearchParams({ ...q }).toString()}`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return { items: [], error: '날씨를 받아 오지 못했어요. 인터넷을 확인해 주세요.' }
  }
  const text = await res.text()
  if (res.status === 503) return { items: [], error: '날씨 인증키가 아직 중계에 없어요.' }
  try {
    return itemsOf(JSON.parse(text))
  } catch {
    return { items: [], error: /SERVICE_KEY|등록되지/.test(text) ? '인증키가 아직 켜지지 않았어요(승인 뒤 1~2시간).' : '날씨 응답을 읽지 못했어요.' }
  }
}
