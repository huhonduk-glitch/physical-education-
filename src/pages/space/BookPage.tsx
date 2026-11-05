import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { addDays, todayStr } from '../../lib/dates'
import { SpaceError, bookingAt, bookingClashes, deleteItem, putItem, rowId, weekDates, type Booking } from '../../lib/space'
import { useApp } from '../../state/AppContext'
import { useSpace } from '../../state/useSpace'

const DAY = ['월', '화', '수', '목', '금']
const DEFAULT_PLACES = ['체육관', '운동장']

/**
 * 체육관 · 운동장 사용 예약 (학교 공유 공간 6-13): 장소마다 한 주 요일 × 교시 표.
 * 빈칸을 누르면 내 이름으로 예약, 내 칸을 다시 누르면 취소. 다른 선생님 칸은 이름만 보인다.
 * 내 시간표 수업은 옅게 표시(그 시간에 체육관을 쓸지 고르는 데 참고).
 */
export default function BookPage() {
  const { settings } = useApp()
  const book = useSpace<Booking>('book')
  const conn = book.conn
  const today = todayStr()
  const [anchor, setAnchor] = useState(today)
  const [place, setPlace] = useState(DEFAULT_PLACES[0])
  const [newPlace, setNewPlace] = useState('')
  const [err, setErr] = useState('')
  const rows = book.rows ?? []
  const places = useMemo(() => [...new Set([...DEFAULT_PLACES, ...rows.map((r) => r.data.place)])], [rows])
  const days = weekDates(anchor)
  const periods = Math.max(7, settings.periodStarts?.length ?? 0)
  const clashes = new Set(bookingClashes(rows))

  if (!conn)
    return (
      <>
        <PageHeader title="체육관 예약" back />
        <div className="page">
          <Link to="/work/space" className="card flex items-center gap-3">
            <Icon name="share" className="text-brand" />
            <span className="flex-1 font-bold">먼저 학교 공유 공간에 연결해 주세요</span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        </div>
      </>
    )

  const tap = async (date: string, period: number) => {
    setErr('')
    const cur = bookingAt(rows, place, date, period)
    try {
      if (cur) {
        if (cur.data.teacher !== conn.me) return
        await deleteItem(conn, 'book', cur.id)
      } else {
        await book.reload()
        await putItem<Booking>(conn, 'book', rowId(), { place, date, period, teacher: conn.me })
      }
      await book.reload()
    } catch (e) {
      setErr(e instanceof SpaceError ? e.message : '저장하지 못했어요.')
    }
  }

  return (
    <>
      <PageHeader
        title="체육관 · 운동장 예약"
        sub={`${conn.name} · 같이 보는 예약표`}
        back
        right={
          <button type="button" className="btn btn-soft" aria-label="새로 받기" onClick={() => void book.reload()}>
            <Icon name="reset" />
          </button>
        }
      />
      <div className="page space-y-3 pb-10">
        <div className="flex flex-wrap items-center gap-2">
          {places.map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={place === p} onClick={() => setPlace(p)}>
              {p}
            </button>
          ))}
          <input className="field h-10 w-32" placeholder="+ 장소" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newPlace.trim() && (setPlace(newPlace.trim()), setNewPlace(''))} />
        </div>
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="지난주" onClick={() => setAnchor(addDays(days[0], -7))}>
            ◀
          </button>
          <b>
            {days[0].slice(5).replace('-', '/')} ~ {days[4].slice(5).replace('-', '/')} · {place}
          </b>
          <button type="button" className="btn btn-soft h-11 min-h-0 px-3" aria-label="다음 주" onClick={() => setAnchor(addDays(days[0], 7))}>
            ▶
          </button>
        </div>
        {(book.err || err) && <p className="rounded-2xl bg-danger-light px-4 py-3 font-bold text-danger">{book.err || err}</p>}
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <thead>
              <tr className="bg-fill text-ink-2">
                <th className="w-10 border-b border-line py-2" />
                {days.map((d, i) => (
                  <th key={d} className={`border-b border-l border-line py-2 font-bold ${d === today ? 'bg-brand text-white' : ''}`}>
                    {DAY[i]} <span className="text-xs font-semibold opacity-80">{d.slice(8)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
                <tr key={p}>
                  <th className="border-b border-line text-center font-bold text-ink-3">{p}</th>
                  {days.map((d, di) => {
                    const b = bookingAt(rows, place, d, p)
                    const mine = b?.data.teacher === conn.me
                    const myClass = settings.timetable.some((t) => t.day === di + 1 && t.period === p)
                    const clash = clashes.has(`${place}|${d}|${p}`)
                    return (
                      <td key={d} className="h-12 border-b border-l border-line p-0.5">
                        <button
                          type="button"
                          className={`flex h-full w-full flex-col items-center justify-center rounded-md text-xs font-bold ${
                            clash ? 'bg-danger text-white' : b ? (mine ? 'bg-brand text-white' : 'bg-fill-2 text-ink') : myClass ? 'bg-brand-light/60 text-brand hover:bg-brand-light' : 'hover:bg-fill'
                          }`}
                          disabled={!!b && !mine}
                          aria-label={`${DAY[di]} ${p}교시 ${b ? `${b.data.teacher} 예약` : '비어 있음'}`}
                          onClick={() => void tap(d, p)}
                        >
                          {b ? b.data.teacher : myClass ? '내 수업' : ''}
                          {clash && <span className="text-[0.6rem]">겹침</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint px-1">
          빈칸을 누르면 <b>{conn.me}</b> 이름으로 예약, 내 칸(파랑)을 다시 누르면 취소 · 회색 = 다른 선생님 · 옅은 파랑 = 내 시간표 수업 · 빨강 = 같은 칸에 두 명(서로 이야기해 주세요)
        </p>
      </div>
    </>
  )
}
