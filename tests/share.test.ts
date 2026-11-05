import { describe, expect, it } from 'vitest'
import type { Assessment, ProgressPlan } from '../src/db/types'
import { ShareError, decodePack, encodePack, hasStudentInfo, packAssessment, packCalendar, packPlan, shareLink, unpackAssessment, unpackCalendar, unpackPlan } from '../src/lib/share'

const plan: ProgressPlan = {
  id: 'p1',
  schoolYear: 2026,
  semester: 2,
  title: '1학년 체육1 (농구)',
  subject: '체육1',
  weeklyHours: 2,
  weeks: 17,
  target: 34,
  startDate: '2026-08-18',
  endDate: '2026-12-31',
  offDays: ['2026-10-03'],
  groupIds: ['g1', 'g2'],
  items: [{ id: 'i1', unit: '농구', content: '드리블' } as ProgressPlan['items'][number]],
  skips: { g1: ['2026-09-01|2'] },
  done: { g1: ['i1'] },
  createdAt: 1,
  updatedAt: 2,
}
const assess = {
  id: 'a1',
  schoolYear: 2026,
  title: '농구 레이업 슛',
  grade: 1,
  rubric: [],
  altTaskEnabled: true,
  groupIds: ['g1'],
  items: [{ id: 'e1', label: '레이업', method: 'direct', max: 30, allowed: [30, 27, 24] }],
} as Assessment

describe('같이 쓰기 · 보내기 받기', () => {
  it('진도표: 수업반 · 진도 · 빠진 수업은 빼고 보냄, 받으면 새 id · 고른 반 · 진도 처음부터', () => {
    const pack = packPlan(plan)
    const d = pack.data as Record<string, unknown>
    expect(d.groupIds).toBeUndefined()
    expect(d.done).toBeUndefined()
    expect(d.skips).toBeUndefined()
    expect(hasStudentInfo(pack)).toBe(false)
    const mine = unpackPlan(pack, { id: 'n1', schoolYear: 2027, groupIds: ['x'], now: 9 })
    expect(mine).toMatchObject({ id: 'n1', schoolYear: 2027, groupIds: ['x'], done: {}, skips: {}, title: plan.title, target: 34 })
    expect(mine.items).toHaveLength(1)
  })
  it('수행평가: 채점 요소 · 기준 점수는 그대로, 수업반은 받는 사람이 고름', () => {
    const pack = packAssessment(assess)
    expect((pack.data as Record<string, unknown>).groupIds).toBeUndefined()
    const mine = unpackAssessment(pack, { id: 'n2', schoolYear: 2026, groupIds: ['g9'] })
    expect(mine.items?.[0]).toMatchObject({ allowed: [30, 27, 24] })
    expect(mine.groupIds).toEqual(['g9'])
    expect(() => unpackPlan(pack, { id: 'x', schoolYear: 1, groupIds: [], now: 0 })).toThrow(ShareError)
  })
  it('코드 왕복 (압축 안 함) · 링크에서 코드 꺼내기 · 파일 내용 그대로', async () => {
    const pack = packAssessment(assess)
    const code = await encodePack(pack, { compress: false })
    expect(code[0]).toBe('j')
    const link = shareLink('https://example.github.io/physical-education-/?demo=1#/more', code)
    expect(link).toBe(`https://example.github.io/physical-education-/#/share?d=${code}`)
    expect((await decodePack(link)).name).toBe('농구 레이업 슛')
    expect((await decodePack(JSON.stringify(pack))).type).toBe('assessment')
  })
  it('압축 코드 왕복 (브라우저 압축 기능이 있으면)', async () => {
    if (typeof CompressionStream === 'undefined') return
    const code = await encodePack(packPlan(plan))
    expect(code[0]).toBe('z')
    expect((await decodePack(code)).name).toBe(plan.title)
  })
  it('다른 자료 · 잘린 코드는 알려 줌', async () => {
    await expect(decodePack('{"a":1}')).rejects.toThrow(ShareError)
    await expect(decodePack('jabc')).rejects.toThrow(ShareError)
    await expect(decodePack('')).rejects.toThrow(ShareError)
  })
  it('학생 정보 낱말이 섞이면 걸러냄', () => {
    expect(hasStudentInfo({ app: 'PE LOG', v: 1, type: 'assessment', name: 'x', createdAt: 0, data: { scores: {} } })).toBe(true)
  })
})

describe('업무 달력 묶음', () => {
  it('id는 빼고 보내고, 받으면 일정 목록', async () => {
    const pack = packCalendar([{ id: 'x', date: '2026-11-20', title: '나이스 PAPS 입력 마감', kind: 'neis' }], '우리 학교 일정')
    expect((pack.data as { id?: string }[])[0].id).toBeUndefined()
    const back = await decodePack(await encodePack(pack, { compress: false }))
    expect(unpackCalendar(back)).toEqual([{ date: '2026-11-20', title: '나이스 PAPS 입력 마감', kind: 'neis' }])
    expect(() => unpackCalendar(packPlan(plan))).toThrow(ShareError)
  })
})
