import type { Figure } from './sports'

/**
 * 절에 붙이는 자유 이용 삽화 (2026-11-03 교사 요청: "자유 이용 삽화를 최대한 찾아서 넣어").
 * 위키미디어 공용 · rawpixel 퍼블릭 도메인에서 CC0 · CC BY · CC BY-SA만, 그림 내용을 눈으로 확인하고 고름.
 * 저작자 · 라이선스는 sportPhotos.ts. 절에 이미 그림(경기장 · 사진)이 있으면 그것을 그대로 둔다.
 * 교과서 · 출판사 그림은 넣지 않는다(저작권, 공개 저장소).
 */
export const SECTION_ILLUST: Record<string, Record<string, Figure>> = {
  basketball: {
    기술: { kind: 'photo', photo: 'il-bb-jumpshot', caption: '점프 슛 — 무릎을 굽혔다 펴며 가장 높은 곳에서 손목으로 밀어 던져요' },
    포지션: { kind: 'photo', photo: 'il-bb-positions', caption: '공격 때 다섯 자리 — ① 포인트 가드 ② 슈팅 가드 ③ 스몰 포워드 ④ 파워 포워드 ⑤ 센터' },
    전술: { kind: 'photo', photo: 'il-bb-zone', caption: '2-3 지역 방어 — 앞에 2명(①②), 뒤에 3명(④⑤③)이 사람 대신 구역을 맡아 골 밑을 지켜요' },
  },
  football: {
    '한눈에 보기': { kind: 'photo', photo: 'il-fb-player', caption: '공을 몰고 가는 선수(드리블)' },
    '주요 규칙 — 오프사이드': { kind: 'photo', photo: 'il-fb-offside', caption: '오프사이드 위치: 왼쪽 파랑 공격수가 공과 뒤에서 두 번째 수비수(점선)보다 상대 골라인에 가까워요' },
  },
  futsal: { 포지션: { kind: 'photo', photo: 'il-fs-22', caption: '2-2 배치 — GK 골레이로 · A 뒤 수비(픽소) · F 양쪽(알라) · P 맨 앞(피보)' } },
  volleyball: {
    역사: { kind: 'photo', photo: 'vb-morgan', caption: '윌리엄 G. 모건 — 1895년 홀리오크 YMCA에서 배구(처음 이름 민토네트)를 만들었어요' },
    '경기장 · 인원': { kind: 'photo', photo: 'il-vb-court', caption: '배구 코트 18 m × 9 m — 가운데 점선이 네트, 양쪽 가로선이 공격선(어택 라인)' },
    포지션: { kind: 'photo', photo: 'il-vb-rotation', caption: '자리 번호 1~6과 로테이션 — 서브권을 얻으면 시계 방향으로 한 칸씩 돌아요' },
    기술: { kind: 'photo', photo: 'il-vb-picto', caption: '네트 앞에서 뛰어올라 공을 치는 모습(배구 픽토그램)' },
  },
  badminton: {
    경기장: { kind: 'photo', photo: 'il-bd-court', caption: '배드민턴 코트 — 안쪽 세로선은 단식, 바깥 세로선은 복식 옆줄. 네트 가까운 가로선이 짧은 서비스 라인' },
    서브: { kind: 'photo', photo: 'il-bd-serve', caption: '서브가 떨어져야 하는 곳(초록) — 서버 점수가 짝수면 오른쪽, 홀수면 왼쪽 서비스 코트에서 대각선으로. 단식은 길고 좁게, 복식은 짧고 넓게. 맨 아래는 서브 뒤 랠리 때 코트' },
    기술: { kind: 'photo', photo: 'il-bd-picto', caption: '몸을 뻗어 셔틀콕을 치는 모습(배드민턴 픽토그램)' },
  },
  tabletennis: {
    '한눈에 보기': { kind: 'photo', photo: 'il-tt-players', caption: '탁구 경기' },
    기술: { kind: 'photo', photo: 'il-tt-picto', caption: '라켓으로 공을 치는 모습(탁구 픽토그램)' },
  },
  tennis: {
    '한눈에 보기': { kind: 'photo', photo: 'il-tn-player', caption: '포핸드를 준비하는 선수' },
    경기장: { kind: 'photo', photo: 'il-tn-court', caption: '테니스 코트 — 안쪽 세로선 사이가 단식(8.23 m), 바깥 세로선 사이가 복식(10.97 m)이에요' },
  },
  baseball: {
    '한눈에 보기': { kind: 'photo', photo: 'il-bs-scene', caption: '타자 · 포수 · 주심' },
    경기장: { kind: 'photo', photo: 'il-bs-diamond', caption: '내야 — 홈 플레이트 · 1루 · 2루 · 3루가 정사각형을 이루고, 가운데에 투수 마운드, 양쪽으로 파울 라인이 뻗어요' },
    포지션: { kind: 'photo', photo: 'il-bs-positions', caption: '수비 아홉 자리 — 그림 속 번호는 기록할 때 쓰는 수비 번호예요(1 투수 · 2 포수 · 3 1루수 · 4 2루수 · 5 3루수 · 6 유격수 · 7 좌익수 · 8 중견수 · 9 우익수)' },
  },
  softball: {
    '한눈에 보기': { kind: 'photo', photo: 'il-sb-picto', caption: '공을 던지는 모습(소프트볼 픽토그램)' },
    기술: { kind: 'photo', photo: 'il-bs-batter', caption: '타격 준비 자세 (야구 그림)' },
  },
  handball: { 기술: { kind: 'photo', photo: 'il-hb-picto', caption: '뛰어올라 공을 던지는 모습(핸드볼 픽토그램)' } },
  netball: { '한눈에 보기': { kind: 'photo', photo: 'il-nb-picto', caption: '골 링을 향해 공을 던지는 모습(넷볼 픽토그램)' } },
  athletics: { '한눈에 보기': { kind: 'photo', photo: 'il-at-picto', caption: '달리는 모습(육상 픽토그램)' } },
  gymnastics: { '한눈에 보기': { kind: 'photo', photo: 'il-gy-picto', caption: '거꾸로 선 동작(기계체조 픽토그램)' } },
  teeball: { 기술: { kind: 'photo', photo: 'il-bs-batter', caption: '타격 준비 자세 (야구 그림)' } },
  jumprope: { '한눈에 보기': { kind: 'photo', photo: 'il-jr-longrope', caption: '긴 줄넘기 — 두 사람이 줄을 돌리고 가운데서 뛰어요' } },
}
