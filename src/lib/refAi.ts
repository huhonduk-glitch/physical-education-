import type { SportGuide } from '../data/sports'
import { SPORT_KEYS } from '../data/sportKeys'
import { REF_BOARDS } from '../data/refCalls'

/**
 * AI 보조심판 (2026-10-30). 순수 함수 — 요청문 만들기 · 답 읽기 · 조항 확인. 실제 호출은 aiPolish.runAi.
 * 교사 결정(기본값): AI 근거는 앱의 규칙 요약만(가). 요약에 없으면 '판단 어려움'.
 * 보내는 것: 상황 글(학생 이름 가림) · 그 종목 규칙 요약(조항 포함) · 우리 반 규칙. 학생 정보는 보내지 않는다.
 * AI가 댄 조항이 앱 자료에 없으면 '확인 필요'로 표시한다(조항을 지어내는 것 막기).
 */

export interface RefAnswer {
  verdict: string
  reason: string
  restart: string
  refs: string[]
  confidence: '높음' | '보통' | '낮음'
  /** AI 답에서 앱 자료에 없는 조항 */
  unknownRefs: string[]
  /** 규칙 요약으로 판단할 수 없다고 답함 */
  unsure: boolean
}

/** 그 종목 규칙 요약 (AI 근거): 절마다 '- 내용 [조항]' + 핵심 규칙 + 빠른 판정판 */
export function ruleDigest(g: SportGuide): string {
  const lines: string[] = []
  for (const s of g.sections) {
    if (/역사/.test(s.title)) continue
    lines.push(`## ${s.title}`)
    for (const sp of s.specs ?? []) lines.push(`- ${sp.label}: ${sp.value}${sp.ref ? ` [${sp.ref}]` : ''}`)
    for (const it of s.items) lines.push(`- ${it.t}${it.ref ? ` [${it.ref}]` : ''}`)
  }
  const k = SPORT_KEYS[g.id]
  if (k) {
    lines.push('## 핵심 규칙')
    for (const x of k.keys) lines.push(`- ${x.title}: ${x.line}${x.why ? ` ${x.why}` : ''} [${x.ref}]`)
  }
  const b = REF_BOARDS[g.id]
  if (b) {
    lines.push('## 자주 나오는 판정')
    for (const c of b.calls) lines.push(`- ${c.name}: ${c.verdict}. 다시 시작: ${c.restart} [${c.ref}]`)
  }
  return lines.join('\n')
}

/** 앱 자료에 있는 조항 낱말 (예: '규칙 17', 'Law 12', '7.1.2', '제25조') */
export function knownRefs(g: SportGuide): Set<string> {
  const raw = [
    ...g.sections.flatMap((s) => [...s.items.map((i) => i.ref), ...(s.specs ?? []).map((x) => x.ref)]),
    ...(SPORT_KEYS[g.id]?.keys.map((k) => k.ref) ?? []),
    ...(SPORT_KEYS[g.id]?.quiz.map((k) => k.ref) ?? []),
    ...(REF_BOARDS[g.id]?.calls.map((c) => c.ref) ?? []),
  ].filter(Boolean) as string[]
  const out = new Set<string>()
  for (const r of raw) for (const t of refTokens(r)) out.add(t)
  return out
}

/** 조항 글 → 비교할 낱말: '규칙 11.6 · 13' → ['11.6', '13'], 'Law 12 · 13' → ['law12', 'law13'], '제25 · 22조' → ['25', '22'] */
export function refTokens(r: string): string[] {
  const law = /law/i.test(r)
  return r
    .replace(/\(.*?\)/g, '')
    .split(/[·,/]|및|~/)
    .map((x) => x.replace(/규칙|제|조|부록|도표|기본|Law|조항|\s/gi, '').trim())
    .filter((x) => /\d/.test(x))
    .map((x) => (law ? `law${x}` : x).toLowerCase())
}

export function refPrompt(o: { sportName: string; digest: string; situation: string; houseRules?: string }): { system: string; user: string } {
  return {
    system: `당신은 한국 고등학교 체육 수업에서 ${o.sportName} 경기를 보는 교사를 돕는 보조심판입니다.
근거는 아래 '규칙 요약'(공식 규칙서를 줄인 것, [ ]는 조항)과 '우리 반 규칙'뿐입니다.
- 요약과 우리 반 규칙에 있는 내용으로만 판정합니다. 요약에 없는 세부 규칙이 필요하면 추측하지 말고 unsure를 true로 합니다.
- 우리 반 규칙이 공식 규칙과 다르면 우리 반 규칙을 따릅니다.
- refs에는 요약에 실제로 적힌 조항만 씁니다. 조항을 지어내지 않습니다.
- 학생에게 바로 말해 줄 수 있게 짧고 쉬운 한국어(해요체)로 씁니다.
- 아래 JSON 하나만 내보냅니다. 다른 글은 쓰지 않습니다.
{"verdict":"판정 한 줄","reason":"이유 1~2문장","restart":"다시 시작하는 방법","refs":["조항"],"confidence":"높음|보통|낮음","unsure":false}

<규칙 요약>
${o.digest}
</규칙 요약>`,
    user: [o.houseRules?.trim() ? `우리 반 규칙:\n${o.houseRules.trim()}` : '우리 반 규칙: 없음 (공식 규칙대로)', '', `상황: ${o.situation.trim()}`].join('\n'),
  }
}

/** AI 답 읽기: 코드 블록 · 앞뒤 글이 섞여도 JSON만 꺼낸다. 조항은 앱 자료와 맞춰 본다 */
export function parseRefAnswer(text: string, known: Set<string>): RefAnswer | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  let j: Record<string, unknown>
  try {
    j = JSON.parse(m[0])
  } catch {
    return null
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const refs = Array.isArray(j.refs) ? j.refs.map(str).filter(Boolean) : []
  const conf = str(j.confidence)
  const unknownRefs = refs.filter((r) => {
    const t = refTokens(r)
    return !t.length || t.some((x) => !known.has(x))
  })
  const verdict = str(j.verdict)
  if (!verdict) return null
  return {
    verdict,
    reason: str(j.reason),
    restart: str(j.restart),
    refs,
    confidence: conf === '높음' || conf === '낮음' ? conf : '보통',
    unknownRefs,
    unsure: j.unsure === true,
  }
}
