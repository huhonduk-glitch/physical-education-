/**
 * 팀 편성·전술 보드 앱으로 넘기는 글자 만들기 (CLAUDE.md 4-10). 순수 함수.
 * SPORTS BRACKET 일괄 입력 형식 = 한 줄에 '번호 이름 성별 수준' (저장소 index.html bulkAddStudents 확인).
 * 설명용 머리줄('번호 이름 성별 수준')은 넣지 않는다 — 넣으면 '이름'이라는 학생이 생긴다.
 */

export interface TeamStudent {
  number: number
  name: string
  gender: 'M' | 'F' | null
  level?: '상' | '중' | '하' | null
}

export function bracketText(list: readonly TeamStudent[], includeLevel: boolean): string {
  return list
    .map((s) => {
      const parts = [String(s.number), s.name.replace(/\s+/g, '')]
      const g = s.gender === 'M' ? '남' : s.gender === 'F' ? '여' : ''
      if (g || (includeLevel && s.level)) parts.push(g || '-')
      if (includeLevel && s.level) parts.push(s.level)
      return parts.join(' ')
    })
    .join('\n')
}

/** 같은 내용을 CSV로 (엑셀 한글 깨짐 방지 BOM 포함, 첫 줄은 열 이름 — 팀 편성 앱 파일 올리기에서 열을 고른다) */
export function bracketCsv(list: readonly TeamStudent[], includeLevel: boolean): string {
  const head = includeLevel ? ['번호', '이름', '성별', '수준'] : ['번호', '이름', '성별']
  const rows = list.map((s) => {
    const r = [String(s.number), s.name, s.gender === 'M' ? '남' : s.gender === 'F' ? '여' : '']
    if (includeLevel) r.push(s.level ?? '')
    return r
  })
  return '﻿' + [head, ...rows].map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\r\n')
}

/**
 * K-TacticBoard 'JSON 불러오기'용 파일 (저장소 static/app.js hydrate 확인: roster = [{id,name,number,position,group}]).
 * 기본은 번호만 (이름 대신 'N번'). 전술 보드의 개인정보 권장 사항(실명 대신 번호·가명)을 따른다.
 */
export function tacticBoardJson(list: readonly TeamStudent[], opts: { includeName: boolean; group: string }): string {
  return JSON.stringify(
    {
      roster: list.map((s, i) => ({
        id: `r-pe-${i + 1}`,
        name: opts.includeName ? s.name : `${s.number}번`,
        number: s.number,
        position: '',
        group: opts.group,
      })),
    },
    null,
    2,
  )
}

/**
 * 전술 보드 바로 열기 링크. K-TacticBoard가 원래 가진 공유 링크 형식(`#tactic=<base64 JSON>`)을 그대로 쓴다.
 * 전술 보드 코드는 고치지 않는다. `#` 뒤 내용은 인터넷으로 보내지지 않고 그 브라우저 안에서만 읽힌다.
 * 전술 보드는 이렇게 열어도 자동 저장하지 않으므로, 교사가 [저장]하기 전까지 원래 저장본은 그대로다.
 */
export function tacticBoardLink(baseUrl: string, json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // 전술 보드 첫 화면(/)은 static/index.html로 넘어가면서 # 뒤를 버린다(저장소 index.html·netlify.toml 확인).
  // 그래서 주소가 사이트 첫 화면이면 앱 화면을 직접 연다.
  let base = baseUrl.split('#')[0].replace(/\/+$/, '')
  if (/^https?:\/\/[^/]+$/.test(base)) base += '/static/index.html'
  return `${base}#tactic=${btoa(bin)}`
}
