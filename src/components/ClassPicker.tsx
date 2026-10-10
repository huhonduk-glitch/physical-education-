import { useState } from 'react'

export interface ClassKey {
  grade: number
  classNo: number
}

export const classKeyStr = (c: ClassKey) => `${c.grade}-${c.classNo}`

/**
 * 학년-반 고르기 (가로로 밀어서 보기).
 * mine(내 수업반의 '학년-반')을 주면 그 반들만 먼저 보이고, 나머지는 [다른 반 +N]을 눌러야 펼쳐진다.
 */
export default function ClassPicker({
  classes,
  value,
  onChange,
  allLabel,
  mine,
}: {
  classes: ClassKey[]
  value: ClassKey | null
  onChange: (c: ClassKey | null) => void
  allLabel?: string
  mine?: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const useMine = !!mine && mine.size > 0
  const isMine = (c: ClassKey) => !useMine || mine!.has(classKeyStr(c)) || (value !== null && classKeyStr(value) === classKeyStr(c))
  const shown = open ? classes : classes.filter(isMine)
  const hidden = classes.length - shown.length
  const others = useMine ? classes.filter((c) => !mine!.has(classKeyStr(c))).length : 0
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="반 고르기">
      {allLabel && (
        <button type="button" role="tab" aria-selected={value === null} className="chip shrink-0" onClick={() => onChange(null)}>
          {allLabel}
        </button>
      )}
      {shown.map((c) => {
        const on = value !== null && classKeyStr(value) === classKeyStr(c)
        return (
          <button key={classKeyStr(c)} type="button" role="tab" aria-selected={on} className="chip shrink-0 tabular-nums" onClick={() => onChange(c)}>
            {c.grade}학년 {c.classNo}반
          </button>
        )
      })}
      {others > 0 && (
        <button type="button" className="chip shrink-0 border-dashed text-ink-3" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? '내 반만' : `다른 반 +${hidden}`}
        </button>
      )}
    </div>
  )
}

/** 학생 목록에서 반 목록 만들기 */
export function classesOf(students: { grade: number; classNo: number }[]): ClassKey[] {
  const m = new Map<string, ClassKey>()
  for (const s of students) m.set(`${s.grade}-${s.classNo}`, { grade: s.grade, classNo: s.classNo })
  return [...m.values()].sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
}
