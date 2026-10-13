import { useState } from 'react'
import { APP_NAME, Logo } from '../components/Brand'
import InstallGuide from '../components/InstallGuide'
import PageHeader from '../components/PageHeader'
import { TERMS_ITEMS, TERMS_VERSION } from '../lib/terms'
import { useApp } from '../state/AppContext'

function TermsList() {
  return (
    <ol className="space-y-3">
      {TERMS_ITEMS.map((t, i) => (
        <li key={t.title} className={`card space-y-2 ${t.important ? 'ring-2 ring-danger/40' : ''}`}>
          <p className={`text-[1.05rem] font-extrabold ${t.important ? 'text-danger' : ''}`}>
            {i + 1}. {t.title}
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-ink-2">
            {t.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

/** 처음 켰을 때(또는 안내가 바뀌었을 때) 한 번 읽고 동의하는 화면 */
export function TermsGate() {
  const { updateSettings } = useApp()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const agree = async () => {
    setBusy(true)
    await updateSettings({ termsAgreed: { version: TERMS_VERSION, at: Date.now() } })
  }
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 p-5 pt-[calc(env(safe-area-inset-top)+20px)]">
      <Logo size={56} />
      <div>
        <h1 className="text-[1.6rem] font-black">{APP_NAME} 쓰기 전에</h1>
        <p className="hint">꼭 알아야 할 것 6가지예요. 1~2분이면 읽어요.</p>
      </div>
      <InstallGuide place="terms" />
      <TermsList />
      <label className="card flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span className="font-bold">위 내용을 읽었고, 자료는 제가 백업하고 관리할게요.</span>
      </label>
      <button type="button" className="btn btn-primary w-full text-lg" disabled={!checked || busy} onClick={agree}>
        동의하고 시작하기
      </button>
      <p className="hint pb-6 text-center">이 안내는 [더보기 → 이용 안내]에서 다시 볼 수 있어요.</p>
    </main>
  )
}

/** 더보기 → 이용 안내 (다시 읽기) */
export default function TermsPage() {
  const { settings } = useApp()
  const at = settings.termsAgreed?.at
  return (
    <>
      <PageHeader title="이용 안내" back />
      <div className="page space-y-4 pb-8">
        <InstallGuide place="help" />
        <TermsList />
        {at && <p className="hint text-center">{new Date(at).toLocaleDateString('ko-KR')}에 확인했어요.</p>}
      </div>
    </>
  )
}
