import { describe, expect, it } from 'vitest'
import { BOT_FAQ, findAnswer } from '../src/data/botFaq'

describe('땅콩이 도우미 답 찾기', () => {
  it('선생님 말로 물어도 맞는 답', () => {
    expect(findAnswer('처음에 뭐부터 설정해요?')?.id).toBe('start')
    expect(findAnswer('팝스 나이스 내보내기가 안돼요')?.id).toBe('paps')
    expect(findAnswer('노트북에서도 같이 쓰고 싶어요')?.id).toBe('backup')
    expect(findAnswer('세특 바이트 검사')?.id).toBe('seteuk')
    expect(findAnswer('오늘 날씨 어때')?.id).toBe('weather')
    expect(findAnswer('피자 맛집 알려줘')).toBeNull()
  })
  it('답마다 낱말 · 글이 있고 id가 겹치지 않음', () => {
    expect(new Set(BOT_FAQ.map((a) => a.id)).size).toBe(BOT_FAQ.length)
    for (const a of BOT_FAQ) expect(a.keys.length * a.text.length).toBeGreaterThan(0)
  })
})

describe('땅콩이 — 길라잡이 질문 (2026-11-04)', () => {
  it('대회 · 소논문 · 학생 글 질문', () => {
    expect(findAnswer('세특에 대회 써도 돼요?')?.id).toBe('seteuk-contest')
    expect(findAnswer('소논문 쓴 거 넣어도 되나요')?.id).toBe('seteuk-thesis')
    expect(findAnswer('학생 자기평가서 참고해도 돼요?')?.id).toBe('seteuk-student')
  })
})

it('출석률 질문 (2026-11-04)', () => {
  expect(findAnswer('고교학점제 출석률 미이수 학생 확인')?.id).toBe('credit')
})

describe('효과(useEffect)가 값을 돌려주지 않음 (2026-11-14)', () => {
  it('scrollIntoView · scrollTo를 화살표 함수로 바로 돌려주지 않음 — 최신 크롬은 Promise를 돌려줘 React가 멈춘다', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []))
    const bad = walk('src').filter((f) => /use(Layout)?Effect\(\(\) =>\s*[^{(\s][^,]*\.(scrollIntoView|scrollTo|scrollBy)\(/.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
})
