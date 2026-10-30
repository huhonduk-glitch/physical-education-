import { useEffect, useState } from 'react'
import Collapse from '../../components/Collapse'
import { SAMPLE_STYLE } from '../../data/seteukStyleSample'
import { AiError, CLAUDE_MODEL, loadRouterModels, type AiSettings, type RouterModel } from '../../lib/aiPolish'
import { countText } from '../../lib/seteukCheck'
import { useApp } from '../../state/AppContext'

/** 세특 AI 연결 · 내 문체 예시 (6-5 ③). 키는 이 기기에만 */
export function aiSettingsOf(st: { aiProvider: AiSettings['provider']; claudeApiKey: string; openrouterApiKey: string; openrouterModel: string; seteukStyle: string }): AiSettings {
  return { provider: st.aiProvider, claudeApiKey: st.claudeApiKey, openrouterApiKey: st.openrouterApiKey, openrouterModel: st.openrouterModel, styleExamples: st.seteukStyle }
}

export default function AiSetupCard({ readOnly }: { readOnly: boolean }) {
  const { settings, updateSettings } = useApp()
  const [claude, setClaude] = useState(settings.claudeApiKey)
  const [router, setRouter] = useState(settings.openrouterApiKey)
  const [style, setStyle] = useState(settings.seteukStyle)
  const [models, setModels] = useState<RouterModel[] | null>(null)
  const [onlyFree, setOnlyFree] = useState(true)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => setClaude(settings.claudeApiKey), [settings.claudeApiKey])
  useEffect(() => setRouter(settings.openrouterApiKey), [settings.openrouterApiKey])
  useEffect(() => setStyle(settings.seteukStyle), [settings.seteukStyle])
  const p = settings.aiProvider
  const sub =
    p === 'claude'
      ? `Claude (${CLAUDE_MODEL}) ${settings.claudeApiKey ? '· 키 넣음' : '· 키 없음'}`
      : p === 'openrouter'
        ? `OpenRouter · ${settings.openrouterModel || '모델 고르기 전'}`
        : '키 없이 — 무료 챗봇에 복사해서 쓰기'
  const loadModels = async () => {
    setErr('')
    try {
      setModels(await loadRouterModels())
    } catch (e) {
      setErr(e instanceof AiError ? e.message : '모델 목록을 불러오지 못했어요.')
    }
  }
  const shown = (models ?? []).filter((m) => (!onlyFree || m.free) && (!q.trim() || `${m.id} ${m.name}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 40)
  return (
    <Collapse title="AI 연결 · 내 문체 예시" sub={sub}>
      <div className="space-y-3">
        <div className="segment" role="radiogroup" aria-label="AI 연결 방법">
          {(
            [
              ['manual', '키 없이(무료)'],
              ['openrouter', 'OpenRouter'],
              ['claude', 'Claude'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={p === k} onClick={() => updateSettings({ aiProvider: k })} disabled={readOnly}>
              {l}
            </button>
          ))}
        </div>
        {p === 'manual' && <p className="hint">편집 창에서 [요청문 복사] → 무료 챗봇(ChatGPT · Gemini · Claude 등 웹사이트)에 붙여 넣기 → 받은 답을 다시 붙여 넣어요. 앱은 인터넷을 쓰지 않아요.</p>}
        {p === 'claude' && (
          <div className="space-y-2">
            <input className="field font-mono text-sm" type="password" autoComplete="off" value={claude} placeholder="sk-ant-…" onChange={(e) => setClaude(e.target.value)} disabled={readOnly} aria-label="Claude API 키" />
            <button type="button" className="btn btn-primary w-full" onClick={() => updateSettings({ claudeApiKey: claude.trim() })} disabled={readOnly || claude.trim() === settings.claudeApiKey}>
              키 저장
            </button>
            <p className="hint">모델: {CLAUDE_MODEL}. 쓴 만큼 선생님 Anthropic 계정에 요금이 나가요.</p>
          </div>
        )}
        {p === 'openrouter' && (
          <div className="space-y-2">
            <input className="field font-mono text-sm" type="password" autoComplete="off" value={router} placeholder="sk-or-…" onChange={(e) => setRouter(e.target.value)} disabled={readOnly} aria-label="OpenRouter 키" />
            <button type="button" className="btn btn-primary w-full" onClick={() => updateSettings({ openrouterApiKey: router.trim() })} disabled={readOnly || router.trim() === settings.openrouterApiKey}>
              키 저장
            </button>
            <p className="text-sm font-bold">지금 모델: {settings.openrouterModel || '없음'}</p>
            {!models ? (
              <button type="button" className="btn btn-soft w-full" onClick={loadModels}>
                모델 목록 불러오기
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <input className="field flex-1" value={q} placeholder="찾기 (예: claude, gemini)" onChange={(e) => setQ(e.target.value)} />
                  <button type="button" className="chip" aria-pressed={onlyFree} onClick={() => setOnlyFree(!onlyFree)}>
                    무료만
                  </button>
                </div>
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {shown.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${settings.openrouterModel === m.id ? 'bg-brand-light ring-2 ring-brand' : 'bg-fill'}`}
                        onClick={() => updateSettings({ openrouterModel: m.id })}
                        disabled={readOnly}
                      >
                        <b>{m.name}</b>
                        <span className="block text-ink-3">{m.free ? '무료 · 하루 사용량 제한 · 입력 내용이 학습에 쓰일 수 있음' : `100만 토큰당 입력 $${m.inPrice.toFixed(2)} · 출력 $${m.outPrice.toFixed(2)}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {err && <p className="font-bold text-danger">{err}</p>}
          </div>
        )}
        <p className="hint">키는 이 기기에만 저장되고 백업 파일에도 들어가지 않아요. 공용 PC에는 넣지 마세요.</p>
        <label className="block">
          <span className="label">내 문체 예시 (선생님이 잘 쓴 세특 몇 개 · 학생 이름은 빼고)</span>
          <textarea className="field min-h-[120px] py-3 text-sm" value={style} onChange={(e) => setStyle(e.target.value)} disabled={readOnly} placeholder="AI가 문장 구성 · 어휘 · 길이만 참고해요. 예시의 내용은 가져오지 않아요." />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-soft" onClick={() => setStyle(style.trim() ? style : SAMPLE_STYLE)} disabled={readOnly || !!style.trim()}>
            앱 예시 넣어 보기
          </button>
          <button type="button" className="btn btn-primary" onClick={() => updateSettings({ seteukStyle: style })} disabled={readOnly || style === settings.seteukStyle}>
            예시 저장 ({countText(style).chars}자)
          </button>
        </div>
        <p className="hint">앱 예시는 가상 학생 글이에요. 선생님이 직접 쓴 잘된 세특 2~5개(학생 이름은 빼고)로 바꿔 넣으면 AI가 선생님 문체로 써요. 예시는 이 기기에만 저장돼요.</p>
      </div>
    </Collapse>
  )
}
