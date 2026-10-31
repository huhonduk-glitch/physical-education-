import type { GuideSource, SportGuide } from './sports'

/**
 * 체육 플레이북(kimju.kr/pe-textbook)에 있고 PE LOG에 없던 종목 (2026-10-31 교사 요청: 참고해서 발전시켜 작성).
 * 규칙 숫자 · 내용은 공식 규칙서 원문을 받아 읽고 확인했다. [ ] 안은 그 규칙서 조항. 기술 · 전술 · 안전은 sportsCoaching.ts.
 */
const IHF: GuideSource = { label: 'IHF 핸드볼 경기 규칙 (Rules of the Game — Indoor Handball)', edition: '2025-07-01', url: 'https://www.federhandball.it/wp-content/uploads/2025/07/Regolamento-tecnico-di-giuoco-2025-inglese.pdf' }
const IFF: GuideSource = { label: 'IFF 플로어볼 경기 규칙 (Rules of the Game)', edition: '2026', url: 'https://www.floorball.sport/wp-content/uploads/2026/02/Rules-of-the-Game-2026-with-all-changes-260209.pdf' }
const ITF: GuideSource = { label: 'ITF 테니스 규칙 (Rules of Tennis) — 테니스캐나다 2026 규정집에 실린 판', edition: '2026', url: 'https://assets.tenniscanada.com/production/Rules-of-the-Court-2026.pdf' }
const WBSC: GuideSource = { label: 'WBSC 공식 야구 규칙 (Official Rules of Baseball)', edition: '2025-2026', url: 'https://static.wbsc.org/uploads/federations/0/cms/documents/d3d36a7c-4a8a-1cca-adc1-d4edff1efc30.pdf' }
const WIKI = (name: string, page: string): GuideSource => ({ label: `위키백과(영문) — ${name}`, edition: '역사 참고', url: `https://en.wikipedia.org/wiki/${page}` })

const HANDBALL: SportGuide = {
  id: 'handball',
  name: '핸드볼',
  emoji: '🤾',
  group: 'invasion',
  summary: '7명씩, 손으로 패스해 골에 던져 넣기, 3걸음 · 3초, 골 에어리어는 골키퍼만',
  sections: [
    {
      title: '한눈에 보기',
      lead: '손으로 공을 주고받아 상대 골에 던져 넣는 경기예요. 공을 들고는 3걸음 · 3초까지만 돼요.',
      items: [
        { t: '코트에는 한 팀 7명(골키퍼 1명 포함)까지 들어가요.', ref: '4:1' },
        { t: '16세 이상은 30분씩 전반 · 후반을 해요.', ref: '2:1' },
        { t: '손 · 팔 · 머리 · 몸통 · 허벅지 · 무릎으로 공을 다룰 수 있어요(무릎 아래로는 안 돼요).', ref: '7:1 · 7:8' },
      ],
    },
    { title: '역사', items: [{ t: '19세기 말 북유럽(덴마크 · 독일 · 스웨덴)에서 지금 모습이 만들어졌어요. 1972년 뮌헨 올림픽부터 실내 핸드볼이 정식 종목이에요.' }] },
    {
      title: '경기장 · 공',
      lead: '코트는 40 m × 20 m, 골 앞 6 m 안은 골 에어리어예요.',
      specs: [
        { label: '코트', value: '40 m × 20 m', ref: '1:1' },
        { label: '골 에어리어', value: '골에서 6 m', ref: '1:4' },
        { label: '공(성인 남)', value: '둘레 58~60 cm · 425~475 g (3호)', ref: '3:2' },
      ],
      items: [{ t: '공은 나이 · 성별에 따라 크기가 달라요. 학교에서는 작고 가벼운 공을 써요.', ref: '3:2' }],
    },
    {
      title: '주요 규칙',
      lead: '공을 들고 있을 때: 3초, 3걸음. 골 에어리어에는 골키퍼만.',
      items: [
        { t: '공을 3초 넘게 들고 있으면 안 돼요(바닥에 놓여 있어도).', ref: '7:2' },
        { t: '공을 들고 3걸음까지만 움직여요. 드리블한 뒤 다시 잡으면 또 3걸음 · 3초.', ref: '7:3 · 7:4' },
        { t: '골 에어리어(선 포함)에는 골키퍼만 들어가요. 공격수가 들어가면 상대 골키퍼 공, 수비가 들어가 이득을 보면 프리 스로 · 7 m 던지기.', ref: '6:1 · 6:2' },
        { t: '골키퍼는 골 에어리어 안에서는 몸 어디로든 공을 막을 수 있어요.', ref: '5:1' },
      ],
    },
    {
      title: '반칙과 벌칙',
      items: [
        { t: '손을 펴서 상대 손의 공을 쳐 내는 것은 돼요. 상대 손에서 공을 잡아채거나 때려 빼앗는 것은 반칙이에요.', ref: '8:1 · 8:2' },
        { t: '팔 · 손 · 다리로 막거나 밀기, 잡기는 반칙이에요. 굽힌 팔로 몸을 맞대고 따라가는 것은 돼요.', ref: '8:1 · 8:2' },
        { t: '반칙이 거듭되면 경고 → 2분 퇴장 → 실격 순으로 벌칙이 커져요.', ref: '8:3 · 16' },
        { t: '확실한 골 기회를 반칙으로 막으면 7 m 던지기예요.', ref: '14:1' },
      ],
    },
  ],
  sources: [IHF, WIKI('핸드볼', 'Handball')],
  bracket: { formats: '📊 리그전 또는 🏆 토너먼트', scoreMode: '단일 점수', points: { win: 2, draw: 1, loss: 0 }, pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)', scorer: true, notes: ['수업에서는 전 · 후반 10분 안팎으로 줄여요.'] },
}

const FLOORBALL: SportGuide = {
  id: 'floorball',
  name: '플로어볼',
  emoji: '🏑',
  group: 'invasion',
  summary: '6명씩, 구멍 뚫린 공을 스틱으로, 스틱은 허리 아래 · 몸싸움 없음',
  sections: [
    {
      title: '한눈에 보기',
      lead: '가벼운 스틱과 구멍 뚫린 플라스틱 공으로 하는 실내 하키예요. 스틱을 높이 들지 않고, 상대 몸 · 스틱을 치지 않아요.',
      items: [
        { t: '한 팀 6명(골키퍼 1명 포함)까지 뛰어요.', ref: '301' },
        { t: '20분씩 3피리어드, 사이 10분 쉬어요.', ref: '201' },
        { t: '골키퍼는 스틱 없이 골 앞 구역에서 손으로 막아요.', ref: '303 · 403' },
      ],
    },
    { title: '역사', items: [{ t: '1970년대 스웨덴에서 플라스틱 스틱 · 공으로 시작했어요. 1986년 국제플로어볼연맹(IFF)이 생겼어요.' }] },
    {
      title: '경기장',
      specs: [{ label: '링크', value: '40 m × 20 m, 둘레를 낮은 판으로 둘러요', ref: '101' }],
      items: [{ t: '학교에서는 체육관 크기에 맞춰 줄이고, 판이 없으면 선으로 대신해요.' }],
    },
    {
      title: '반칙 (프리 히트)',
      lead: '플로어볼의 핵심: 스틱은 낮게, 몸싸움 없이.',
      items: [
        { t: '상대 스틱을 치거나 막거나 들어 올리거나 차기, 상대 몸을 치기.', ref: '507 1)' },
        { t: '스틱 날을 허리 위로 휘두르기(치기 전 · 친 뒤 모두).', ref: '507 3)' },
        { t: '스틱 · 발로 무릎 위에서 공을 치거나 치려 하기. 허벅지로 멈추는 것은 돼요.', ref: '507 4)' },
        { t: '어깨끼리 맞대는 것 말고 상대를 밀기, 뒤로 물러서며 막기, 잡기.', ref: '507 2) · 6) · 7)' },
        { t: '두 발이 다 뜬 채(점프) 공을 멈추기, 골키퍼 구역에 들어가기.', ref: '507 8) · 11)' },
      ],
    },
  ],
  sources: [IFF, WIKI('플로어볼', 'Floorball')],
  bracket: { formats: '📊 리그전 또는 🏆 토너먼트', scoreMode: '단일 점수', points: { win: 3, draw: 1, loss: 0 }, pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)', scorer: true, notes: ['수업에서는 피리어드를 줄이고 3대3 · 4대4로 해도 돼요.'] },
}

const TENNIS: SportGuide = {
  id: 'tennis',
  name: '테니스',
  emoji: '🎾',
  group: 'net',
  summary: '15 · 30 · 40 · 게임, 6게임 세트, 서브는 두 번 기회',
  sections: [
    {
      title: '한눈에 보기',
      lead: '공이 한 번 튀기 전이나 튄 뒤 라켓으로 넘겨요. 점수는 15 · 30 · 40 · 게임으로 불러요.',
      items: [
        { t: '점수: 0점은 러브, 1점 15, 2점 30, 3점 40, 4점이면 게임. 40-40은 듀스, 그 뒤 2점 연속으로 이겨야 게임.', ref: '5a' },
        { t: '세트는 보통 6게임을 2게임 차로 먼저 이기면 끝나고, 6-6이면 타이브레이크(7점, 2점 차)를 해요.', ref: '5b · 6' },
        { t: '공이 선에 닿으면 그 선이 둘러싼 코트 안에 들어간 거예요.', ref: '12' },
      ],
    },
    { title: '역사', items: [{ t: '19세기 영국에서 잔디 위 경기(론 테니스)로 자리 잡았어요. 1877년 첫 윔블던 대회가 열렸어요.' }] },
    {
      title: '경기장',
      specs: [
        { label: '코트', value: '길이 23.77 m · 단식 너비 8.23 m · 복식 10.97 m', ref: '1' },
        { label: '네트 높이', value: '가운데 0.914 m', ref: '1' },
      ],
      items: [{ t: '복식은 바깥쪽 복도까지 코트로 써요.', ref: '1' }],
    },
    {
      title: '서브',
      lead: '끝줄 뒤에서, 대각선 서비스 코트로. 두 번 기회가 있어요.',
      items: [
        { t: '두 발을 끝줄 뒤에 두고 서서, 공을 손으로 띄워 바닥에 닿기 전에 쳐요. 아래로 쳐도(언더핸드) 돼요.', ref: '16' },
        { t: '게임마다 오른쪽부터 시작해 점수마다 왼쪽 · 오른쪽을 번갈아, 대각선 서비스 코트에 넣어요.', ref: '17' },
        { t: '서브할 때 끝줄을 밟거나 걸어가면 풋 폴트예요.', ref: '18' },
        { t: '첫 서브가 폴트면 한 번 더(세컨드 서브). 두 번 다 폴트면 더블 폴트로 1점을 잃어요.', ref: '19 · 20 · 24' },
        { t: '서브가 네트에 닿고 맞게 들어가면 렛(다시 서브)이에요.', ref: '22' },
      ],
    },
    {
      title: '점수를 잃는 경우',
      items: [
        { t: '공이 두 번 튀기 전에 못 넘김 · 넘긴 공이 상대 코트 밖에 떨어짐.', ref: '24' },
        { t: '공이 경기 중일 때 라켓 · 몸 · 옷이 네트나 상대 코트에 닿음, 공이 네트를 넘기 전에 침.', ref: '24' },
      ],
    },
  ],
  sources: [ITF, WIKI('테니스', 'Tennis')],
  bracket: { formats: '🏆 토너먼트 또는 📊 리그전', scoreMode: '3세트제', points: { win: 2, draw: 0, loss: 1 }, pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)', scorer: false, notes: ['수업에서는 4게임 1세트나 타이브레이크(7점)만으로 줄여요.'] },
}

const BASEBALL: SportGuide = {
  id: 'baseball',
  name: '야구',
  emoji: '⚾',
  group: 'field',
  summary: '9명씩, 공격 · 수비를 번갈아, 스트라이크 3 · 볼 4 · 아웃 3',
  sections: [
    {
      title: '한눈에 보기',
      lead: '두 팀이 공격과 수비를 번갈아 해요. 공격은 공을 치고 1 · 2 · 3루를 돌아 홈을 밟으면 1점, 수비는 아웃 3개를 잡으면 공격과 바꿔요.',
      items: [
        { t: '정규 경기는 9이닝(대회에 따라 6 · 7이닝)이에요.', ref: '7.7.1' },
        { t: '한 이닝에서 아웃 3개가 되기 전에 홈을 밟아야 점수가 나요.', ref: '10.8' },
        { t: '볼 4개면 1루로 걸어 나가요(볼넷).', ref: '10.2.10' },
        { t: '스트라이크 3개면 삼진 아웃이에요.', ref: '9.10' },
      ],
    },
    { title: '역사', items: [{ t: '19세기 미국에서 지금 규칙이 자리 잡았어요. 한국에는 1905년 무렵 들어왔고, 1982년 프로야구가 시작됐어요.' }] },
    {
      title: '경기장',
      lead: '내야는 한 변 27.43 m(90피트)인 정사각형이에요.',
      specs: [
        { label: '루 사이', value: '27.43 m (90피트)', ref: '2.1.1' },
        { label: '투수판 → 홈', value: '18.44 m (60피트 6인치)', ref: '2.1' },
        { label: '홈 → 외야 끝(파울 기둥)', value: '83.82 m 이상', ref: '2.1.1' },
      ],
      items: [{ t: '어린 선수용은 루 사이 22.86 m(75피트), 투수 거리 15.54 m로 줄여요.', ref: '2.1 표' }],
    },
    {
      title: '주요 규칙',
      items: [
        { t: '친 공이 1 · 3루 선 안(페어)에 떨어져야 달릴 수 있어요. 선 밖은 파울(스트라이크 2개까지는 스트라이크로 셈).', ref: '6.26 · 6.34' },
        { t: '뜬 공을 수비가 땅에 닿기 전에 잡으면 친 사람 아웃(플라이 아웃).', ref: '9.10' },
        { t: '주자가 다음 루로 꼭 가야 하는 상황(포스)에서는 수비가 공을 갖고 그 루를 밟으면 아웃, 아니면 주자를 공으로 태그해야 아웃.', ref: '6.32 · 10.7' },
        { t: '뜬 공이 잡히면 주자는 원래 루로 돌아가 루를 밟은(태그 업) 뒤에야 뛸 수 있어요.', ref: '10.7' },
        { t: '루는 1 → 2 → 3 → 홈 순서로 밟아요.', ref: '10.1' },
      ],
    },
  ],
  sources: [WBSC, WIKI('야구', 'Baseball')],
  bracket: { formats: '🏆 토너먼트 또는 📊 리그전', scoreMode: '단일 점수', points: { win: 2, draw: 1, loss: 0 }, pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)', scorer: false, notes: ['수업에서는 3 · 5이닝이나 한 이닝 타자 수를 정해 줄여요(티볼처럼 공을 받침대에 올려도 돼요).'] },
}

export const MORE: SportGuide[] = [HANDBALL, FLOORBALL, TENNIS, BASEBALL]
