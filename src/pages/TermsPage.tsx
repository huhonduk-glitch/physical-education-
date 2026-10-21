import { useState } from 'react'
import ActionBar from '../components/ActionBar'
import { APP_NAME, Logo } from '../components/Brand'
import InstallGuide from '../components/InstallGuide'
import PageHeader from '../components/PageHeader'
import { TERMS_ITEMS, TERMS_VERSION } from '../lib/terms'
import { useApp } from '../state/AppContext'

function TermsBody({ body }: { body: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-ink-2">
      {body.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  )
}

function TermsList() {
  return (
    <ol className="space-y-3">
      {TERMS_ITEMS.map((t, i) => (
        <li key={t.title} className={`card space-y-2 ${t.important ? 'ring-2 ring-danger/40' : ''}`}>
          <p className={`text-[1.05rem] font-extrabold ${t.important ? 'text-danger' : ''}`}>
            {i + 1}. {t.title}
          </p>
          <TermsBody body={t.body} />
        </li>
      ))}
    </ol>
  )
}

/** 처음 화면용: 제목만 한 줄씩 보이고 눌러서 펼친다 (6개를 다 펼치면 동의 버튼이 두 화면 아래로 밀려서) */
function TermsFolded() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ol className="card overflow-hidden p-0">
      {TERMS_ITEMS.map((t, i) => (
        <li key={t.title} className="border-t border-line first:border-t-0">
          <button
            type="button"
            aria-expanded={open === i}
            className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fill"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${t.important ? 'bg-danger-light text-danger' : 'bg-fill text-ink-2'}`}>{i + 1}</span>
            <b className={`min-w-0 flex-1 ${t.important ? 'text-danger' : ''}`}>{t.title}</b>
            <span className={`shrink-0 text-ink-3 transition-transform ${open === i ? 'rotate-90' : ''}`} aria-hidden>
              ›
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-4">
              <TermsBody body={t.body} />
            </div>
          )}
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
    <>
      <main className="mx-auto min-h-dvh max-w-md space-y-4 p-5 pt-[calc(env(safe-area-inset-top)+20px)]">
        <Logo size={56} />
        <div>
          <h1 className="text-[1.6rem] font-black">{APP_NAME} 쓰기 전에</h1>
          <p className="hint">꼭 알아야 할 것 6가지예요. 빨간 2가지는 꼭 눌러서 읽어 주세요.</p>
        </div>
        <InstallGuide place="terms" />
        <TermsFolded />
        <p className="hint text-center">이 안내는 [더보기 → 이용 안내]에서 다시 볼 수 있어요.</p>
      </main>
      {/* 동의 체크·버튼은 화면 아래에 고정 (예전에는 안내 6개 아래, 화면 밖에 있었음) */}
      <ActionBar edge>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-1">
          <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span className="font-bold">위 내용을 읽었고, 자료는 제가 백업하고 관리할게요.</span>
        </label>
        <button type="button" className="btn btn-primary w-full text-lg" disabled={!checked || busy} onClick={agree}>
          동의하고 시작하기
        </button>
      </ActionBar>
    </>
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
