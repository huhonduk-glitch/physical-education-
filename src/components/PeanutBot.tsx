import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BOT_FAQ, findAnswer, type BotAnswer } from '../data/botFaq'

/**
 * 땅콩이 도우미 (2026-11-04 교사 요청). 그림은 교사 포트폴리오 사이트의 땅콩이쌤(교사 캐릭터).
 * 인터넷 · AI 없이 botFaq.ts 안에서만 답을 찾는다(학생 정보를 쓰지 않음). 대화는 저장하지 않는다.
 */
const BASE = import.meta.env.BASE_URL
type Msg = { from: 'me'; text: string } | { from: 'bot'; text: string; links?: BotAnswer['links'] }
const HELLO: Msg = { from: 'bot', text: '안녕하세요! PE LOG 도우미 땅콩이예요 🥜 궁금한 걸 적거나 아래 버튼을 눌러 주세요.' }
const QUICK = BOT_FAQ.filter((a) => a.quick)

export default function PeanutBot() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([HELLO])
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs, open])
  // 홈 · 더보기 · 사용법에만 (2026-11-04 교사 결정: 수업 중 화면에서 학생 카드 · 시간표를 가리지 않게)
  if (!/^\/(more|help)?$/.test(pathname)) return null

  const ask = (text: string, a?: BotAnswer | null) => {
    const ans = a ?? findAnswer(text)
    setMsgs((m) => [
      ...m,
      { from: 'me', text },
      ans
        ? { from: 'bot', text: ans.text, links: ans.links }
        : { from: 'bot', text: '음… 그건 아직 잘 모르겠어요 🥲 [사용법]에서 찾아보거나, 아래 버튼 중에서 골라 주세요.', links: [{ to: '/help', label: '사용법' }] },
    ])
  }

  return (
    <>
      {open && (
        <section role="dialog" aria-label="땅콩이 도우미" className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-float)] md:bottom-24">
          <header className="flex items-center gap-2 bg-brand px-4 py-3 text-white">
            <img src={`${BASE}brand/ddangkong.webp`} alt="" className="h-9 w-9 rounded-full bg-white object-cover" />
            <b className="flex-1">땅콩이 도우미</b>
            <button type="button" className="rounded-full px-2 text-xl" aria-label="닫기" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) =>
              m.from === 'me' ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-white">
                  {m.text}
                </p>
              ) : (
                <div key={i} className="max-w-[92%] space-y-1.5 rounded-2xl rounded-bl-sm bg-fill px-3 py-2">
                  <p className="leading-relaxed whitespace-pre-line">{m.text}</p>
                  {m.links && (
                    <p className="flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-brand">
                          {l.label} ›
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
              ),
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK.map((a) => (
                <button key={a.id} type="button" className="rounded-full border border-line px-3 py-1 text-sm font-bold" onClick={() => ask(a.quick!, a)}>
                  {a.quick}
                </button>
              ))}
            </div>
            <div ref={end} />
          </div>
          <form
            className="flex gap-2 border-t border-line p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) ask(q.trim())
              setQ('')
            }}
          >
            <input className="field min-h-[44px] flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: PAPS 내보내기가 안 돼요" aria-label="질문" />
            <button type="submit" className="btn btn-primary px-4">
              묻기
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        aria-label="땅콩이 도우미 열기"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white shadow-[var(--shadow-float)] ring-2 ring-brand active:scale-95 md:bottom-6"
      >
        <img src={`${BASE}brand/ddangkong.webp`} alt="" className="h-full w-full object-cover" />
      </button>
    </>
  )
}
