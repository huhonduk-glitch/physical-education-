import type { ClassGroup } from '../db/types'
import { GROUP_COLORS } from '../lib/groups'

/** 수업반 고르기 (가로로 밀어서 보기) */
export default function GroupPicker({ groups, value, onChange }: { groups: ClassGroup[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]" role="tablist" aria-label="수업반 고르기">
      {groups.map((g) => {
        const on = g.id === value
        const c = GROUP_COLORS[g.color] ?? GROUP_COLORS.blue
        return (
          <button key={g.id} type="button" role="tab" aria-selected={on} className="chip shrink-0 gap-1.5" onClick={() => onChange(g.id)}>
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: on ? '#fff' : c.fg }} aria-hidden />
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
