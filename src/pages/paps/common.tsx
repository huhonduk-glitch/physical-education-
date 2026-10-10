import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { classesOf, classKeyStr, type ClassKey } from '../../components/ClassPicker'
import { db } from '../../db/db'
import type { MeasureKey } from '../../lib/neisHeaderParser'
import { validateExport } from '../../lib/neisExport'
import type { CellSpec } from '../../lib/papsLayout'
import type { Band } from '../../lib/paps'
import { useApp } from '../../state/AppContext'
import type { PapsClassView } from '../../state/usePapsClass'

const KEY = 'pe.papsClass'

/** PAPS 화면들이 함께 쓰는 '지금 고른 반' (주소 ?c=1-3 → 없으면 지난번 반) */
export function usePapsClassKey(): { classes: ClassKey[]; mine: Set<string>; cls: ClassKey | null; setCls: (c: ClassKey | null) => void } {
  const { settings } = useApp()
  // 내 수업반(학적반)이 있으면 그 반들을 먼저 보여 준다. 나머지는 [다른 반]으로 접어 둔다
  const groups = useLiveQuery(() => db.groups.where('schoolYear').equals(settings.schoolYear).toArray(), [settings.schoolYear])
  const mine = useMemo(
    () => new Set((groups ?? []).filter((g) => g.kind === 'homeroom' && !g.archived).map((g) => `${g.grade}-${g.classNo}`)),
    [groups],
  )
  const [sp, setSp] = useSearchParams()
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status === '재학').toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const fromUrl = sp.get('c')
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    /* 무시 */
  }
  const want = fromUrl ?? saved
  const cls = classes.find((c) => classKeyStr(c) === want) ?? classes.find((c) => mine.has(classKeyStr(c))) ?? classes[0] ?? null
  useEffect(() => {
    if (cls && fromUrl !== classKeyStr(cls)) setSp((p) => (p.set('c', classKeyStr(cls)), p), { replace: true })
  }, [cls, fromUrl, setSp])
  const setCls = (c: ClassKey | null) => {
    if (!c) return
    try {
      localStorage.setItem(KEY, classKeyStr(c))
    } catch {
      /* 무시 */
    }
    setSp((p) => (p.set('c', classKeyStr(c)), p), { replace: true })
  }
  return { classes, mine, cls, setCls }
}

export function gradeTone(g: Band['grade'] | undefined | null): string {
  if (g === undefined || g === null) return 'bg-fill text-ink-3'
  if (typeof g === 'string') {
    if (g === '정상') return 'bg-ok-light text-ok'
    if (g === '고도비만') return 'bg-danger-light text-danger'
    return 'bg-caution-light text-caution'
  }
  return ['', 'bg-brand text-white', 'bg-ok text-white', 'bg-[#f2c94c] text-ink', 'bg-[#f2994a] text-white', 'bg-danger text-white'][g] ?? 'bg-fill'
}

export function GradeBadge({ band, points }: { band: Band | null | undefined; points?: number | null }) {
  if (!band) return <span className="badge bg-fill text-ink-3">—</span>
  return (
    <span className={`badge ${gradeTone(band.grade)}`}>
      {typeof band.grade === 'number' ? `${band.grade}등급` : band.grade}
      {points !== undefined && points !== null ? ` · ${points}점` : ''}
    </span>
  )
}

/** 측정 칸을 종목별로 묶기 (신장·체중은 BMI 하나로) */
export function measureGroups(cells: readonly CellSpec[]): { key: MeasureKey | 'bmi'; cells: CellSpec[] }[] {
  const out: { key: MeasureKey | 'bmi'; cells: CellSpec[] }[] = []
  for (const c of cells) {
    const k: MeasureKey | 'bmi' = c.key === 'height' || c.key === 'weight' ? 'bmi' : c.key === 'heartRate' ? 'stepTest' : c.key
    let g = out.find((x) => x.key === k)
    if (!g) out.push((g = { key: k, cells: [] }))
    g.cells.push(c)
  }
  return out
}

/** 반 하나의 나이스 업로드 준비 상태 */
export function useReadiness(pc: PapsClassView) {
  const { settings } = useApp()
  return useMemo(() => {
    const v = validateExport(pc.columns, pc.students, pc.values, new Set(pc.excluded.keys()), settings.neisRanges)
    const missing = v.issues.filter((i) => i.kind === 'missing').length
    const bad = v.issues.filter((i) => i.kind !== 'missing').length
    return { ...v, missing, bad }
  }, [pc, settings.neisRanges])
}

export function ReadinessBadge({ missing, bad }: { missing: number; bad: number }) {
  if (bad) return <span className="badge bg-danger-light text-danger">❌ 범위·자릿수 오류 {bad}칸</span>
  if (missing) return <span className="badge bg-caution-light text-caution">⚠️ 누락 {missing}칸</span>
  return <span className="badge bg-ok-light text-ok">✅ 업로드 가능</span>
}
