/**
 * 선생님이 직접 만든 종목 그림 (2026-11-03 교사 요청: "이런 시각자료를 규칙 있는 곳에").
 * 파일은 public/sports/posters/. 종목 화면의 '한 장으로 보는 규칙'과 슬라이드 · PPT 앞쪽에 들어간다.
 * 그림 속 글이 공식 규칙서와 다른 곳은 지우지 않고 note로 바로잡는다(규칙서 원문을 다시 읽고 확인).
 */
export interface Poster {
  src: string
  title: string
  credit: string
  /** 그림 아래 바로잡기 · 덧붙임 (조항과 함께) */
  note?: string
}

export const SPORT_POSTERS: Record<string, Poster[]> = {
  netball: [
    {
      src: 'sports/posters/nb-rules7.jpg',
      title: '넷볼 7가지 주요 규칙',
      credit: '선생님 제작',
      note: '6 풋워크: 착지한 발은 들 수 있어요. 다만 그 발이 다시 바닥에 닿기 전에 패스 · 슛해야 해요 [규칙 13]. 7 스로인: 코트 밖에 서서, 한 발 이상을 선에서 15 cm 안에 둬요 [규칙 6.11].',
    },
    {
      src: 'sports/posters/nb-positions.jpg',
      title: '포지션마다 들어갈 수 있는 구역',
      credit: '선생님 제작',
    },
  ],
}
