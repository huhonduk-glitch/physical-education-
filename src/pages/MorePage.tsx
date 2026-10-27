import { IS_DEMO } from '../lib/demo'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo, MakerCredit } from '../components/Brand'
import FeatureSheet from '../components/FeatureSheet'
import Icon, { type IconName } from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { backupOverdue } from '../db/backup'
import type { FeatureId } from '../db/settings'
import { featureOn } from '../lib/features'
import { useApp } from '../state/AppContext'

interface MenuItem {
  to: string
  label: string
  desc?: string
  icon: IconName
  tone: string
  feature?: FeatureId
}

/** 더보기 메뉴: 하는 일 순서대로 묶는다 (수업 → 학생 → 앱 설정 → 도움) */
const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: '수업',
    items: [
      { to: '/plans', label: '교과 진도표', desc: '차시 계획 · 날짜 자동 · 반별 진도', icon: 'calendar', tone: 'bg-brand-light text-brand', feature: 'plans' },
      { to: '/more/assessments', label: '수행평가', desc: '평가 만들기 · 채점 · 나이스 파일', icon: 'clipboard', tone: 'bg-brand-light text-brand', feature: 'assess' },
      { to: '/seteuk/write', label: '세특 쓰기', desc: '초안 · 기재요령 검사 · AI 다듬기 · 확정', icon: 'edit', tone: 'bg-brand-light text-brand', feature: 'seteuk' },
      { to: '/more/keywords', label: '세특 키워드', desc: '근거 모아보기 · 키워드 사전', icon: 'tag', tone: 'bg-brand-light text-brand', feature: 'seteuk' },
      { to: '/tools/apps', label: '팀 편성 · 전술 보드', desc: '반 명단 보내기', icon: 'share', tone: 'bg-brand-light text-brand', feature: 'apps' },
      { to: '/more/captains', label: '체육부장', desc: '지정 · 활동 체크', icon: 'medal', tone: 'bg-brand-light text-brand', feature: 'captains' },
      { to: '/more/absences', label: '견학', desc: '견학 목록 · 대체 과제', icon: 'bandage', tone: 'bg-brand-light text-brand', feature: 'absences' },
    ],
  },
  {
    title: '학생',
    items: [
      { to: '/students', label: '전체 학생 명렬', desc: '학적반별 명단 · 학생별 기록', icon: 'students', tone: 'bg-brand-light text-brand' },
      { to: '/students/import', label: '명렬 올리기', desc: '나이스 파일 · 붙여넣기', icon: 'upload', tone: 'bg-brand-light text-brand' },
      { to: '/students/summary', label: '반 요약', desc: '미준비 · 칭찬 상위 · 미측정', icon: 'list', tone: 'bg-brand-light text-brand', feature: 'records' },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { to: '/more/settings', label: '설정', desc: '학교 · 버튼 · PIN · 연동 앱', icon: 'settings', tone: 'bg-brand-light text-brand' },
      { to: '/more/settings/timetable', label: '수업 시간표', icon: 'calendar', tone: 'bg-brand-light text-brand' },
      { to: '/timetable/pe', label: '전체 체육 시간표', desc: '학교 체육 수업 겹침 확인 (컴시간 · 나이스)', icon: 'grid', tone: 'bg-brand-light text-brand' },
      { to: '/more/settings/neis', label: '나이스에서 불러오기', desc: '학급 · 시간표 · 학사일정', icon: 'download', tone: 'bg-brand-light text-brand' },
      { to: '/more/data', label: '백업 · 학년도', desc: '백업 · 복원 · 새 학년도', icon: 'database', tone: 'bg-brand-light text-brand' },
    ],
  },
  {
    title: '도움',
    items: [
      { to: '/help', label: '사용법', desc: '하루 수업 흐름 · 자주 묻는 질문', icon: 'info', tone: 'bg-brand-light text-brand' },
      { to: '/more/changelog', label: '업데이트 소식', desc: '새로 생기고 바뀐 기능', icon: 'bolt', tone: 'bg-brand-light text-brand' },
      { to: '/more/terms', label: '이용 안내', desc: '자료 보관 · 개인정보', icon: 'lock', tone: 'bg-brand-light text-brand' },
    ],
  },
]

function backupLabel(at: number): { text: string; warn: boolean } {
  if (!at) return { text: '아직 백업 안 함', warn: true }
  const days = Math.floor((Date.now() - at) / 86400000)
  return { text: days === 0 ? '오늘 백업함' : `${days}일 전 백업`, warn: backupOverdue(at) }
}

export default function MorePage() {
  const { lock, settings } = useApp()
  const [pick, setPick] = useState(false)
  const backup = backupLabel(settings.lastBackupAt)

  return (
    <>
      <PageHeader title="더보기" />
      <div className="page space-y-5 pb-8">
        {/* 내 정보: 학교 · 학년도 · 백업 상태를 한눈에 */}
        <Link to="/more/settings" className="card flex items-center gap-3 transition-transform active:scale-[0.99]">
          <Logo size={48} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[1.1rem]">{settings.schoolName || '학교 이름을 넣어 주세요'}</b>
            <span className="hint block">
              {settings.schoolYear}학년도 · {settings.schoolLevel === '고' ? '고등학교' : settings.schoolLevel === '중' ? '중학교' : '초등학교'}
            </span>
          </span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>

        {/* 자주 쓰는 4가지 */}
        <div className="grid grid-cols-4 gap-2">
          <QuickTile to="/help" icon="info" label="사용법" tone="bg-brand-light text-brand" />
          <QuickTile onClick={() => setPick(true)} icon="grid" label="기능 고르기" tone="bg-brand-light text-brand" />
          <QuickTile to="/more/data" icon="database" label={backup.warn ? '백업 필요' : '백업'} tone={backup.warn ? 'bg-danger text-white' : 'bg-brand-light text-brand'} />
          <QuickTile onClick={lock} icon="lock" label="지금 잠그기" tone="bg-brand-light text-brand" />
        </div>
        <p className={`-mt-2 px-1 text-sm font-bold ${backup.warn ? 'text-danger' : 'text-ink-3'}`}>💾 {backup.text}</p>

        {GROUPS.map((g) => ({ ...g, items: g.items.filter((m) => !m.feature || featureOn(settings.features, m.feature)) }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.title}>
              <p className="mb-1.5 px-1 text-sm font-bold text-ink-3">{g.title}</p>
              <div className="card overflow-hidden p-0">
                {g.items.map((m) => (
                  <Link key={m.to} to={m.to} className="list-row min-h-[58px] hover:bg-fill">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.tone}`}>
                      <Icon name={m.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1 font-bold">{m.label}</span>
                    {m.desc && <span className="hidden max-w-[45%] truncate text-sm text-ink-3 sm:block">{m.desc}</span>}
                    <Icon name="chevronRight" size={18} className="text-ink-3" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

        {/* 시연 모드: 다른 선생님께 가상 학생으로 보여 주기 (실제 자료와 따로 보관) */}
        {!IS_DEMO && (
          <a href={`${import.meta.env.BASE_URL}?demo=1`} className="card flex min-h-[64px] items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
              <Icon name="play" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block">시연 모드로 열기</b>
              <span className="hint">가상 학생·수업 예시로 다른 선생님께 보여 주기 · 내 자료는 그대로</span>
            </span>
            <Icon name="chevronRight" size={18} className="text-ink-3" />
          </a>
        )}

        <p className="hint text-center">학생 정보는 이 기기 안에만 저장돼요 · 인터넷으로 보내지 않아요</p>
        <MakerCredit className="pt-2 pb-2" />
      </div>
      {pick && <FeatureSheet onClose={() => setPick(false)} />}
    </>
  )
}

function QuickTile({ to, onClick, icon, label, tone }: { to?: string; onClick?: () => void; icon: IconName; label: string; tone: string }) {
  const inner = (
    <>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <span className="text-[0.78rem] leading-tight font-bold text-ink-2">{label}</span>
    </>
  )
  const cls = 'card flex min-h-[88px] flex-col items-center justify-center gap-1.5 px-1 py-3 text-center transition-transform active:scale-[0.97]'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  )
}
