/**
 * 세특 문장 검사 (6-5 ③). 순수 함수. 인터넷 안 씀.
 * 근거: 「2026학년도 학교생활기록부 기재요령(고등학교)」 교육부훈령 제555호 — 총칙 3~5(23~24쪽), 글자 수(과목별 세특 500자).
 * 앱이 기재요령을 새로 지어내지 않는다. 낱말로 '의심되는 곳'을 찾아 알려 줄 뿐이고, 판단은 교사가 한다.
 */

export interface CheckHit {
  id: string
  level: 'error' | 'warn' | 'info'
  title: string
  /** 근거 (기재요령 쪽·항목) */
  basis: string
  /** 걸린 낱말 */
  words: string[]
}

export const SETEUK_MAX_CHARS = 500

/** 나이스 글자 수 셈: 글자 수(공백 포함)와 바이트(한글 3 · 영문/숫자/공백 1 · 줄바꿈 2) */
export function countText(text: string): { chars: number; bytes: number } {
  let bytes = 0
  for (const ch of text.replace(/\r/g, '')) bytes += ch === '\n' ? 2 : /[\u0000-\u007f]/.test(ch) ? 1 : 3
  return { chars: [...text.replace(/\r/g, '')].length, bytes }
}

interface Rule {
  id: string
  level: CheckHit['level']
  title: string
  basis: string
  re: RegExp
}

const P = '기재요령 23~24쪽'
/** 어떤 항목에도 기재할 수 없는 사항 (총칙 3) + 학교를 알 수 있는 내용 (총칙 4) */
const RULES: Rule[] = [
  { id: 'lang-test', level: 'error', title: '공인어학시험 · 한자시험', basis: `${P} 3-가`, re: /TOEIC|TOEFL|TEPS|HSK|JPT|JLPT|DELF|DALF|TORFL|DELE|토익|토플|텝스|한자능력검정|한자급수|실용한자|상무한검/gi },
  { id: 'contest', level: 'error', title: '대회 참여 · 수상 실적', basis: `${P} 3-나 (교내대회는 '수상경력'에만)`, re: /대회|수상(?!\s*(스포츠|안전|레저|구조|인명))|입상|금상|은상|동상(?!이몽)|대상\s*(수상|을\s*받)|최우수상|우수상|장려상/g },
  { id: 'rank', level: 'warn', title: '순위 · 우승 (대회라면 기재 불가)', basis: `${P} 3-나 — 수업 중 경기 결과라면 괜찮아요`, re: /준?우승|[0-9]+위(?![가-힣])/g },
  { id: 'outside-award', level: 'error', title: '교외상 · 표창 · 감사장 · 공로상', basis: `${P} 3-다`, re: /표창|감사장|공로상|교외상/g },
  { id: 'cert', level: 'error', title: '인증시험 · 자격증', basis: `${P} 3-라, 파`, re: /인증시험|자격증|급수\s*취득|[0-9]+급\s*(취득|합격)/g },
  { id: 'mock', level: 'error', title: '모의고사 · 학력평가 성적', basis: `${P} 3-마`, re: /모의고사|모의평가|학력평가|전국연합/g },
  { id: 'paper', level: 'error', title: '논문 · 학회 발표', basis: `${P} 3-바`, re: /논문|학회|학술지|학술대회/g },
  { id: 'book', level: 'error', title: '도서 출간', basis: `${P} 3-사`, re: /출간|출판|저서|책을\s*(냄|펴냄|발간)/g },
  { id: 'ip', level: 'error', title: '특허 · 지식재산권', basis: `${P} 3-아`, re: /특허|실용신안|상표\s*(출원|등록)|지식재산/g },
  { id: 'abroad', level: 'error', title: '어학연수 · 해외 활동', basis: `${P} 3-자`, re: /어학연수|해외\s*(봉사|활동|연수|캠프)|유학/g },
  { id: 'parents', level: 'warn', title: '부모 · 친인척 언급 (사회·경제적 지위 암시 금지)', basis: `${P} 3-차`, re: /아버지|어머니|부모님|부친|모친|아빠|엄마|삼촌|이모|고모|할아버지|할머니/g },
  { id: 'scholar', level: 'error', title: '장학생 · 장학금', basis: `${P} 3-카`, re: /장학/g },
  { id: 'univ', level: 'error', title: '특정 대학명 · 기관명 · 상호명 · 강사명', basis: `${P} 3-타`, re: /[가-힣A-Za-z]{2,}대학교|학원|과외|인강|인터넷\s*강의/g },
]

/** 학교를 알 수 있는 내용 (총칙 4): 학교 이름과 줄임말 */
function schoolWords(schoolName: string): string[] {
  const n = schoolName.replace(/\s+/g, '').replace(/\(.*?\)/g, '')
  if (!n) return []
  const base = n.replace(/(고등학교|중학교|초등학교|학교)$/, '')
  const out = new Set([n])
  if (base && base !== n) {
    if (/고등학교$/.test(n)) {
      out.add(`${base}고`)
      // 삼성여자고등학교 → 삼성여고, ○○남자고등학교 → ○○남고
      if (/(여자|남자)$/.test(base)) out.add(`${base.slice(0, -1)}고`)
    }
    if (/중학교$/.test(n)) out.add(`${base}중`)
  }
  return [...out].filter((w) => w.length >= 2)
}

export function checkSeteuk(text: string, opts: { schoolName?: string; maxChars?: number } = {}): CheckHit[] {
  const hits: CheckHit[] = []
  const max = opts.maxChars ?? SETEUK_MAX_CHARS
  const { chars } = countText(text)
  if (chars > max) hits.push({ id: 'length', level: 'error', title: `${max}자를 넘었어요 (${chars}자)`, basis: '기재요령: 과목별 세부능력 및 특기사항 500자', words: [] })
  for (const r of RULES) {
    const words = [...new Set([...text.matchAll(r.re)].map((m) => m[0].trim()))]
    if (words.length) hits.push({ id: r.id, level: r.level, title: r.title, basis: r.basis, words })
  }
  const school = schoolWords(opts.schoolName ?? '').filter((w) => text.replace(/\s+/g, '').includes(w))
  if (school.length) hits.push({ id: 'school', level: 'error', title: '학교를 알 수 있는 내용', basis: '기재요령 23쪽 4 (학교명 · 재단명 · 축제명 · 별칭 등)', words: school })
  // 참고: 기호 · 영문 줄임말 (나이스 입력 오류나 읽기 어려움)
  const sym = [...new Set(text.match(/[~※★☆♥♡◆■□▶→←#@$%^&*+=<>|\\{}[\]]|[😀-🙏]/gu) ?? [])]
  if (sym.length) hits.push({ id: 'symbol', level: 'warn', title: '특수 기호', basis: '참고 (나이스 입력 · 읽기)', words: sym })
  return hits
}

/** AI 도움을 받았을 때 최종 입력 전에 교사가 확인할 것 (기재요령 24쪽 5-다 ※) */
export const AI_CONFIRM_ITEMS = [
  '학생이 실제로 한 활동만 적었어요 (허위 없음)',
  '사실보다 부풀리지 않았어요 (과장 없음)',
  '제가 직접 관찰·평가한 내용을 바탕으로 썼어요',
  '기재요령 유의사항(금지 사항 · 글자 수)을 확인했어요',
] as const

/** 교사가 AI 문장을 얼마나 고쳤는지: 0~1 (글자 단위 편집 거리 / 긴 쪽 길이). 0이면 그대로 */
export function editRatio(a: string, b: string): number {
  const x = [...a]
  const y = [...b]
  if (!x.length && !y.length) return 0
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[y.length] / Math.max(x.length, y.length)
}
