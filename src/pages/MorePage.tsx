import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useApp } from '../state/AppContext'

const LATER = [
  { label: '수행평가 채점표', phase: 5 },
  { label: '세특 키워드', phase: 5 },
  { label: '체육부장', phase: 2 },
  { label: '견학 · 열외', phase: 2 },
  { label: '팀 편성 앱 연동', phase: 6 },
  { label: '백업 · 복원 · 학년도 넘기기', phase: 6 },
]

export default function MorePage() {
  const { lock } = useApp()
  return (
    <>
      <PageHeader title="더보기" />
      <div className="page space-y-3 py-4">
        <Link to="/more/settings" className="card flex min-h-[60px] items-center justify-between text-lg font-bold">
          <span>⚙️ 설정</span>
          <span aria-hidden>›</span>
        </Link>
        <button type="button" className="card flex min-h-[60px] w-full items-center text-lg font-bold" onClick={lock}>
          🔒 지금 잠그기
        </button>
        <ul className="space-y-2 pt-2">
          {LATER.map((m) => (
            <li key={m.label} className="flex min-h-[52px] items-center justify-between rounded-xl bg-zinc-100 px-4 text-zinc-600">
              <span>{m.label}</span>
              <span className="text-sm">{m.phase}단계 예정</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
