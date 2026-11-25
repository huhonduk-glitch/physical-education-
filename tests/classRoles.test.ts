import { describe, expect, it } from 'vitest'
import { assignRole, holdersOn, removeRole, ROLE_PRESETS, roleSentence, rolesOfStudent, rotateRoles, type ClassRole, type RoleTerm } from '../src/lib/classRoles'
import { checkSeteuk } from '../src/lib/seteukCheck'
import { draftParts } from '../src/lib/seteukDraft'

const ids = () => {
  let n = 0
  return () => `t${++n}`
}
const roles: ClassRole[] = [
  { id: 'warm', name: '준비운동 리더', duty: '준비운동을 앞에서 진행함' },
  { id: 'gear', name: '교구 담당', duty: '교구를 준비하고 정리함' },
]
const order = ['s1', 's2', 's3', 's4', 's5']

describe('수업 역할', () => {
  it('맡기기: 새로 맡는 학생은 그날부터, 빠지는 학생은 전날로 기간을 닫고, 계속 맡는 학생은 그대로', () => {
    const id = ids()
    let t = assignRole([], 'gear', ['s1', 's2'], '2026-11-02', id)
    expect(holdersOn(t, 'gear', '2026-11-02')).toEqual(['s1', 's2'])
    expect(holdersOn(t, 'gear', '2026-11-01')).toEqual([])
    t = assignRole(t, 'gear', ['s2', 's3'], '2026-11-09', id)
    expect(holdersOn(t, 'gear', '2026-11-09').sort()).toEqual(['s2', 's3'])
    expect(t.find((x) => x.studentId === 's1')).toMatchObject({ from: '2026-11-02', to: '2026-11-08' })
    expect(t.find((x) => x.studentId === 's2')?.to).toBeUndefined() // 계속 맡음 — 기간이 끊기지 않는다
    // 같은 날 다시 고치면 그날 시작한 기간은 지운다 (지난 기록에 남지 않게)
    const again = assignRole(t, 'gear', ['s2'], '2026-11-09', id)
    expect(again.some((x) => x.studentId === 's3')).toBe(false)
    expect(holdersOn(again, 'gear', '2026-11-09')).toEqual(['s2'])
  })
  it('다음 사람으로 돌리기: 맡은 사람 수만큼 가장 뒤 번호의 다음 학생, 끝에서는 처음으로, 맡은 사람 없는 역할은 그대로', () => {
    const id = ids()
    let t: RoleTerm[] = assignRole([], 'warm', ['s4', 's5'], '2026-11-02', id)
    t = rotateRoles(t, roles, order, '2026-11-09', id)
    expect(holdersOn(t, 'warm', '2026-11-09')).toEqual(['s1', 's2'])
    expect(holdersOn(t, 'gear', '2026-11-09')).toEqual([])
    expect(holdersOn(t, 'warm', '2026-11-08').sort()).toEqual(['s4', 's5']) // 지난 기간은 남는다
    expect(rotateRoles(t, roles, [], '2026-11-10', id)).toEqual(t)
  })
  it('한 학생이 맡았던 역할 · 지우기 · 세특 한 문장', () => {
    const id = ids()
    let t = assignRole([], 'gear', ['s1'], '2026-09-01', id)
    t = assignRole(t, 'gear', ['s2'], '2026-09-15', id)
    t = assignRole(t, 'gear', ['s1'], '2026-10-01', id)
    t = assignRole(t, 'warm', ['s1'], '2026-10-05', id)
    const mine = rolesOfStudent(roles, t, 's1')
    expect(mine.map((m) => [m.role.name, m.from, m.to, m.times])).toEqual([
      ['교구 담당', '2026-09-01', undefined, 2],
      ['준비운동 리더', '2026-10-05', undefined, 1],
    ])
    const rest = removeRole(roles, t, 'gear')
    expect(rest.roles.map((r) => r.id)).toEqual(['warm'])
    expect(rest.terms.every((x) => x.roleId === 'warm')).toBe(true)
    expect(roleSentence(roles[1])).toBe('수업에서 ‘교구 담당’ 역할을 맡아 교구를 준비하고 정리함')
    expect(roleSentence({ name: '심판', duty: '' })).toBe('수업에서 ‘심판’ 역할을 맡음')
    expect(roleSentence({ name: '심판', duty: '경기 판정을 맡음.' })).toBe('수업에서 ‘심판’ 역할을 맡아 경기 판정을 맡음')
  })
  it('세특 틀 초안: 부장 다음 · 메모 앞에, 두 개까지, 역할이 없으면 문장도 없음', () => {
    const base = { records: [], keywords: [], assessments: [], captainRoles: [] as string[] }
    expect(draftParts(base).some((p) => p.kind === 'role')).toBe(false)
    const parts = draftParts({ ...base, captainRoles: ['체육부장'], classRoles: [...roles, { name: '심판', duty: '' }] })
    expect(parts.map((p) => p.kind)).toEqual(['captain', 'role', 'role'])
    expect(parts[1]).toEqual({ kind: 'role', id: 'role:준비운동 리더', text: '수업에서 ‘준비운동 리더’ 역할을 맡아 준비운동을 앞에서 진행함.' })
  })
  it('기본 역할 문장은 기재요령 검사기에 오류 · 경고가 없다', () => {
    for (const p of ROLE_PRESETS) {
      const text = `${roleSentence(p)}.`
      expect(checkSeteuk(text).filter((h) => h.level !== 'info'), text).toEqual([])
    }
  })
})
