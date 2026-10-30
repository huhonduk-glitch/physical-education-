import type { CourtId } from '../components/CourtDiagram'
import type { LeagueRules, SportId } from '../lib/league'
import { INVASION } from './sportsInvasion'
import { NET } from './sportsNet'

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
const OLY = (sport: string, path: string): GuideSource => ({ label: `올림픽 공식 누리집 — ${sport}`, edition: '역사 참고', url: `https://www.olympics.com/en/sports/${path}/` })

export const SPORTS: SportGuide[] = [
  ...INVASION,
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
  ...NET,
]

/** 자료를 준비 중인 종목 (2026-10-27 교사 요청 목록). 공식 규칙서 · 자료를 확인하는 대로 SPORTS로 옮긴다 */
export const UPCOMING: { id: string; name: string; emoji: string; group: SportGroup; note?: string }[] = [
  { id: 'bigvolleyball', name: '빅발리볼', emoji: '🏐', group: 'net' },
  { id: 'baseball', name: '야구', emoji: '⚾', group: 'field' },
  { id: 'teeball', name: '티볼', emoji: '⚾', group: 'field' },
  { id: 'platebaseball', name: '플레이트 야구', emoji: '⚾', group: 'field' },
  { id: 'gymnastics', name: '체조 (맨몸)', emoji: '🤸', group: 'skill' },
  { id: 'athletics', name: '육상 (50m · 이어달리기)', emoji: '🏃', group: 'skill' },
  { id: 'discgolf', name: '플라잉디스크 골프', emoji: '🥏', group: 'skill' },
]

export const sportOf = (id: string): SportGuide | undefined => SPORTS.find((s) => s.id === id)
