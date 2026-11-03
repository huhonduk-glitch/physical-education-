import type { Figure } from './sports'

/**
 * 절에 붙이는 자유 이용 삽화 (2026-11-03 교사 요청: "자유 이용 삽화를 최대한 찾아서 넣어").
 * 위키미디어 공용 · rawpixel 퍼블릭 도메인에서 CC0 · CC BY · CC BY-SA만, 그림 내용을 눈으로 확인하고 고름.
 * 저작자 · 라이선스는 sportPhotos.ts. 절에 이미 그림(경기장 · 사진)이 있으면 그것을 그대로 둔다.
 * 교과서 · 출판사 그림은 넣지 않는다(저작권, 공개 저장소).
 */
export const SECTION_ILLUST: Record<string, Record<string, Figure>> = {
  basketball: { 기술: { kind: 'photo', photo: 'il-bb-jumpshot', caption: '점프 슛 — 무릎을 굽혔다 펴며 가장 높은 곳에서 손목으로 밀어 던져요' } },
  football: {
    '한눈에 보기': { kind: 'photo', photo: 'il-fb-player', caption: '공을 몰고 가는 선수(드리블)' },
    '주요 규칙 — 오프사이드': { kind: 'photo', photo: 'il-fb-offside', caption: '오프사이드 위치: 왼쪽 파랑 공격수가 공과 뒤에서 두 번째 수비수(점선)보다 상대 골라인에 가까워요' },
  },
  futsal: { 포지션: { kind: 'photo', photo: 'il-fs-22', caption: '2-2 배치 — GK 골레이로 · A 뒤 수비(픽소) · F 양쪽(알라) · P 맨 앞(피보)' } },
  volleyball: { 포지션: { kind: 'photo', photo: 'il-vb-rotation', caption: '자리 번호 1~6과 로테이션 — 서브권을 얻으면 시계 방향으로 한 칸씩 돌아요' } },
  tabletennis: { '한눈에 보기': { kind: 'photo', photo: 'il-tt-players', caption: '탁구 경기' } },
  tennis: { '한눈에 보기': { kind: 'photo', photo: 'il-tn-player', caption: '포핸드를 준비하는 선수' } },
  baseball: { '한눈에 보기': { kind: 'photo', photo: 'il-bs-scene', caption: '타자 · 포수 · 주심' } },
  softball: { 기술: { kind: 'photo', photo: 'il-bs-batter', caption: '타격 준비 자세 (야구 그림)' } },
  teeball: { 기술: { kind: 'photo', photo: 'il-bs-batter', caption: '타격 준비 자세 (야구 그림)' } },
  jumprope: { '한눈에 보기': { kind: 'photo', photo: 'il-jr-longrope', caption: '긴 줄넘기 — 두 사람이 줄을 돌리고 가운데서 뛰어요' } },
}
