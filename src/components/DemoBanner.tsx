import { useState } from 'react'
import { db } from '../db/db'
import { demoUrl, exitDemo, IS_DEMO } from '../lib/demo'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

const BASE = import.meta.env.BASE_URL

/**
 * 시연 모드 표시 (늘 화면 위에). 눌러서 시연 주소 복사 · 처음 상태로 · 시연 끝내기.
 * 실제 앱(시연 모드가 아닐 때)에서는 아무것도 그리지 않는다.
 */
export default function DemoBanner() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!IS_DEMO) return null
  const url = demoUrl(location.origin, BASE)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* 복사가 막힌 브라우저: 아래 주소를 길게 눌러 복사 */
    }
  }
  const reset = async () => {
    if (!confirm('시연 자료를 처음 상태로 되돌릴까요? 시연하며 바꾼 내용이 지워져요. (실제 학생 자료는 건드리지 않아요)')) return
    setBusy(true)
    db.close()
    await db.delete() // 시연 저장소(pe-records-demo)만 지운다 → 다시 열면 가상 자료를 새로 넣는다
    location.reload()
  }
  return (
    <>
      {/* 화면 맨 위 얇은 띠 (제목·버튼을 가리지 않게 흐름 안에 둔다) */}
      <button
        type="button"
        className="flex min-h-[40px] w-full items-center justify-center gap-2 bg-[#eb6834] px-4 pt-[env(safe-area-inset-top)] text-sm font-extrabold text-white print:hidden"
        onClick={() => setOpen(true)}
        aria-label="시연 모드 · 가상 학생 자료. 눌러서 메뉴 열기"
      >
        🎬 시연 모드 · 가상 학생 자료
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">메뉴</span>
      </button>
      {open && (
        <BottomSheet title="시연 모드" sub="가상 학생 · 가상 기록" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-[0.95rem] text-ink-2">
              <li>
                지금 보이는 학생·기록은 모두 <b>지어낸 가상 자료</b>예요. 학교 이름도 &lsquo;시연고등학교 (가상)&rsquo;이에요.
              </li>
              <li>
                시연 모드는 <b>실제 자료와 따로 보관</b>돼요. 여기서 무엇을 눌러도 실제 학생 자료는 바뀌지 않아요.
              </li>
              <li>시연용 PIN은 0000이에요. 이 탭을 닫으면 시연 모드가 끝나요(가상 자료는 다음 시연을 위해 남아요).</li>
            </ul>
            <div className="rounded-2xl bg-fill p-3">
              <p className="label">다른 선생님께 보낼 시연 주소</p>
              <p className="text-sm break-all text-ink select-all">{url}</p>
              <button type="button" className="btn btn-soft mt-2 w-full bg-white" onClick={() => void copy()}>
                <Icon name="copy" /> {copied ? '복사했어요' : '주소 복사'}
              </button>
            </div>
            <button type="button" className="btn btn-soft w-full" disabled={busy} onClick={() => void reset()}>
              <Icon name="reset" /> 가상 자료 처음 상태로
            </button>
            <button type="button" className="btn btn-primary w-full" onClick={() => exitDemo(BASE)}>
              시연 끝내기 (실제 앱으로)
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
