import type { PeDatabase } from './db'
import { newId } from './db'
import type { Lesson } from './types'

/** 수업반·날짜의 일지를 저장한다 (있으면 고치고, 없으면 만든다). 내용이 모두 비면 지운다 */
export async function saveLesson(
  db: PeDatabase,
  key: { schoolYear: number; groupId: string; date: string },
  body: { period?: number; unit?: string; activity: string; note?: string },
): Promise<'saved' | 'deleted' | 'empty'> {
  const clean = { period: body.period || undefined, unit: body.unit?.trim() || undefined, activity: body.activity.trim(), note: body.note?.trim() || undefined }
  const empty = !clean.unit && !clean.activity && !clean.note
  return db.transaction('rw', db.lessons, async () => {
    const cur = await db.lessons.where('[groupId+date]').equals([key.groupId, key.date]).first()
    if (empty) {
      if (cur) {
        await db.lessons.delete(cur.id)
        return 'deleted'
      }
      return 'empty'
    }
    const now = Date.now()
    if (cur) await db.lessons.update(cur.id, { ...clean, updatedAt: now })
    else await db.lessons.add({ id: newId(), ...key, ...clean, createdAt: now, updatedAt: now } as Lesson)
    return 'saved'
  })
}
