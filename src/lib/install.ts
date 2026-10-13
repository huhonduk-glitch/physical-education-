/**
 * 이 기기에서 앱이 어떻게 열렸는지 알아본다 (홈 화면 추가 안내용).
 * - 아이폰·아이패드 사파리는 홈 화면에 추가하지 않은 사이트의 저장 자료를 7일 동안 안 쓰면 지울 수 있다.
 * - 카카오톡·네이버 같은 앱 안 브라우저는 자료가 쉽게 사라지고 홈 화면 추가도 안 된다.
 * 판단만 하는 순수 함수라 테스트할 수 있다. 실제 기기 값은 currentInstallInfo()가 넣는다.
 */
export type Platform = 'ios' | 'android' | 'desktop'

export interface InstallInfo {
  platform: Platform
  /** 홈 화면(설치된 앱)으로 열렸나 */
  standalone: boolean
  /** 앱 안 브라우저 이름 (카카오톡 등). 아니면 null */
  inApp: string | null
}

const IN_APP: [RegExp, string][] = [
  [/KAKAOTALK/i, '카카오톡'],
  [/NAVER\(inapp|NAVER\//i, '네이버 앱'],
  [/DaumApps/i, '다음 앱'],
  [/BAND\//i, '밴드'],
  [/Instagram/i, '인스타그램'],
  [/FBAN|FBAV/i, '페이스북'],
  [/Line\//i, '라인'],
  [/everytimeApp/i, '에브리타임'],
]

export function detectInstall(ua: string, maxTouchPoints: number, standalone: boolean): InstallInfo {
  const inApp = IN_APP.find(([re]) => re.test(ua))?.[1] ?? null
  // 아이패드(iPadOS 13 이상)는 맥처럼 보이지만 터치가 된다
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)
  const platform: Platform = ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop'
  return { platform, standalone, inApp }
}

export function currentInstallInfo(): InstallInfo {
  if (typeof window === 'undefined') return { platform: 'desktop', standalone: false, inApp: null }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return detectInstall(navigator.userAgent, navigator.maxTouchPoints ?? 0, standalone)
}

/** 카카오톡 안에서 열렸을 때 바깥 브라우저로 여는 주소 (카카오톡이 지원하는 방식) */
export function kakaoOpenExternal(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
}

/* ── 안드로이드·PC 크롬의 [앱 설치] 버튼 ─────────────────────────────
 * 브라우저가 'beforeinstallprompt'를 한 번만 보내므로 앱이 켜질 때부터 받아 둔다(main.tsx에서 불러옴). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function listenInstallPrompt(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    listeners.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((f) => f())
  })
}

export function canPromptInstall(): boolean {
  return deferred !== null
}

export function onInstallPromptChange(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

/** [앱 설치]를 누르면 브라우저 설치 창을 띄운다. 설치하면 true */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  await ev.prompt()
  const { outcome } = await ev.userChoice
  listeners.forEach((f) => f())
  return outcome === 'accepted'
}
