import { useState } from 'react'
import { Link } from 'react-router-dom'
import { newYearDue } from '../lib/newYear'
import { useApp } from '../state/AppContext'
import Icon from './Icon'

const LATER_KEY = 'pelog.newYearLater'
const LATER_DAYS = 7

function laterUntil(): number {
  try {
    return Number(localStorage.getItem(LATER_KEY) ?? 0)
  } catch {
    return 0
  }
}

/** 3월 1일이 지나면 홈 맨 위에 새 학년도 시작 안내 (6-30). [나중에]는 7일 동안 숨김 */
export default function NewYearNotice() {
  const { settings } = useApp()
  const [hiddenUntil, setHiddenUntil] = useState(laterUntil)
  const next = newYearDue(settings)
  if (!next || Date.now() < hiddenUntil) return null
  const later = () => {
    const until = Date.now() + LATER_DAYS * 86400000
    try {
      localStorage.setItem(LATER_KEY, String(until))
    } catch {
      /* 무시 */
    }
    setHiddenUntil(until)
  }
  return (
    <section className="card space-y-2 bg-brand-light shadow-none" role="status">
      <div className="flex items-start gap-2">
        <Icon name="calendar" className="mt-0.5 shrink-0 text-brand" />
        <p className="flex-1 font-bold text-brand">{next}학년도가 됐어요</p>
      </div>
      <p className="text-sm text-ink-2">새 명렬 · 시간표를 넣기 전에 [새 학년도 시작]을 눌러 주세요. 지난해 기록은 그대로 보관되고, 진도표 · 수행평가를 골라 가져올 수 있어요.</p>
      <div className="flex gap-2">
        <Link to="/more/data/new-year" className="btn btn-primary flex-1">
          새 학년도 시작
        </Link>
        <button type="button" className="btn btn-soft bg-white" onClick={later}>
          나중에
        </button>
      </div>
    </section>
  )
}
