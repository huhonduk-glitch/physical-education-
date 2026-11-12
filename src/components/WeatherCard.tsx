import { useCallback, useEffect, useRef, useState } from 'react'
import { COMCI_RELAY_DEFAULT } from '../lib/comcigan'
import {
  GRADE_LABEL,
  PTY_LABEL,
  SKY_LABEL,
  dailyBase,
  fcstBase,
  fetchWx,
  ncstBase,
  outdoorAdvice,
  parseAir,
  parseFcst,
  parseNcst,
  stationNames,
  toGrid,
  type Air,
  type Fcst,
  type Ncst,
} from '../lib/weather'
import { GRID_SIDO, airSido, placeFromAddress, placeFromGrid, rowOf, sigunguOf, suggestStation, type GridRow } from '../lib/weatherPlace'
import { useApp } from '../state/AppContext'
import { weatherEmoji } from '../lib/dash'
import Icon from './Icon'

const GRADE_STYLE: Record<number, string> = { 1: 'bg-[#e8f0fe] text-[#1d5fd6]', 2: 'bg-ok-light text-ok', 3: 'bg-caution-light text-ink', 4: 'bg-danger text-white' }
const STALE = 30 * 60 * 1000

/**
 * 홈 날씨 · 미세먼지 (6-11 H, 0-4 예외): 지금 기온 · 강수 · 오늘 최고/최저 · 강수확률, 미세먼지 · 초미세먼지 등급, 실외 수업 참고.
 * 학교 위치: 나이스 학교 주소로 자동, 또는 시도 → 시군구를 고르거나 [현재 위치로](격자 번호만 저장). 측정소는 추천 + 고르기. 30분마다 새로.
 */
export default function WeatherCard() {
  const { settings, updateSettings } = useApp()
  const loc = settings.weatherLoc
  const cache = settings.weatherCache
  const relay = settings.comciRelayUrl || COMCI_RELAY_DEFAULT
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [setup, setSetup] = useState(false)

  const refresh = useCallback(async () => {
    if (!loc) return
    setBusy(true)
    setErr('')
    const now = new Date()
    const nb = ncstBase(now)
    const fb = fcstBase(now)
    const db = dailyBase(now)
    const [n, f, a, dy] = await Promise.all([
      fetchWx(relay, { wx: 'ncst', base_date: nb.date, base_time: nb.time, nx: String(loc.nx), ny: String(loc.ny) }),
      fetchWx(relay, { wx: 'fcst', base_date: fb.date, base_time: fb.time, nx: String(loc.nx), ny: String(loc.ny) }),
      fetchWx(relay, { wx: 'air', sidoName: loc.sido }),
      db.time === fb.time && db.date === fb.date ? Promise.resolve(null) : fetchWx(relay, { wx: 'fcst', base_date: db.date, base_time: db.time, nx: String(loc.nx), ny: String(loc.ny) }),
    ])
    const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const next = {
      fetchedAt: Date.now(),
      ncst: n.error ? cache?.ncst : parseNcst(n.items as never),
      fcst: f.error
        ? cache?.fcst
        : (() => {
            const cur = parseFcst(f.items as never, today, hhmm)
            // 최저 · 최고는 02시 예보 쪽이 하루 전체를 담고 있다
            const day = dy && !dy.error ? parseFcst(dy.items as never, today, hhmm) : null
            return { ...cur, tmn: cur.tmn ?? day?.tmn, tmx: cur.tmx ?? day?.tmx }
          })(),
      air: a.error ? cache?.air : parseAir(a.items as never, loc.station) ?? undefined,
    }
    setErr(n.error || a.error || f.error || '')
    await updateSettings({ weatherCache: next })
    setBusy(false)
  }, [loc, relay, cache, updateSettings])

  useEffect(() => {
    if (loc && (!cache || Date.now() - cache.fetchedAt > STALE)) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc?.nx, loc?.ny, loc?.station])

  if (setup) return <WeatherSetup relay={relay} onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />
  // 위치를 아직 안 정했으면 작은 칸으로만 (맨 위 줄 높이를 늘리지 않게)
  if (!loc)
    return (
      <button type="button" className="dash-tile flex w-full flex-col items-center justify-center bg-white text-center" onClick={() => setSetup(true)}>
        <span className="text-[2.2rem] leading-none" aria-hidden>
          ⛅
        </span>
        <b className="mt-1.5 text-[0.98rem]">날씨 · 미세먼지 보기</b>
        <span className="text-[0.82rem] font-semibold text-brand">학교 위치 정하기 ›</span>
      </button>
    )

  const n: Ncst | undefined = cache?.ncst
  const f: Fcst | undefined = cache?.fcst
  const a: Air | undefined = cache?.air
  const adv = outdoorAdvice(n, a, f)
  const tone = adv.level === 'stop' ? 'border-danger bg-danger-light' : adv.level === 'caution' ? 'border-caution bg-caution-light' : 'border-line bg-white'
  const emoji = weatherEmoji(n?.pty, f?.sky, new Date().getHours())
  const skyText = n?.pty ? PTY_LABEL[n.pty] : f?.sky ? SKY_LABEL[f.sky] : ''
  const grade = (label: string, g?: number, v?: number) => (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.8rem] font-extrabold ${g ? GRADE_STYLE[g] : 'bg-fill text-ink-3'}`}>
      <span className="font-bold opacity-80">{label}</span>
      {g ? GRADE_LABEL[g] : '—'}
      {v !== undefined && <span className="font-bold tabular-nums opacity-70">{v}</span>}
    </span>
  )

  return (
    <section className={`dash-tile relative border-2 ${tone}`} aria-label="오늘 날씨 · 미세먼지">
      <div className="absolute top-1.5 right-1.5 flex">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-fill" aria-label="날씨 새로 받기" disabled={busy} onClick={() => void refresh()}>
          <Icon name="reset" size={16} className={busy ? 'animate-spin' : ''} />
        </button>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-fill" aria-label="위치 · 측정소 바꾸기" onClick={() => setSetup(true)}>
          <Icon name="settings" size={16} />
        </button>
      </div>
      <p className="pr-16 text-[0.82rem] font-bold text-ink-3">{loc.label || loc.station}</p>
      <div className="flex items-center gap-2.5">
        <span className="text-[2.6rem] leading-none" role="img" aria-label={skyText || '날씨'}>
          {emoji}
        </span>
        <div className="min-w-0">
          <p className="leading-none font-black tracking-tight tabular-nums">
            <span className="text-[2.1rem] xl:text-[2.4rem]">{n?.temp !== undefined ? `${n.temp}°` : '—'}</span>
            {skyText && <span className="ml-1.5 text-[1rem] font-extrabold text-ink-2">{skyText}</span>}
          </p>
          <p className="mt-1 text-[0.8rem] font-bold text-ink-3 tabular-nums">
            {f?.tmx !== undefined && <span className="text-danger">↑{f.tmx}° </span>}
            {f?.tmn !== undefined && <span className="text-[#2a78d6]">↓{f.tmn}° </span>}
            {f?.pop !== undefined && <span>☔ {f.pop}%</span>}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {grade('미세', a?.pm10Grade, a?.pm10)}
        {grade('초미세', a?.pm25Grade, a?.pm25)}
      </div>
      {adv.reasons.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-[0.84rem] font-bold">
          {adv.reasons.map((r) => (
            <li key={r} className={adv.level === 'stop' ? 'text-danger' : 'text-ink'}>
              ⚠️ {r}
            </li>
          ))}
        </ul>
      ) : (
        cache && <p className="mt-1.5 text-[0.84rem] font-bold text-ok">실외 수업하기 괜찮은 날이에요</p>
      )}
      {err && <p className="mt-1 text-xs font-bold text-danger">{err}</p>}
      <p className="mt-1 text-[0.68rem] leading-snug text-ink-3">
        기상청 · 에어코리아{cache ? ` · ${new Date(cache.fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 받음` : ''} · 실외 수업 여부는 학교 지침대로
      </p>
    </section>
  )
}

function WeatherSetup({ relay, onDone, onCancel }: { relay: string; onDone: () => void; onCancel?: () => void }) {
  const { settings, updateSettings } = useApp()
  const cur = settings.weatherLoc
  const school = settings.neisSchool
  const [sido, setSido] = useState(cur?.place?.split('|')[0] ?? '')
  const [sigungu, setSigungu] = useState(cur?.place?.split('|')[1] ?? '')
  const [grid, setGrid] = useState<{ nx: number; ny: number } | null>(cur ? { nx: cur.nx, ny: cur.ny } : null)
  const [airName, setAirName] = useState(cur?.sido ?? '')
  const [stations, setStations] = useState<string[]>([])
  const [station, setStation] = useState(cur?.station ?? '')
  const [label, setLabel] = useState(cur?.label ?? school?.name ?? settings.schoolName ?? '')
  const [msg, setMsg] = useState('')
  const tried = useRef(false)

  /** 시군구 하나를 고르면: 격자 · 에어코리아 시도 · 측정소 목록과 추천 */
  const pick = useCallback(
    async (row: GridRow, keepStation?: string) => {
      setSido(row.s)
      setSigungu(row.g)
      setGrid({ nx: row.x, ny: row.y })
      const air = airSido(row)
      setAirName(air)
      const r = await fetchWx(relay, { wx: 'air', sidoName: air })
      if (r.error) setMsg(r.error)
      const list = stationNames(r.items as never)
      setStations(list)
      setStation(keepStation && list.includes(keepStation) ? keepStation : suggestStation(list, row))
    },
    [relay],
  )

  // 처음: 저장한 곳이 있으면 그 목록, 없으면 나이스 학교 주소로 자동
  useEffect(() => {
    if (tried.current) return
    tried.current = true
    const saved = cur?.place ? rowOf(cur.place.split('|')[0], cur.place.split('|')[1]) : undefined
    if (saved) return void pick(saved, cur?.station)
    if (cur) return void pick(placeFromGrid(cur.nx, cur.ny), cur.station)
    if (school?.address) {
      const p = placeFromAddress(school.address)
      if (p.row) {
        setMsg(`나이스 학교 주소(${school.address})로 정했어요. 다르면 아래에서 고쳐 주세요.`)
        void pick(p.row)
      } else if (p.sido) setSido(p.sido)
    }
  }, [cur, school, pick])

  const locate = () => {
    if (!navigator.geolocation) return setMsg('이 브라우저는 위치를 못 써요. 시도 · 시군구를 골라 주세요.')
    setMsg('위치를 찾는 중…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const g = toGrid(p.coords.latitude, p.coords.longitude)
        const row = placeFromGrid(g.nx, g.ny)
        void pick(row).then(() => setGrid(g))
        setMsg(`${row.s} ${row.g} 근처예요. 위도 · 경도는 저장하지 않고 기상청 격자 번호만 저장해요.`)
      },
      () => setMsg('위치를 못 받았어요. 브라우저에서 위치 허용을 누르거나, 시도 · 시군구를 골라 주세요.'),
      { enableHighAccuracy: false, timeout: 15000 },
    )
  }

  const rows = sido ? sigunguOf(sido) : []

  return (
    <section className="card space-y-3" aria-label="날씨 위치 정하기">
      <div>
        <p className="font-extrabold">오늘 날씨 · 미세먼지 · 학교 위치</p>
        <p className="hint">선생님 학교가 있는 시군구를 정해 두면 홈에 실외 수업 참고가 떠요. 보내는 것은 기상청 격자 번호 · 시도 이름뿐이에요.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="field"
          value={sido}
          aria-label="시도"
          onChange={(e) => {
            setSido(e.target.value)
            setSigungu('')
            setGrid(null)
            setStations([])
            setStation('')
            setMsg('')
          }}
        >
          <option value="">시도 고르기</option>
          {GRID_SIDO.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={sigungu}
          disabled={!rows.length}
          aria-label="시군구"
          onChange={(e) => {
            const row = rowOf(sido, e.target.value)
            setMsg('')
            if (row) void pick(row)
          }}
        >
          <option value="">시군구 고르기</option>
          {rows.map((r) => (
            <option key={r.g} value={r.g}>
              {r.g}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="btn btn-outline w-full" onClick={locate}>
        <Icon name="flag" size={18} /> 학교에 있다면: 현재 위치로 찾기
      </button>
      <label className="block">
        <span className="text-sm font-bold text-ink-2">미세먼지 측정소 {airName && `(${airName})`}</span>
        <select className="field mt-1 w-full" value={station} disabled={!stations.length} onChange={(e) => setStation(e.target.value)} aria-label="미세먼지 측정소">
          <option value="">{stations.length ? '측정소 고르기 (학교 가까운 곳)' : '시군구를 먼저 골라 주세요'}</option>
          {stations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <input className="field w-full" placeholder="카드에 보일 이름 (예: 학교)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="카드에 보일 이름" />
      {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
      {grid && <p className="text-xs text-ink-3">기상청 격자 {grid.nx}, {grid.ny}</p>}
      <div className="grid grid-cols-2 gap-2">
        {onCancel ? (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            그만
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!grid || !airName || !station}
          onClick={async () => {
            await updateSettings({
              weatherLoc: { nx: grid!.nx, ny: grid!.ny, sido: airName, station, label: label.trim() || undefined, place: sido && sigungu ? `${sido}|${sigungu}` : undefined },
              weatherCache: null,
            })
            onDone()
          }}
        >
          저장
        </button>
      </div>
    </section>
  )
}
