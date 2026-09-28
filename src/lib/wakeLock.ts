import { useEffect } from 'react'

/** 타이머가 도는 동안 화면이 꺼지지 않게 한다 (Wake Lock API). 지원하지 않는 브라우저에서는 조용히 넘어간다. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        /* 배터리 절약 모드 등 */
      }
    }
    // 다른 앱에 갔다 오면 잠금이 풀리므로 다시 건다
    const onVis = () => document.visibilityState === 'visible' && void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => {})
    }
  }, [active])
}
