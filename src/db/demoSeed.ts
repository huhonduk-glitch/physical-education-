/**
 * 시연용 가상 자료 (시연 모드 전용, src/lib/demo.ts).
 * 이름은 모두 지어낸 가명(성 + 순우리말 이름)이고, 기록도 모두 만든 값이다. 실제 학생과 관계없다.
 * 날짜는 '오늘'을 기준으로 만들어서 언제 열어도 최근 수업처럼 보인다. 같은 씨앗(seed)이면 늘 같은 반이 만들어진다.
 *
 * 들어가는 것: 남녀공학 고등학교 · 1학년 1·2반, 2학년 1반(학적반) + 배드민턴 수강반 · 시간표 ·
 * 최근 4주 누가기록(칭찬·지도·관찰) · 견학 · 체육부장 · 수업 일지 · PAPS(1-1반 2회차, 1-2반 1회차) · 수행평가 1개
 */
import { addDays, todayStr } from '../lib/dates'
import { hashPin, PIN_SETTING_KEY, type StoredPin } from '../lib/pin'
import { TERMS_VERSION } from '../lib/terms'
import { ensureKeywordSeed } from './recordsRepo'
import type { PeDatabase } from './db'
import { currentSchoolYear, defaultSettings, saveSettings, type TimetableEntry } from './settings'
import type { Absence, Assessment, AssessmentScore, Captain, ClassGroup, ClassRecord, Lesson, PapsResult, PapsRound, Student } from './types'

export const DEMO_SEEDED_KEY = 'demoSeeded'
export const DEMO_SCHOOL = '시연고등학교 (가상)'

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍']
const GIVEN = ['가온', '나래', '다온', '라온', '마루', '바다', '사랑', '아름', '자람', '차오', '카이', '태양', '파랑', '하늘', '가을', '나무', '다솜', '라희', '미르', '보람', '새벽', '아토', '주원', '초롱', '푸름', '한결', '하람', '이든', '온유', '시우']
/** 시연 자료의 이름은 이 두 목록의 조합뿐이다 (테스트에서 확인) */
export const DEMO_NAME_PARTS = { SURNAMES, GIVEN }

/** 같은 씨앗이면 같은 수가 나오는 난수 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DemoSeedOptions {
  now?: Date
  seed?: number
  /** 테스트에서 PIN 해시를 빨리 만들려고 넣는다 */
  pin?: StoredPin
}

export async function seedDemo(db: PeDatabase, opts: DemoSeedOptions = {}): Promise<boolean> {
  if ((await db.settings.get(DEMO_SEEDED_KEY))?.value) return false
  const now = opts.now ?? new Date()
  const r = rng(opts.seed ?? 20261022)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  const chance = (p: number) => r() < p
  const between = (lo: number, hi: number) => lo + r() * (hi - lo)
  const today = todayStr(now)
  const year = currentSchoolYear(now)
  let n = 0
  const id = (p: string) => `demo-${p}-${++n}`
  const ts = now.getTime()

  // ── 학생: 1-1, 1-2, 2-1 각 20명 (번호 홀수 남, 짝수 여)
  const students: Student[] = []
  const used = new Set<string>()
  for (const [grade, classNo] of [
    [1, 1],
    [1, 2],
    [2, 1],
  ] as const) {
    for (let no = 1; no <= 20; no++) {
      let name = ''
      do name = pick(SURNAMES) + pick(GIVEN)
      while (used.has(name))
      used.add(name)
      const code = `${grade}${String(classNo).padStart(2, '0')}${String(no).padStart(2, '0')}`
      students.push({
        id: id('s'),
        schoolYear: year,
        grade,
        classNo,
        classCode: String(classNo).padStart(2, '0'),
        number: no,
        name,
        gender: no % 2 ? 'M' : 'F',
        studentCode: code,
        course: '주간',
        track: '일반계',
        dept: '일반학과',
        status: '재학',
        memo: '',
      })
    }
  }
  const classOf = (g: number, c: number) => students.filter((s) => s.grade === g && s.classNo === c)

  // ── 수업반: 학적반 3 + 수강반 1 (1학년 두 반에서 10명)
  const g11: ClassGroup = { id: id('g'), schoolYear: year, semester: 0, kind: 'homeroom', name: '1학년 1반', subject: '체육', grade: 1, classNo: 1, memberIds: [], color: 'blue', sortOrder: 0, archived: false, createdAt: ts }
  const g12: ClassGroup = { ...g11, id: id('g'), name: '1학년 2반', classNo: 2, color: 'green', sortOrder: 1 }
  const g21: ClassGroup = { ...g11, id: id('g'), name: '2학년 1반', subject: '운동과 건강', grade: 2, classNo: 1, color: 'orange', sortOrder: 2 }
  const electiveMembers = [...classOf(1, 1).slice(0, 5), ...classOf(1, 2).slice(0, 5)].map((s) => s.id)
  const gEl: ClassGroup = { id: id('g'), schoolYear: year, semester: 2, kind: 'elective', name: '스포츠 생활 · 배드민턴', subject: '스포츠 생활', memberIds: electiveMembers, color: 'purple', sortOrder: 3, archived: false, createdAt: ts }
  const groups = [g11, g12, g21, gEl]
  const membersOf = (g: ClassGroup) => (g.kind === 'homeroom' ? classOf(g.grade!, g.classNo!) : students.filter((s) => g.memberIds.includes(s.id)))

  // ── 시간표: 월~금 (요일, 교시, 수업반)
  const timetable: TimetableEntry[] = [
    [1, 1, g11],
    [1, 3, g12],
    [1, 5, g21],
    [2, 2, gEl],
    [2, 4, g11],
    [3, 1, g12],
    [3, 3, g21],
    [3, 6, gEl],
    [4, 2, g11],
    [4, 5, g12],
    [5, 3, g21],
    [5, 4, gEl],
  ].map(([day, period, g]) => ({ day: day as number, period: period as number, groupId: (g as ClassGroup).id }))

  // ── 세특 키워드 (앱 기본 사전) → 칭찬·관찰에 붙일 몇 개
  await ensureKeywordSeed(db)
  const kw = (await db.keywords.toArray()).filter((k) => k.isActive).slice(0, 24).map((k) => k.id)

  // ── 최근 4주 수업 날짜마다 누가기록
  const records: ClassRecord[] = []
  const absences: Absence[] = []
  const lessons: Lesson[] = []
  const praise = ['정리정돈', '용구 정리', '친구 도움', '리더십', '안전 지킴', '적극 참여']
  const guide = ['체육복', '실내화', '교구']
  const units: Record<string, [string, string][]> = {
    [g11.id]: [
      ['농구', '레이업 슛 기본 동작 · 2인 패스'],
      ['농구', '드리블 후 레이업 · 모둠 연습'],
      ['농구', '3대3 미니 게임 · 규칙 익히기'],
      ['PAPS', '왕복오래달리기 · 윗몸말아올리기 측정'],
    ],
    [g12.id]: [
      ['배구', '언더핸드 패스 · 짝 연습'],
      ['배구', '오버핸드 패스 · 원 대형 랠리'],
      ['PAPS', '앉아윗몸앞으로굽히기 · 제자리멀리뛰기'],
    ],
    [g21.id]: [
      ['건강 체력', '서킷 트레이닝 6종목'],
      ['건강 체력', '심박수 재기 · 운동 강도 알기'],
    ],
    [gEl.id]: [
      ['배드민턴', '하이클리어 · 드롭샷'],
      ['배드민턴', '복식 게임 · 서브 규칙'],
    ],
  }
  for (let back = 27; back >= 0; back--) {
    const date = addDays(today, -back)
    const day = new Date(`${date}T09:00:00`).getDay()
    for (const t of timetable.filter((x) => x.day === day)) {
      const g = groups.find((x) => x.id === t.groupId)!
      const list = membersOf(g)
      const absentToday = new Set<string>()
      if (chance(0.5)) {
        const s = pick(list)
        absentToday.add(s.id)
        absences.push({ id: id('a'), schoolYear: year, studentId: s.id, date, period: t.period, reason: pick(['부상', '질병', '기타', '부상'] as const), altTaskDone: chance(0.5), groupId: g.id })
      }
      for (const s of list) {
        if (absentToday.has(s.id)) continue
        const at = new Date(`${date}T10:00:00`).getTime()
        if (chance(0.13)) {
          records.push({ id: id('r'), schoolYear: year, studentId: s.id, date, period: t.period, type: 'exemplary', category: pick(praise), keywordIds: chance(0.4) ? [pick(kw)] : [], groupId: g.id, createdAt: at, updatedAt: at })
        }
        if (chance(0.05)) {
          records.push({ id: id('r'), schoolYear: year, studentId: s.id, date, period: t.period, type: 'unprepared', category: pick(guide), keywordIds: [], groupId: g.id, createdAt: at, updatedAt: at })
        }
        if (chance(0.015)) {
          records.push({ id: id('r'), schoolYear: year, studentId: s.id, date, period: t.period, type: 'observation', category: '관찰', note: pick(['모둠 활동에서 역할을 나눠 줌', '시범을 자원해서 보여 줌', '친구의 자세를 고쳐 줌']), keywordIds: [pick(kw)], groupId: g.id, createdAt: at, updatedAt: at })
        }
      }
      if (back <= 14) {
        const [unit, activity] = pick(units[g.id])
        lessons.push({ id: id('l'), schoolYear: year, groupId: g.id, date, period: t.period, unit, activity, note: pick(['다음 시간: 체육복 꼭 챙기기', '다음 시간: 모둠 정하기', '', '공 바람 넣어 두기']), createdAt: ts, updatedAt: ts })
      }
    }
  }

  // ── 체육부장 (1-1)
  const c11 = classOf(1, 1)
  const captains: Captain[] = [
    { id: id('c'), schoolYear: year, grade: 1, classNo: 1, studentId: c11[4].id, role: '부장', from: addDays(today, -60) },
    { id: id('c'), schoolYear: year, grade: 1, classNo: 1, studentId: c11[11].id, role: '부부장', from: addDays(today, -60) },
  ]
  for (let back = 20; back >= 0; back -= 3) {
    const date = addDays(today, -back)
    const at = new Date(`${date}T10:00:00`).getTime()
    records.push({ id: id('r'), schoolYear: year, studentId: c11[4].id, date, type: 'captain', category: pick(['준비운동 인솔', '교구 준비·정리', '출석 확인']), keywordIds: [], groupId: g11.id, createdAt: at, updatedAt: at })
  }

  // ── PAPS: 1-1(2회차) · 1-2(1회차). 종목 = 왕복오래달리기 · 윗몸말아올리기 · 앉아윗몸앞으로굽히기 · 제자리멀리뛰기
  const selected = { 심폐지구력: 'shuttleRun', '근력·근지구력': 'curlUp', 유연성: 'sitAndReach', 순발력: 'standingLongJump' }
  const papsConfigs = [
    { id: id('pc'), schoolYear: year, grade: 1, classNo: 1, selectedEvents: selected },
    { id: id('pc'), schoolYear: year, grade: 1, classNo: 2, selectedEvents: selected },
  ]
  const round2: PapsRound = { id: id('pr'), schoolYear: year, grade: 1, classNo: 1, round: 2, date: addDays(today, -7), createdAt: ts }
  const round1: PapsRound[] = [
    { id: id('pr'), schoolYear: year, grade: 1, classNo: 1, round: 1, date: addDays(today, -70), createdAt: ts },
    { id: id('pr'), schoolYear: year, grade: 1, classNo: 2, round: 1, date: addDays(today, -63), createdAt: ts },
  ]
  const r1 = (x: number) => Math.round(x * 10) / 10
  const papsResults: PapsResult[] = []
  const cell = (studentId: string, eventId: string, attempt: number | null, value: number, roundId?: string, measuredAt = ts) =>
    papsResults.push({ id: id('p'), schoolYear: year, studentId, eventId, attempt, side: null, value, excluded: false, measuredAt, ...(roundId ? { roundId } : {}) })
  const measure = (s: Student, roundId: string | undefined, gain: number) => {
    const m = s.gender === 'M'
    const fit = between(0.5, 1.5) // 학생마다 체력 차이
    cell(s.id, 'shuttleRun', null, Math.round((m ? 38 : 24) * fit + gain * 6), roundId)
    cell(s.id, 'curlUp', null, Math.round((m ? 38 : 26) * fit + gain * 4), roundId)
    const sit = r1((m ? 6 : 13) * fit - 2 + gain)
    cell(s.id, 'sitAndReach', 1, sit, roundId)
    cell(s.id, 'sitAndReach', 2, r1(sit + between(-1, 1.5)), roundId)
    const jump = Math.round((m ? 200 : 155) * (0.85 + fit * 0.15) + gain * 5)
    cell(s.id, 'standingLongJump', 1, jump, roundId)
    cell(s.id, 'standingLongJump', 2, jump + Math.round(between(-6, 8)), roundId)
    const h = r1(m ? between(166, 182) : between(154, 168))
    cell(s.id, 'height', null, h, roundId)
    // BMI는 대부분 정상 범위가 되게 (시연에서 '비만'이 두드러져 보이지 않도록)
    cell(s.id, 'weight', null, r1((h / 100) ** 2 * between(18.8, 24.2)), roundId)
  }
  for (const s of c11) {
    measure(s, undefined, 0)
    measure(s, round2.id, between(0.3, 1.6))
  }
  for (const s of classOf(1, 2)) measure(s, undefined, 0)
  // 측정 제외 1명 (사유 예시)
  papsResults.push({ id: id('p'), schoolYear: year, studentId: classOf(1, 2)[19].id, eventId: '__excluded__', attempt: null, side: null, excluded: true, excludeReason: '발목 부상 (예시)', measuredAt: ts })

  // ── 수행평가: 1-1 농구 레이업 슛 (등급표 2요소)
  const levels = [
    { label: 'A', points: 10, desc: '스텝·점프·슛이 끊김 없이 이어지고 성공률이 높다' },
    { label: 'B', points: 8, desc: '동작이 대체로 이어지나 한 부분이 어색하다' },
    { label: 'C', points: 6, desc: '스텝이나 점프 중 하나가 자주 흐트러진다' },
    { label: 'D', points: 4, desc: '동작을 나누어서만 할 수 있다' },
    { label: 'E', points: 2, desc: '참여했으나 기본 동작이 어렵다' },
  ]
  const assessment: Assessment = {
    id: id('as'),
    schoolYear: year,
    title: '농구 레이업 슛 실기',
    grade: 1,
    rubric: [],
    altTaskEnabled: true,
    groupIds: [g11.id],
    items: [
      { id: 'demo-item-1', label: '동작 연결(스텝·점프·슛)', method: 'level', levels },
      { id: 'demo-item-2', label: '슛 성공(10회 중)', method: 'record', unit: '회', better: 'higher', bands: [{ limit: 8, points: 10 }, { limit: 6, points: 8 }, { limit: 4, points: 6 }, { limit: 2, points: 4 }], basePoints: 2 },
    ],
    semester: 2,
  }
  const scores: AssessmentScore[] = c11.slice(0, 16).map((s) => ({
    id: id('sc'),
    assessmentId: assessment.id,
    studentId: s.id,
    scores: { 'demo-item-1': pick(['A', 'A', 'B', 'B', 'B', 'C', 'C', 'D']), 'demo-item-2': Math.floor(between(2, 11)) },
  }))

  const pin = opts.pin ?? (await hashPin('0000'))
  await db.transaction('rw', [db.students, db.groups, db.records, db.absences, db.lessons, db.captains, db.papsConfigs, db.papsRounds, db.papsResults, db.assessments, db.assessmentScores, db.settings], async () => {
    await db.students.bulkAdd(students)
    await db.groups.bulkAdd(groups)
    await db.records.bulkAdd(records)
    await db.absences.bulkAdd(absences)
    await db.lessons.bulkAdd(lessons)
    await db.captains.bulkAdd(captains)
    await db.papsConfigs.bulkAdd(papsConfigs)
    await db.papsRounds.bulkAdd([...round1, round2])
    await db.papsResults.bulkAdd(papsResults)
    await db.assessments.add(assessment)
    await db.assessmentScores.bulkAdd(scores)
    await saveSettings(db, {
      ...defaultSettings(),
      schoolName: DEMO_SCHOOL,
      schoolGenderType: '공학',
      schoolYear: year,
      latestYear: year,
      timetable,
      termsAgreed: { version: TERMS_VERSION, at: ts },
      lastBackupAt: ts, // 시연 중에 백업 경고가 뜨지 않게
    })
    await db.settings.put({ key: PIN_SETTING_KEY, value: pin })
    await db.settings.put({ key: DEMO_SEEDED_KEY, value: ts })
  })
  return true
}
