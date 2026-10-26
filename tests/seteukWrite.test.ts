import { describe, expect, it } from 'vitest'
import type { ClassRecord, Keyword } from '../src/db/types'
import { checkSeteuk, countText, editRatio } from '../src/lib/seteukCheck'
import { draftParts, draftText, eulReul, euroRo, iGa, sentence } from '../src/lib/seteukDraft'

const ids = (r: CheckHit[]) => r.map((h) => h.id)
type CheckHit = ReturnType<typeof checkSeteuk>[number]

describe('세특 검사 (기재요령 총칙 3~5)', () => {
  it('깨끗한 문장은 걸리는 것이 없다', () => {
    expect(checkSeteuk('배드민턴 하이클리어 동작을 분석하여 친구들에게 설명하고, 랠리 연습을 주도함.')).toEqual([])
  })
  it('대회·수상 · 어학시험 · 모의고사 · 대학명 · 학원 · 장학', () => {
    const r = checkSeteuk('교내 체육대회에서 우수상을 받았고 TOEIC 900점, 모의고사 1등급, ○○대학교 진학 희망, 학원에서 배운 기술, 장학생.')
    expect(ids(r)).toEqual(expect.arrayContaining(['contest', 'lang-test', 'mock', 'univ', 'scholar']))
    expect(r.find((h) => h.id === 'contest')?.words).toEqual(expect.arrayContaining(['대회', '우수상']))
  })
  it('헷갈리는 낱말은 걸지 않는다: 대상으로 · 수상 스포츠 · 시대에 · 반대', () => {
    expect(checkSeteuk('친구들을 대상으로 시범을 보이고, 수상 스포츠의 안전 수칙을 시대에 맞게 정리하며 반대 의견도 존중함.')).toEqual([])
  })
  it('순위·우승은 경고(수업 중 경기면 괜찮음), 부모 언급은 경고', () => {
    const r = checkSeteuk('반 리그에서 우승하며 1위를 함. 아버지와 함께 운동함.')
    expect(r.map((h) => [h.id, h.level])).toEqual([
      ['rank', 'warn'],
      ['parents', 'warn'],
    ])
  })
  it('학교 이름과 줄임말', () => {
    expect(checkSeteuk('삼성여고 체육 축제에서', { schoolName: '삼성여자고등학교' })[0]).toMatchObject({ id: 'school', words: ['삼성여고'] })
    expect(checkSeteuk('시연고 체육관에서', { schoolName: '시연고등학교' })[0]).toMatchObject({ id: 'school', words: ['시연고'] })
  })
  it('500자 넘으면 오류, 바이트도 센다', () => {
    expect(countText('가a\n')).toEqual({ chars: 3, bytes: 6 })
    // 나이스 1,500바이트: 한글 499자 + 마침표 = 1,498바이트 → 통과, 띄어쓰기는 1바이트라 한글 500자 + 띄어쓰기 있어도 통과
    expect(checkSeteuk(`${'가'.repeat(498)}함.`)).toEqual([])
    expect(checkSeteuk(`${'가'.repeat(250)} ${'가'.repeat(248)}함.`).find((h) => h.id === 'length')).toBeUndefined()
    expect(checkSeteuk(`${'가'.repeat(500)}함.`)[0]).toMatchObject({ id: 'length', level: 'error' })
  })
  it('학교 연수자료: 유의어 → 대체어 · 영문 · 명사형 종결 · 기호 · 두 칸 · 방과후', () => {
    const r = checkSeteuk('유튜브 영상과 챗GPT로 조사하고 엑셀로 정리함. PAPS 결과를 TV로 보며 Python을 배웠다. 방과후에도  연습함 ~')
    const by = (id: string) => r.find((h) => h.id === id)
    expect(by('substitute')?.words).toEqual(expect.arrayContaining(['유튜브 → 동영상 플랫폼, 동영상 공유 서비스', '챗GPT → 대화형 인공지능, 생성형 인공지능', '엑셀 → 스프레드시트', 'Python → 프로그래밍 언어']))
    // PAPS · TV는 허용된 영문, Python은 유의어에서 이미 잡음
    expect(by('english')).toBeUndefined()
    expect(by('ending')?.words.join(' ')).toContain('배웠다')
    expect(by('symbol')?.words).toEqual(['~'])
    expect(by('space')).toBeDefined()
    expect(by('afterschool')?.level).toBe('error')
    expect(checkSeteuk('Badminton 랠리를 함.').find((h) => h.id === 'english')?.words).toEqual(['Badminton'])
    expect(checkSeteuk("'하이클리어' 동작을 [분석]해 설명함.")).toEqual([])
  })
  it('고친 정도: 같으면 0, 전부 다르면 1', () => {
    expect(editRatio('가나다라', '가나다라')).toBe(0)
    expect(editRatio('가나다라', '마바사아')).toBe(1)
    expect(editRatio('가나다라', '가나다마')).toBe(0.25)
  })
})

const rec = (o: Partial<ClassRecord>): ClassRecord => ({ id: Math.random().toString(), schoolYear: 2026, studentId: 's', date: '2026-09-01', type: 'exemplary', category: '정리정돈', keywordIds: [], createdAt: 0, updatedAt: 0, ...o })
const kws: Keyword[] = [
  { id: 'k1', label: '배려', category: '배려', isActive: true, sortOrder: 0 },
  { id: 'k2', label: '리더십', category: '리더십', isActive: true, sortOrder: 1 },
]

describe('세특 틀 초안 (기록에 있는 것만)', () => {
  it('조사', () => {
    expect(iGa('배려')).toBe('배려가')
    expect(iGa('리더십')).toBe('리더십이')
    expect(eulReul('교구 정리')).toBe('교구 정리를')
    expect(euroRo('체육부장')).toBe('체육부장으로')
    expect(euroRo('부부장')).toBe('부부장으로')
    expect(euroRo('반장')).toBe('반장으로')
    expect(sentence(' 랠리를 주도함 ')).toBe('랠리를 주도함.')
  })
  it('칭찬 두 번 이상 · 키워드 · 부장 · 메모 · 수행평가 등급 기준', () => {
    const parts = draftParts({
      records: [
        rec({ category: '정리정돈', keywordIds: ['k1'] }),
        rec({ category: '정리정돈', keywordIds: ['k1', 'k2'] }),
        rec({ category: '친구 도움' }),
        rec({ type: 'observation', category: '관찰', note: '하이클리어 자세를 스스로 촬영해 고침', date: '2026-09-10' }),
        rec({ type: 'unprepared', category: '체육복', note: '체육복 안 가져옴' }),
        rec({ type: 'captain', category: '준비운동 인솔' }),
      ],
      keywords: kws,
      captainRoles: ['체육부장'],
      assessments: [
        {
          a: { id: 'a', schoolYear: 2026, title: '배드민턴 랠리', grade: 2, rubric: [], altTaskEnabled: true },
          items: [{ id: 'i', label: '랠리', method: 'level', levels: [{ label: 'A', points: 10, desc: '파트너와 타이밍을 맞추어 랠리를 이어감.' }, { label: 'B', points: 8 }] }],
          scores: { i: 'A' },
        },
      ],
    })
    expect(parts.map((p) => p.kind)).toEqual(['praise', 'keyword', 'captain', 'note', 'assess'])
    expect(draftText(parts)).toBe(
      '수업 중 정리정돈 면에서 꾸준히 모범을 보임. 배려, 리더십이 돋보임. 체육부장으로서 준비운동 인솔을 맡아 수행함. 하이클리어 자세를 스스로 촬영해 고침. 「배드민턴 랠리」에서 파트너와 타이밍을 맞추어 랠리를 이어감.',
    )
    // 지도(미준비) 기록과 메모는 넣지 않는다
    expect(draftText(parts)).not.toContain('체육복')
  })
  it('기록이 없으면 빈 초안', () => {
    expect(draftParts({ records: [], keywords: [], assessments: [], captainRoles: [] })).toEqual([])
  })
})

describe('기관명 · 상호명 찾기 (기재요령 3-타)', () => {
  const by = (t: string, id: string) => checkSeteuk(t).find((h) => h.id === id)?.words ?? []
  it('확실한 이름은 오류: 중앙부처 · 체육 단체 · 리그 · 브랜드', () => {
    expect(by('문화체육관광부와 대한체육회 자료로 프리미어리그 경기와 나이키 운동화를 분석함.', 'org')).toEqual(expect.arrayContaining(['문화체육관광부', '대한체육회', '프리미어리그', '나이키']))
  })
  it('이름 꼴(…청 · …협회 · …공단 · …센터 · 주식회사)은 의심으로', () => {
    expect(by('질병관리청 통계와 대한배드민턴협회 규칙, 한국전력공사 자료, 강남스포츠센터 견학, 주식회사 가나다를 조사함.', 'org-maybe')).toEqual(
      expect.arrayContaining(['질병관리청', '대한배드민턴협회', '한국전력공사', '강남스포츠센터', '주식회사 가나다']),
    )
  })
  it('흔한 낱말 · 일반 명칭은 걸지 않음', () => {
    const t = '자료 출처를 밝히고 참가신청을 받아 위기대처 방법을 경청함. 지역 보건소와 스포츠센터, 학교 체육부 활동, 영상을 시청함.'
    expect(by(t, 'org')).toEqual([])
    expect(by(t, 'org-maybe')).toEqual([])
  })
})

describe('연수자료 분야별 확장 · 모든 학교명', () => {
  const ids = (t: string, o?: { schoolName?: string }) => checkSeteuk(t, o).map((h) => h.id)
  const words = (t: string, id: string) => checkSeteuk(t).find((h) => h.id === id)?.words ?? []
  it('다른 학교 이름도 (고교블라인드)', () => {
    expect(words('한국과학고등학교와 서울여고, 부산중학교 학생들과 교류전을 함.', 'school')).toEqual(['한국과학고등학교', '서울여고', '부산중학교'])
    expect(words('우리 고등학교 체육관과 일반 고등학교 수업을 비교함.', 'school')).toEqual([])
  })
  it('자격증 · 인증 · 단증, 공모전 · 경시 · 메달, 장관상, 수능 성적, 학원 강사', () => {
    expect(ids('생활스포츠지도사 자격 취득을 목표로 함.')).toContain('cert')
    expect(ids('태권도 2단 승단과 컴퓨터활용능력을 준비함.')).toContain('cert')
    expect(ids('영상 공모전과 수학 경시에 나가 금메달을 땀.')).toContain('contest')
    expect(ids('교육감상을 받음.')).toContain('outside-award')
    expect(ids('수능 등급 향상을 위해 노력함.')).toContain('mock')
    expect(ids('김철수 코치에게 배운 기술을 익힘.')).toContain('univ')
    expect(ids('서울대 진학을 목표로 함.')).toContain('univ')
    expect(ids('IELTS를 준비함.')).toContain('lang-test')
  })
  it('소논문 · 같은 문장 반복', () => {
    expect(ids('배드민턴 하이클리어를 주제로 소논문을 작성함.')).not.toContain('paper')
    expect(ids('논문을 학술지에 투고함.')).toContain('paper')
    expect(ids('랠리를 끝까지 이어가며 집중함. 랠리를 끝까지 이어가며 집중함.')).toContain('repeat')
  })
})
