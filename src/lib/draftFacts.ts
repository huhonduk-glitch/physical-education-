/**
 * 기안문 초안에 넣을 '현황' 줄 (2026-11-10 교사 승인 '다음 할 일 3 → 진행').
 * 앱에 이미 있는 자료만 센다(새 기준 · 지어낸 숫자 없음). 학생 이름은 넣지 않는다(결재 문서 본문 · 공유 대비).
 * 문서 id는 src/data/peDocs.ts DRAFT_DOCS.
 */
import { clinicTargets, rate, schoolPapsStats, type ClinicRule, type SchoolPapsRow } from './schoolPaps'
import type { ClinicYear } from './clinic'
import type { CommitteeYear } from './committee'

export interface FactsInput {
  year: number
  schoolLevel: string
  /** 이 학년도 재학생 (성별 · 학년만) */
  students: readonly { grade: number; gender: 'M' | 'F' | null | undefined }[]
  /** 이 학년도 · 지난 학년도 PAPS (반마다 최근 회차) */
  paps: readonly SchoolPapsRow[]
  lastPaps: readonly SchoolPapsRow[]
  rule: ClinicRule
  /** 반마다 측정 종목 (요인 → 종목 이름) */
  configs: readonly { grade: number; events: string[] }[]
  /** 측정 회차 (반마다 1회차 날짜) */
  rounds: readonly { grade: number; round: number; date: string }[]
  clinic?: ClinicYear
  committee?: CommitteeYear
}

const byGrade = <T extends { grade: number }>(xs: readonly T[]) => [...new Set(xs.map((x) => x.grade))].sort((a, b) => a - b)

/** 학년별 인원 글: '1학년 120명 · 2학년 118명' */
function countLine(xs: readonly { grade: number }[], lv: string): string {
  return byGrade(xs)
    .map((g) => `${lv}${g} ${xs.filter((x) => x.grade === g).length}명`)
    .join(' · ')
}

export function draftFacts(docId: string, f: FactsInput): string[] {
  const lv = f.schoolLevel
  const out: string[] = []
  const head = (t: string) => out.push(`  (현황 · PE LOG에서 센 값, 확인 후 고치세요) ${t}`)
  const line = (t: string) => out.push(`   · ${t}`)

  if (docId === 'girls') {
    const girls = f.students.filter((s) => s.gender === 'F')
    if (girls.length === 0) return []
    head(`여학생 ${girls.length}명 (전체 ${f.students.length}명)`)
    line(`학년별: ${countLine(girls, lv)}`)
    const st = schoolPapsStats(f.paps.filter((r) => r.gender === 'F'), f.rule).school
    if (st.complete) line(`여학생 PAPS: 다 측정 ${st.complete}명, 평균 종합점수 ${st.avgTotal}점, 종합 ${f.rule.lowGrades.join('·')}등급 ${st.low}명(${rate(st.low, st.complete)})`)
    const boys = schoolPapsStats(f.paps.filter((r) => r.gender === 'M'), f.rule).school
    if (st.complete && boys.complete) line(`(비교) 남학생 평균 종합점수 ${boys.avgTotal}점, 저체력 ${rate(boys.low, boys.complete)}`)
    return out
  }

  if (docId === 'clinic') {
    const t = clinicTargets(f.paps, f.rule)
    const low = t.filter((x) => x.reasons.some((r) => r.startsWith('종합'))).length
    const obese = t.filter((x) => x.reasons.some((r) => !r.startsWith('종합'))).length
    const st = schoolPapsStats(f.paps, f.rule).school
    if (!st.complete && t.length === 0) return []
    head(`대상 후보 ${t.length}명 (저체력 ${low}명 · 비만 판정 ${obese}명, 겹치면 한 번)`)
    if (st.complete) line(`학교 전체 저체력 비율 ${rate(st.low, st.complete)} (다 측정 ${st.complete}명)`)
    const last = schoolPapsStats(f.lastPaps, f.rule).school
    if (last.complete) line(`작년(${f.year - 1}) 저체력 비율 ${rate(last.low, last.complete)}`)
    if (f.clinic?.members.length) {
      const wish = f.clinic.members.filter((m) => m.why === '참여 희망').length
      line(`참여 학생 ${f.clinic.members.length}명${wish ? ` (참여 희망 ${wish}명 포함)` : ''}`)
    }
    return out
  }

  if (docId === 'paps') {
    if (f.students.length === 0) return []
    head(`대상 ${f.students.length}명 — ${countLine(f.students, lv)}`)
    for (const g of byGrade(f.configs)) {
      const ev = [...new Set(f.configs.filter((c) => c.grade === g).flatMap((c) => c.events))]
      if (ev.length) line(`${lv}${g} 측정 종목: ${ev.join(', ')}`)
    }
    const first = f.rounds.filter((r) => r.round === 1).map((r) => r.date).sort()
    if (first.length) line(`1회차(정시) 측정: ${first[0]} ~ ${first[first.length - 1]}`)
    const last = schoolPapsStats(f.lastPaps, f.rule)
    if (last.school.complete) line(`작년(${f.year - 1}) 결과: 평균 종합점수 ${last.school.avgTotal}점, 종합 ${f.rule.lowGrades.join('·')}등급 ${rate(last.school.low, last.school.complete)}`)
    return out
  }

  if (docId === 'committee' && f.committee) {
    const ms = f.committee.members
    if (ms.length === 0 && f.committee.meetings.length === 0) return []
    if (ms.length) {
      head(`위원 ${ms.length}명 (당연직 ${ms.filter((m) => m.kind === '당연직').length} · 위촉 ${ms.filter((m) => m.kind === '위촉').length} · 외부 ${ms.filter((m) => m.kind === '외부').length})`)
      line(ms.map((m) => `${m.name}(${m.post ? `${m.post} · ` : ''}${m.role || m.kind})`).join(', '))
    }
    for (const m of f.committee.meetings) line(`${m.date} ${m.kind}: 안건 ${m.agenda.map((a) => a.title).filter(Boolean).join(' / ') || '-'}`)
    return out
  }
  return out
}
