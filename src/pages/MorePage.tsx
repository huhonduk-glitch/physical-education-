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

const T = 'bg-brand-light text-brand'

interface MenuItem {
  to: string
  label: string
  desc?: string
  icon: IconName
  tone: string
  feature?: FeatureId
}

/**
 * 더보기 메뉴 (2026-11-04 레이아웃 정리): 하는 일로 묶는다.
 * 위 4칸(사용법 · 기능 고르기 · 백업 · 잠그기)과 하단 탭(도구의 팀 편성)에 있는 것은 목록에서 뺐다 — 같은 메뉴가 두 번 보이지 않게.
 * 설명은 짧게. 폰에서는 이름만, 넓은 화면에서는 이름 아래 한 줄.
 */
const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: '수업',
    items: [
      { to: '/plans', label: '교과 진도표', desc: '차시 계획 · 반별 진도', icon: 'calendar', tone: T, feature: 'plans' },
      { to: '/more/assessments', label: '수행평가', desc: '평가 만들기 · 채점 · 나이스', icon: 'clipboard', tone: T, feature: 'assess' },
      { to: '/seteuk/write', label: '세특 쓰기', desc: '초안 · 검사 · AI 다듬기', icon: 'edit', tone: T, feature: 'seteuk' },
      { to: '/more/keywords', label: '세특 키워드', desc: '근거 모아보기 · 사전', icon: 'tag', tone: T, feature: 'seteuk' },
      { to: '/more/captains', label: '체육부장', desc: '지정 · 활동 체크', icon: 'medal', tone: T, feature: 'captains' },
      { to: '/more/absences', label: '견학', desc: '목록 · 대체 과제', icon: 'bandage', tone: T, feature: 'absences' },
    ],
  },
  {
    title: '학생',
    items: [
      { to: '/students', label: '전체 학생 명렬', desc: '학생별 기록', icon: 'students', tone: T },
      { to: '/students/import', label: '명렬 올리기', desc: '나이스 파일 · 붙여넣기', icon: 'upload', tone: T },
      { to: '/students/summary', label: '반 요약', desc: '칭찬 · 지도 상위 · 미측정', icon: 'list', tone: T, feature: 'records' },
    ],
  },
  {
    title: '학교체육 업무',
    items: [
      { to: '/work/team', label: '학교운동부 · 학생선수', desc: '나이스 할 일 · 규정 · 양식', icon: 'medal', tone: T },
      { to: '/work/club', label: '학교스포츠클럽', desc: '등록 · 활동내역 · 학생부', icon: 'team', tone: T },
      { to: '/work/budget', label: '체육 예산 현황', desc: '에듀파인 → 구글 시트', icon: 'list', tone: T },
    ],
  },
  {
    title: '시간표 · 나이스',
    items: [
      { to: '/more/settings/timetable', label: '내 수업 시간표', desc: '요일 · 교시마다 수업반', icon: 'calendar', tone: T },
      { to: '/timetable/pe', label: '전체 체육 시간표', desc: '체육관 겹침 확인', icon: 'grid', tone: T },
      { to: '/more/settings/neis', label: '나이스에서 불러오기', desc: '학급 · 시간표 · 학사일정', icon: 'download', tone: T },
    ],
  },
  {
    title: '앱',
    items: [
      { to: '/more/settings', label: '설정', desc: '학교 · 버튼 · PIN', icon: 'settings', tone: T },
      { to: '/more/changelog', label: '업데이트 소식', desc: '새로 바뀐 기능', icon: 'bolt', tone: T },
      { to: '/more/terms', label: '이용 안내', desc: '자료 보관 · 개인정보', icon: 'lock', tone: T },
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
      <PageHeader title="더보기" wide />
      <div className="page space-y-5 pb-8 lg:max-w-[64rem]">
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

        {/* 자주 쓰는 4가지 — 백업 칸에 마지막 백업이 언제인지 같이 */}
        <div className="grid grid-cols-4 gap-2">
          <QuickTile to="/help" icon="info" label="사용법" tone={T} />
          <QuickTile onClick={() => setPick(true)} icon="grid" label="기능 고르기" tone={T} />
          <QuickTile to="/more/data" icon="database" label={backup.warn ? '백업 필요' : '백업'} sub={backup.text} warn={backup.warn} tone={backup.warn ? 'bg-danger text-white' : T} />
          <QuickTile onClick={lock} icon="lock" label="잠그기" tone={T} />
        </div>

        <div className="space-y-5 md:columns-2 md:gap-5 md:space-y-0 md:[&>section]:mb-5 md:[&>section]:break-inside-avoid">
          {GROUPS.map((g) => ({ ...g, items: g.items.filter((m) => !m.feature || featureOn(settings.features, m.feature)) }))
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.title}>
                <h2 className="mb-1.5 px-1 text-sm font-bold text-ink-3">{g.title}</h2>
                <div className="card overflow-hidden p-0">
                  {g.items.map((m) => (
                    <Link key={m.to} to={m.to} className="list-row min-h-[58px] hover:bg-fill">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.tone}`}>
                        <Icon name={m.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{m.label}</b>
                        {m.desc && <span className="hidden truncate text-sm text-ink-3 md:block">{m.desc}</span>}
                      </span>
                      <Icon name="chevronRight" size={18} className="text-ink-3" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>

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

function QuickTile({ to, onClick, icon, label, sub, warn, tone }: { to?: string; onClick?: () => void; icon: IconName; label: string; sub?: string; warn?: boolean; tone: string }) {
  const inner = (
    <>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <span className="text-[0.78rem] leading-tight font-bold text-ink-2">{label}</span>
      {sub && <span className={`-mt-1 text-[0.7rem] leading-tight font-semibold ${warn ? 'text-danger' : 'text-ink-3'}`}>{sub}</span>}
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
