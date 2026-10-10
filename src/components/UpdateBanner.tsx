import { useRegisterSW } from 'virtual:pwa-register/react'
import Icon from './Icon'

/**
 * 새 버전 알림. 앱은 오프라인에서도 열리도록 파일을 기기에 저장해 두기 때문에,
 * 새 버전이 배포돼도 저장해 둔 옛 버전이 먼저 열린다. 새 버전이 받아지면 이 띠를 보여 주고,
 * 교사가 [업데이트]를 누르면 새 버전으로 바꿔 다시 연다.
 * 수업 중 입력이 끊기지 않도록 저절로 새로고침하지는 않는다.
 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      // 앱을 다시 볼 때마다, 그리고 30분마다 새 버전이 있는지 확인한다 (인터넷이 없으면 조용히 넘어감)
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      setInterval(check, 30 * 60 * 1000)
    },
  })


  if (!needRefresh) return null
  return (
    <div className="print:hidden anim-pop fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-[80] mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-brand px-4 py-2.5 text-white shadow-[var(--shadow-float)]" role="status">
      <Icon name="download" />
      <span className="flex-1 font-bold">새 버전이 나왔어요</span>
      <button type="button" className="btn min-h-[40px] bg-white px-4 text-brand" onClick={() => updateServiceWorker(true)}>
        업데이트
      </button>
      <button type="button" className="btn btn-ghost min-h-[40px] px-2 text-white" aria-label="나중에" onClick={() => setNeedRefresh(false)}>
        <Icon name="close" />
      </button>
    </div>
  )
}
