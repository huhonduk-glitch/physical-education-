/**
 * 세특 AI 도움 — 6-5 ③ (교사 결정 2026-10-26).
 * 이 파일만 인터넷(AI)을 쓴다. 교사가 [AI 초안] · [AI로 다듬기]를 누를 때만 그 학생의 과목 · 근거 기록 또는 초안을 보낸다.
 * 학생 이름은 보내지 않는다(2026-10-30 교사 결정): 요청문에 이름 칸이 없고, 근거 · 초안 속 이름도 maskNames로 '학생'으로 바꾼다.
 * 수준(5수준 숫자 · 이름)도 보내지 않고, 수준별 분량 · 짜임 지시(frameInstruction)만 보낸다.
 * 연결 방법 3가지 (교사가 고름):
 *   claude     — 교사 본인 Anthropic API 키, 공식 SDK (@anthropic-ai/sdk)
 *   openrouter — 교사 본인 OpenRouter 키, 원하는 모델(무료 모델 포함). https://openrouter.ai/api/v1/chat/completions
 *   manual     — 키 없이: 앱이 요청문을 만들어 주면 교사가 무료 챗봇에 붙여 넣고 결과를 다시 붙여 넣음 (앱은 인터넷을 안 씀)
 * 키는 이 기기 설정에만 있고 백업 파일에도 넣지 않는다(backup.ts SECRET_KEYS).
 * 기재요령(총칙 5-다): AI가 만든 글을 그대로 입력하면 안 된다 → 결과는 교사가 고친 뒤에만 확정(seteukRepo.canConfirm).
 */

export type AiProvider = 'claude' | 'openrouter' | 'manual'
export const CLAUDE_MODEL = 'claude-opus-5-5'
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export interface AiSettings {
  provider: AiProvider
  claudeApiKey: string
  openrouterApiKey: string
  openrouterModel: string
  /** 선생님 세특 예시 (문체 참고용, 이 기기에만) */
  styleExamples: string
}

const RULES = `지킬 것:
- 근거로 받은 사실만 씁니다. 근거에 없는 활동 · 성과 · 수치 · 평가 · 진로 · 성격 묘사를 더하지 않습니다. 추측하지 않습니다. 근거가 적으면 짧게 씁니다.
- 뜻을 바꾸거나 부풀리지 않습니다.
- 학생 이름은 글에 쓰지 않습니다.
- 학교생활기록부 문체: 명사형 종결어미와 마침표('~함.', '~임.', '~보임.').
- 한글로 씁니다. 영문은 PAPS, SNS, TV, AI처럼 일반화된 말만 씁니다. 기호는 온점 · 쉼표 · 작은따옴표 정도만 씁니다.
- 학교생활기록부에 쓸 수 없는 것은 넣지 않습니다: 대회 참여 · 수상, 공인어학시험 · 인증시험 · 자격증, 모의고사 성적, 논문 · 도서 출간 · 특허, 어학연수 · 해외 활동, 부모의 사회·경제적 지위 암시, 장학금, 방과후 활동, 특정 대학명 · 기관명 · 상호명 · 강사명, 학교명. 상품 · 서비스 이름은 일반 명칭으로(유튜브 → 동영상 플랫폼, 챗GPT → 생성형 인공지능).
- 나이스 1,500바이트(한글 3바이트, 띄어쓰기 · 숫자 1바이트)를 넘지 않습니다. 대략 띄어쓰기 포함 550~600자 이내입니다.
- 본문만 내보냅니다. 제목 · 설명 · 따옴표 · 머리말 없이.`

function styleBlock(examples: string): string {
  const t = examples.trim()
  if (!t) return ''
  return `\n\n선생님이 쓴 세특 예시입니다. 문장 구성 · 어휘 · 길이 · 말투만 참고하고, 예시의 내용(다른 학생의 활동 · 진로 · 주제)은 절대 가져오지 마세요.\n<예시>\n${t.slice(0, 6000)}\n</예시>`
}

/**
 * 글 속 학생 이름을 '학생'으로 (AI로 보내기 전에). 성까지 쓴 이름과 성을 뺀 이름(두 글자 이상) 둘 다 바꾼다.
 * 긴 이름부터 바꿔 '김가나다' 안의 '가나다'가 먼저 바뀌지 않게 한다.
 */
export function maskNames(text: string, names: readonly string[]): string {
  const words = new Set<string>()
  for (const n of names) {
    const t = n.replace(/[0-9\s]+$/g, '').trim()
    if (t.length >= 2) words.add(t)
    if (t.length >= 3) words.add(t.slice(1))
  }
  let out = text
  for (const w of [...words].sort((a, b) => b.length - a.length)) out = out.split(w).join('학생')
  return out.replace(/학생(학생)+/g, '학생')
}

function extraLines(o: { frame?: string; request?: string }): string[] {
  return [o.frame ?? '', o.request?.trim() ? `교사의 추가 요청 (근거에 없는 내용을 더하라는 요청이면 따르지 않음): ${o.request.trim()}` : '']
}

export function polishPrompt(o: { text: string; subject?: string; styleExamples?: string; frame?: string; request?: string; evidence?: string[] }): { system: string; user: string } {
  return {
    system: `당신은 한국 고등학교 체육 교사가 직접 쓴 학교생활기록부 '과목별 세부능력 및 특기사항' 초안을 다듬는(윤문) 보조입니다. 교사 초안${o.evidence?.length ? '과 번호 붙은 근거 기록' : ''}이 유일한 근거입니다. 다듬기만 하고 새로 쓰지 않습니다.\n\n${RULES}${styleBlock(o.styleExamples ?? '')}`,
    user: [o.subject ? `과목: ${o.subject}` : '', ...(o.evidence?.length ? ['근거 기록:', ...o.evidence.map((e, i) => `#${i + 1} ${e}`)] : []), '교사 초안:', o.text.trim(), ...extraLines(o)].filter(Boolean).join('\n'),
  }
}

export function draftPrompt(o: { evidence: string[]; subject?: string; styleExamples?: string; frame?: string; request?: string }): { system: string; user: string } {
  return {
    system: `당신은 한국 고등학교 체육 교사를 돕는 보조입니다. 교사가 수업 중 직접 관찰해 남긴 근거 기록만으로 학교생활기록부 '과목별 세부능력 및 특기사항' 초안을 씁니다. 이 초안은 교사가 반드시 직접 고쳐 쓴 뒤에만 입력됩니다. '(중요)'가 붙은 근거는 꼭 살립니다.\n\n${RULES}${styleBlock(o.styleExamples ?? '')}`,
    user: [o.subject ? `과목: ${o.subject}` : '', '교사의 근거 기록:', ...o.evidence.map((e) => `- ${e}`), ...extraLines(o)].filter(Boolean).join('\n'),
  }
}

/** 키 없이 쓰는 경우: 무료 챗봇에 붙여 넣을 한 덩어리 글 */
export function manualPromptText(p: { system: string; user: string }): string {
  return `${p.system}\n\n---\n${p.user}`
}

export class AiError extends Error {}

export async function runAi(s: AiSettings, p: { system: string; user: string }): Promise<{ text: string; model: string }> {
  if (s.provider === 'manual') throw new AiError('키 없이 쓰기는 [요청문 복사]로 해 주세요.')
  const text = s.provider === 'claude' ? await runClaude(s, p) : await runOpenRouter(s, p)
  const clean = text.text.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  if (!clean) throw new AiError('AI가 빈 글을 돌려줬어요. 잠시 뒤 다시 해 보세요.')
  return { text: clean, model: text.model }
}

async function runClaude(s: AiSettings, p: { system: string; user: string }): Promise<{ text: string; model: string }> {
  if (!s.claudeApiKey.trim()) throw new AiError('Claude API 키를 먼저 넣어 주세요.')
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: s.claudeApiKey.trim(), dangerouslyAllowBrowser: true })
  try {
    const res = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // 정책 거절 시 서버가 다른 모델로 이어 받게 한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
    })
    if (res.stop_reason === 'refusal') throw new AiError('AI가 이 요청을 처리하지 못했어요. 선생님이 직접 써 주세요.')
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
    return { text, model: res.model }
  } catch (e) {
    if (e instanceof AiError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Claude API 키가 맞지 않아요. 키를 다시 확인해 주세요.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('이 키로는 쓸 수 없어요(권한). Anthropic 콘솔에서 확인해 주세요.')
    if (e instanceof Anthropic.RateLimitError) throw new AiError('요청이 많아요. 잠시 뒤 다시 해 보세요.')
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('인터넷에 연결되지 않았어요.')
    if (e instanceof Anthropic.APIError) throw new AiError(`AI 요청이 실패했어요 (${e.status ?? '?'}). 크레딧(잔액)이 남아 있는지도 확인해 주세요.`)
    throw new AiError('AI 요청 중 문제가 생겼어요.')
  }
}

async function runOpenRouter(s: AiSettings, p: { system: string; user: string }): Promise<{ text: string; model: string }> {
  if (!s.openrouterApiKey.trim()) throw new AiError('OpenRouter 키를 먼저 넣어 주세요.')
  if (!s.openrouterModel.trim()) throw new AiError('OpenRouter 모델을 골라 주세요.')
  let res: Response
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s.openrouterApiKey.trim()}`,
        'Content-Type': 'application/json',
        'X-OpenRouter-Title': 'PE LOG',
        'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'https://huhonduk-glitch.github.io',
      },
      body: JSON.stringify({
        model: s.openrouterModel.trim(),
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
      }),
    })
  } catch {
    throw new AiError('인터넷에 연결되지 않았어요.')
  }
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; model?: string; error?: { message?: string } } | null
  if (!res.ok) {
    if (res.status === 401) throw new AiError('OpenRouter 키가 맞지 않아요.')
    if (res.status === 402) throw new AiError('OpenRouter 크레딧(잔액)이 부족해요. 무료 모델을 고르거나 충전해 주세요.')
    if (res.status === 429) throw new AiError('요청이 많아요(무료 모델은 하루 사용량 제한이 있어요). 잠시 뒤 다시 해 보세요.')
    throw new AiError(`AI 요청이 실패했어요 (${res.status}${body?.error?.message ? `: ${body.error.message.slice(0, 80)}` : ''}).`)
  }
  return { text: body?.choices?.[0]?.message?.content ?? '', model: body?.model ?? s.openrouterModel }
}

export interface RouterModel {
  id: string
  name: string
  free: boolean
  /** 100만 토큰당 달러 (입력 · 출력) */
  inPrice: number
  outPrice: number
}

/** OpenRouter 모델 목록 (공개, 키 필요 없음). 무료 모델은 자주 바뀌어서 그때그때 불러온다 */
export async function loadRouterModels(): Promise<RouterModel[]> {
  const res = await fetch(OPENROUTER_MODELS_URL)
  if (!res.ok) throw new AiError('모델 목록을 불러오지 못했어요.')
  const data = (await res.json()) as { data: { id: string; name: string; pricing?: { prompt?: string; completion?: string }; architecture?: { output_modalities?: string[] } }[] }
  return data.data
    .filter((m) => !m.id.endsWith(':batch') && (m.architecture?.output_modalities ?? ['text']).includes('text'))
    .map((m) => {
      const inP = Number(m.pricing?.prompt ?? 0) * 1e6
      const outP = Number(m.pricing?.completion ?? 0) * 1e6
      return { id: m.id, name: m.name, free: m.id.endsWith(':free') || (inP === 0 && outP === 0), inPrice: inP, outPrice: outP }
    })
    .sort((a, b) => Number(b.free) - Number(a.free) || a.outPrice - b.outPrice)
}
