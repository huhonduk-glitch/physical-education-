import type { WorkSrc } from './peWork'

/**
 * 업무 흐름도 (2026-11-12 교사 요청 '각 업무의 흐름도', 6가지: 운동부 · 스포츠클럽 · 소위원회 · PAPS · 건강체력교실 · 체육대회).
 * 새 사실을 지어내지 않는다 — 앱에 이미 쪽수와 함께 들어 있는 자료를 시간 순서로 이어 붙인 것:
 *   peWork.ts(일정 · 나이스 메뉴 · 규정), peDocs.ts(매년 기안 문서 · 부록 98쪽 제출 일정), 운영방향 원문(176쪽판, pe-log-refs).
 * 쪽: final = 운영방향 누리집 PDF 176쪽판, plan = 탑재용 161쪽판, neis = 나이스 교육자료.
 * 근거가 없는 학교 자체 일(체육대회 계획 · 정산 등)은 src 없이 school: true → 화면에 '학교마다 달라요'.
 * 예산 · 견적서 → 품의는 돈이 드는 단계에 [예산]으로 끼워 넣는다(교사 결정 '5개 안에 녹여서').
 */

export type FlowKind = 'plan' | 'meeting' | 'neis' | 'submit' | 'edu' | 'run' | 'budget' | 'safety' | 'app'

export const FLOW_KIND: Record<FlowKind, { label: string; tone: string; dot: string }> = {
  plan: { label: '기안', tone: 'bg-brand-light text-brand', dot: 'bg-brand' },
  meeting: { label: '회의', tone: 'bg-[#f1ecff] text-[#5b3cc4]', dot: 'bg-[#6d4fd8]' },
  neis: { label: '나이스', tone: 'bg-[#e3f6f4] text-[#0b6e66]', dot: 'bg-[#0f8a80]' },
  submit: { label: '제출 · 보고', tone: 'bg-[#fff1e5] text-[#a24b00]', dot: 'bg-[#d9690f]' },
  edu: { label: '교육', tone: 'bg-[#e9eefc] text-[#2a46a8]', dot: 'bg-[#3a5bd0]' },
  run: { label: '운영', tone: 'bg-fill-2 text-ink-2', dot: 'bg-ink-3' },
  budget: { label: '예산', tone: 'bg-ok-light text-ok', dot: 'bg-ok' },
  safety: { label: '안전', tone: 'bg-danger-light text-danger', dot: 'bg-danger' },
  app: { label: 'PE LOG', tone: 'bg-[#eaf2ff] text-[#1957c2]', dot: 'bg-[#5598e7]' },
}

export interface FlowLink {
  to: string
  label: string
}

export interface FlowStep {
  when: string
  kind: FlowKind
  title: string
  detail?: string
  /** 근거 쪽 (여러 곳이면 배열) */
  src?: WorkSrc | WorkSrc[]
  /** 제주교육청 2026 기준 */
  local?: boolean
  /** 공식 근거 없이 학교마다 하는 일 */
  school?: boolean
  links?: FlowLink[]
}

export interface FlowPhase {
  title: string
  steps: FlowStep[]
}

export type FlowId = 'team' | 'club' | 'committee' | 'paps' | 'clinic' | 'sportsday'

export interface WorkFlow {
  id: FlowId
  title: string
  /** 칩에 쓰는 짧은 이름 */
  short: string
  summary: string
  phases: FlowPhase[]
}

const P = (page: WorkSrc['page']): WorkSrc => ({ doc: 'plan', page })
const F = (page: WorkSrc['page']): WorkSrc => ({ doc: 'final', page })
const N = (page: WorkSrc['page']): WorkSrc => ({ doc: 'neis', page })

const DOCS: FlowLink = { to: '/work/docs', label: '기안문 초안' }
const QUOTE: FlowLink = { to: '/work/quote', label: '견적서 → 품의' }
const BUDGET: FlowLink = { to: '/work/budget', label: '체육 예산 현황' }

export const WORK_FLOWS: WorkFlow[] = [
  {
    id: 'team',
    title: '학교운동부 · 학생선수',
    short: '운동부',
    summary: '연간 계획 · 나이스 등록 → 매월 상담 · 학기마다 교육과 간담회 → 학기 말 최저학력 확인 → 교육청 제출',
    phases: [
      {
        title: '학년 초',
        steps: [
          { when: '학년 초', kind: 'plan', title: '학교운동부 연간 운영 계획 수립 → 학교운영위원회 심의', detail: '일반현황 · 예산 편성 · 집행 계획 · 연간 훈련계획 · 안전대책 · 학생선수 상담 계획', src: F([78, 82]), links: [DOCS] },
          { when: '학년 초', kind: 'neis', title: '나이스 등록: 학교운동부 → 지도교사 · 지도자 → 학생선수', detail: '학교운동부 소속과 개인 활동 학생선수까지 파악해 등록', src: N([75, 87]), links: [{ to: '/work/team/neis', label: '나이스 순서' }] },
          { when: '4월 1일 기준', kind: 'submit', title: '학교운동부 현황 · 체육특기자 현황 나이스 입력', src: F(98), local: true },
          { when: '3.20', kind: 'submit', title: '학생선수 현황(엑셀 서식 3) · 졸업생 진로 진학 현황(서식 2) 교데통 제출', detail: '학생선수 현황은 9.11에 한 번 더', src: F(98), local: true },
          { when: '학년 초', kind: 'run', title: '최저학력제 적용 과목 정하고 학생선수 · 학부모에게 안내', detail: '(고) 영어 · 사회를 수학 · 과학으로 바꾸면 소위원회 심의 후 학교장 결정', src: P([65, 70]) },
          { when: '학년 초 1회', kind: 'run', title: '청렴서약서 받기 (운동부지도자 · 학생선수 · 학부모, 양식 7)', src: P(70), local: true },
        ],
      },
      {
        title: '연중',
        steps: [
          { when: '매월 1회 이상', kind: 'run', title: '학생선수 상담 (개인별 상담일지 기록 · 결재)', detail: '운동부지도자 상담과 따로', src: P(50) },
          { when: '수시', kind: 'neis', title: '출결(출석인정결석 허용일수) · 훈련일지 나이스 입력', detail: '출결은 담임교사가 학적에서 마감한 뒤 담당 교사가', src: N([88, 93]), links: [{ to: '/work/team/neis', label: '나이스 순서' }] },
          { when: '대회 · 훈련 전', kind: 'plan', title: '대회 참가계획 + 보충학습계획(내부결재), 전지훈련은 1개월 전 계획서 사전보고', src: F([78, 82]) },
          { when: '사유가 생기면', kind: 'budget', title: '전국규모대회 참가 지원금 신청서 · 정산서 (양식 2)', detail: '운동부 물품 · 경비 품의는 견적서 → 품의에서 품목 표와 초안을', src: F(98), local: true, links: [QUOTE, BUDGET] },
          { when: '학기마다', kind: 'edu', title: '학생선수 인권교육 · 학교폭력예방교육 · 진로교육 (학기별 1회)', src: P([46, 51]), links: [{ to: '/work/team/edu', label: '받아야 할 교육' }] },
          { when: '연 1회 이상', kind: 'edu', title: '성폭력 예방교육 · 도핑방지교육', src: P([46, 56]) },
          { when: '학기마다', kind: 'meeting', title: '학교장 주재 학생선수 · 지도자 · 학부모 간담회, 학교장 청렴서한문', src: P(70) },
          { when: '4~6월', kind: 'run', title: '학생선수 폭력피해 실태조사', detail: '2026년부터 시기가 바뀜', src: P(54) },
          { when: '6.2 · 10.30', kind: 'submit', title: '학교운동부 청렴도 제고 실적 (엑셀 서식 5) 교데통 제출', src: F(98), local: true },
          { when: '6.23 · 12.1', kind: 'submit', title: '간담회 · 서한문 · 서약서 결과 보고 (고 → 도교육청 체육건강과)', src: P(70), local: true },
        ],
      },
      {
        title: '학기 말 · 연말',
        steps: [
          { when: '학기 말', kind: 'neis', title: '최저학력 도달 확인 → 미도달은 기초학력보장 프로그램(e-School Run-Up) 이수', src: P(64), links: [{ to: '/work/team/neis', label: '나이스 순서' }] },
          { when: '6.26 · 12.18', kind: 'submit', title: '학생선수 재활치료비 신청서 · 청구서 (양식 4)', src: F(98), local: true },
          { when: '11.20', kind: 'submit', title: '동계강화훈련 계획서 (양식 1)', src: F(98), local: true },
          { when: '1학기말 · 2학기말', kind: 'submit', title: '학생선수 최저학력제 시행 현황 등 보고 (공문 참조)', src: F(98), local: true },
        ],
      },
    ],
  },
  {
    id: 'club',
    title: '학교스포츠클럽',
    short: '스포츠클럽',
    summary: '소위원회에서 조직 → 연간 계획 기안 → 나이스 등록 → 매월 활동 입력 → 11.20 마무리 → 학생부',
    phases: [
      {
        title: '학년 초 (3~4월)',
        steps: [
          { when: '3~4월', kind: 'meeting', title: '학교체육소위원회를 거쳐 클럽 조직', detail: '등록 학생이 10명 아래로 불가피하면 소위원회가 등록 여부를 정해요', src: F([37, 38]), local: true, links: [{ to: '/work/committee/meetings', label: '회의 기록' }] },
          { when: '3~4월', kind: 'plan', title: '전체 · 클럽별 연간 운영 계획 기안 (필수)', detail: '클럽 · 지도교사 · 학생 수, 활동 시간 · 장소 · 대회, 활성화 지원비 예산', src: F([37, 38]), links: [DOCS] },
          { when: '활동 시작 전', kind: 'plan', title: '정규교육과정 외 클럽 운영 계획 → 학교장 승인 (필수)', detail: '동아리 시간 밖(0교시 · 점심 · 공휴일 · 토요일)에 활동하는 클럽', src: F([38, 39]), links: [DOCS] },
          { when: '4월~', kind: 'neis', title: '나이스 등록: 종목 확인 → 지도교사 · 강사 → 클럽 · 구성원', src: N([108, 116]), links: [{ to: '/work/club/neis', label: '나이스 순서' }] },
        ],
      },
      {
        title: '연중 (3~12월)',
        steps: [
          { when: '매월', kind: 'neis', title: '클럽 활동(연습 · 대회) → 활동내역 나이스 입력', detail: '월별 입력 권장', src: P(33), local: true },
          { when: '필요할 때', kind: 'budget', title: '활성화 지원비 집행 — 물품은 견적서 → 품의', detail: '강사비는 지원비의 20%(10학급 이하 30%) 안, 내부강사 시간당 33,000원. 남은 돈은 체육 예산 현황에서', src: P(33), local: true, links: [QUOTE, BUDGET] },
          { when: '9.19~20', kind: 'run', title: '교육감배 학교스포츠클럽축전', detail: '교내 등록 후 10시간 이상 활동한 팀이 참가', src: P([3, 39]), local: true },
        ],
      },
      {
        title: '연말',
        steps: [
          { when: '11.20까지', kind: 'submit', title: '학교스포츠클럽 등록 및 실적 나이스 마무리', src: F(98), local: true },
          { when: '나이스 마무리 뒤', kind: 'neis', title: '담임교사가 학생부로 가져오기', detail: '정규교육과정 밖 클럽은 동아리활동란에 클럽명과 활동시간만(평일 2시간 · 공휴일 4시간까지, 20분 단위). 특기사항은 정규교육과정 안의 클럽(중학교 창체)만', src: P([34, 35]), links: [{ to: '/work/club/neis', label: '나이스 순서' }] },
        ],
      },
    ],
  },
  {
    id: 'committee',
    title: '학교체육소위원회',
    short: '소위원회',
    summary: '학년 초 규정 · 위원 구성 → 3~4월 클럽 조직 심의 → 학기마다 정기회의(연 2회) → 필요할 때 임시회의',
    phases: [
      {
        title: '학년 초',
        steps: [
          { when: '학년 초', kind: 'plan', title: '소위원회 규정 정비 · 위원 구성', detail: '5~7명, 외부위원 1명 이상. 학교운영위원회와 분리 운영', src: F([6, 19]), local: true, links: [{ to: '/work/committee/meetings', label: '위원 명단' }] },
          { when: '3~4월', kind: 'meeting', title: '학교스포츠클럽 조직 심의', src: F(37), local: true },
        ],
      },
      {
        title: '학기마다',
        steps: [
          { when: '회의 5일 전', kind: 'run', title: '간사가 안건을 위원에게 알림 (규정 예시)', detail: '긴급하면 예외 · 서면결의 후 다음 회의에 보고', src: F(157) },
          { when: '1학기 1회', kind: 'meeting', title: '1학기 정기회의', detail: '재적 과반수 출석으로 열고 출석 3분의 2 이상 찬성으로 의결 (규정 예시)', src: F([19, 157]), local: true, links: [{ to: '/work/committee/meetings', label: '회의 기록 · 회의록' }] },
          { when: '2학기 1회', kind: 'meeting', title: '2학기 정기회의 (연 2회 의무)', src: F([19, 157]), local: true, links: [{ to: '/work/committee/meetings', label: '회의 기록 · 회의록' }] },
          { when: '회의 뒤', kind: 'plan', title: '회의 결과 · 회의록 기안 (필수)', detail: '엑셀 서식 11 점검표 칸: 소위원회 개최일자 · 회의록 작성 여부', src: F(19), links: [DOCS] },
        ],
      },
      {
        title: '필요할 때',
        steps: [
          { when: '필요할 때', kind: 'meeting', title: '임시회의', detail: '위원 3분의 1 이상 요구, 교육감(교육장) 요청, 위원장이 필요하다고 볼 때', src: F(157) },
          { when: '사안이 생기면', kind: 'meeting', title: '소위원회를 거쳐야 하는 일', detail: '클럽 10명 미만 등록 · 최저학력 과목 변경 · 운동부 창단 · 해체 · 지도자 자격 승인 · 운동부 폭력 신고 조사(7일 안에 학교장에게)', src: [F(38), F(70), F(84), F(29), F(151)], local: true, links: [{ to: '/work/committee/rules', label: '지침 · 심의할 일' }] },
        ],
      },
    ],
  },
  {
    id: 'paps',
    title: '학생건강체력평가 (PAPS)',
    short: 'PAPS',
    summary: '3월 실시 계획 → 집중 측정 · 결과 통지 → 나이스 입력(5.29) → 4~5등급 수시 측정 · 건강체력교실 → 통계(11월 말) · 측정결과 제출(12.18)',
    phases: [
      {
        title: '학년 초 (3월)',
        steps: [
          { when: '3월', kind: 'plan', title: 'PAPS 실시 계획 기안 (필수)', detail: '대상(초4~고3), 측정 종목, 3월 집중 측정 일정 · 측정 교사, 4~5등급 수시 측정과 건강체력교실 연계', src: F([21, 23]), links: [DOCS] },
          { when: '3월', kind: 'app', title: '반마다 측정 종목 정하기', detail: '나이스 PAPS 양식 머리글을 등록하면 칸이 똑같아져요', links: [{ to: '/paps/setup', label: '측정 설정' }] },
          { when: '3월 집중', kind: 'run', title: '측정 (교사 평가 권장)', src: F([21, 23]), links: [{ to: '/paps', label: '기록 입력' }, { to: '/timer?tab=paps&aid=shuttle', label: '왕복오래달리기' }] },
        ],
      },
      {
        title: '상반기',
        steps: [
          { when: '측정 뒤', kind: 'run', title: '결과를 학생 · 학부모에게 제공 (의무)', src: F([21, 23]), links: [{ to: '/paps/results', label: '결과 · 등급' }] },
          { when: '5.29까지', kind: 'submit', title: '학생건강체력평가 결과 나이스 입력', detail: '빈칸 · 범위 오류가 있으면 파일 전체가 거부돼요 — 앱이 먼저 검사', src: F(98), local: true, links: [{ to: '/paps/export', label: '나이스 파일' }] },
        ],
      },
      {
        title: '연중 · 연말',
        steps: [
          { when: '4월~', kind: 'run', title: '4~5등급 학생 수시 측정 → 건강체력교실 연계', src: F([21, 23]), links: [{ to: '/paps/clinic', label: '건강체력교실' }] },
          { when: '11월 말', kind: 'submit', title: '학생건강체력 나이스 통계 제출', detail: '나이스 [PAPS] 통계 생성 → 기안(승인요청) → 교육청 전송', src: [F(98), F([21, 23])], local: true },
          { when: '12.18', kind: 'submit', title: 'PAPS 측정결과 (엑셀 서식 14) 교데통 제출 (고 → 도교육청)', detail: '미측정 학생 관리부(서식 12)도 앱이 채워 줘요', src: F(98), local: true, links: [{ to: '/paps/school', label: '학교 전체 결과 · 서식' }] },
        ],
      },
    ],
  },
  {
    id: 'clinic',
    title: '건강체력교실',
    short: '건강체력교실',
    summary: '상반기 PAPS 뒤 대상 선정 → 운영 계획 기안(법정 의무) → 연중 운영 · 참여 기록 → 다시 측정 → 체력 변화 분석',
    phases: [
      {
        title: '상반기 PAPS 뒤',
        steps: [
          { when: '측정 뒤', kind: 'app', title: '대상 학생 찾기', detail: '대상: PAPS 4~5등급, 비만 판정 학생 및 참여 희망자 (기준은 학교 지침에 맞게)', src: F([23, 24]), links: [{ to: '/paps/school', label: '학교 전체 결과 · 대상 후보' }] },
          { when: '학년 초', kind: 'plan', title: '건강체력교실 운영 계획 기안 (법정 의무)', detail: '학교체육 진흥법 제9조 · 시행규칙 제5조: 운영 시기 · 담당자, 프로그램, 참여 학생 지도 · 관리 방안', src: F([23, 24]), links: [DOCS, { to: '/paps/clinic', label: '운영계획 칸' }] },
          { when: '계획과 함께', kind: 'budget', title: '예산: 학교운영기본경비 권장사업', detail: '10학급 미만 200만 원 · 10~19학급 250만 원 · 20학급 이상 300만 원. 업무추진비 · 간식비는 편성할 수 없어요. 운동 기구는 견적서 → 품의로', src: F([23, 24]), local: true, links: [QUOTE, BUDGET] },
        ],
      },
      {
        title: '연중',
        steps: [
          { when: '연중', kind: 'run', title: '운영 (한시적이 아니라 연중)', detail: '참여 학생 · 활동 기록 · 참여 체크', src: F([23, 24]), links: [{ to: '/paps/clinic', label: '참여 · 활동 기록' }] },
        ],
      },
      {
        title: '하반기 · 연말',
        steps: [
          { when: '다시 측정 뒤', kind: 'run', title: '참여 학생의 체력 변화 분석 (운영 결과)', detail: '1회차 → 최근 회차 비교, 엑셀로 받기', src: F([23, 24]), links: [{ to: '/paps/clinic', label: '변화 분석' }] },
          { when: '점검 때', kind: 'submit', title: '엑셀 서식 11 점검표 칸: 운영 계획 수립일자 · 주당 운영 시간', src: F([23, 24]), local: true },
        ],
      },
    ],
  },
  {
    id: 'sportsday',
    title: '체육대회 (학교체육행사)',
    short: '체육대회',
    summary: '계획 기안 → 종목 · 팀 · 대진 → 물품 품의 → 교직원 사전 안전교육 · 시설 점검 → 당일 운영 · 사고 대응 → 정리 · 정산',
    phases: [
      {
        title: '계획',
        steps: [
          { when: '근거', kind: 'run', title: '학교장은 학교체육행사를 정기적으로 열고 필요한 경비를 학교 예산에서 확보', detail: '학교체육 진흥법 제6조 ① 7호 · ②', src: F(115) },
          { when: '행사 전', kind: 'plan', title: '체육대회 운영 계획 기안', detail: '일시 · 장소 · 종목 · 운영 조직 · 예산 · 안전 대책 · 우천 계획 등 (공식 서식 없음)', school: true },
          { when: '행사 전', kind: 'app', title: '종목 · 규칙 정하기 → 학급별 팀 · 대진표', detail: '종목 규칙 그림으로 학생 안내, 팀 나누기, 대진표는 SPORTS BRACKET', links: [{ to: '/sports', label: '종목 수업자료' }, { to: '/tools/teams', label: '팀 나누기' }, { to: '/tools/apps', label: '대진표' }] },
          { when: '행사 전', kind: 'budget', title: '물품 · 시상품 구입: 견적서 → 품의', detail: '어느 예산에서 쓸지 고르면 쓰고 난 뒤 잔액이 보여요', school: true, links: [QUOTE, BUDGET] },
        ],
      },
      {
        title: '안전 준비',
        steps: [
          { when: '행사 전 (의무)', kind: 'safety', title: '교직원 대상 사전 안전교육', detail: '운동회 · 체육대회 · 학교 축제 등 각종 행사 전 실시 의무화', src: F(92), local: true },
          { when: '매달 4일 (의무)', kind: 'safety', title: '학교체육시설 안전 점검 · 관리 대장 작성', detail: '월 1회 의무 점검 — 행사 전에도 한 번 더 확인하면 좋아요', src: F(94), local: true },
          { when: '행사 전', kind: 'run', title: '경쟁이 과열될 종목은 규칙을 바꿔 운영', detail: '체육수업 안전 지도 내용 — 체육대회에도 참고. 예) 반칙하면 2분간 퇴장', src: F(92), local: true },
        ],
      },
      {
        title: '당일',
        steps: [
          { when: '당일', kind: 'app', title: '경기 진행: 점수 · 시간 · 판정', links: [{ to: '/referee', label: 'AI 보조심판' }, { to: '/timer', label: '타이머' }] },
          { when: '사고가 나면', kind: 'safety', title: '안전사고 대응 · 보고', detail: '경중과 관계없이 학교 관리자에게 보고 → 응급조치 · 119(필요하면 112) · 보호자 연락 → 원인 · 피해 파악 후 보고 (고 → 도교육청 안전관리과 · 체육건강과)', src: F(93), local: true },
        ],
      },
      {
        title: '마무리',
        steps: [
          { when: '행사 뒤', kind: 'run', title: '결과 · 시상 정리, 예산 정산', detail: '공식 서식 없음 — 다음 해 일정은 업무 달력에', school: true, links: [{ to: '/work/calendar', label: '업무 달력' }] },
        ],
      },
    ],
  },
]

/** 체육대회 [안전] 하위 메뉴: 운영방향 원문 92~94쪽 문장만 (제주 2026) */
export const SPORTSDAY_SAFETY: { title: string; lines: { text: string; src: WorkSrc; local?: boolean }[] }[] = [
  {
    title: '행사 전',
    lines: [
      { text: '운동회 · 체육대회 · 학교 축제 등 각종 행사 전 교직원 대상 사전 안전교육 실시 (의무화)', src: F(92), local: true },
      { text: '학교 단위 교직원 심폐소생술 등 안전교육: 연간 4시간 이상', src: F(92), local: true },
      { text: '학교체육시설 · 놀이시설 안전 점검 월 1회 의무(매달 4일) · 안전 점검 관리 대장 작성, 일일 점검 권장', src: F(94), local: true },
      { text: '교외 대회 참가 · 전지훈련 · 생존수영 때는 학생 · 인솔자 휴대폰 비상연락망을 만들어 학교에서 관리', src: F(92), local: true },
      { text: '경쟁 과열이 우려되는 종목은 규칙을 바꿔 운영 — 예) 반칙하면 2분간 퇴장 (체육수업 안전 지도 내용)', src: F(92), local: true },
    ],
  },
  {
    title: '사고가 나면 (순서대로)',
    lines: [
      { text: '① 사고의 경중과 관계없이 학교 관리자에게 반드시 보고', src: F(93) },
      { text: '② 응급조치: 환자 상태 관찰 · 응급 처치, 의료기관 이송 여부 결정, 119 · 112 등 협조 요청, 보호자에게 연락', src: F(93) },
      { text: '③ 사고 원인 · 피해 상황을 파악해 관할 교육(지원)청에 보고', src: F(93) },
      { text: '보고 체계: 고 · 특수학교 → 도교육청(안전관리과 · 체육건강과), 초 · 중학교 → 교육지원청 → 도교육청', src: F(93), local: true },
      { text: '이동 중 교통사고, 골절 · 3인 이상 동시 부상 등 입원 치료가 필요한 부상, 익수사고는 즉시 신고하고 학교 · 교육청 담당자에게 바로 보고', src: F(93), local: true },
    ],
  },
]

export function workFlow(id: string): WorkFlow | undefined {
  return WORK_FLOWS.find((f) => f.id === id)
}
