import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { canPromptInstall, currentInstallInfo, kakaoOpenExternal, onInstallPromptChange, promptInstall } from '../lib/install'

const HIDE_KEY = 'pelog.installHint.hiddenAt'
const HIDE_DAYS = 14

function hiddenRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(HIDE_KEY) ?? 0)
    return Date.now() - at < HIDE_DAYS * 86400000
  } catch {
    return false
  }
}

/**
 * 홈 화면 추가 안내.
 * - 앱 안 브라우저(카카오톡 등): 빨강. 사파리·크롬으로 다시 열게 한다 (닫을 수 없음)
 * - 아이폰·아이패드 사파리: 빨강. 홈 화면 추가 방법 (닫을 수 없음 — 7일 뒤 자료가 지워질 수 있어서)
 * - 안드로이드·PC: 부드럽게. [앱 설치] 버튼이 있으면 보여 주고, 2주 동안 숨길 수 있다
 * - 이미 홈 화면 앱으로 열렸으면: home에서는 안 보이고, help에서는 "잘 쓰고 있어요"
 */
export default function InstallGuide({ place }: { place: 'home' | 'terms' | 'help' }) {
  const [info] = useState(currentInstallInfo)
  const [canInstall, setCanInstall] = useState(canPromptInstall)
  const [hidden, setHidden] = useState(hiddenRecently)
  const [copied, setCopied] = useState(false)
  const [openSteps, setOpenSteps] = useState(false)
  useEffect(() => onInstallPromptChange(() => setCanInstall(canPromptInstall())), [])

  const url = typeof location !== 'undefined' ? location.href.split('#')[0] : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* 복사가 막힌 브라우저: 주소를 보여 주므로 길게 눌러 복사 */
    }
  }

  if (info.standalone) {
    if (place !== 'help') return null
    return (
      <section className="rounded-2xl bg-ok-light px-4 py-3 text-ok">
        <p className="font-bold">✅ 홈 화면 앱으로 쓰고 있어요. 자료가 안전하게 보관돼요.</p>
      </section>
    )
  }

  if (info.inApp) {
    return (
      <section className="space-y-2 rounded-2xl bg-danger-light px-4 py-3 text-danger" role="alert">
        <p className="font-extrabold">{info.inApp} 안에서 열렸어요</p>
        <p className="text-[0.95rem] font-semibold">
          여기에 넣은 자료는 쉽게 사라져요. <b>{info.platform === 'ios' ? '사파리' : '크롬'}</b>로 다시 열어 주세요.
        </p>
        {info.inApp === '카카오톡' ? (
          <a className="btn btn-danger w-full" href={kakaoOpenExternal(url)}>
            다른 브라우저로 열기
          </a>
        ) : (
          <p className="text-[0.95rem]">오른쪽 위나 아래의 ⋯ 메뉴 → '다른 브라우저로 열기'를 누르세요.</p>
        )}
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white/70 px-2 py-1 text-sm text-ink">{url}</code>
          <button type="button" className="btn btn-outline min-h-[40px] px-3 text-sm" onClick={copy}>
            {copied ? '복사됨' : '주소 복사'}
          </button>
        </div>
      </section>
    )
  }

  if (info.platform === 'ios') {
    if (place === 'home' && !openSteps) {
      return (
        <button type="button" className="flex w-full items-center gap-3 rounded-2xl bg-danger-light px-4 py-3 text-left text-danger" onClick={() => setOpenSteps(true)}>
          <span className="flex-1">
            <b className="block">홈 화면에 추가해 주세요</b>
            <span className="text-sm font-semibold">사파리로만 쓰면 자료가 지워질 수 있어요</span>
          </span>
          <span className="shrink-0 text-sm font-extrabold">방법 보기 ›</span>
        </button>
      )
    }
    return (
      <section className="space-y-2 rounded-2xl bg-danger-light px-4 py-3 text-danger" role="alert">
        <p className="font-extrabold">아이폰·아이패드는 홈 화면에 추가해 주세요</p>
        <p className="text-[0.95rem] font-semibold">사파리로만 쓰면 7일 동안 안 열었을 때 자료가 지워질 수 있어요.</p>
        <ol className="list-decimal space-y-1 pl-5 text-[0.95rem] text-ink">
          <li>
            사파리 아래쪽(아이패드는 위쪽)의 <b>공유 버튼</b> <span aria-hidden>⬆︎</span>을 누르세요
          </li>
          <li>
            목록을 내려 <b>'홈 화면에 추가'</b> → <b>추가</b>
          </li>
          <li>
            이제 홈 화면의 <b>PE LOG 아이콘</b>으로 여세요
          </li>
        </ol>
        <p className="text-sm text-ink-2">
          홈 화면 앱은 사파리와 자료를 따로 보관해요. 사파리에서 이미 자료를 넣었다면 [백업]으로 파일을 받고 홈 화면 앱에서 [복원]하세요.
        </p>
      </section>
    )
  }

  if (place === 'home' && hidden) return null
  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()))
    } catch {
      /* 저장이 막힌 브라우저: 이번만 숨긴다 */
    }
    setHidden(true)
  }

  if (place === 'home') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-light py-2 pr-1 pl-4">
        <Icon name="download" size={20} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1 text-[0.95rem] font-bold text-brand-ink">
          {info.platform === 'android' ? '홈 화면에 앱으로 설치하면 더 안전해요' : '이 PC에 앱으로 설치할 수 있어요'}
        </span>
        {canInstall ? (
          <button type="button" className="btn btn-primary min-h-[40px] px-3 text-sm" onClick={() => void promptInstall()}>
            설치
          </button>
        ) : (
          <Link to="/more/terms" className="btn btn-ghost min-h-[40px] px-2 text-sm text-brand">
            방법
          </Link>
        )}
        <button type="button" className="btn btn-ghost min-h-[40px] px-2 text-ink-3" aria-label="2주 동안 안 보기" onClick={hide}>
          <Icon name="close" size={18} />
        </button>
      </div>
    )
  }

  // 안드로이드·PC 설치 안내는 동의한 뒤 홈에서 한 줄로 보여 준다 (처음 화면은 동의 버튼에 집중)
  if (place === 'terms') return null

  return (
    <section className="space-y-2 rounded-2xl bg-brand-light px-4 py-3">
      <p className="font-extrabold text-brand-ink">{info.platform === 'android' ? '홈 화면에 앱으로 설치하세요' : '이 PC에 앱으로 설치할 수 있어요'}</p>
      <p className="text-[0.95rem] text-ink-2">
        {info.platform === 'android'
          ? '설치하면 인터넷이 없어도 바로 열리고, 자료도 더 안전하게 보관돼요.'
          : '교무실 공용 PC라면 설치하지 말고 쓰지도 마세요. 내 PC에서만 쓰세요.'}
      </p>
      {canInstall ? (
        <button type="button" className="btn btn-primary w-full" onClick={() => void promptInstall()}>
          앱으로 설치
        </button>
      ) : (
        <p className="text-[0.95rem] text-ink">
          {info.platform === 'android'
            ? "크롬 오른쪽 위 ⋮ 메뉴 → '앱 설치' 또는 '홈 화면에 추가'를 누르세요."
            : '주소창 오른쪽의 설치 아이콘(⊕)이나 브라우저 메뉴 → \'앱 설치\'를 누르세요.'}
        </p>
      )}
    </section>
  )
}
