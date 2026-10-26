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
  { id: 'afterschool', level: 'error', title: '방과후 활동', basis: '기재요령 (다른 항목 입력 금지 내용) · 학교 연수자료', re: /방과\s*후/g },
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

/** 기재 유의어 → 대체어 (학교 연수자료 5. 기재 유의어 → 대체어, 기재요령 기준) */
const SUBSTITUTES: { re: RegExp; to: string }[] = [
  [/구글\s*클래스룸|Google\s*Classroom|EBS\s*온라인\s*클래스/gi, '학습 플랫폼, 원격 학습 플랫폼'],
  [/구글\s*티비|Google\s*TV|유튜브|YouTube|티빙|TVING|왓챠|watcha|넷플릭스|netflix|웨이브|wavve|디즈니\s*(플러스|\+)|disneyplus/gi, '동영상 플랫폼, 동영상 공유 서비스'],
  [/구글\s*문서|Google\s*Docs/gi, '온라인 문서 편집기'],
  [/구글|Google|네이버(?!\s*웨일온)|NAVER|다음\s*포털|Daum/gi, '포털사이트'],
  [/틱톡|TikTok/gi, '엔터테인먼트 플랫폼'],
  [/개더\s*타운|Gather\s*Town|제페토|ZEPETO/gi, '메타버스 플랫폼'],
  [/미리\s*캔버스|miricanvas|망고\s*보드|mangoboard|캔바|Canva/gi, '디자인 제작 플랫폼'],
  [/블로(?=\s|$|[로를를의에])|Vllo|프리미어\s*프로|Premiere\s*Pro|파워\s*디렉터|키네\s*마스터|파이널\s*컷|Final\s*Cut/gi, '영상 제작 프로그램, 영상 편집 프로그램'],
  [/포토샵|페인트샵|김프/gi, '사진 편집 프로그램'],
  [/클래스팅|classting/gi, '학습 플랫폼, 클래스 관리 도구'],
  [/유튜버|YouTuber/gi, '동영상 크리에이터, 동영상 제공자, 개인 미디어 제작자'],
  [/카카오톡|카톡|KakaoTalk/gi, '메신저, 메신저 서비스'],
  [/인스타그램|Instagram|트위터|Twitter|페이스북|Facebook|라인(?=\s*메신저)|LINE(?=\s)|메타\s*\(구/gi, '소셜네트워크서비스'],
  [/이프랜드|ifland/gi, '메타버스 소셜커뮤니케이션서비스'],
  [/패들렛|Padlet|띵커벨|ThinkerBell|알로(?=\s|$|[로를의에])|Allo/gi, '온라인 협업 도구, 협업 플랫폼'],
  [/클래스\s*카드|classcard/gi, '온라인 단어 학습 앱'],
  [/커리어넷|careernet|워크넷|메이저맵|majormap/gi, '진로 정보망, 진로 정보 사이트'],
  [/홀랜드|Holland/gi, '직업 선호도 검사'],
  [/KTX|SRT|케이티엑스|에스알티/g, '초고속 열차, 고속 열차'],
  [/유엔|\bUN\b|유럽\s*연합|\bEU\b|\bWHO\b|\bWTO\b|OECD|\bIMF\b|유네스코|UNESCO|IAEA|NATO/g, '국제기구'],
  [/줌(?=\s*(으로|을|회의|수업))|Zoom|웨일\s*온/gi, '화상 회의'],
  [/MBTI/gi, '성격유형 검사'],
  [/\bVR\b|브이알/g, '가상현실'],
  [/\bAR\b|에이알/g, '증강현실'],
  [/HTML|에이치티엠엘/gi, '하이퍼텍스트 마크업 언어, 웹 페이지 제작 언어'],
  [/\bCSS\b|씨에스에스/g, '스타일 시트 언어'],
  [/아이패드|iPad|갤럭시\s*탭|Galaxy\s*Tab/gi, '태블릿피시'],
  [/크롬\s*북|chrome\s*book/gi, '휴대용 컴퓨터'],
  [/\bhwp\b|한글\s*프로그램|MS\s*워드|워드\s*프로그램/gi, '문서작성 프로그램'],
  [/엑셀|한셀/g, '스프레드시트'],
  [/챗\s*GPT|ChatGPT|뤼튼|빙챗|바드|하이퍼클로바\s*X|클로드|Claude|제미나이|Gemini/gi, '대화형 인공지능, 생성형 인공지능'],
  [/알트코인|비트코인/g, '가상화폐'],
  [/파이썬|Python/gi, '프로그래밍 언어'],
  [/\bTED\b|테드\s*강연/g, '온라인 강연회'],
].map(([re, to]) => ({ re: re as RegExp, to: to as string }))

/** 영문 그대로 써도 되는 일반화된 명사 (기재요령 28~30쪽 예시) */
const ALLOWED_EN = ['CEO', 'PD', 'UCC', 'IT', 'POP', 'CF', 'TV', 'PAPS', 'SNS', 'PPT', 'AI']

/** 문장 끝이 명사형(받침 ㅁ)이고 마침표로 끝나는지: 걸린 문장 끝 조각 */
function badEndings(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  const out: string[] = []
  if (!/[.]$/.test(t)) out.push(`마침표 없음: '…${t.slice(-8)}'`)
  for (const sen of t.split(/(?<=[.])\s+/)) {
    const body = sen.replace(/[.\s'’‘\])]+$/, '')
    const last = body.slice(-1)
    const code = last.charCodeAt(0) - 0xac00
    if (code >= 0 && code <= 11171 && code % 28 !== 16) out.push(`'…${body.slice(-6)}.'`)
  }
  return out.slice(0, 5)
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
  // 학교 연수자료(2026 학교생활기록부 기재요령 담임 연수, 기재요령 28~30쪽): 한글 입력 · 명사형 종결과 마침표 · 기호 최소화
  const sub = SUBSTITUTES.flatMap((x) => [...text.matchAll(x.re)].map((m) => `${m[0].trim()} → ${x.to}`))
  if (sub.length) hits.push({ id: 'substitute', level: 'error', title: '기재 유의어 (대체어로 바꿔 주세요)', basis: '기재요령 · 학교 연수자료 ‘기재 유의어 → 대체어’', words: [...new Set(sub)] })
  // 유의어로 이미 잡은 자리(예: 챗GPT)의 영문은 다시 걸지 않는다
  const spans = SUBSTITUTES.flatMap((x) => [...text.matchAll(x.re)].map((m) => [m.index!, m.index! + m[0].length] as const))
  const inSpan = (i: number) => spans.some(([a, b]) => i >= a && i < b)
  const eng = [...new Set([...text.matchAll(/[A-Za-z][A-Za-z0-9]*/g)].filter((m) => !inSpan(m.index!) && !ALLOWED_EN.includes(m[0].toUpperCase())).map((m) => m[0]))]
  if (eng.length) hits.push({ id: 'english', level: 'warn', title: '영문 입력 지양 (한글로)', basis: '기재요령 28~30쪽: 한글 입력 (허용 예: CEO, PD, UCC, IT, TV, PAPS, SNS, PPT, AI 등 일반화된 명사)', words: eng })
  const ending = badEndings(text)
  if (ending.length) hits.push({ id: 'ending', level: 'warn', title: '명사형 종결어미 · 마침표', basis: '기재요령 28~30쪽 (예: ~우수함. ~성실한 학생임.)', words: ending })
  const sym = [...new Set(text.match(/[^\p{L}\p{N}\s.,\-'‘’[\]]/gu) ?? [])]
  if (sym.length) hits.push({ id: 'symbol', level: 'warn', title: '특수 기호 (최소화)', basis: '기재요령 28~30쪽: 온점 · 쉼표 · 하이픈 · 작은따옴표 · 대괄호만', words: sym })
  if (/ {2,}/.test(text)) hits.push({ id: 'space', level: 'warn', title: '공백 두 칸', basis: '학교 연수자료: 자주 틀리는 오류', words: ['두 칸 띄어쓰기'] })
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
