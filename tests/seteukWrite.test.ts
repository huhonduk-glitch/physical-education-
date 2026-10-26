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
    expect(checkSeteuk(`${'가'.repeat(499)}함.`)[0]).toMatchObject({ id: 'length', level: 'error' })
    expect(checkSeteuk(`${'가'.repeat(498)}함.`)).toEqual([])
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
