import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { useApp } from '../state/AppContext'

const GROUPS: { title: string; items: { to: string; label: string; desc: string; icon: IconName; tone: string }[] }[] = [
  {
    title: '수업 관리',
    items: [
      { to: '/more/assessments', label: '수행평가 채점표', desc: '평가 만들기 · 반별 채점 · 엑셀', icon: 'clipboard', tone: 'bg-brand-light text-brand' },
      { to: '/more/keywords', label: '세특 키워드', desc: '키워드 사전 · 근거 엑셀', icon: 'tag', tone: 'bg-ok-light text-ok' },
      { to: '/more/captains', label: '체육부장', desc: '지정 · 교체 이력 · 활동 체크', icon: 'medal', tone: 'bg-caution-light text-caution' },
      { to: '/more/absences', label: '견학 · 열외', desc: '견학 목록 · 대체 과제', icon: 'bandage', tone: 'bg-fill-2 text-ink-2' },
      { to: '/students/summary', label: '반 요약', desc: '미준비·솔선수범 상위 · 미측정자', icon: 'list', tone: 'bg-brand-light text-brand' },
    ],
  },
  {
    title: '앱',
    items: [
      { to: '/more/data', label: '백업 · 학년도', desc: '백업 · 복원 · 새 학년도 · 전체 삭제', icon: 'database', tone: 'bg-danger-light text-danger' },
      { to: '/more/settings', label: '설정', desc: '학교 · 시간표 · 버튼 · PIN · 연동 앱', icon: 'settings', tone: 'bg-fill-2 text-ink-2' },
    ],
  },
]

export default function MorePage() {
  const { lock } = useApp()
  return (
    <>
      <PageHeader title="더보기" />
      <div className="page space-y-5 pb-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <p className="mb-2 px-1 text-sm font-bold text-ink-3">{g.title}</p>
            <div className="card overflow-hidden p-0">
              {g.items.map((m) => (
                <Link key={m.to} to={m.to} className="list-row min-h-[68px] hover:bg-fill">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${m.tone}`}>
                    <Icon name={m.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{m.label}</span>
                    <span className="hint block truncate">{m.desc}</span>
                  </span>
                  <Icon name="chevronRight" className="text-ink-3" />
                </Link>
              ))}
            </div>
          </section>
        ))}
        <button type="button" className="card flex min-h-[60px] w-full items-center gap-3 font-bold" onClick={lock}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">
            <Icon name="lock" size={20} />
          </span>
          지금 잠그기
        </button>
        <p className="hint text-center">학생 정보는 이 기기 안에만 저장돼요 · 인터넷으로 보내지 않아요</p>
      </div>
    </>
  )
}
