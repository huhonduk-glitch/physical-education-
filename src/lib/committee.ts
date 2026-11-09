/**
 * 학교체육소위원회 회의 기록 (2026-11-09 교사 요청 "절차랑 회의록 서식 등등 추가").
 *
 * 근거: 제주교육청 「2026 체육교육운영방향(최종)」 누리집 PDF
 *  - 6 · 19쪽: 학교운영위원회와 분리 운영, 5~7명(외부위원 1명 이상), 협의회 학기별 1회 · 연 2회 의무 개최
 *  - 156~157쪽 '학교체육소위원회 운영 규정(예시)': 제2조 기능(심의 사항) · 제3조 구성 · 제5조 운영
 *    (정기회의 연 2회 반기별 + 임시회의, 과반수 출석 개의 · 출석위원 3분의 2 이상 찬성 의결, 안건 5일 전 통보, 서면결의, 본인 관련 사안 심의 불참)
 *  - 84쪽: 운동부 창단은 '학교체육소위원회 개최(학교장 결재)', 해체 보고에 '체육소위원회 회의록' 첨부
 *  - 서식 '11. 학교체육운영 점검표': 소위원회 개최일자 · 회의록 작성 기록 여부를 점검
 * 회의록 서식은 위 자료에 없다 → 앱의 회의록은 '학교 자체 양식 예시'로 표시한다(공식 서식 아님).
 * 저장: settings.committee[학년도] (이 기기 · 백업). 위원 이름은 교직원 · 학부모라 학생 정보가 아니다.
 */
import { addDays } from './dates'

export type MemberKind = '당연직' | '위촉' | '외부'
export interface CommitteeMember {
  id: string
  name: string
  /** 직위 (예: 교감, 체육부장, 학부모위원, 보건교사, 지역 체육회) */
  role: string
  kind: MemberKind
  /** 위원장 · 부위원장 · 간사 */
  post?: '위원장' | '부위원장' | '간사'
}

export type MeetingKind = '1학기 정기' | '2학기 정기' | '임시' | '서면결의'
export type Decision = '원안 가결' | '수정 가결' | '부결' | '보고(의결 없음)' | ''
export interface AgendaItem {
  title: string
  /** 제안 설명 · 주요 논의 */
  body: string
  decision: Decision
  /** 찬성 · 반대 (의결한 안건만) */
  yes?: number
  no?: number
}
export interface CommitteeMeeting {
  id: string
  kind: MeetingKind
  date: string
  time: string
  place: string
  /** 참석한 위원 id */
  present: string[]
  agenda: AgendaItem[]
  /** 기타 · 다음 회의 */
  note: string
  /** 학교장 결재 날짜 (없으면 아직) */
  approvedOn?: string
}
export interface CommitteeYear {
  members: CommitteeMember[]
  meetings: CommitteeMeeting[]
}
export const EMPTY_COMMITTEE: CommitteeYear = { members: [], meetings: [] }

/** 회의 절차 (규정 예시 제5조 · 84쪽) — 화면 안내와 회의록 체크에 같이 쓴다 */
export const MEETING_STEPS: { text: string; page: number | [number, number] }[] = [
  { text: '학년 초: 위원 구성 5~7명(당연직 교감 · 체육 업무 부장, 위촉 위원에 학부모 위원 포함, 외부위원 1명 이상), 위원장 호선 · 간사 지명', page: [19, 156] },
  { text: '정기회의는 학기마다 1번(연 2회 의무), 필요하면 임시회의(위원 3분의 1 이상 요구 · 교육감(교육장) 요청 · 위원장 판단)', page: [19, 157] },
  { text: '간사가 회의 5일 전까지 안건을 위원에게 알림 (긴급하면 예외)', page: 157 },
  { text: '참석 대상 위원 과반수가 나와야 회의를 열 수 있음', page: 157 },
  { text: '출석 위원 3분의 2 이상 찬성으로 의결. 본인이 직접 관련된 안건은 그 위원이 심의에 빠짐', page: 157 },
  { text: '긴급한 안건은 서면결의로 하고 다음 회의에 보고', page: 157 },
  { text: '회의록 작성 → 학교장 결재 (운동부 창단은 소위원회 개최를 학교장 결재, 해체 보고에는 회의록 첨부)', page: 84 },
  { text: '교육청 점검 때 개최일자 · 회의록 작성 여부를 확인 (서식 11 학교체육운영 점검표)', page: 19 },
]

/** 안건 추천 — 규정 예시 제2조 심의 사항과 운영방향의 '소위원회를 거치는 일' */
export const AGENDA_PRESETS: { title: string; when?: string; page: number }[] = [
  { title: '학교체육소위원회 위원 구성 및 운영 규정 정비', when: '1학기', page: 6 },
  { title: '학교스포츠클럽 조직 및 연간 운영 계획', when: '1학기', page: 37 },
  { title: '등록 인원 10명 미만 학교스포츠클럽 등록 여부', when: '1학기', page: 38 },
  { title: '건강체력교실 운영 계획 및 비만 판정 학생 대책', when: '1학기', page: 156 },
  { title: '학생선수 등록 및 탈퇴', page: 156 },
  { title: '학생선수 최저학력제 적용 과목 및 운영', when: '1학기', page: 70 },
  { title: '학생선수 학습권 보장 및 인권 보호', page: 156 },
  { title: '학교운동부 창단 · 해체', page: 84 },
  { title: '여학생 체육활동 활성화 계획', when: '1학기', page: 156 },
  { title: '학교체육 인력 채용 계획 (학교운영위원회 심의 시 생략 가능)', page: 156 },
  { title: '학교스포츠클럽 · 건강체력교실 운영 결과', when: '2학기', page: 156 },
]

/** 성원: 참석 대상 위원의 과반수 */
export function quorum(memberCount: number, presentCount: number): { needed: number; ok: boolean } {
  const needed = Math.floor(memberCount / 2) + 1
  return { needed, ok: memberCount > 0 && presentCount >= needed }
}

/** 의결: 출석 위원 3분의 2 이상 찬성 */
export function passNeeded(presentCount: number): number {
  return Math.ceil((presentCount * 2) / 3)
}

/** 찬성 수가 의결 기준을 넘었는지 (찬반을 적지 않았으면 null) */
export function passed(item: AgendaItem, presentCount: number): boolean | null {
  if (item.yes === undefined) return null
  return item.yes >= passNeeded(presentCount)
}

/** 안건 통보 기한: 회의 5일 전 */
export function noticeBy(date: string): string {
  return addDays(date, -5)
}

/** 학기 (1학기: 학년도 3/1 ~ 8/16, 2학기: 8/17 ~ 다음 해 2월) */
export function semesterOf(date: string, schoolYear: number): 1 | 2 | null {
  if (date >= `${schoolYear}-03-01` && date < `${schoolYear}-08-17`) return 1
  if (date >= `${schoolYear}-08-17` && date < `${schoolYear + 1}-03-01`) return 2
  return null
}

/** 학기마다 정기회의를 열었는지 (연 2회 의무) · 회의록 결재 여부 — 점검표 칸에 맞춤 */
export function yearStatus(meetings: readonly CommitteeMeeting[], schoolYear: number): { sem: 1 | 2; held: CommitteeMeeting[]; ok: boolean }[] {
  return ([1, 2] as const).map((sem) => {
    const held = meetings.filter((m) => m.kind !== '서면결의' && semesterOf(m.date, schoolYear) === sem).sort((a, b) => a.date.localeCompare(b.date))
    return { sem, held, ok: held.length > 0 }
  })
}

/** 위원 구성 점검 (5~7명, 외부위원 1명 이상, 위원장 · 간사) */
export function memberProblems(members: readonly CommitteeMember[]): string[] {
  const out: string[] = []
  if (members.length < 5 || members.length > 7) out.push(`위원 ${members.length}명 — 운영방향은 5~7명 안팎`)
  if (!members.some((m) => m.kind === '외부')) out.push('외부위원이 없어요 (1명 이상)')
  if (!members.some((m) => m.post === '위원장')) out.push('위원장을 정해 주세요 (위촉 위원 중 호선)')
  if (!members.some((m) => m.post === '간사')) out.push('간사를 정해 주세요 (교직원 중 위원장이 지명)')
  return out
}

/** 회의록 글 (복사용). 공식 서식이 아니라 학교 자체 양식 예시 */
export function minutesText(m: CommitteeMeeting, members: readonly CommitteeMember[], schoolName: string): string {
  const present = members.filter((x) => m.present.includes(x.id))
  const absent = members.filter((x) => !m.present.includes(x.id))
  const q = quorum(members.length, present.length)
  const lines = [
    `${schoolName} 학교체육소위원회 회의록 (${m.kind})`,
    '',
    `일시: ${m.date} ${m.time}`,
    `장소: ${m.place}`,
    `참석: ${present.map((x) => `${x.name}(${x.post ?? x.role})`).join(', ') || '-'} (${present.length}명)`,
    `불참: ${absent.map((x) => x.name).join(', ') || '없음'}`,
    `성원: 재적 ${members.length}명 중 ${present.length}명 출석 — ${q.ok ? '과반수 출석으로 개의' : `과반수(${q.needed}명) 미달`}`,
    `의결 기준: 출석 위원 3분의 2 이상(${passNeeded(present.length)}명) 찬성`,
    '',
    ...m.agenda.flatMap((a, i) => [
      `안건 ${i + 1}. ${a.title}`,
      ...(a.body ? a.body.split('\n').map((l) => `  ${l}`) : []),
      `  결과: ${a.decision || '-'}${a.yes !== undefined ? ` (찬성 ${a.yes} · 반대 ${a.no ?? 0})` : ''}`,
      '',
    ]),
    ...(m.note ? [`기타: ${m.note}`, ''] : []),
    '위 내용이 사실과 같음을 확인합니다.',
    `위원장: ${members.find((x) => x.post === '위원장')?.name ?? ''} (서명)   간사: ${members.find((x) => x.post === '간사')?.name ?? ''} (서명)`,
  ]
  return lines.join('\n')
}
