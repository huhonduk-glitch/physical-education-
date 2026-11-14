import { BOT_FAQ, type BotAnswer } from '../data/botFaq'

/**
 * 땅콩이 AI 답 (2026-11-13 교사 '2번 세 개 다'). 순수 함수 — 요청문 · 답 읽기. 실제 호출은 aiPolish.runAi.
 * 준비된 답(botFaq)에서 못 찾았거나 답이 모자랄 때, 교사가 [AI에게 물어보기]를 누를 때만 쓴다.
 * 보내는 것: 질문 글(이 학년도 학생 이름은 '학생'으로 가림) · 앱 사용법 답 목록(botFaq — 학생 정보 없음). 기기 자료는 보내지 않는다.
 * AI 근거는 답 목록만 — 목록에 없으면 '모름'. 바로가기는 AI가 고른 답 번호의 것만(주소를 지어내지 못하게).
 */

export interface BotAiAnswer {
  text: string
  links: NonNullable<BotAnswer['links']>
  /** 답 목록으로 답할 수 없다고 함 */
  unsure: boolean
}

/** 앱 사용법 요약 (AI 근거): 답마다 '[id] 글' */
export function botDigest(faq: readonly BotAnswer[] = BOT_FAQ): string {
  return faq.map((a) => `[${a.id}] ${a.text.replace(/\n/g, ' ')}`).join('\n')
}

export function botPrompt(question: string, faq: readonly BotAnswer[] = BOT_FAQ): { system: string; user: string } {
  const system = `당신은 체육교사용 앱 'PE LOG'의 도우미 '땅콩이'입니다. 아래 <사용법>에 있는 내용만 근거로 선생님 질문에 답합니다.
지킬 것:
- <사용법>에 없는 기능 · 메뉴 · 버튼 · 규정을 지어내지 않습니다. 근거가 없으면 unsure를 true로 하고, answer에 "그건 사용법에 없어서 잘 모르겠어요."라고 씁니다.
- 앱 사용법이 아닌 질문(일반 상식 · 다른 프로그램 등)도 unsure를 true로 합니다.
- 쉬운 해요체 한국어로 3~5문장 이내. 순서가 있으면 ① ② ③으로 씁니다.
- ids에는 답의 근거로 쓴 사용법 항목의 대괄호 이름을 넣습니다(최대 3개).
- JSON 하나만 내보냅니다: {"answer": "...", "ids": ["..."], "unsure": false}`
  return { system, user: `<사용법>\n${botDigest(faq)}\n</사용법>\n\n<질문>\n${question.trim().slice(0, 500)}\n</질문>` }
}

/** AI 답 읽기: JSON을 꺼내고, 바로가기는 고른 답 항목에 실제로 있는 것만 */
export function parseBotAnswer(raw: string, faq: readonly BotAnswer[] = BOT_FAQ): BotAiAnswer | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  let j: { answer?: unknown; ids?: unknown; unsure?: unknown }
  try {
    j = JSON.parse(m[0])
  } catch {
    return null
  }
  const text = typeof j.answer === 'string' ? j.answer.trim() : ''
  if (!text) return null
  const ids = Array.isArray(j.ids) ? j.ids.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/[[\]\s]/g, '')) : []
  const links: BotAiAnswer['links'] = []
  for (const id of ids.slice(0, 3)) {
    for (const l of faq.find((a) => a.id === id)?.links ?? []) if (!links.some((x) => x.to === l.to) && links.length < 4) links.push(l)
  }
  const unsure = j.unsure === true
  return { text, links: unsure ? [] : links, unsure }
}
