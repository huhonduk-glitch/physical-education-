import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BOT_FAQ, findAnswer, type BotAnswer } from '../data/botFaq'
import { db } from '../db/db'
import { AiError, maskNames, runAi } from '../lib/aiPolish'
import { botPrompt, parseBotAnswer } from '../lib/botAi'
import { todayStr } from '../lib/dates'
import { aiSettingsOf } from '../pages/seteuk/AiSetupCard'
import { useApp } from '../state/AppContext'
import { useBrief } from '../state/useBrief'

/**
 * 땅콩이 도우미 (2026-11-04 교사 요청). 그림은 교사 포트폴리오 사이트의 땅콩이쌤(교사 캐릭터).
 * 기본은 인터넷 · AI 없이 botFaq.ts 안에서만 답을 찾는다(학생 정보를 쓰지 않음). 대화는 저장하지 않는다.
 * AI 답(2026-11-13, 선택): 직접 적은 질문의 답 아래 [AI에게 물어보기]를 누를 때만, 질문(학생 이름 가림)과 사용법 목록을 교사가 연결한 AI로 보낸다(lib/botAi.ts).
 */
const BASE = import.meta.env.BASE_URL
type Msg = { from: 'me'; text: string } | { from: 'bot'; text: string; links?: BotAnswer['links']; askAi?: string; ai?: boolean }
const HELLO: Msg = { from: 'bot', text: '안녕하세요! PE LOG 도우미 땅콩이예요 🥜 궁금한 걸 적거나 아래 버튼을 눌러 주세요.' }
const QUICK = BOT_FAQ.filter((a) => a.quick)
/** 오늘 브리핑 말풍선을 본(닫은) 날 — 하루에 한 번만 먼저 말을 건다 */
const BRIEF_KEY = 'pelog.brief.day'
const seenToday = () => {
  try {
    return localStorage.getItem(BRIEF_KEY) === todayStr()
  } catch {
    return true
  }
}
const markSeen = () => {
  try {
    localStorage.setItem(BRIEF_KEY, todayStr())
  } catch {
    /* 무시 */
  }
}

export default function PeanutBot() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([HELLO])
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  // 중괄호 필수: 최신 크롬의 scrollIntoView는 Promise를 돌려줘서, 그대로 돌려주면 React가 정리 함수로 부르다 앱이 멈춘다(2026-11-14 고침)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs, open])
  // 홈 · 설정 · 사용법에만 (2026-11-04 교사 결정: 수업 중 화면에서 학생 카드 · 시간표를 가리지 않게)
  const shown = /^\/(more|help)?$/.test(pathname)
  // 오늘 브리핑 (2026-11-11): 기기 안 자료만 센다. 홈에서 하루 한 번 말풍선으로 먼저 알린다
  const brief = useBrief(shown)
  const [nudged, setNudged] = useState(seenToday)
  // AI 답 (선택): 키를 연결한 선생님만. 질문 속 학생 이름은 보내기 전에 가린다
  const { settings } = useApp()
  const ai = aiSettingsOf(settings)
  const aiReady = ai.provider === 'claude' ? !!ai.claudeApiKey : ai.provider === 'openrouter' ? !!(ai.openrouterApiKey && ai.openrouterModel) : false
  const names = useLiveQuery(async () => (open && aiReady ? (await db.students.where('schoolYear').equals(settings.schoolYear).toArray()).map((s) => s.name) : []), [open, aiReady, settings.schoolYear])
  const [busy, setBusy] = useState(false)
  if (!shown) return null
  const tellBrief = () => {
    if (!brief) return
    markSeen()
    setNudged(true)
    setOpen(true)
    setMsgs((m) => [...m, { from: 'me', text: '오늘 브리핑' }, { from: 'bot', text: brief.text, links: brief.links }])
  }
  const nudge = pathname === '/' && !open && !nudged && !!brief && brief.count > 0

  const ask = (text: string, a?: BotAnswer | null) => {
    const ans = a ?? findAnswer(text)
    setMsgs((m) => [
      ...m,
      { from: 'me', text },
      ans
        ? { from: 'bot', text: ans.text, links: ans.links, askAi: a ? undefined : text }
        : { from: 'bot', text: '음… 그건 아직 잘 모르겠어요 🥲 [사용법]에서 찾아보거나, 아래 버튼 중에서 골라 주세요.', links: [{ to: '/help', label: '사용법' }], askAi: text },
    ])
  }
  const askAi = async (question: string) => {
    if (busy) return
    setBusy(true)
    // 같은 질문을 두 번 보내지 않게 버튼을 거둔다
    setMsgs((m) => m.map((x) => (x.from === 'bot' && x.askAi === question ? { ...x, askAi: undefined } : x)))
    let out: Msg
    try {
      const a = parseBotAnswer((await runAi(ai, botPrompt(maskNames(question, names ?? [])))).text)
      out = a
        ? { from: 'bot', ai: true, text: a.text, links: a.unsure ? [{ to: '/help', label: '사용법' }] : a.links }
        : { from: 'bot', text: 'AI 답을 읽지 못했어요. 잠시 뒤 다시 해 보세요.', askAi: question }
    } catch (e) {
      out = { from: 'bot', text: e instanceof AiError ? e.message : 'AI 요청 중 문제가 생겼어요. 인터넷 연결을 확인해 주세요.', askAi: question }
    }
    setMsgs((m) => [...m, out])
    setBusy(false)
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
                  {m.ai && <p className="text-xs font-bold text-ink-3">AI 답 · 사용법을 근거로 했지만 틀릴 수 있어요</p>}
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
                  {m.askAi &&
                    (aiReady ? (
                      <button type="button" className="rounded-full border border-brand bg-white px-3 py-1 text-sm font-bold text-brand disabled:opacity-50" disabled={busy} onClick={() => askAi(m.askAi!)}>
                        AI에게 물어보기
                      </button>
                    ) : (
                      !m.links?.some((l) => l.to !== '/help') && (
                        <Link to="/seteuk/ai-guide" onClick={() => setOpen(false)} className="block text-xs text-ink-3 underline">
                          AI를 연결하면 땅콩이가 AI로도 답해요 ›
                        </Link>
                      )
                    ))}
                </div>
              ),
            )}
            {busy && <p className="w-fit rounded-2xl rounded-bl-sm bg-fill px-3 py-2 text-ink-3">AI에게 물어보는 중…</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button type="button" className="rounded-full border border-brand px-3 py-1 text-sm font-bold text-brand" onClick={tellBrief} disabled={!brief}>
                오늘 브리핑
              </button>
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
      {nudge && (
        <div className="fixed right-[4.75rem] bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-40 flex items-center gap-1 rounded-2xl rounded-br-sm bg-white py-1.5 pr-1 pl-3 shadow-[var(--shadow-float)] ring-1 ring-line md:bottom-8">
          <button type="button" className="text-sm font-bold text-brand" onClick={tellBrief}>
            오늘 브리핑 {brief.count}가지 볼까요?
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-lg text-ink-3"
            aria-label="오늘은 그만 보기"
            onClick={() => {
              markSeen()
              setNudged(true)
            }}
          >
            ×
          </button>
        </div>
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
