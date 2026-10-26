/**
 * 세특 AI 다듬기(윤문) — 6-5 ③ (교사 결정 2026-10-26: 교사 초안 + AI 윤문, 이름 포함, 선생님 Claude API 키).
 * 이 파일만 인터넷(Anthropic API)을 쓴다. 교사가 [AI로 다듬기]를 누를 때만, 그 학생의 이름 · 과목 · 초안 글을 보낸다.
 * 키는 이 기기 설정에만 있고 백업 파일에도 넣지 않는다.
 * 기재요령(총칙 5-다): AI가 만든 글을 그대로 입력하면 안 된다 → 결과는 교사가 고친 뒤에만 확정할 수 있다(seteukRepo.canConfirm).
 */

export const POLISH_MODEL = 'claude-opus-5-5'

export const POLISH_SYSTEM = `당신은 한국 고등학교 체육 교사가 직접 쓴 학교생활기록부 '과목별 세부능력 및 특기사항' 초안을 다듬는(윤문) 보조입니다.
교사의 초안이 유일한 근거입니다. 다듬기만 하고 새로 쓰지 않습니다.

지킬 것:
- 초안에 있는 사실만 씁니다. 초안에 없는 활동 · 성과 · 수치 · 평가 · 성격 묘사를 더하지 않습니다. 추측하지 않습니다.
- 뜻을 바꾸거나 부풀리지 않습니다. 문장을 자연스럽게 잇고 맞춤법 · 띄어쓰기를 고칩니다. 겹치는 말은 줄입니다.
- 학생 이름은 글에 쓰지 않습니다.
- 학교생활기록부 문체로 씁니다: '~함.', '~임.', '~보임.'처럼 명사형으로 끝냅니다.
- 학교생활기록부에 쓸 수 없는 것은 넣지 않고, 초안에 있으면 빼 주세요: 대회 참여 · 수상, 공인어학시험 · 인증시험, 모의고사 성적, 논문 · 도서 출간 · 특허, 어학연수 · 해외 활동, 부모의 사회·경제적 지위 암시, 장학금, 특정 대학명 · 기관명 · 상호명 · 강사명, 학교명.
- 500자를 넘지 않습니다.
- 다듬은 글만 내보냅니다. 제목 · 설명 · 따옴표 · 머리말 없이 본문만 씁니다.`

export class PolishError extends Error {}

export async function polishSeteuk(opts: { apiKey: string; text: string; studentName?: string; subject?: string }): Promise<{ text: string; model: string }> {
  if (!opts.apiKey.trim()) throw new PolishError('Claude API 키를 먼저 넣어 주세요.')
  if (!opts.text.trim()) throw new PolishError('다듬을 초안이 비어 있어요.')
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: opts.apiKey.trim(), dangerouslyAllowBrowser: true })
  const user = [opts.studentName ? `학생: ${opts.studentName}` : '', opts.subject ? `과목: ${opts.subject}` : '', '교사 초안:', opts.text.trim()].filter(Boolean).join('\n')
  try {
    const res = await client.beta.messages.create({
      model: POLISH_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // 정책 거절 시 서버가 알아서 다른 모델로 이어 받게 한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: POLISH_SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    if (res.stop_reason === 'refusal') throw new PolishError('AI가 이 글을 다듬지 못했어요. 선생님이 직접 고쳐 주세요.')
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim()
    if (!text) throw new PolishError('AI가 빈 글을 돌려줬어요. 잠시 뒤 다시 해 보세요.')
    return { text, model: res.model }
  } catch (e) {
    if (e instanceof PolishError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new PolishError('API 키가 맞지 않아요. 키를 다시 확인해 주세요.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new PolishError('이 키로는 쓸 수 없어요(권한). Anthropic 콘솔에서 확인해 주세요.')
    if (e instanceof Anthropic.RateLimitError) throw new PolishError('요청이 많아요. 잠시 뒤 다시 해 보세요.')
    if (e instanceof Anthropic.APIConnectionError) throw new PolishError('인터넷에 연결되지 않았어요. 연결을 확인해 주세요.')
    if (e instanceof Anthropic.APIError) throw new PolishError(`AI 요청이 실패했어요 (${e.status ?? '?'}). 잠시 뒤 다시 해 보세요.`)
    throw new PolishError('AI 요청 중 문제가 생겼어요.')
  }
}
