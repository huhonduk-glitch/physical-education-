/**
 * 관찰 메모 한꺼번에 넣기 (2026-11-26, 슈퍼스쿨 생기부 초안의 '학생 관찰 · 평가 업로드(학번 · 이름 · 내용)' 참고 — 코드는 새로 씀).
 * 엑셀 · 구글 시트에서 복사한 줄(탭) 또는 '3 홍길동 내용'처럼 띄어 쓴 줄을 읽는다. 순수 함수.
 * 학생 찾기: 학번(5자리) → 번호 → 이름(한 명일 때). 번호와 이름이 둘 다 있는데 다르면 넣지 않고 알린다.
 */

export interface PasteMember {
  id: string
  /** 카드 번호 (학적반 = 번호, 수강반 = 학번) */
  no: string
  studentCode: string
  name: string
}

export interface ObservePasteResult {
  items: { studentId: string; text: string; who: string }[]
  problems: string[]
}

const HEAD = /^(학번|번호|이름|성명|내용|관찰|메모)$/

export function readObservations(text: string, members: readonly PasteMember[]): ObservePasteResult {
  const items: ObservePasteResult['items'] = []
  const problems: string[] = []
  const byName = (n: string) => members.filter((m) => m.name === n)
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const cells = raw.includes('\t') ? raw.split('\t').map((c) => c.trim()) : null
    let code = ''
    let no = ''
    let name = ''
    let note = ''
    if (cells) {
      if (cells.every((c) => !c || HEAD.test(c.replace(/\s+/g, '')))) continue // 머리글 줄
      for (const c of cells) {
        if (!c) continue
        if (!code && /^\d{5}$/.test(c)) code = c
        else if (!no && /^\d{1,2}$/.test(c)) no = c
        else if (!name && /^[가-힣]{2,5}$/.test(c) && byName(c).length) name = c
        else note = note ? `${note} ${c}` : c
      }
    } else {
      const m = /^(?:(\d{5})|(\d{1,2})[.)]?)?\s*([가-힣]{2,5})?\s+(.+)$/.exec(line)
      if (m && (m[1] || m[2] || (m[3] && byName(m[3]).length))) {
        code = m[1] ?? ''
        no = m[2] ?? ''
        name = m[3] && byName(m[3]).length ? m[3] : ''
        note = name ? m[4] : `${m[3] ?? ''} ${m[4]}`.trim()
      } else note = line
    }
    if (!note) continue
    let who: PasteMember | undefined
    if (code) who = members.find((m) => m.studentCode === code)
    if (!who && no) {
      // 학적반은 번호, 수강반은 학번 끝 두 자리가 한 명뿐일 때만
      const tail = members.filter((x) => x.studentCode.endsWith(no.padStart(2, '0')))
      who = members.find((m) => m.no === no) ?? (tail.length === 1 ? tail[0] : undefined)
    }
    if (!who && name) {
      const same = byName(name)
      if (same.length === 1) who = same[0]
      else if (same.length > 1) {
        problems.push(`${name}: 같은 이름이 ${same.length}명이에요 — 번호를 함께 적어 주세요`)
        continue
      }
    }
    if (!who) {
      problems.push(`찾지 못함: ${line.slice(0, 30)}`)
      continue
    }
    if (name && who.name !== name) {
      problems.push(`${code || no}번은 ${who.name}인데 이름이 ${name}이에요 — 넣지 않았어요`)
      continue
    }
    items.push({ studentId: who.id, text: note, who: `${who.no} ${who.name}` })
  }
  return { items, problems }
}
