import type { PeDatabase } from './db'
import { newId } from './db'

/** 한 채점 요소에 여러 학생 값을 한 번에 넣는다 (다른 요소 점수·메모는 그대로). 덮어쓴 칸 수를 돌려준다 */
export async function setItemValues(db: PeDatabase, assessmentId: string, itemId: string, values: { studentId: string; value: string | number }[]): Promise<number> {
  return db.transaction('rw', db.assessmentScores, async () => {
    let overwritten = 0
    for (const { studentId, value } of values) {
      const cur = await db.assessmentScores.where('[assessmentId+studentId]').equals([assessmentId, studentId]).first()
      if (cur) {
        if (cur.scores[itemId] !== undefined && cur.scores[itemId] !== '') overwritten++
        await db.assessmentScores.update(cur.id, { scores: { ...cur.scores, [itemId]: value } })
      } else await db.assessmentScores.add({ id: newId(), assessmentId, studentId, scores: { [itemId]: value } })
    }
    return overwritten
  })
}
