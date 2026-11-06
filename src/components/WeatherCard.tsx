import { useCallback, useEffect, useState } from 'react'
import { COMCI_RELAY_DEFAULT } from '../lib/comcigan'
import {
  GRADE_LABEL,
  PTY_LABEL,
  SIDO_LIST,
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
import { useApp } from '../state/AppContext'
import Icon from './Icon'

const GRADE_STYLE: Record<number, string> = { 1: 'bg-[#e8f0fe] text-[#1d5fd6]', 2: 'bg-ok-light text-ok', 3: 'bg-caution-light text-ink', 4: 'bg-danger text-white' }
const STALE = 30 * 60 * 1000

/**
 * 홈 날씨 · 미세먼지 (6-11 H, 0-4 예외): 지금 기온 · 강수 · 오늘 최고/최저 · 강수확률, 미세먼지 · 초미세먼지 등급, 실외 수업 참고.
 * 학교 위치는 처음 한 번 [현재 위치로](격자 번호로만 저장) + 미세먼지 측정소 고르기. 30분마다 새로.
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

  if (!loc || setup) return <WeatherSetup relay={relay} onDone={() => setSetup(false)} onCancel={loc ? () => setSetup(false) : undefined} />

  const n: Ncst | undefined = cache?.ncst
  const f: Fcst | undefined = cache?.fcst
  const a: Air | undefined = cache?.air
  const adv = outdoorAdvice(n, a, f)
  const tone = adv.level === 'stop' ? 'border-danger bg-danger-light' : adv.level === 'caution' ? 'border-caution bg-caution-light' : 'border-line bg-white'
  const grade = (label: string, g?: number, v?: number, unit = '') => (
    <div className={`rounded-xl px-3 py-2 ${g ? GRADE_STYLE[g] : 'bg-fill text-ink-3'}`}>
      <p className="text-xs font-bold opacity-80">{label}</p>
      <p className="font-black">
        {g ? GRADE_LABEL[g] : '—'}
        {v !== undefined && <span className="ml-1 text-xs font-bold opacity-80">{v}{unit}</span>}
      </p>
    </div>
  )

  return (
    <section className={`card space-y-3 border-2 ${tone}`} aria-label="오늘 날씨 · 미세먼지">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-3">
            오늘 날씨 · {loc.label || loc.station}
          </p>
          <p className="text-[1.9rem] leading-tight font-black tabular-nums">
            {n?.temp !== undefined ? `${n.temp}℃` : '—'}
            <span className="ml-2 text-base font-bold text-ink-2">
              {n?.pty ? PTY_LABEL[n.pty] : f?.sky ? SKY_LABEL[f.sky] : ''}
            </span>
          </p>
          <p className="text-sm font-semibold text-ink-2">
            {f?.tmx !== undefined && `최고 ${f.tmx}℃ `}
            {f?.tmn !== undefined && `· 최저 ${f.tmn}℃ `}
            {f?.pop !== undefined && `· 강수확률 ${f.pop}%`}
          </p>
        </div>
        <button type="button" className="btn btn-ghost h-10 min-h-0 px-2 text-ink-3" aria-label="날씨 새로 받기" disabled={busy} onClick={() => void refresh()}>
          <Icon name="reset" size={18} />
        </button>
        <button type="button" className="btn btn-ghost h-10 min-h-0 px-2 text-ink-3" aria-label="위치 · 측정소 바꾸기" onClick={() => setSetup(true)}>
          <Icon name="settings" size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {grade('미세먼지', a?.pm10Grade, a?.pm10, '㎍')}
        {grade('초미세먼지', a?.pm25Grade, a?.pm25, '㎍')}
      </div>
      {adv.reasons.length > 0 ? (
        <ul className="space-y-1 text-sm font-bold">
          {adv.reasons.map((r) => (
            <li key={r} className={adv.level === 'stop' ? 'text-danger' : 'text-ink'}>
              ⚠️ {r}
            </li>
          ))}
        </ul>
      ) : (
        cache && <p className="text-sm font-bold text-ok">실외 수업하기 괜찮은 날이에요</p>
      )}
      {err && <p className="text-xs font-bold text-danger">{err}</p>}
      <p className="text-[0.72rem] text-ink-3">
        기상청 · 에어코리아 자료 {cache ? `· ${new Date(cache.fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 받음` : ''}
        {a?.time ? ` · 측정 ${a.time.slice(11)}` : ''} · 실외 수업 여부는 학교 지침을 따라 주세요
      </p>
    </section>
  )
}

function WeatherSetup({ relay, onDone, onCancel }: { relay: string; onDone: () => void; onCancel?: () => void }) {
  const { settings, updateSettings } = useApp()
  const cur = settings.weatherLoc
  const [grid, setGrid] = useState<{ nx: number; ny: number } | null>(cur ? { nx: cur.nx, ny: cur.ny } : null)
  const [sido, setSido] = useState(cur?.sido ?? '')
  const [stations, setStations] = useState<string[]>([])
  const [station, setStation] = useState(cur?.station ?? '')
  const [label, setLabel] = useState(cur?.label ?? settings.schoolName ?? '')
  const [msg, setMsg] = useState('')

  const locate = () => {
    if (!navigator.geolocation) return setMsg('이 브라우저는 위치를 못 써요.')
    setMsg('위치를 찾는 중…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGrid(toGrid(p.coords.latitude, p.coords.longitude))
        setMsg('위치를 찾았어요. 위도 · 경도는 저장하지 않고 기상청 격자 번호만 저장해요.')
      },
      () => setMsg('위치를 못 받았어요. 브라우저에서 위치 허용을 눌러 주세요.'),
      { enableHighAccuracy: false, timeout: 15000 },
    )
  }
  const loadStations = async (s: string) => {
    setSido(s)
    setStation('')
    const r = await fetchWx(relay, { wx: 'air', sidoName: s })
    if (r.error) setMsg(r.error)
    setStations(stationNames(r.items as never))
  }

  return (
    <section className="card space-y-3" aria-label="날씨 위치 정하기">
      <div>
        <p className="font-extrabold">오늘 날씨 · 미세먼지</p>
        <p className="hint">학교에서 한 번 정해 두면 홈에 실외 수업 참고가 떠요. 보내는 것은 학교 위치(격자 번호 · 측정소)뿐이에요.</p>
      </div>
      <button type="button" className="btn btn-outline w-full" onClick={locate}>
        <Icon name="flag" size={18} /> {grid ? `현재 위치로 다시 정하기 (격자 ${grid.nx}, ${grid.ny})` : '학교에서 현재 위치로 정하기'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <select className="field" value={sido} onChange={(e) => void loadStations(e.target.value)} aria-label="시도">
          <option value="">시도 고르기</option>
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="field" value={station} disabled={!stations.length} onChange={(e) => setStation(e.target.value)} aria-label="미세먼지 측정소">
          <option value="">측정소 (학교 가까운 곳)</option>
          {stations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <input className="field w-full" placeholder="이름 (예: 학교)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
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
          disabled={!grid || !sido || !station}
          onClick={async () => {
            await updateSettings({ weatherLoc: { nx: grid!.nx, ny: grid!.ny, sido, station, label: label.trim() || undefined }, weatherCache: null })
            onDone()
          }}
        >
          저장
        </button>
      </div>
    </section>
  )
}
