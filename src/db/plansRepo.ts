import type { PeDatabase } from './db'
import { newId } from './db'
import type { PlanItem, ProgressPlan } from './types'
import { toggleSkip, type Meeting } from '../lib/progressPlan'

/** 교과 진도표 저장 (6-5). 진도표 하나 = 한 줄. 차시 · 끝냄 · 밀기도 그 줄 안에 둔다 */

export type NewPlan = Omit<ProgressPlan, 'id' | 'createdAt' | 'updatedAt' | 'skips' | 'done' | 'items'> & { items?: PlanItem[] }

export async function createPlan(db: PeDatabase, input: NewPlan): Promise<string> {
  const now = Date.now()
  const plan: ProgressPlan = { ...input, items: input.items ?? [], skips: {}, done: {}, id: newId(), createdAt: now, updatedAt: now }
  await db.progressPlans.add(plan)
  return plan.id
}

export async function updatePlan(db: PeDatabase, id: string, patch: Partial<Omit<ProgressPlan, 'id' | 'createdAt'>>): Promise<void> {
  await db.progressPlans.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deletePlan(db: PeDatabase, id: string): Promise<void> {
  await db.progressPlans.delete(id)
}

/** 이 수업반에서 이 차시를 끝냄 / 안 끝냄 */
export async function setDone(db: PeDatabase, planId: string, groupId: string, itemId: string, on: boolean): Promise<void> {
  await db.transaction('rw', db.progressPlans, async () => {
    const p = await db.progressPlans.get(planId)
    if (!p) return
    const cur = new Set(p.done[groupId] ?? [])
    if (on) cur.add(itemId)
    else cur.delete(itemId)
    await db.progressPlans.update(planId, { done: { ...p.done, [groupId]: [...cur] }, updatedAt: Date.now() })
  })
}

/** 이 수업반의 이 수업이 빠짐 (밀기) / 되돌리기 */
export async function toggleGroupSkip(db: PeDatabase, planId: string, groupId: string, m: Meeting): Promise<void> {
  await db.transaction('rw', db.progressPlans, async () => {
    const p = await db.progressPlans.get(planId)
    if (!p) return
    await db.progressPlans.update(planId, { skips: { ...p.skips, [groupId]: toggleSkip(p.skips[groupId] ?? [], m) }, updatedAt: Date.now() })
  })
}

/** 이 수업반이 쓰는 진도표 (가장 최근에 고친 것 먼저) */
export async function plansForGroup(db: PeDatabase, groupId: string): Promise<ProgressPlan[]> {
  const list = await db.progressPlans.where('groupIds').equals(groupId).toArray()
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 다른 학년도 진도표를 올해로 복사 (차시만 · 끝냄 · 밀기 · 수업반은 비움) */
export async function copyPlanToYear(db: PeDatabase, src: ProgressPlan, schoolYear: number, dates: { startDate: string; endDate: string }): Promise<string> {
  return createPlan(db, {
    schoolYear,
    semester: src.semester,
    title: src.title,
    subject: src.subject,
    grade: src.grade,
    weeklyHours: src.weeklyHours,
    weeks: src.weeks,
    target: src.target,
    startDate: dates.startDate,
    endDate: dates.endDate,
    offDays: [],
    groupIds: [],
    extras: src.extras,
    items: src.items.map((it) => ({ ...it, id: newId(), lockedDate: undefined })),
  })
}
