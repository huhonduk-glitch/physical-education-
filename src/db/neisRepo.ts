import type { TimetableEntry } from './settings'
import type { PeDatabase } from './db'
import { createGroup } from './groupsRepo'
import type { ClassGroup } from './types'
import { COLOR_KEYS, newHomeroomGroup } from '../lib/groups'
import { newId } from './db'

export interface SlotPick {
  day: number
  period: number
  subject: string
  /** 이 시각에 수업하는 학적반 (2개 이상이면 합반 수업반으로 묶는다) */
  classes: { grade: number; classNo: number }[]
}

export interface ApplyResult {
  timetable: TimetableEntry[]
  createdHomerooms: number
  createdElectives: string[]
  slots: number
}

const classKey = (c: { grade: number; classNo: number }) => `${c.grade}-${c.classNo}`
export const combinedName = (subject: string, classes: { grade: number; classNo: number }[]) =>
  `${subject} ${[...classes].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo).map(classKey).join('·')}`

/**
 * 나이스 시간표에서 고른 칸 → 수업반 + 앱 시간표.
 * - 반 하나: 그 학적반 수업반(없으면 만듦). 과목이 기본값('체육')이면 나이스 과목명으로 바꾼다.
 * - 반 여럿(합반·선택과목): '과목 1-1·1-2' 수강반을 만들고 그 반 학생을 모두 넣는다(교사가 나중에 고칠 수 있다).
 * - replaceAll이면 고르지 않은 칸은 비우고, 아니면 고른 칸만 바꾼다.
 */
export async function applyNeisTimetable(
  db: PeDatabase,
  opts: { schoolYear: number; picks: SlotPick[]; current: TimetableEntry[]; replaceAll: boolean },
): Promise<ApplyResult> {
  return db.transaction('rw', db.groups, db.students, async () => {
    const groups = await db.groups.where('schoolYear').equals(opts.schoolYear).toArray()
    const students = await db.students.where('schoolYear').equals(opts.schoolYear).filter((s) => s.status === '재학').toArray()
    let createdHomerooms = 0
    const createdElectives: string[] = []
    let order = groups.length

    const homeroomFor = async (c: { grade: number; classNo: number }, subject: string): Promise<string> => {
      const g = groups.find((x) => x.kind === 'homeroom' && x.grade === c.grade && x.classNo === c.classNo)
      if (g) {
        if (g.archived || (g.subject === '체육' && subject && subject !== g.subject)) {
          const patch: Partial<ClassGroup> = { archived: false }
          if (g.subject === '체육' && subject) patch.subject = subject
          await db.groups.update(g.id, patch)
          Object.assign(g, patch)
        }
        return g.id
      }
      const row: ClassGroup = { ...newHomeroomGroup(opts.schoolYear, c.grade, c.classNo, order++), subject: subject || '체육', id: newId(), createdAt: Date.now() }
      await db.groups.add(row)
      groups.push(row)
      createdHomerooms++
      return row.id
    }
    const combinedFor = async (subject: string, classes: { grade: number; classNo: number }[]): Promise<string> => {
      const name = combinedName(subject, classes)
      const g = groups.find((x) => x.kind === 'elective' && x.name === name)
      if (g) return g.id
      const keys = new Set(classes.map(classKey))
      const id = await createGroup(db, {
        schoolYear: opts.schoolYear,
        semester: 0,
        kind: 'elective',
        name,
        subject,
        memberIds: students.filter((s) => keys.has(classKey(s))).map((s) => s.id),
        color: COLOR_KEYS[(order++ + 3) % COLOR_KEYS.length],
        archived: false,
      })
      groups.push({ id, name, kind: 'elective' } as ClassGroup)
      createdElectives.push(name)
      return id
    }

    const fresh: TimetableEntry[] = []
    for (const p of opts.picks) {
      if (p.classes.length === 0) continue
      const groupId = p.classes.length === 1 ? await homeroomFor(p.classes[0], p.subject) : await combinedFor(p.subject, p.classes)
      fresh.push({ day: p.day, period: p.period, groupId })
    }
    const taken = new Set(fresh.map((e) => `${e.day}|${e.period}`))
    const kept = opts.replaceAll ? [] : opts.current.filter((e) => !taken.has(`${e.day}|${e.period}`))
    // 같은 칸을 두 번 고르면 뒤의 것
    const merged = new Map<string, TimetableEntry>()
    for (const e of [...kept, ...fresh]) merged.set(`${e.day}|${e.period}`, e)
    const timetable = [...merged.values()].sort((a, b) => a.day - b.day || a.period - b.period)
    return { timetable, createdHomerooms, createdElectives, slots: fresh.length }
  })
}

