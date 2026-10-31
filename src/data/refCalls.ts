/**
 * 보조심판 빠른 판정판 (2026-10-30, 교사 승인 '오케이 진행').
 * 경기 중 자주 나오는 반칙 · 상황 버튼 → 판정 · 다시 시작 · 심판 신호 · 학생에게 한마디 · 조항.
 * 모두 src/data/sports*.ts에 조항을 단 규칙서 요약과, 다시 시작 방법(벌칙)은 규칙서 원문을 다시 읽어 확인했다:
 * FIBA 2026 제22조(바이얼레이션 벌칙) · World Netball 2024 각 규칙의 Sanction · FITB 7.2(브레이크다운) · WFDF 2025-2028 17.2 · 18.1 · 18.2.
 * 지어낸 내용 없음. 학교 수업에서 줄여 쓰는 규칙은 '우리 반 규칙'(settings.refHouseRules)으로 교사가 따로 적는다.
 */
export type CallKind = 'foul' | 'violation' | 'score' | 'card' | 'restart'

export interface RefCall {
  id: string
  name: string
  /** 찾기 칸에서 같이 찾을 말 (학생들이 하는 말) */
  words: string
  kind: CallKind
  /** 판정 (큰 글씨) */
  verdict: string
  /** 다시 시작 */
  restart: string
  /** 심판 신호 (규칙서에 있을 때만) */
  signal?: string
  /** 학생에게 하는 한마디 */
  tell: string
  ref: string
  /** 팀 파울로 센다 (농구 · 풋살) */
  teamFoul?: boolean
}

export interface RefBoard {
  /** 점수 버튼 (농구 1 · 2 · 3) */
  scoreSteps: number[]
  /** 팀 파울이 이 수에 이르면 알림 (농구: 한 쿼터 5번째부터 자유투 2개 · 풋살: 6번째부터 벽 없는 프리킥) */
  teamFoulAlert?: { at: number; text: string; ref: string }
  calls: RefCall[]
}

export const REF_BOARDS: Record<string, RefBoard> = {
  basketball: {
    scoreSteps: [1, 2, 3],
    teamFoulAlert: { at: 5, text: '이 쿼터 팀 파울 5번째부터는 슛 동작이 아닌 파울에도 자유투 2개 (공 가진 팀의 파울은 빼요)', ref: '제42조' },
    calls: [
      { id: 'travel', name: '트래블링', words: '공 들고 걸음 걷기 발 움직임 축발', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀이 가장 가까운 곳에서 스로인 (백보드 바로 뒤는 빼고)', signal: '두 주먹을 돌린다', tell: '공을 잡으면 한 발은 바닥에 붙여요.', ref: '제25 · 22조' },
      { id: 'double', name: '더블 드리블', words: '드리블 멈췄다 다시 두 손', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀이 가장 가까운 곳에서 스로인', signal: '손바닥으로 두드리는 동작', tell: '드리블을 멈추면 패스나 슛을 해요.', ref: '24.2 · 제22조' },
      { id: 'three', name: '3초', words: '제한구역 오래 서 있음 골밑', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀이 가장 가까운 곳에서 스로인', signal: '팔을 흔들며 손가락 3개', tell: '골밑 페인트 안에는 3초까지만 있어요.', ref: '제26 · 22조' },
      { id: 'eight', name: '8초', words: '하프라인 넘기 백코트 늦음', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀 스로인', signal: '손가락 8개', tell: '우리 코트에서 8초 안에 넘어가요.', ref: '제28 · 22조' },
      { id: 'shotclock', name: '24초', words: '공격 시간 슛 안 함', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀 스로인', signal: '손가락으로 어깨를 짚는다', tell: '24초 안에 슛해서 링에 맞혀야 해요.', ref: '제29 · 22조' },
      { id: 'backcourt', name: '백코트', words: '하프라인 다시 넘어감 되돌아감', kind: 'violation', verdict: '바이얼레이션 — 상대 공', restart: '상대 팀 스로인', tell: '넘어간 공은 우리 코트로 다시 가져오지 않아요.', ref: '제30 · 22조' },
      { id: 'personal', name: '개인 파울', words: '밀기 잡기 치기 막기 접촉 팔', kind: 'foul', verdict: '파울 — 상대 스로인 (팀 파울 5번째부터 자유투 2개)', restart: '파울당한 팀 스로인. 슛하던 선수면 자유투', signal: '주먹을 쥔다 (시계 멈춤)', tell: '몸으로 밀지 말고 발로 따라가요.', ref: '제34 · 42조', teamFoul: true },
      { id: 'shooting', name: '슛 동작 파울', words: '슛할 때 파울 자유투', kind: 'foul', verdict: '자유투 — 들어갔으면 득점 + 1개, 안 들어갔으면 2점 슛 2개 · 3점 슛 3개', restart: '자유투 뒤 이어서', tell: '슛하는 팔을 치지 않아요.', ref: '34.2.2', teamFoul: true },
      { id: 'goaltend', name: '골텐딩', words: '내려오는 공 막기 블록', kind: 'violation', verdict: '수비가 했으면 득점 인정, 공격이 했으면 득점 무효', restart: '득점이면 끝줄 스로인, 아니면 상대 공', tell: '링보다 높은 데서 내려오는 공은 건드리지 않아요.', ref: '제31조' },
      { id: 'technical', name: '테크니컬 파울', words: '대들기 항의 시간 끌기 비신사', kind: 'card', verdict: '상대에게 자유투 1개', restart: '자유투 뒤 이어서', tell: '판정에는 손을 들어 질문해요.', ref: '제36조' },
    ],
  },
  football: {
    scoreSteps: [1],
    calls: [
      { id: 'foul', name: '차기 · 밀기 · 걸기', words: '태클 반칙 몸 접촉 넘어뜨림', kind: 'foul', verdict: '직접 프리킥 (우리 페널티 에어리어 안이면 페널티킥)', restart: '반칙한 자리에서. 상대는 9.15 m', tell: '공을 노리고, 사람은 건드리지 않아요.', ref: 'Law 12 · 13' },
      { id: 'hand', name: '핸드볼', words: '손 팔 공 맞음', kind: 'foul', verdict: '직접 프리킥 (페널티 에어리어 안이면 페널티킥)', restart: '반칙한 자리에서', tell: '팔을 벌려 몸을 크게 만들지 않아요.', ref: 'Law 12' },
      { id: 'offside', name: '오프사이드', words: '앞에 있다 패스 받음 수비수 뒤', kind: 'violation', verdict: '상대 간접 프리킥', restart: '오프사이드 반칙한 자리에서', tell: '공을 찬 순간 마지막 두 번째 수비수와 나란히 서요.', ref: 'Law 11' },
      { id: 'throwin', name: '스로인', words: '터치라인 밖 옆줄 나감 던지기', kind: 'restart', verdict: '마지막에 안 건드린 팀 스로인', restart: '두 발은 줄 위나 밖, 두 손으로 머리 뒤에서 머리 위로. 바로 골은 안 돼요', tell: '두 발을 땅에 붙이고 던져요.', ref: 'Law 15' },
      { id: 'goalkick', name: '골킥', words: '골라인 밖 공격이 마지막', kind: 'restart', verdict: '수비 팀 골킥', restart: '골 에어리어 안에서 차요', tell: '', ref: 'Law 16' },
      { id: 'corner', name: '코너킥', words: '골라인 밖 수비가 마지막', kind: 'restart', verdict: '공격 팀 코너킥', restart: '공이 나간 쪽 코너에서', tell: '', ref: 'Law 17' },
      { id: 'yellow', name: '경고', words: '노란 카드 무모 거친', kind: 'card', verdict: '노란 카드 + 직접 프리킥 (경고 2번이면 퇴장)', restart: '반칙한 자리에서', signal: '노란 카드를 들어 보인다', tell: '다치게 할 수 있는 동작은 하지 않아요.', ref: 'Law 12' },
      { id: 'red', name: '퇴장', words: '빨간 카드 지나친 힘 폭력', kind: 'card', verdict: '빨간 카드 + 직접 프리킥', restart: '반칙한 자리에서', signal: '빨간 카드를 들어 보인다', tell: '', ref: 'Law 12' },
      { id: 'gk8', name: '골키퍼 8초', words: '골키퍼 공 오래 들고 있음', kind: 'violation', verdict: '상대 코너킥', restart: '코너에서', tell: '골키퍼는 공을 잡으면 8초 안에 놓아요.', ref: 'Law 12 (2025/26)' },
      { id: 'advantage', name: '어드밴티지', words: '계속 이어 가기 멈추지 않음', kind: 'restart', verdict: '멈추지 않고 이어 가요', restart: '반칙당한 팀이 그대로 하는 게 더 좋을 때', tell: '', ref: 'Law 5' },
    ],
  },
  futsal: {
    scoreSteps: [1],
    teamFoulAlert: { at: 6, text: '이 피리어드 누적 파울 6번째부터 벽 없이 10 m 마크(또는 반칙한 곳)에서 직접 프리킥', ref: 'Law 13' },
    calls: [
      { id: 'foul', name: '차기 · 밀기 · 걸기', words: '태클 반칙 접촉 넘어뜨림', kind: 'foul', verdict: '직접 프리킥 + 누적 파울 (페널티 에어리어 안이면 페널티킥)', restart: '반칙한 자리에서, 4초 안에', tell: '발로 공만 노려요.', ref: 'Law 12 · 13', teamFoul: true },
      { id: 'hand', name: '핸드볼', words: '손 팔', kind: 'foul', verdict: '직접 프리킥 + 누적 파울', restart: '반칙한 자리에서, 4초 안에', tell: '', ref: 'Law 12', teamFoul: true },
      { id: 'kickin', name: '킥인', words: '터치라인 밖 옆줄 나감 천장', kind: 'restart', verdict: '마지막에 안 건드린 팀 킥인', restart: '줄 위에 공을 세우고 발로, 4초 안에. 바로 골은 안 돼요', tell: '손으로 던지지 않고 발로 차요.', ref: 'Law 15' },
      { id: 'four', name: '4초', words: '킥인 프리킥 늦음 시간 끌기', kind: 'violation', verdict: '킥인이면 상대 킥인, 프리킥 · 코너킥 등이면 상대 간접 프리킥', restart: '준비된 뒤 4초 안에 해야 해요', tell: '심판이 손가락으로 4초를 세요.', ref: 'Law 13 · 15~17' },
      { id: 'gk4', name: '골키퍼 4초', words: '골키퍼 오래 가짐 우리 진영', kind: 'violation', verdict: '상대 간접 프리킥', restart: '반칙한 자리에서', tell: '골키퍼는 4초 안에 공을 내보내요.', ref: 'Law 12' },
      { id: 'backpass', name: '골키퍼 백패스 손', words: '우리 편이 찬 공 골키퍼 손으로 잡음', kind: 'violation', verdict: '상대 간접 프리킥', restart: '반칙한 자리에서', tell: '우리 편이 발로 준 공은 골키퍼도 발로.', ref: 'Law 12' },
      { id: 'clearance', name: '골 클리어런스', words: '골라인 밖 공격이 마지막', kind: 'restart', verdict: '골키퍼가 손으로 던져 시작', restart: '페널티 에어리어 안에서, 4초 안에. 바로 골은 안 돼요', tell: '', ref: 'Law 16' },
      { id: 'nooffside', name: '오프사이드?', words: '골 앞에 있음 앞에서 받음', kind: 'restart', verdict: '반칙 아님 — 풋살은 오프사이드가 없어요', restart: '그대로 이어 가요', tell: '골 앞에 있어도 괜찮아요.', ref: 'Law 11' },
    ],
  },
  netball: {
    scoreSteps: [1],
    calls: [
      { id: 'contact', name: '접촉', words: '밀기 잡기 기대기 공 치기 몸싸움 부딪힘', kind: 'foul', verdict: '페널티 패스 (골 서클 안이면 패스 · 슛 중 골라요)', restart: '반칙한 선수 자리에서. 반칙한 선수는 옆에 비켜서 있어요', tell: '몸으로 막지 않고 거리를 두고 막아요.', ref: '규칙 17 · 6' },
      { id: 'obstruction', name: '방해 (0.9 m)', words: '가까이 막음 팔 뻗기 거리', kind: 'foul', verdict: '페널티 패스', restart: '반칙한 선수 자리에서. 반칙한 선수는 옆에 비켜서 있어요', tell: '공 가진 선수 발에서 0.9 m 떨어져 막아요.', ref: '규칙 16 · 6' },
      { id: 'repossession', name: '재소유 (드리블)', words: '드리블 혼자 튕김 다시 잡음 공 놓고 다시', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '반칙한 자리에서 상대가 패스', tell: '공을 놓으면 다른 선수가 닿기 전에 다시 잡지 않아요.', ref: '규칙 11.6' },
      { id: 'footwork', name: '풋워크', words: '걷기 발 움직임 착지 끌기 깡충', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '반칙한 자리에서 상대가 패스', tell: '착지한 발로만 돌고, 그 발이 다시 닿기 전에 패스해요.', ref: '규칙 13' },
      { id: 'held', name: '3초', words: '오래 들고 있음 공 잡고 늦음', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '반칙한 자리에서 상대가 패스', tell: '잡으면 3초 안에 패스 · 슛.', ref: '규칙 11.4' },
      { id: 'offside', name: '오프사이드', words: '구역 밖 나감 들어가면 안 되는 곳', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '들어간 구역에서 상대가 패스', tell: '내 포지션 구역 안에서만 움직여요.', ref: '규칙 14 · 3' },
      { id: 'overthird', name: '오버 어 서드', words: '한 칸 건너뛴 패스 긴 패스', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '공이 잘못 들어간 서드의 줄 옆에서', tell: '서드마다 한 번씩 누군가 공을 잡아요.', ref: '규칙 12' },
      { id: 'shortpass', name: '쇼트 패스', words: '바로 옆 건네주기 짧은 패스', kind: 'violation', verdict: '프리 패스 (상대 공)', restart: '받은 자리에서 상대가 패스', tell: '상대가 끊을 수 있을 만큼 떨어져서 패스해요.', ref: '규칙 12' },
      { id: 'out', name: '아웃', words: '코트 밖 나감 줄 밖', kind: 'restart', verdict: '마지막에 안 건드린 팀 스로인', restart: '공이 나간 자리 옆에서', tell: '', ref: '규칙 15' },
      { id: 'shooter', name: '슛 자격', words: '슛 누가 WA 바깥에서 슛', kind: 'restart', verdict: 'GS · GA가 상대 골 서클 안에서 던진 것만 골', restart: '골이 아니면 그대로 이어 가요', tell: '', ref: '규칙 9' },
    ],
  },
  tchoukball: {
    scoreSteps: [1],
    calls: [
      { id: 'point', name: '득점', words: '바닥에 닿음 못 받음 점수', kind: 'score', verdict: '공격 팀 1점', restart: '점수를 내준 팀이 프레임 옆 끝줄 밖에서 던져 시작', tell: '', ref: '규칙 8.1 · 10' },
      { id: 'miss', name: '실점', words: '프레임 못 맞힘 밖에 떨어짐 금지 구역 자기 몸', kind: 'score', verdict: '상대 팀 1점', restart: '점수를 내준 팀이 끝줄 밖에서 던져 시작', tell: '프레임을 정확히 맞혀요.', ref: '규칙 8.2 · 10' },
      { id: 'steps', name: '3걸음', words: '걷기 공 들고 4걸음', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서 상대가 공을 두 손으로 바닥에 댄 뒤 시작, 슛 전 패스 1번 이상', signal: '규칙서 손 신호 5', tell: '공을 잡으면 3걸음까지.', ref: '7.1.2 · 7.2' },
      { id: 'sec3', name: '3초', words: '오래 들고 있음', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서, 바닥에 댄 뒤 시작', signal: '규칙서 손 신호 6', tell: '3초 안에 패스 · 슛.', ref: '7.1.3 · 7.2' },
      { id: 'pass4', name: '4번째 패스', words: '패스 많이 네 번', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서, 바닥에 댄 뒤 시작', signal: '규칙서 손 신호 7', tell: '슛 전 패스는 3번까지.', ref: '7.1.4 · 7.2' },
      { id: 'obstruct', name: '방해 · 가로채기', words: '막기 패스 가로챔 몸싸움 끼어들기', kind: 'foul', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서, 바닥에 댄 뒤 시작', signal: '규칙서 손 신호 9', tell: '상대 패스는 건드리지 않고, 튕겨 나올 자리를 잡아요.', ref: '7.1.7 · 7.1.8 · 7.2' },
      { id: 'knee', name: '무릎 아래', words: '발 정강이 공 닿음', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서', signal: '규칙서 손 신호 4', tell: '공은 무릎 위로만 받아요.', ref: '7.1.1 · 7.2' },
      { id: 'zone', name: '금지 구역', words: '반원 들어감 줄 밟음 착지', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '가장 가까운 경기장 안에서', signal: '규칙서 손 신호 11 · 12', tell: '공을 들고 반원 줄을 밟지 않아요.', ref: '7.1.11 · 7.1.12 · 7.2' },
      { id: 'shots4', name: '같은 프레임 4번째', words: '연속 슛 한 프레임', kind: 'violation', verdict: '폴트 — 상대 브레이크다운', restart: '반칙한 자리에서', signal: '규칙서 손 신호 10', tell: '한 프레임은 연속 3번까지.', ref: '7.1.10 · 7.2' },
    ],
  },
  ultimate: {
    scoreSteps: [1],
    calls: [
      { id: 'goal', name: '득점', words: '엔드존 잡음 골', kind: 'score', verdict: '1점', restart: '엔드존을 바꾸고, 넣은 팀이 풀(멀리 던져 주기)', tell: '', ref: '4.5 · 7' },
      { id: 'turnover', name: '턴오버', words: '떨어짐 땅 가로챔 밖', kind: 'restart', verdict: '공격권이 상대에게', restart: '원반이 멈춘 자리에서 상대가 시작 (밖이면 나간 곳에서 가장 가까운 경기장 안)', tell: '', ref: '13.1 · 13.7 · 13.8' },
      { id: 'stall', name: '스톨 10', words: '오래 들고 있음 열 셈', kind: 'violation', verdict: '턴오버 — 상대 공', restart: '그 자리에서 상대가 시작', tell: '수비는 1초 이상 간격으로 "스톨링 1 … 10".', ref: '9 · 13.2' },
      { id: 'travel', name: '트래블', words: '들고 달림 축발 움직임 걸음', kind: 'violation', verdict: '경기는 멈추지 않아요 — 던지는 사람이 맞는 자리로 돌아가 축발을 잡아요', restart: '축발을 잡을 때까지 스톨 카운트를 멈추고, 그 전에는 못 던져요', tell: '잡으면 빨리 멈추고 한 발을 축으로.', ref: '18.2' },
      { id: 'foul', name: '파울 (몸 닿음)', words: '밀기 접촉 부딪힘 잡기', kind: 'foul', verdict: '파울당한 선수가 "파울"을 부르고, 상대가 받아들이면 그 선수가 그 자리에서 원반을 가져요', restart: '상대가 받아들이지 않으면 원반을 던진 사람에게 돌려 다시', tell: '파울은 당한 선수만 불러요. 몸싸움 없이.', ref: '15.4 · 17.2' },
      { id: 'double', name: '더블 팀', words: '수비 두 명 붙음', kind: 'foul', verdict: '반칙 — 던지는 사람이 "더블 팀"을 불러요', restart: '경기는 이어 가고, 수비는 자리를 고친 뒤 마지막으로 다 센 수에서 1을 뺀 수부터 다시 세요', tell: '원반 든 사람 3 m 안에는 수비 한 명만.', ref: '18.1' },
      { id: 'danger', name: '위험한 행동', words: '거칠게 뛰어들기 다이빙', kind: 'foul', verdict: '닿지 않았어도 파울', restart: '파울처럼 처리', tell: '다칠 수 있는 동작은 하지 않아요.', ref: '17.1' },
      { id: 'spirit', name: '의견이 다를 때', words: '판정 다툼 서로 다름', kind: 'restart', verdict: '두 선수가 이야기해 정하고, 안 되면 원반을 던진 사람에게 돌려 다시', restart: '선수끼리 스스로 풀어요 (심판 없음)', tell: '정직 · 존중 · 공정 (스피릿 오브 더 게임).', ref: '1.1 · 16.3' },
    ],
  },
  volleyball: {
    scoreSteps: [1],
    calls: [
      { id: 'four', name: '포 히트', words: '네 번 4번 터치', kind: 'violation', verdict: '반칙 — 상대 1점 · 서브권', restart: '랠리를 이긴 팀이 서브', signal: '손가락 4개', tell: '3번 안에 넘겨요 (블로킹은 안 세요).', ref: '9.3.1 · 6.1 · 도표 11-18' },
      { id: 'double', name: '더블 컨택트', words: '한 사람 두 번 연달아', kind: 'violation', verdict: '반칙 — 상대 1점 · 서브권', restart: '랠리를 이긴 팀이 서브', signal: '손가락 2개', tell: '한 사람이 연달아 두 번 치지 않아요.', ref: '9.1.1 · 6.1 · 도표 11-17' },
      { id: 'catch', name: '캐치', words: '잡기 던지기 들고', kind: 'violation', verdict: '반칙 — 상대 1점 · 서브권', restart: '랠리를 이긴 팀이 서브', tell: '공은 튕기듯 쳐요.', ref: '9.2.2 · 6.1' },
      { id: 'in', name: '인 · 아웃', words: '라인 안 밖 공 떨어짐', kind: 'score', verdict: '줄 위도 인 — 공이 닿은 쪽의 상대가 1점', restart: '랠리를 이긴 팀이 서브', signal: '인: 팔과 손가락으로 바닥을 가리킴', tell: '', ref: '8.3 · 6.1 · 도표 11-14' },
      { id: 'rotation', name: '자리 · 순서 반칙', words: '로테이션 순서 틀림 자리', kind: 'violation', verdict: '반칙 — 상대 1점 · 서브권', restart: '자리를 바로잡고, 랠리를 이긴 팀이 서브', signal: '집게손가락으로 원을 그림', tell: '서브권을 얻으면 시계 방향으로 한 칸.', ref: '7.6.2 · 도표 11-13' },
      { id: 'serve8', name: '서브 8초', words: '서브 늦음', kind: 'violation', verdict: '반칙 — 상대 1점 · 서브권', restart: '상대 팀이 서브', signal: '손가락 8개를 폄', tell: '휘슬 뒤 8초 안에 서브.', ref: '12.4.4 · 도표 11-11' },
      { id: 'replay', name: '다시 하기', words: '동시 반칙 애매 방해', kind: 'restart', verdict: '그 랠리를 다시 해요', restart: '그 랠리를 처음부터 다시', signal: '두 엄지를 세움', tell: '', ref: '6.1.3 · 도표 11-23' },
    ],
  },
  badminton: {
    scoreSteps: [1],
    calls: [
      { id: 'servehigh', name: '서브 높이', words: '서브 높음 허리 위 1.15', kind: 'violation', verdict: '서브 폴트 — 상대 1점', restart: '상대가 점수에 맞는 쪽(짝수 오른쪽 · 홀수 왼쪽)에서 서브', tell: '칠 때 셔틀 전체가 바닥에서 1.15 m 아래.', ref: '9.1.6 · 7.3' },
      { id: 'servecork', name: '서브 — 깃털 먼저', words: '코르크 깃털 먼저 맞음', kind: 'violation', verdict: '서브 폴트 — 상대 1점', restart: '상대 서브', tell: '라켓은 셔틀 코르크를 먼저 쳐요.', ref: '9.1.5 · 7.3' },
      { id: 'side', name: '서브 위치', words: '오른쪽 왼쪽 짝수 홀수 잘못', kind: 'restart', verdict: '서브하는 쪽 점수가 0 · 짝수면 오른쪽, 홀수면 왼쪽', restart: '대각선 상대 서비스 코트로', tell: '', ref: '10 · 11' },
      { id: 'out', name: '아웃 · 네트 못 넘김', words: '밖 떨어짐 네트 걸림 천장', kind: 'violation', verdict: '폴트 — 상대 1점', restart: '랠리를 이긴 쪽이 서브', tell: '', ref: '13.3 · 7.3' },
      { id: 'double', name: '두 번 치기', words: '연달아 두 번 같은 편 둘 다', kind: 'violation', verdict: '폴트 — 상대 1점', restart: '랠리를 이긴 쪽이 서브', tell: '한 번에 넘겨요 (복식도 한 사람만).', ref: '13.3 · 7.3' },
      { id: 'net', name: '네트 터치', words: '라켓 몸 네트 닿음 넘어감', kind: 'violation', verdict: '폴트 — 상대 1점 (친 뒤 라켓이 따라 넘어가는 것은 괜찮아요)', restart: '랠리를 이긴 쪽이 서브', tell: '네트에 닿지 않게 한 발 뒤에서.', ref: '13.4 · 7.3' },
      { id: 'body', name: '몸 · 옷에 맞음', words: '셔틀 몸 맞음', kind: 'violation', verdict: '폴트 — 상대 1점', restart: '랠리를 이긴 쪽이 서브', tell: '', ref: '13.3 · 7.3' },
      { id: 'let', name: '렛', words: '다시 하기 다른 셔틀 들어옴 방해', kind: 'restart', verdict: '그 랠리를 세지 않고 다시', restart: '같은 서브로 다시', tell: '', ref: '14' },
    ],
  },
  // 네트형 추가 (2026-10-30): ITTF 2026 · USA Pickleball 2026 · IKBF 2024 원문 확인
  tabletennis: {
    scoreSteps: [1],
    calls: [
      { id: 'netserve', name: '서브 네트 맞음', words: '서브 네트 닿음 렛', kind: 'restart', verdict: '렛 — 다시 서브 (맞게 들어갔을 때)', restart: '같은 사람이 다시 서브', tell: '', ref: '2.9.1.1' },
      { id: 'toss', name: '서브 토스 반칙', words: '던지기 낮음 16 손가락 쥠 회전', kind: 'violation', verdict: '상대 1점', restart: '2점마다 서브 차례대로', tell: '손바닥을 펴고 16 cm 이상 똑바로 던져 올려요.', ref: '2.6.1 · 2.6.2 · 2.10.1.1' },
      { id: 'servebounce', name: '서브가 내 코트에 안 튐', words: '바로 넘김 한 번 튀기', kind: 'violation', verdict: '상대 1점', restart: '2점마다 서브 차례대로', tell: '서브는 내 코트에 한 번 튀기고 넘겨요.', ref: '2.6.3 · 2.10.1.1' },
      { id: 'out', name: '아웃 · 네트', words: '밖 넘어감 안 넘어감 네트 걸림', kind: 'violation', verdict: '상대 1점', restart: '2점마다 서브 차례대로', tell: '', ref: '2.10.1.2 ~ 2.10.1.5' },
      { id: 'double', name: '두 번 치기', words: '연달아 두 번', kind: 'violation', verdict: '일부러 두 번 쳤으면 상대 1점', restart: '2점마다 서브 차례대로', tell: '', ref: '2.10.1.7' },
      { id: 'table', name: '탁구대 · 네트 건드림', words: '손 짚음 몸 닿음 탁구대 움직임', kind: 'violation', verdict: '상대 1점', restart: '2점마다 서브 차례대로', tell: '치지 않는 손은 탁구대에 짚지 않아요.', ref: '2.10.1.9 ~ 2.10.1.11' },
      { id: 'order', name: '복식 차례 어김', words: '복식 순서 짝 차례', kind: 'violation', verdict: '상대 1점', restart: '서브한 사람 → 받은 사람 → 서브한 사람 짝 → 받은 사람 짝', tell: '', ref: '2.8.2 · 2.10.1.12' },
      { id: 'deuce', name: '10-10', words: '듀스 2점 차', kind: 'restart', verdict: '2점 앞설 때까지 해요', restart: '서브는 1점마다 번갈아', tell: '', ref: '2.11.1 · 2.13.3' },
    ],
  },
  pickleball: {
    scoreSteps: [1],
    calls: [
      { id: 'kitchen', name: '키친 발리', words: '키친 논발리 바로 쳤음 밟음 쏠림', kind: 'violation', verdict: '폴트 — 그 랠리를 잃어요', restart: '서브 쪽이 잃으면 다음 서버(또는 사이드 아웃)', tell: '발리는 키친 밖에서. 친 뒤 몸이 쏠리지 않게.', ref: '11.A.1 · 11.A.2' },
      { id: 'twobounce', name: '투 바운스 어김', words: '안 튀기고 바로 침 리턴 발리', kind: 'violation', verdict: '폴트 — 그 랠리를 잃어요', restart: '서브 쪽이 잃으면 다음 서버(또는 사이드 아웃)', tell: '서브와 리턴은 한 번씩 튀긴 뒤 쳐요.', ref: '10.A' },
      { id: 'serve', name: '서브 동작 반칙', words: '언더핸드 허리 위 내려침', kind: 'violation', verdict: '폴트 — 서브 쪽이 랠리를 잃어요', restart: '다음 서버(또는 사이드 아웃)', tell: '아래에서 위로, 공은 허리 아래에서.', ref: '7.C.1 ~ 7.C.3' },
      { id: 'servekitchen', name: '서브가 키친에', words: '서브 짧음 키친 선', kind: 'violation', verdict: '폴트 — 서브 쪽이 랠리를 잃어요', restart: '다음 서버(또는 사이드 아웃)', tell: '서브는 키친(선 포함)을 넘겨요.', ref: '7.E.2' },
      { id: 'out', name: '아웃 · 네트', words: '밖 안 넘어감 두 번 튐', kind: 'violation', verdict: '폴트 — 그 랠리를 잃어요', restart: '서브 쪽이 잃으면 다음 서버(또는 사이드 아웃)', tell: '', ref: '10.B · 10.C' },
      { id: 'side', name: '서브 위치', words: '오른쪽 왼쪽 짝수 홀수', kind: 'restart', verdict: '서버 점수 0 · 짝수면 오른쪽, 홀수면 왼쪽 (단식)', restart: '대각선 서비스 코트로', tell: '', ref: '5.A.1 · 5.B.3' },
      { id: 'sideout', name: '사이드 아웃', words: '서브 넘어감 복식 두 명', kind: 'restart', verdict: '복식은 두 명이 다 랠리를 잃어야 서브가 넘어가요 (게임 처음 팀은 한 명만)', restart: '오른쪽에 선 사람부터 서브', tell: '', ref: '5.B · 5.B.2' },
    ],
  },
  kinball: {
    scoreSteps: [1],
    calls: [
      { id: 'call', name: '부르기 반칙', words: '옴니킨 색 틀림 늦음 안 부름', kind: 'violation', verdict: '반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 그 자리에서 다시 쳐요 (5초)', tell: '"옴니킨 + 색"을 공을 잡은 뒤, 치기 전에 또렷하게.', ref: '6.1 · 5.2.4' },
      { id: 'contact', name: '접촉 빠짐', words: '네 명 다 안 닿음 한 명 떨어짐', kind: 'violation', verdict: '반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 그 자리에서 다시 쳐요', tell: '칠 때 4명 모두 공에 손을 대요.', ref: '6.2.1 · 5.2.4' },
      { id: 'drop', name: '공 떨어뜨림', words: '못 받음 바닥 닿음', kind: 'violation', verdict: '불린 팀 반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 그 자리에서 다시 쳐요', tell: '', ref: '6.3.1 · 5.2.4' },
      { id: 'out', name: '아웃', words: '밖 떨어짐 코트 밖', kind: 'violation', verdict: '친 팀 반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 다시 쳐요', tell: '', ref: '6.4.1 · 5.2.4' },
      { id: 'down', name: '아래로 친 공', words: '내리꽂기 위로 안 감', kind: 'violation', verdict: '친 팀 반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 그 자리에서 다시 쳐요', tell: '공은 위로 올라가는 궤적이 있어야 해요.', ref: '6.5 · 5.2.4' },
      { id: 'short', name: '너무 짧은 공', words: '가까이 공격 구역 못 벗어남', kind: 'violation', verdict: '친 팀 반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 그 자리에서 다시 쳐요', tell: '공격 구역(공에서 1.8 m)을 다 벗어나게.', ref: '6.6 · 5.2.4' },
      { id: 'time', name: '시간 반칙', words: '10초 5초 늦음', kind: 'violation', verdict: '반칙 — 나머지 두 팀 1점씩', restart: '반칙한 팀이 다시 쳐요', tell: '받으면 10초, 다시 칠 때는 5초 안에.', ref: '6.8.1 · 6.8.2' },
      { id: 'critical', name: '9점 (목표 − 2)', words: '한 팀 나감 두 팀만', kind: 'restart', verdict: '가장 점수 낮은 팀이 나가고 두 팀이 겨뤄요', restart: '두 팀 중 점수 낮은 팀이 가운데에서 쳐요', tell: '', ref: '5.2.5 · 5.2.6' },
    ],
  },
  // 체육 플레이북 참고로 더한 종목 (2026-10-31)
  handball: {
    scoreSteps: [1],
    calls: [
      { id: 'steps', name: '걸음 반칙', words: '네 걸음 오래 걸음 트래블링', kind: 'violation', verdict: '상대 프리 스로', restart: '반칙한 자리에서 상대가 던져 시작', tell: '공을 들고는 3걸음까지.', ref: '7:3 · 13:1' },
      { id: 'sec3', name: '3초', words: '오래 들고 있음', kind: 'violation', verdict: '상대 프리 스로', restart: '반칙한 자리에서', tell: '3초 안에 패스 · 슛 · 드리블.', ref: '7:2 · 13:1' },
      { id: 'area-att', name: '골 에어리어 (공격)', words: '선 밟음 들어감 공격수', kind: 'violation', verdict: '상대 골키퍼 공 (골 무효)', restart: '골키퍼가 골 에어리어에서 던져 시작', tell: '선을 밟지 말고 뛰어올라 공중에서 던져요.', ref: '6:2 a · 12:1' },
      { id: 'area-def', name: '골 에어리어 (수비)', words: '수비 들어감 골 에어리어 막음', kind: 'foul', verdict: '이득을 봤으면 프리 스로, 확실한 골 기회를 막았으면 7 m 던지기', restart: '프리 스로는 반칙한 자리, 7 m 던지기는 7 m 선에서', tell: '수비도 골 에어리어 밖에서 막아요.', ref: '6:2 b · c' },
      { id: 'push', name: '밀기 · 잡기', words: '밀기 잡기 팔 몸싸움 공 잡아채기', kind: 'foul', verdict: '상대 프리 스로 (거듭되면 경고 → 2분 퇴장)', restart: '반칙한 자리에서', tell: '굽힌 팔로 따라가고, 밀거나 잡지 않아요.', ref: '8:2 · 8:3' },
      { id: 'seven', name: '7 m 던지기', words: '골 기회 막음 페널티', kind: 'foul', verdict: '7 m 던지기', restart: '7 m 선에서 골키퍼와 1대1', tell: '', ref: '14:1' },
      { id: 'foot', name: '발로 공 다룸', words: '발 차기 무릎 아래', kind: 'violation', verdict: '상대 프리 스로', restart: '반칙한 자리에서', tell: '무릎 아래로는 공을 다루지 않아요.', ref: '7:8' },
    ],
  },
  floorball: {
    scoreSteps: [1],
    calls: [
      { id: 'high', name: '하이 스틱', words: '스틱 높이 허리 위 휘두르기', kind: 'violation', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '스틱 날은 허리 아래로.', ref: '507 3)' },
      { id: 'knee', name: '무릎 위 플레이', words: '공 높이 무릎 위 발', kind: 'violation', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '공은 무릎 아래에서만 쳐요(허벅지로 멈추기는 OK).', ref: '507 4)' },
      { id: 'stick', name: '스틱 치기', words: '스틱 때림 들어올림 막음', kind: 'foul', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '상대 스틱은 건드리지 않고 공만 노려요.', ref: '507 1)' },
      { id: 'push', name: '밀기 · 잡기', words: '밀기 잡기 몸싸움 부딪힘', kind: 'foul', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '어깨끼리 맞대는 것까지만.', ref: '507 2) · 6)' },
      { id: 'jump', name: '점프해서 멈춤', words: '뛰어서 공 멈춤', kind: 'violation', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '한 발은 바닥에 두고 멈춰요.', ref: '507 11)' },
      { id: 'crease', name: '골키퍼 구역 들어감', words: '골키퍼 구역 골대 앞', kind: 'violation', verdict: '상대 프리 히트', restart: '반칙한 자리에서', tell: '', ref: '507 8)' },
    ],
  },
  tennis: {
    scoreSteps: [1],
    calls: [
      { id: 'fault', name: '서브 폴트', words: '서브 밖 네트 안 들어감', kind: 'violation', verdict: '첫 서브면 세컨드 서브, 두 번째면 더블 폴트(상대 1점)', restart: '같은 자리에서 다시 서브', tell: '', ref: '19 · 20 · 24' },
      { id: 'foot', name: '풋 폴트', words: '끝줄 밟음 걸어감', kind: 'violation', verdict: '서브 폴트로 처리', restart: '세컨드 서브(또는 더블 폴트)', tell: '서브할 때 끝줄을 밟지 않아요.', ref: '18' },
      { id: 'let', name: '렛 (서브 네트)', words: '네트 맞고 들어감', kind: 'restart', verdict: '그 서브만 다시', restart: '같은 서브 차례로 다시', tell: '', ref: '22' },
      { id: 'line', name: '선에 닿음', words: '라인 인 아웃', kind: 'score', verdict: '선에 닿으면 인', restart: '이어서', tell: '', ref: '12' },
      { id: 'net', name: '네트 터치', words: '라켓 몸 네트 닿음 넘어감', kind: 'violation', verdict: '공이 경기 중이면 그 선수가 1점 잃음', restart: '다음 포인트', tell: '', ref: '24' },
      { id: 'deuce', name: '듀스', words: '40 40 어드밴티지', kind: 'restart', verdict: '2점 연속으로 이겨야 게임', restart: '듀스 다음 점수는 어드밴티지', tell: '', ref: '5a' },
    ],
  },
  baseball: {
    scoreSteps: [1],
    calls: [
      { id: 'walk', name: '볼넷', words: '볼 4개', kind: 'restart', verdict: '타자는 1루로', restart: '다음 타자', tell: '', ref: '10.2.10' },
      { id: 'strikeout', name: '삼진', words: '스트라이크 3개', kind: 'restart', verdict: '타자 아웃', restart: '다음 타자', tell: '', ref: '9.10' },
      { id: 'foul', name: '파울', words: '선 밖 공', kind: 'restart', verdict: '스트라이크 2개까지는 스트라이크로 셈 (주자는 원래 루로)', restart: '다시 투구', tell: '', ref: '6.34' },
      { id: 'fly', name: '플라이 아웃', words: '뜬 공 잡음', kind: 'restart', verdict: '타자 아웃 — 주자는 원래 루를 밟고(태그 업) 뛰어요', restart: '이어서', tell: '', ref: '9.10 · 10.7' },
      { id: 'force', name: '포스 아웃', words: '루 밟음 송구 먼저', kind: 'restart', verdict: '꼭 가야 하는 주자: 수비가 공을 갖고 그 루를 먼저 밟으면 아웃', restart: '이어서', tell: '', ref: '6.32 · 10.7' },
      { id: 'tag', name: '태그 아웃', words: '공으로 터치 주자', kind: 'restart', verdict: '루를 떠난 주자를 공(공 든 글러브)으로 태그하면 아웃', restart: '이어서', tell: '', ref: '10.7' },
      { id: 'order', name: '루 건너뜀', words: '루 안 밟음 순서', kind: 'violation', verdict: '수비가 어필하면 그 주자 아웃', restart: '다음 플레이 전에 어필해야 해요', tell: '루는 1 → 2 → 3 → 홈 순서로 밟아요.', ref: '10.1 · 11.1' },
    ],
  },
  // 필드형 나머지 (2026-10-31)
  softball: {
    scoreSteps: [1],
    calls: [
      { id: 'pitch', name: '투구 반칙', words: '위로 던짐 엉덩이 위 팔 두 바퀴', kind: 'violation', verdict: '반칙 투구 — 타자에게 볼 1개 (주자는 한 루씩)', restart: '다음 투구', tell: '손이 엉덩이 아래로 지나가며 놓아요.', ref: '4.3' },
      { id: 'walk', name: '볼넷', words: '볼 4개', kind: 'restart', verdict: '타자는 1루로', restart: '다음 타자', tell: '', ref: '제5장' },
      { id: 'strikeout', name: '삼진', words: '스트라이크 3개', kind: 'restart', verdict: '타자 아웃', restart: '다음 타자', tell: '', ref: '제5장' },
      { id: 'double', name: '더블 베이스', words: '1루 두 칸 부딪힘', kind: 'restart', verdict: '수비는 안쪽 칸, 타자 주자는 바깥 칸', restart: '이어서', tell: '1루에서는 바깥 칸을 밟아요.', ref: '5.6' },
      { id: 'force', name: '포스 · 태그 아웃', words: '루 밟음 터치 송구', kind: 'restart', verdict: '꼭 가야 하는 주자는 루를 밟아 아웃, 아니면 공으로 태그해야 아웃', restart: '이어서', tell: '', ref: '제5장' },
      { id: 'fly', name: '플라이 아웃', words: '뜬공 잡음', kind: 'restart', verdict: '타자 아웃 — 먼저 출발한 주자는 원래 루로 돌아가 밟아야 해요', restart: '이어서', tell: '', ref: '5.10' },
    ],
  },
  teeball: {
    scoreSteps: [1],
    calls: [
      { id: 'foul3', name: '파울 3번', words: '파울 세 번', kind: 'restart', verdict: '타자 아웃 (학교 규칙)', restart: '다음 타자', tell: '', ref: '플레이북' },
      { id: 'steal', name: '먼저 뛰기', words: '도루 리드 미리 출발', kind: 'violation', verdict: '공이 맞기 전에 떠난 주자는 원래 루로 (또는 아웃 — 미리 정한 대로)', restart: '다시 타격', tell: '주자는 공이 맞은 뒤 출발해요.', ref: '플레이북' },
      { id: 'fly', name: '플라이 아웃', words: '뜬공 잡음', kind: 'restart', verdict: '타자 아웃', restart: '이어서', tell: '', ref: '플레이북' },
      { id: 'force', name: '포스 아웃', words: '루 먼저 밟음', kind: 'restart', verdict: '꼭 가야 하는 주자보다 공을 가진 수비가 루를 먼저 밟으면 아웃', restart: '이어서', tell: '', ref: '플레이북' },
      { id: 'tag', name: '태그 아웃', words: '공으로 터치', kind: 'restart', verdict: '루를 떠난 주자를 공으로 건드리면 아웃', restart: '이어서', tell: '', ref: '플레이북' },
      { id: 'bat', name: '배트 던짐', words: '배트 던지기 위험', kind: 'card', verdict: '경고 (거듭되면 아웃 — 학교 규칙)', restart: '이어서', tell: '치고 나면 배트를 내려놓고 달려요.', ref: '플레이북' },
    ],
  },
}

/** 찾기: 이름 · 학생 말 · 판정에서 낱말이 모두 들어간 버튼 */
export function searchCalls(board: RefBoard, q: string): RefCall[] {
  const words = q.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return board.calls
  return board.calls.filter((c) => {
    const hay = `${c.name} ${c.words} ${c.verdict}`.replace(/\s+/g, '')
    return words.every((w) => hay.includes(w))
  })
}
