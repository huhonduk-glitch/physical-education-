import type { FlowId } from './peFlows'

/**
 * 제작자가 실제로 쓴 문서 (2026-11-12 교사 요청 "업무하면서 만들고 썼던 양식들을 개인정보 지우고 넣어 놓으면 좋겠다").
 * 서버 없이: 파일은 public/docs/<업무 id>/에 두고 GitHub Pages가 그대로 내려준다(받기 링크).
 * 공개 저장소라 한 번 올리면 커밋 기록에 남는다 → 넣기 전에 파일을 열어 학생 · 교직원 이름, 학번, 연락처, 서명,
 * 학교 이름 · 주소(필요하면), 계좌 · 금액 등 지울 것을 확인하고 지운 사본만 넣는다. 원본은 저장소 밖.
 */
export interface AuthorDoc {
  title: string
  /** 어떤 때 쓰는지 · 고쳐 쓸 곳 */
  desc?: string
  /** public 기준 경로 (docs/club/클럽운영계획_예시.hwpx) */
  file: string
  kind: 'hwp' | 'hwpx' | 'xlsx' | 'xls' | 'pdf' | 'docx' | 'pptx'
  /** 실제로 쓴 학년도 */
  year?: number
}

export const AUTHOR_DOCS: Record<FlowId, AuthorDoc[]> = {
  team: [],
  club: [],
  committee: [],
  paps: [],
  clinic: [],
  sportsday: [],
}

export const AUTHOR_KIND_LABEL: Record<AuthorDoc['kind'], string> = {
  hwp: '한글',
  hwpx: '한글',
  xlsx: '엑셀',
  xls: '엑셀',
  pdf: 'PDF',
  docx: '워드',
  pptx: 'PPT',
}
