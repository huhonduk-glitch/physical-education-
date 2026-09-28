export interface ClassKey {
  grade: number
  classNo: number
}

export const classKeyStr = (c: ClassKey) => `${c.grade}-${c.classNo}`

/** 학년-반 고르기 (가로로 밀어서 보기) */
export default function ClassPicker({ classes, value, onChange }: { classes: ClassKey[]; value: ClassKey | null; onChange: (c: ClassKey) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="반 고르기">
      {classes.map((c) => {
        const on = value !== null && classKeyStr(value) === classKeyStr(c)
        return (
          <button
            key={classKeyStr(c)}
            type="button"
            role="tab"
            aria-selected={on}
            className={`btn shrink-0 ${on ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onChange(c)}
          >
            {c.grade}-{c.classNo}
          </button>
        )
      })}
    </div>
  )
}

/** 학생 목록에서 반 목록 만들기 */
export function classesOf(students: { grade: number; classNo: number }[]): ClassKey[] {
  const m = new Map<string, ClassKey>()
  for (const s of students) m.set(`${s.grade}-${s.classNo}`, { grade: s.grade, classNo: s.classNo })
  return [...m.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
}
