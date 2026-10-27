import type { CourtId } from '../components/CourtDiagram'
import type { LeagueRules, SportId } from '../lib/league'

/**
 * 종목 수업자료 (6-5 ④, 2026-10-27).
 * 모든 내용은 아래 공식 규칙서를 직접 읽고 줄여 쓴 것이다(원문을 옮기지 않음). 줄마다 조항 번호를 단다.
 * 역사는 여러 자료가 같게 말하는 것만 넣었다(날짜가 엇갈리는 것은 넣지 않음).
 * 규칙이 바뀌면 이 파일과 sources의 판(edition)을 같이 고친다.
 */

export interface GuideItem {
  t: string
  /** 규칙서 조항 (예: '제8조', 'Law 11') */
  ref?: string
}
/** 규격 표 한 줄 (예: 둘레 | 750~770 mm | 장비 규정) */
export interface Spec {
  label: string
  value: string
  ref?: string
}
/** 절에 붙는 그림: 직접 그린 경기장 또는 자유 이용 사진(src/data/sportPhotos.ts 열쇠) */
export type Figure = { kind: 'court'; court: CourtId; caption: string } | { kind: 'photo'; photo: string; caption: string }

export interface GuideSection {
  title: string
  /** 수업에서 처음 꺼내는 한두 문장 */
  lead?: string
  items: GuideItem[]
  specs?: Spec[]
  figure?: Figure
}
export interface GuideSource {
  label: string
  edition: string
  url: string
}

/** 2022 개정 교육과정의 경쟁 유형으로 묶음 (2026-10-27 교사 결정: 영역 · 네트 · 필드 · 기술형) */
export type SportGroup = 'invasion' | 'net' | 'field' | 'skill'
export const SPORT_GROUPS: { id: SportGroup; name: string; desc: string }[] = [
  { id: 'invasion', name: '영역형', desc: '상대 진영으로 들어가 골 · 득점을 노려요' },
  { id: 'net', name: '네트형', desc: '네트나 정해진 공간 너머로 보내 상대가 받지 못하게 해요' },
  { id: 'field', name: '필드형', desc: '공격과 수비를 번갈아 하며 치고 달려 점수를 내요' },
  { id: 'skill', name: '기술형', desc: '정해진 동작 · 기록 · 표적에 도전해요 (동작형 · 기록형)' },
]

/** SPORTS BRACKET(교사 팀 편성 · 대진표 앱)에서 고를 설정. 이름은 그 앱 화면 글자 그대로 */
export interface BracketGuide {
  /** 대회설정 → 방식 */
  formats: string
  /** 대회설정 → 스코어 방식: 단일 점수 / 3세트제 / 5세트제 */
  scoreMode: '단일 점수' | '3세트제' | '5세트제'
  /** 리그전 승 · 무 · 패 승점 */
  points: { win: number; draw: number; loss: number }
  pointsNote: string
  /** 득점자 기록 켜기/끄기 */
  scorer: boolean
  notes: string[]
}

export interface SportGuide {
  id: SportId
  name: string
  emoji: string
  group: SportGroup
  summary: string
  /** 표지 사진 (sportPhotos 열쇠) */
  cover?: string
  sections: GuideSection[]
  sources: GuideSource[]
  bracket?: BracketGuide
  /** 예전 PE LOG 리그전 기본값 (리그전 메뉴는 2026-10-27 숨김 — 이미 만든 리그전을 보여 줄 때만) */
  league?: LeagueRules
  pointsNote?: string
  scoreSteps?: number[]
}

const FIBA: GuideSource = {
  label: 'FIBA 공식 농구 규칙 (Official Basketball Rules)',
  edition: '2024, 2024-10-01 시행 (v1.0a)',
  url: 'https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf',
}
const FIVB: GuideSource = {
  label: 'FIVB 공식 배구 규칙 (Official Volleyball Rules)',
  edition: '2025-2028',
  url: 'https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf',
}
const BWF: GuideSource = {
  label: 'BWF 배드민턴 경기 규칙 (Laws of Badminton, BWF Statutes 4.1)',
  edition: '2023-05-29 시행 v2.1',
  url: 'https://corporate.bwfbadminton.com/statutes/',
}
const IFAB: GuideSource = {
  label: 'IFAB 축구 경기 규칙 (Laws of the Game)',
  edition: '2025/26, 2025-07-01 시행',
  url: 'https://www.theifab.com/laws-of-the-game-documents/',
}
const FUTSAL: GuideSource = {
  label: 'FIFA 풋살 경기 규칙 (Futsal Laws of the Game) — 홍콩축구협회 게시본',
  edition: '2025-26, 2025-09-05 시행',
  url: 'https://resource.hkfa.com/upload//referee/LOTG%2025-26/Futsal%20Laws%20of%20the%20Game%202025_2026_EN.pdf',
}
const OLY = (sport: string, path: string): GuideSource => ({ label: `올림픽 공식 누리집 — ${sport}`, edition: '역사 참고', url: `https://www.olympics.com/en/sports/${path}/` })

export const SPORTS: SportGuide[] = [
  {
    id: 'basketball',
    group: 'invasion',
    bracket: {
      formats: '📊 리그전 또는 🏅 조별+토너먼트',
      scoreMode: '단일 점수',
      points: { win: 2, draw: 0, loss: 1 },
      pointsNote: 'FIBA 규칙 부록 D.1.1 (이기면 2 · 지면 1 · 몰수패 0)',
      scorer: true,
      notes: ['농구는 비기지 않아요. 동점이면 연장(제8조) 점수까지 넣어요.', '토너먼트도 같은 방식이에요(SPORTS BRACKET은 토너먼트 무승부를 받지 않아요).'],
    },
    name: '농구',
    emoji: '🏀',
    summary: '5명씩, 10분 4쿼터, 바스켓에 넣어 1 · 2 · 3점',
    sections: [
      {
        title: '역사',
        items: [
          { t: '1891년 미국 매사추세츠주 스프링필드의 YMCA 지도자 학교에서 체육 교사 제임스 네이스미스가 겨울에 실내에서 할 운동으로 만들었다. 처음에는 복숭아 바구니를 골대로 썼다.' },
          { t: '1936년 베를린 올림픽부터 정식 종목이다.' },
        ],
      },
      {
        title: '경기장 · 인원 · 시간',
        items: [
          { t: '코트는 길이 28 m × 너비 15 m(선 안쪽 기준).', ref: '제2조' },
          { t: '한 팀은 경기할 수 있는 선수 12명까지 등록하고, 코트에는 5명이 뛴다.', ref: '제4조' },
          { t: '10분씩 4쿼터. 4쿼터가 끝나 동점이면 승부가 날 때까지 5분 연장을 이어 한다.', ref: '제8조' },
          { t: '작전시간: 전반 2번, 후반 3번(4쿼터 마지막 2분 안에는 최대 2번), 연장마다 1번.', ref: '제18조' },
        ],
      },
      {
        title: '득점',
        items: [
          { t: '자유투 1점, 2점 구역 슛 2점, 3점 구역(3점 선 밖) 슛 3점.', ref: '제16조' },
          { t: '경기 시간이 끝났을 때 점수가 많은 팀이 이긴다.', ref: '제1조' },
        ],
      },
      {
        title: '바이얼레이션(공을 상대에게 넘김)',
        items: [
          { t: '트래블링: 공을 가진 채 규칙이 허용하는 범위를 넘어 발을 움직임(축발이 떨어진 채 공을 놓지 않음 등).', ref: '제25조' },
          { t: '더블 드리블: 드리블을 끝낸 뒤 다시 드리블. (슛한 공이나 상대가 건드린 공을 다시 잡은 경우는 괜찮음)', ref: '제24조' },
          { t: '3초: 공격 중 상대 제한구역 안에 3초 넘게 머묾.', ref: '제26조' },
          { t: '5초: 가까이 붙어 수비당하는 선수는 5초 안에 패스 · 슛 · 드리블.', ref: '제27조' },
          { t: '8초: 백코트에서 공을 잡은 팀은 8초 안에 프런트코트로.', ref: '제28조' },
          { t: '24초: 공을 잡은 팀은 24초 안에 슛을 던져 링에 닿게. 상황에 따라 14초로 다시 맞춘다.', ref: '제29조' },
          { t: '하프라인 넘어간 공을 백코트로 되돌림.', ref: '제30조' },
        ],
      },
      {
        title: '파울',
        items: [
          { t: '선수 한 명이 파울 5개면 그 경기에서 더 뛸 수 없다.', ref: '제40조' },
          { t: '팀 파울: 한 쿼터에 팀 파울 4개를 한 뒤(5번째부터)는 슛 동작이 아닌 선수에게 한 개인 파울도 자유투 2개(공을 가진 팀의 파울은 제외).', ref: '제41조' },
          { t: '파울 종류: 개인 · 더블 · 테크니컬 · 언스포츠맨라이크 · 디스퀄리파잉.', ref: '제34~38조' },
        ],
      },
      {
        title: '심판 신호 (부록 A)',
        items: [
          { t: '시계 멈춤: 손바닥을 편다 / 파울로 멈춤: 주먹을 쥔다 / 시계 시작: 손으로 자르듯 내린다.', ref: '부록 A' },
          { t: '득점: 손가락 1 · 2개를 손목으로 흔듦, 3점 시도는 손가락 3개를 한 팔로, 성공은 두 팔로.', ref: '부록 A' },
          { t: '교체: 팔뚝을 엇갈림 / 작전시간: T자를 만들고 집게손가락.', ref: '부록 A' },
          { t: '트래블링: 주먹을 돌림 / 더블 드리블: 손바닥으로 두드리는 동작 / 캐링: 손바닥 반 바퀴.', ref: '부록 A' },
          { t: '3초: 팔을 흔들고 손가락 3개 / 5초: 손가락 5개 / 8초: 손가락 8개 / 24초: 손가락을 어깨에 댐.', ref: '부록 A' },
        ],
      },
      {
        title: '순위 정하기 (부록 D)',
        items: [
          { t: '이기면 2점, 지면 1점, 몰수패는 0점.', ref: 'D.1.1' },
          { t: '같으면 그 팀들끼리 경기 결과 → 그 경기의 득실 → 득점 → 전체 득실 → 전체 득점 순. 앱 리그전 순위가 이 순서를 따른다.', ref: 'D.1.3' },
        ],
      },
    ],
    sources: [FIBA, OLY('농구', 'basketball')],
    league: { kind: 'goals', allowDraw: false, points: { win: 2, draw: 0, loss: 1, forfeit: 0 } },
    pointsNote: 'FIBA 규칙 부록 D.1.1 (승 2 · 패 1 · 몰수패 0)',
    scoreSteps: [1, 2, 3],
  },
  {
    id: 'volleyball',
    group: 'net',
    bracket: {
      formats: '📊 리그전 또는 🏅 조별+토너먼트',
      scoreMode: '3세트제',
      points: { win: 3, draw: 0, loss: 0 },
      pointsNote: '많이 쓰는 방식. 공식 경기는 5세트제(3세트 먼저, 6.3)',
      scorer: false,
      notes: ['세트 점수는 25점 · 2점 차, 마지막 세트 15점(6.2 · 6.3). 수업 시간이 짧으면 15점 세트로 미리 정해 두세요.', '세트마다 점수를 넣으면 이긴 세트 수가 경기 결과가 돼요.'],
    },
    name: '배구',
    emoji: '🏐',
    summary: '6명씩, 랠리마다 1점, 25점 세트, 3번 안에 넘기기',
    sections: [
      {
        title: '역사',
        items: [
          { t: '1895년 미국 매사추세츠주 홀리오크 YMCA의 체육 지도자 윌리엄 G. 모건이 농구보다 덜 거친 실내 운동으로 만들었다. 처음 이름은 민토네트(Mintonette).' },
          { t: '1964년 도쿄 올림픽부터 정식 종목이다.' },
        ],
      },
      {
        title: '경기장 · 인원',
        items: [
          { t: '코트는 18 m × 9 m.', ref: '1.1' },
          { t: '네트 높이: 남자 2.43 m, 여자 2.24 m.', ref: '2.1' },
          { t: '경기 중에는 언제나 한 팀 6명.', ref: '7.3.1' },
        ],
      },
      {
        title: '점수 · 세트',
        items: [
          { t: '랠리 포인트: 랠리를 이긴 팀이 1점. 서브한 팀이 이기면 계속 서브, 받은 팀이 이기면 1점을 얻고 서브권도 가져간다.', ref: '6.1' },
          { t: '세트는 25점을 먼저 내고 2점 앞서야 이긴다. 24-24면 2점 차가 날 때까지(26-24, 27-25…).', ref: '6.2' },
          { t: '3세트를 먼저 이기면 경기 승리. 2-2면 5세트는 15점(2점 차).', ref: '6.3' },
        ],
      },
      {
        title: '경기 방법 · 반칙',
        items: [
          { t: '블로킹을 빼고 팀은 3번 안에 공을 넘겨야 한다(4번이면 반칙).', ref: '9.1 · 9.3.1' },
          { t: '한 선수가 공을 연달아 두 번 칠 수 없다(블로킹 다음은 예외).', ref: '9.1.1' },
          { t: '공을 잡거나 던지면 반칙(캐치). 공은 몸 어디에 닿아도 된다.', ref: '9.2.1 · 9.2.2 · 9.3.3' },
          { t: '서브권을 새로 얻은 팀은 시계 방향으로 한 자리씩 돌고 서브한다(앞 오른쪽 선수가 뒤 오른쪽으로 가서 서브).', ref: '7.6.2 · 12.2.2.2' },
          { t: '서브는 주심의 휘슬 뒤 8초 안에.', ref: '12.4.4' },
          { t: '세트마다 작전시간 2번(30초), 선수 교체 6번까지.', ref: '15.1 · 15.4' },
        ],
      },
      {
        title: '심판 신호 (도표 11)',
        items: [
          { t: '서브 허락: 서브할 방향으로 손을 움직임 / 서브할 팀: 그쪽으로 팔을 뻗음.', ref: '도표 11-1 · 2' },
          { t: '작전시간: 한 손바닥을 다른 손 손가락 위에 대 T자 / 교체: 두 팔뚝을 서로 돌림.', ref: '도표 11-4 · 5' },
          { t: '세트(경기) 끝: 손을 편 채 가슴 앞에서 팔뚝을 엇갈림.', ref: '도표 11-9' },
          { t: '서브 지연: 손가락 8개를 폄 / 자리 · 순서 반칙: 집게손가락으로 원을 그림.', ref: '도표 11-11 · 13' },
          { t: '포 히트: 손가락 4개 / 더블 컨택트: 손가락 2개 / 공격 반칙: 손을 편 채 팔뚝을 아래로.', ref: '도표 11-17 · 18 · 21' },
          { t: '공 인: 팔과 손가락으로 바닥을 가리킴 / 동시 반칙 · 다시 하기: 두 엄지를 세움.', ref: '도표 11-14 · 23' },
        ],
      },
    ],
    sources: [FIVB, OLY('배구', 'volleyball')],
    league: { kind: 'sets', allowDraw: false, points: { win: 3, draw: 0, loss: 0, forfeit: 0, winDecider: 2, lossDecider: 1 }, setRule: { target: 25, decider: 15, winBy: 2, setsToWin: 2 } },
    pointsNote: '많이 쓰는 방식(승 3 · 마지막 세트까지 가서 이기면 2 · 지면 1). 규칙서에는 승점이 없어 교사가 바꿀 수 있어요. 수업 기본은 3판 2선승(공식은 5판 3선승)',
    scoreSteps: [1],
  },
  {
    id: 'football',
    group: 'invasion',
    bracket: {
      formats: '📊 리그전 또는 🏅 조별+토너먼트',
      scoreMode: '단일 점수',
      points: { win: 3, draw: 1, loss: 0 },
      pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)',
      scorer: true,
      notes: ['리그전은 비김을 넣을 수 있어요.', '토너먼트는 비김을 넣을 수 없어요 → 비기면 승부차기(Law 10)로 이긴 팀을 승자로 정해 넣어요.'],
    },
    name: '축구',
    emoji: '⚽',
    summary: '11명씩, 45분 두 번, 오프사이드 있음',
    sections: [
      {
        title: '역사',
        items: [{ t: '1863년 잉글랜드 축구협회(The FA)가 런던에서 첫 통일 규칙을 정했다. 지금 규칙은 국제축구평의회(IFAB)가 정한다.' }],
      },
      {
        title: '경기장 · 인원 · 시간',
        items: [
          { t: '터치라인(긴 쪽) 90~120 m, 골라인 45~90 m. 대회가 이 안에서 정한다.', ref: 'Law 1' },
          { t: '한 팀 11명까지(골키퍼 1명 포함). 7명보다 적으면 시작하거나 다시 할 수 없다.', ref: 'Law 3' },
          { t: '45분씩 두 번(대회 · 학교 경기는 미리 정해 줄일 수 있음).', ref: 'Law 7' },
        ],
      },
      {
        title: '오프사이드',
        items: [
          { t: '오프사이드 위치: 상대 진영에서, 공과 뒤에서 두 번째 상대 선수(보통 마지막 수비수)보다 상대 골라인에 더 가까이 있음. 손 · 팔은 따지지 않는다.', ref: 'Law 11' },
          { t: '그 위치에 있는 것만으로는 반칙이 아니다. 같은 팀이 공을 찬 순간 그 위치에 있다가 경기에 끼어들 때 반칙.', ref: 'Law 11' },
        ],
      },
      {
        title: '반칙 · 카드',
        items: [
          { t: '노란 카드 = 경고, 빨간 카드 = 퇴장.', ref: 'Law 12' },
          { t: '심판 신호(그림은 규칙서 Law 5): 직접 프리킥 · 간접 프리킥 · 페널티킥 · 어드밴티지 · 코너킥 · 골킥.', ref: 'Law 5' },
        ],
      },
    ],
    sources: [IFAB],
    league: { kind: 'goals', allowDraw: true, points: { win: 3, draw: 1, loss: 0, forfeit: 0 } },
    pointsNote: '많이 쓰는 방식(승 3 · 무 1 · 패 0). 경기 규칙서에는 승점이 없어 교사가 바꿀 수 있어요',
    scoreSteps: [1],
  },
  {
    id: 'futsal',
    group: 'invasion',
    bracket: {
      formats: '📊 리그전 또는 🏅 조별+토너먼트',
      scoreMode: '단일 점수',
      points: { win: 3, draw: 1, loss: 0 },
      pointsNote: '많이 쓰는 방식 (경기 규칙서에는 승점이 없어요)',
      scorer: true,
      notes: ['리그전은 비김을 넣을 수 있어요.', '토너먼트는 비김을 넣을 수 없어요 → 비기면 승부차기(Law 10)로 이긴 팀을 승자로 정해 넣어요.'],
    },
    name: '풋살',
    emoji: '🥅',
    summary: '5명씩, 20분 두 번, 오프사이드 없음, 4초 규칙',
    sections: [
      {
        title: '역사',
        items: [{ t: '1930년대 우루과이 몬테비데오에서 실내에서 하는 축구로 시작했다(만든 해는 자료마다 조금 다름). 국제축구연맹(FIFA)은 1989년부터 풋살 국제 대회를 열었다.' }],
      },
      {
        title: '경기장 · 인원 · 시간',
        items: [
          { t: '터치라인 25~42 m, 골라인(엔드라인) 16~25 m. 국제 경기는 38~42 m × 20~25 m.', ref: 'Law 1' },
          { t: '한 팀 5명까지(골키퍼 1명 포함). 3명보다 적으면 시작하거나 다시 할 수 없다. 교체는 몇 번이든.', ref: 'Law 3' },
          { t: '실제 경기 시간 20분씩 두 번(공이 멈추면 시계도 멈춤).', ref: 'Law 7' },
          { t: '작전시간: 피리어드마다 1분 1번(연장전에는 없음).', ref: 'Law 7' },
        ],
      },
      {
        title: '경기 방법 · 반칙',
        items: [
          { t: '오프사이드가 없다.', ref: 'Law 11' },
          { t: '공이 터치라인 밖으로 나가면 발로 차서 넣는 킥인으로 다시 한다.', ref: 'Law 15' },
          { t: '4초 규칙: 킥인 · 프리킥 · 코너킥 · 골 클리어런스는 준비된 뒤 4초 안에. 골키퍼는 자기 진영에서 공을 4초 넘게 가지고 있으면 안 된다.', ref: 'Law 12~17' },
          { t: '누적 파울: 직접 프리킥 반칙을 팀마다 피리어드별로 센다. 6번째부터는 벽 없이 10 m 마크(또는 반칙한 곳)에서 직접 프리킥, 페널티 에어리어 안이면 페널티킥.', ref: 'Law 13' },
        ],
      },
    ],
    sources: [FUTSAL],
    league: { kind: 'goals', allowDraw: true, points: { win: 3, draw: 1, loss: 0, forfeit: 0 } },
    pointsNote: '많이 쓰는 방식(승 3 · 무 1 · 패 0). 경기 규칙서에는 승점이 없어 교사가 바꿀 수 있어요',
    scoreSteps: [1],
  },
  {
    id: 'badminton',
    group: 'net',
    bracket: {
      formats: '🏆 토너먼트 또는 📊 리그전',
      scoreMode: '3세트제',
      points: { win: 2, draw: 0, loss: 1 },
      pointsNote: '많이 쓰는 방식. 경기는 3게임 2선승(7.1)',
      scorer: false,
      notes: ['게임은 21점, 20-20이면 2점 차, 29-29면 30점(7.2~7.5). 수업에서는 1게임 21점이나 15점으로 줄여도 돼요(7.1 "정해 두지 않으면").', '단식 · 복식을 섞으면 종목을 나눠 대회를 따로 만드세요.'],
    },
    name: '배드민턴',
    emoji: '🏸',
    summary: '단식 · 복식, 21점 3게임 2선승, 랠리마다 1점',
    sections: [
      {
        title: '역사',
        items: [
          { t: '이름은 영국 글로스터셔의 배드민턴 하우스(보퍼트 공작의 집)에서 이 놀이를 한 데서 왔다는 설명이 널리 알려져 있다.' },
          { t: '1992년 바르셀로나 올림픽부터 정식 종목이다.' },
        ],
      },
      {
        title: '경기장',
        items: [{ t: '네트 위 끝 높이: 가운데 1.524 m, 복식 사이드라인 위 1.55 m.', ref: '규칙 1' }],
      },
      {
        title: '점수 · 게임',
        items: [
          { t: '정해 두지 않으면 3게임 중 2게임을 먼저 이기면 승리.', ref: '7.1' },
          { t: '21점을 먼저 내면 게임 승리. 랠리를 이긴 쪽이 1점.', ref: '7.2 · 7.3' },
          { t: '20-20이면 2점 먼저 앞서는 쪽이, 29-29면 30점째를 낸 쪽이 이긴다.', ref: '7.4 · 7.5' },
          { t: '게임을 이긴 쪽이 다음 게임에 먼저 서브.', ref: '7.6' },
          { t: '코트 바꾸기: 1게임 · 2게임 끝, 3게임에서 한쪽이 11점일 때.', ref: '8.1' },
          { t: '쉬는 시간: 게임 중 앞선 점수가 11점이면 60초까지, 게임 사이 120초까지.', ref: '16.2' },
        ],
      },
      {
        title: '서브',
        items: [
          { t: '서브하는 쪽 점수가 0이나 짝수면 오른쪽, 홀수면 왼쪽 서비스 코트에서 서브.', ref: '10 · 11' },
          { t: '라켓이 셔틀 아랫부분(코르크)을 먼저 친다. 칠 때 셔틀 전체가 바닥에서 1.15 m 아래.', ref: '9.1.5 · 9.1.6' },
          { t: '서브 동작을 시작하면 라켓은 계속 앞으로. 헛치면 반칙.', ref: '9.1.7 · 9.1.8' },
        ],
      },
      {
        title: '폴트 · 렛',
        items: [
          { t: '셔틀이 코트 밖에 떨어짐 · 네트를 못 넘김 · 천장이나 벽 · 몸이나 옷에 닿음.', ref: '13.3' },
          { t: '같은 선수가 연달아 두 번 침 · 복식에서 같은 편이 연달아 침 · 라켓에 얹어 던지듯 침.', ref: '13.3' },
          { t: '경기 중 라켓 · 몸 · 옷이 네트에 닿음 · 네트 위로 상대 코트에 들어감(친 뒤 따라가는 것은 괜찮음) · 상대를 방해하거나 소리 · 몸짓으로 흐트러뜨림.', ref: '13.4' },
          { t: '렛: 뜻하지 않은 일로 다시 함(그 랠리는 세지 않음). 주심은 폴트와 렛을 부른다.', ref: '14 · 17.6' },
        ],
      },
    ],
    sources: [BWF, OLY('배드민턴', 'badminton')],
    league: { kind: 'sets', allowDraw: false, points: { win: 2, draw: 0, loss: 1, forfeit: 0 }, setRule: { target: 21, decider: 21, winBy: 2, cap: 30, setsToWin: 2 } },
    pointsNote: '많이 쓰는 방식(승 2 · 패 1). 규칙서에는 승점이 없어 교사가 바꿀 수 있어요',
    scoreSteps: [1],
  },
]

/** 자료를 준비 중인 종목 (2026-10-27 교사 요청 목록). 공식 규칙서 · 자료를 확인하는 대로 SPORTS로 옮긴다 */
export const UPCOMING: { id: string; name: string; emoji: string; group: SportGroup; note?: string }[] = [
  { id: 'netball', name: '넷볼', emoji: '🏀', group: 'invasion' },
  { id: 'tchoukball', name: '츄크볼', emoji: '🤾', group: 'invasion', note: '교과서마다 분류가 다를 수 있어요' },
  { id: 'ultimate', name: '플라잉디스크 얼티미트', emoji: '🥏', group: 'invasion' },
  { id: 'bigvolleyball', name: '빅발리볼', emoji: '🏐', group: 'net' },
  { id: 'tabletennis', name: '탁구', emoji: '🏓', group: 'net' },
  { id: 'pickleball', name: '피클볼', emoji: '🏓', group: 'net' },
  { id: 'kinball', name: '킨볼', emoji: '🔵', group: 'net', note: '교과서마다 분류가 다를 수 있어요' },
  { id: 'baseball', name: '야구', emoji: '⚾', group: 'field' },
  { id: 'teeball', name: '티볼', emoji: '⚾', group: 'field' },
  { id: 'platebaseball', name: '플레이트 야구', emoji: '⚾', group: 'field' },
  { id: 'gymnastics', name: '체조 (맨몸)', emoji: '🤸', group: 'skill' },
  { id: 'athletics', name: '육상 (50m · 이어달리기)', emoji: '🏃', group: 'skill' },
  { id: 'discgolf', name: '플라잉디스크 골프', emoji: '🥏', group: 'skill' },
]

export const sportOf = (id: string): SportGuide | undefined => SPORTS.find((s) => s.id === id)
