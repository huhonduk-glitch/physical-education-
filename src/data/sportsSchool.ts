import type { GuideSource, SportGuide } from './sports'

/**
 * 학교에서 만든 종목 (2026-11-02, 교사 요청 "검색해서 찾아서 너가 넣어").
 * 빅발리볼 · 플레이트 야구는 국제 연맹 규칙서가 없고 공개된 협회 규정집도 찾지 못했다. 그래서 대회 · 수업을 다룬 보도와
 * 교사 수업 자료에서 같게 나오는 내용만 넣고, 자료마다 다른 값(코트 폭 · 네트 높이 · 공 무게)은 다르다고 밝힌다.
 * [ ] = 근거 자료 이름. 대회에 나갈 때는 그 대회 요강을 따른다.
 */

const HANSAN: GuideSource = { label: '한산신문 — 학생들을 위한 뉴스포츠, 빅발리볼! (충렬여고 학생기자, 2023-06-09)', edition: '2023', url: 'http://www.hansannews.com/news/articleView.html?idxno=84126' }
const IDOMIN: GuideSource = { label: '경남도민일보 — 밀양교육장배 빅발리볼대회 성황 (2024-12-23)', edition: '2024', url: 'https://www.idomin.com/news/articleView.html?idxno=927347' }
const GN_BLOG: GuideSource = { label: '경상남도 블로그 「괜찮네 경남」 — 누구나 안전하게 재밌게 즐길 수 있는 빅발리볼 (2023-12)', edition: '2023', url: 'https://www.welfarehello.com/community/hometownNews/1ea3131e-19b3-4322-b806-115bc2158adc' }
const VFUN: GuideSource = { label: '발리볼FUN — 빅발리볼 규칙 정리 (2026-06)', edition: '2026', url: 'https://volleyball-fun.com/big-volleyball-tips/' }

const H = '한산신문'
const D = '경남도민일보'
const B = '경남 블로그'
const V = '발리볼FUN'

const BIGVOLLEYBALL: SportGuide = {
  id: 'bigvolleyball',
  name: '빅발리볼',
  emoji: '🏐',
  group: 'net',
  summary: '지름 50 cm 가벼운 큰 공, 배드민턴 코트 · 낮은 네트, 5번 안에 넘기기',
  sections: [
    {
      title: '한눈에 보기',
      lead: '배구공보다 훨씬 크고 가벼운 공으로, 배드민턴 코트에서 하는 배구예요. 5번 안에 넘기면 돼요.',
      items: [
        { t: '한 팀 6명이 코트에 서요. 교체 선수까지 12명까지 등록해요.', ref: H },
        { t: '공을 5번 안에 상대 코트로 넘겨요(배구는 3번). 랠리가 길게 이어져요.', ref: `${H} · ${D}` },
        { t: '로테이션(자리 돌기)이 없어요.', ref: H },
        { t: '공식 국제 규칙서가 없는 학교 종목이라 대회마다 요강이 조금씩 달라요. 경기 전에 우리 반 규칙을 정해 두세요.', ref: '앱 안내' },
      ],
    },
    {
      title: '역사',
      items: [
        { t: '2016년 밀양여고 김석태 선생님이 배구 · 배드민턴 · 킨볼의 좋은 점을 모아 만들었어요.', ref: `${D} · ${B}` },
        { t: '2017년 밀양교육지원청 학교스포츠클럽대회 종목이 되었고, 2019년부터 전국학교스포츠클럽대회 시범 종목으로 열렸어요.', ref: `${H} · ${B}` },
      ],
    },
    {
      title: '경기장 · 공',
      specs: [
        { label: '코트', value: '배드민턴 복식 코트 13.4 m × 6.1 m', ref: `${B} · ${D}` },
        { label: '네트 높이', value: '1.55 m (초 · 여중) ~ 1.75 m (남고)', ref: `${H} · ${B}` },
        { label: '공', value: '지름 약 50 cm · 약 200 g', ref: `${H} · ${V}` },
      ],
      items: [
        { t: '네트 높이는 부별로 달라요: 남초 · 여초 · 여중 1.55 m, 남중 · 여고 1.65 m, 남고 1.75 m. 1.55 m 하나로 적은 자료도 있어요.', ref: `${B} · ${H}` },
        { t: '코트를 13.4 m × 3.1 m로 적은 자료도 있어요. 보통은 배드민턴 복식 코트를 그대로 써요.', ref: `${H} · ${B}` },
        { t: '공은 배구공의 약 두 배 크기로 아주 가벼워요(300 g으로 적은 기사도 있어요). 천장까지 5 m 이상 비어 있어야 해요.', ref: `${H} · ${D}` },
      ],
    },
    {
      title: '서브 · 득점',
      items: [
        { t: '서브는 배드민턴 서브 라인 뒤에서 언더핸드로 넣어요. 공을 던져 올리지 않고 손에 든 채, 네트보다 낮은 곳에서 쳐요.', ref: `${V} · ${B}` },
        { t: '공이 상대 코트에 떨어지거나 상대가 반칙하면 1점이에요.', ref: H },
        { t: '세트는 15점을 먼저, 2점 차로 이겨야 해요. 14 : 14면 2점 차가 날 때까지 하되 17점에서 끝내요.', ref: H },
        { t: '2세트를 먼저 따면 이겨요(3세트제). 타임아웃은 세트마다 1번.', ref: H },
      ],
    },
    {
      title: '반칙',
      items: [
        { t: '같은 사람이 공을 연달아 두 번 치기.', ref: H },
        { t: '5번 안에 상대 코트로 넘기지 못하기.', ref: H },
        { t: '서브로 넘어온 공을 첫 번째 터치에서 오버핸드로 바로 넘기기(언더핸드는 괜찮아요).', ref: `${H} · ${V}` },
        { t: '공이 아직 우리 쪽에 절반 넘게 있을 때 네트 위로 손을 뻗어 치기(상대가 넘긴 공을 막는 블로킹은 괜찮아요).', ref: `${H} · ${V}` },
        { t: '경기 중 몸이 네트에 닿기 · 공이나 사람이 지주대(기둥)에 닿기.', ref: `${H} · ${V}` },
      ],
    },
  ],
  sources: [HANSAN, IDOMIN, GN_BLOG, VFUN],
  bracket: {
    formats: '📊 리그전 또는 🏅 조별+토너먼트',
    scoreMode: '3세트제',
    points: { win: 3, draw: 0, loss: 0 },
    pointsNote: '많이 쓰는 방식 (빅발리볼 요강에 승점은 없어요)',
    scorer: false,
    notes: ['세트는 15점 · 2점 차 · 17점 상한, 2세트 먼저(한산신문 2023). 수업 시간이 짧으면 1세트로 정해도 돼요.'],
  },
  scoreSteps: [1],
}

const EBS: GuideSource = { label: "EBS 뉴스 — '굴리는 야구'로 살린 야구의 재미, 플레이트 야구 (2016-06-08)", edition: '2016', url: 'https://www.youtube.com/watch?v=xiiYWE0V1A4' }
const PREZI: GuideSource = { label: '플레이트 야구 이해하기 (교사 수업 자료, Prezi, 2026-03)', edition: '2026', url: 'https://prezi.com/p/scn_byen2eve/presentation/' }
const E = 'EBS'
const Z = '수업 자료'

const PLATEBASEBALL: SportGuide = {
  id: 'platebaseball',
  name: '플레이트 야구',
  emoji: '⚾',
  group: 'field',
  summary: '투수(우리 편)가 굴린 공이 경사판에서 튀어 오르면 쳐요, 최대 2루까지',
  sections: [
    {
      title: '한눈에 보기',
      lead: '투수가 공을 던지지 않고 바닥으로 굴려요. 홈 앞의 경사판(플레이트)을 타고 튀어 오른 공을 타자가 쳐요.',
      items: [
        { t: '투수는 공격하는 우리 팀 사람이에요. 그래서 치기 좋게 굴려 주고, 타자는 잘 치기만 하면 돼요.', ref: `${E} · ${Z}` },
        { t: '공이 날아오지 않아 무섭지 않고, 공에 맞을 걱정이 적어요. 야구를 처음 하는 학생도 공을 쳐서 달려 볼 수 있어요.', ref: E },
        { t: '학교에서 만든 수업 종목이라 공식 규칙서가 없어요. 아래는 많이 쓰는 방식이니, 경기 전에 우리 반 규칙을 정하세요.', ref: '앱 안내' },
      ],
    },
    {
      title: '경기장 · 용구 · 진행',
      specs: [
        { label: '용구', value: '플레이트(경사판) · 티볼 공 · 티볼 배트 또는 라켓', ref: Z },
        { label: '인원', value: '한 팀 9~10명', ref: Z },
        { label: '이닝', value: '3~5이닝 (시간 제한도 가능)', ref: Z },
      ],
      items: [
        { t: '루는 1 · 2 · 3루와 홈. 공이 부드러운 티볼 공이어야 안전해요.', ref: Z },
        { t: '공수 교대는 3아웃제 또는 모두 한 번씩 치는 전원 타격제 가운데 정해요.', ref: Z },
      ],
    },
    {
      title: '스트라이크 · 아웃',
      items: [
        { t: '스트라이크: 치지 않음 · 헛스윙 · 굴린 공이 플레이트를 벗어남 · 파울. 3번이면 삼진 아웃이에요(2스트라이크 뒤 파울도 스트라이크).', ref: Z },
        { t: '친 공을 땅에 닿기 전에 잡으면 아웃(플라이 아웃).', ref: Z },
        { t: '꼭 가야 하는 주자보다 공을 가진 수비가 루를 먼저 밟으면 아웃(포스 아웃).', ref: Z },
        { t: '그렇지 않은 주자는 공을 든 손이나 글러브로 건드려야 아웃(태그 아웃).', ref: Z },
      ],
    },
    {
      title: '주루 · 안전',
      items: [
        { t: '홈런이 아니면 한 번에 최대 2루까지만 가요.', ref: Z },
        { t: '1 · 2 · 3루 · 홈을 순서대로 밟아요. 홈런도 모든 루를 밟아야 인정돼요.', ref: Z },
        { t: '슬라이딩 · 태클 · 부딪히기 · 세게 태그하기는 금지예요.', ref: Z },
      ],
    },
  ],
  sources: [EBS, PREZI],
  bracket: { formats: '🏆 토너먼트 또는 📊 리그전', scoreMode: '단일 점수', points: { win: 2, draw: 1, loss: 0 }, pointsNote: '많이 쓰는 방식', scorer: false, notes: ['3~5이닝 또는 시간 제한으로 정해요.'] },
  scoreSteps: [1],
}

export const SCHOOL: SportGuide[] = [BIGVOLLEYBALL, PLATEBASEBALL]
