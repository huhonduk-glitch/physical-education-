import { Link } from 'react-router-dom'

/** 업무 바꾸기 단추 줄 (운동부 · 스포츠클럽 · 소위원회 · 체육대회). 누르면 그 업무의 흐름도부터 */
const TOPICS = [
  { id: 'team', label: '운동부' },
  { id: 'club', label: '스포츠클럽' },
  { id: 'committee', label: '소위원회' },
  { id: 'sportsday', label: '체육대회' },
] as const

export default function WorkTopicSwitch({ current }: { current: (typeof TOPICS)[number]['id'] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {TOPICS.map((t) => (
        <Link key={t.id} to={`/work/${t.id}`} replace className={`btn min-h-[44px] px-1 text-[0.92rem] whitespace-nowrap ${t.id === current ? 'btn-primary' : 'btn-outline'}`}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}
