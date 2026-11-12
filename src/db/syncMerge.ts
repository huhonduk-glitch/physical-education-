/**
 * 다른 기기 자료 합치기 (2026-11-12 교사 결정 '동기화는 A로', CLAUDE.md 6-21)
 *
 * 다른 기기에서 만든 백업(잠금 파일을 푼 것)을 이 기기 자료에 더한다. 지우는 것은 없다.
 *
 * 1) 같은 것 찾기: 두 기기에서 따로 만든 같은 학생 · 수업반 · 키워드 · PAPS 회차 · 수행평가는 id가 다르다.
 *    학생 = 학년도 + 학번 + 이름, 학적반 = 학년도 + 학년 · 반 + 기간, 수강반 = 학년도 + 이름 + 기간,
 *    키워드 = 카테고리 + 이름, PAPS 회차 = 학년도 + 학년 · 반 + 회차, 수행평가 = 학년도 + 제목.
 *    찾으면 파일 쪽 id를 이 기기 id로 바꾼다 — 파일 안 모든 곳(기록의 studentId, 수업반 memberIds,
 *    진도표의 수업반별 칸 이름 등)에서 그 id 글자를 그대로 바꾼다(id는 UUID라 다른 글자와 겹치지 않음).
 * 2) 줄 합치기: 이 기기에 없는 줄은 더한다. 같은 줄이 양쪽에 있으면
 *    - 내용이 같으면 그대로
 *    - 둘 다 고친 시각(updatedAt · measuredAt)이 있으면 더 최근 것
 *    - 시각이 없으면 이 기기 것을 둔다 (수강반 학생 목록만 양쪽을 합친다)
 *    PAPS 칸 · 출결 · 채점 · 세특 글 · 측정 종목 · 체육부장은 id가 달라도 같은 자리(학생 · 칸 · 날짜)면 같은 줄로 본다.
 * 3) 설정은 이 기기 것을 그대로 두고, 이 기기에 없는 설정만 가져온다. 비밀 값(AI 키 · 공유 공간)은 오가지 않는다.
 *
 * 한쪽에서 지운 줄은 합치면 다시 생긴다(지운 기록을 남기지 않으므로) → 화면에서 알린다.
 */
import { BACKUP_TABLES, SECRET_KEYS, type BackupFile } from './backup'

type Row = Record<string, unknown> & { id?: string; key?: string }
type Tables = Partial<Record<(typeof BACKUP_TABLES)[number], Row[]>>
export type TableName = (typeof BACKUP_TABLES)[number]

export interface TableStat {
  added: number
  updated: number
  kept: number
  same: number
}

export interface MergePlan {
  /** 표마다 넣을(덧쓸) 줄 */
  put: Partial<Record<TableName, Row[]>>
  stats: Partial<Record<TableName, TableStat>>
  /** 같은 것으로 맞춘 수 (학생 · 수업반 …) */
  matched: number
}

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v))

/** 서로 다른 기기에서 따로 만들 수 있는 '같은 것'의 열쇠 (참조 id가 들어가지 않는 것만) */
const IDENTITY: Partial<Record<TableName, (r: Row) => string | null>> = {
  students: (r) => (r.studentCode && r.name ? `${s(r.schoolYear)}|${s(r.studentCode)}|${s(r.name)}` : null),
  groups: (r) =>
    r.kind === 'homeroom' ? `${s(r.schoolYear)}|h|${s(r.grade)}|${s(r.classNo)}|${s(r.semester)}` : r.name ? `${s(r.schoolYear)}|e|${s(r.name)}|${s(r.semester)}` : null,
  keywords: (r) => (r.label ? `${s(r.category)}|${s(r.label)}` : null),
  papsRounds: (r) => `${s(r.schoolYear)}|${s(r.grade)}|${s(r.classNo)}|${s(r.round)}`,
  assessments: (r) => (r.title ? `${s(r.schoolYear)}|${s(r.title)}` : null),
}

/** id를 바꾼 뒤 '같은 자리'인지 보는 열쇠 (참조 id가 들어감) */
const SLOT: Partial<Record<TableName, (r: Row) => string | null>> = {
  papsResults: (r) => `${s(r.studentId)}|${s(r.eventId)}|${s(r.attempt)}|${s(r.side)}|${s(r.roundId)}|${r.excluded ? 1 : 0}`,
  papsConfigs: (r) => `${s(r.schoolYear)}|${s(r.grade)}|${s(r.classNo)}`,
  attendance: (r) => `${s(r.groupId)}|${s(r.studentId)}|${s(r.date)}|${s(r.period)}`,
  assessmentScores: (r) => `${s(r.assessmentId)}|${s(r.studentId)}`,
  seteukDrafts: (r) => `${s(r.groupId)}|${s(r.studentId)}`,
  captains: (r) => `${s(r.studentId)}|${s(r.role)}|${s(r.from)}`,
}

const timeOf = (r: Row): number | null => {
  const t = r.updatedAt ?? r.measuredAt
  return typeof t === 'number' && Number.isFinite(t) ? t : null
}

/** 값 안의 모든 글자를 id 표대로 바꾼다 (객체 열쇠 포함) */
export function rewriteIds<T>(v: T, map: ReadonlyMap<string, string>): T {
  if (!map.size) return v
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') return map.get(x) ?? x
    if (Array.isArray(x)) return x.map(walk)
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(x)) out[map.get(k) ?? k] = walk(val)
      return out
    }
    return x
  }
  return walk(v) as T
}

/** 순서와 상관없이 같은 내용인지 */
function sameRow(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`
  if (x && typeof x === 'object')
    return `{${Object.keys(x)
      .filter((k) => (x as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`)
      .join(',')}}`
  return JSON.stringify(x ?? null)
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/** 지금 자료(here)와 파일(incoming) → 넣을 줄 (순수 함수, 저장소를 건드리지 않는다) */
export function planMerge(here: Tables, incoming: Tables): MergePlan {
  // 1) 같은 것 찾기 → id 표
  const map = new Map<string, string>()
  for (const [t, keyOf] of Object.entries(IDENTITY) as [TableName, (r: Row) => string | null][]) {
    const byKey = new Map<string, string>()
    for (const r of here[t] ?? []) {
      const k = keyOf(r)
      if (k && r.id && !byKey.has(k)) byKey.set(k, r.id)
    }
    const hereIds = new Set((here[t] ?? []).map((r) => r.id))
    for (const r of incoming[t] ?? []) {
      if (!r.id || hereIds.has(r.id)) continue
      const k = keyOf(r)
      const to = k ? byKey.get(k) : undefined
      if (to && to !== r.id) map.set(r.id, to)
    }
  }

  const put: MergePlan['put'] = {}
  const stats: MergePlan['stats'] = {}
  for (const t of BACKUP_TABLES) {
    const stat: TableStat = { added: 0, updated: 0, kept: 0, same: 0 }
    const rows: Row[] = []
    if (t === 'settings') {
      const have = new Set((here.settings ?? []).map((r) => r.key))
      for (const r of incoming.settings ?? []) {
        if (!r.key || SECRET_KEYS.includes(r.key)) continue
        if (have.has(r.key)) stat.kept++
        else {
          rows.push(rewriteIds(r, map))
          stat.added++
        }
      }
    } else {
      const hereRows = here[t] ?? []
      const byId = new Map(hereRows.map((r) => [r.id, r]))
      const slotOf = SLOT[t]
      const bySlot = new Map<string, Row>()
      if (slotOf) for (const r of hereRows) bySlot.set(slotOf(r) ?? '', r)
      const done = new Set<string>()
      for (const raw of incoming[t] ?? []) {
        if (!raw.id) continue
        let r = rewriteIds(raw, map)
        let old = byId.get(r.id)
        if (!old && slotOf) {
          const k = slotOf(r)
          const hit = k ? bySlot.get(k) : undefined
          if (hit) {
            r = { ...r, id: hit.id }
            old = hit
          }
        }
        if (done.has(r.id!)) continue // 파일 안에서 같은 자리가 두 번
        done.add(r.id!)
        if (!old) {
          rows.push(r)
          stat.added++
          continue
        }
        if (t === 'groups') {
          // 수강반 학생 목록은 양쪽을 합친다 (다른 칸은 이 기기 것)
          const members = uniq([...((old.memberIds as string[]) ?? []), ...((r.memberIds as string[]) ?? [])])
          if (members.length !== ((old.memberIds as string[]) ?? []).length) {
            rows.push({ ...old, memberIds: members })
            stat.updated++
          } else stat.same++
          continue
        }
        if (sameRow(old, r)) {
          stat.same++
          continue
        }
        const a = timeOf(old)
        const b = timeOf(r)
        if (a !== null && b !== null && b > a) {
          rows.push(r)
          stat.updated++
        } else stat.kept++
      }
    }
    if (rows.length) put[t] = rows
    if (stat.added || stat.updated || stat.kept || stat.same) stats[t] = stat
  }
  return { put, stats, matched: map.size }
}

/** 이 기기 저장소에 합치기 (한 번에 — 중간에 실패하면 아무것도 안 바뀐다) */
export async function mergeInto(db: import('./db').PeDatabase, file: BackupFile): Promise<MergePlan> {
  const tables = BACKUP_TABLES.map((t) => db.table(t))
  let plan: MergePlan = { put: {}, stats: {}, matched: 0 }
  await db.transaction('rw', tables, async () => {
    const here: Tables = {}
    for (const t of BACKUP_TABLES) here[t] = (await db.table(t).toArray()) as Row[]
    plan = planMerge(here, file.tables as Tables)
    for (const [t, rows] of Object.entries(plan.put)) if (rows?.length) await db.table(t).bulkPut(rows)
  })
  // 수업반이 생기기 전 백업(groups 표가 없음)을 합쳤을 때만 학적반 수업반을 만들어 붙인다.
  // 늘 돌리면 교사가 수업반으로 만들지 않은 반(지난 학년도 등)까지 수업반이 생긴다
  if (!Array.isArray((file.tables as Record<string, unknown>).groups)) {
    const { runGroupMigration } = await import('./groupsRepo')
    await runGroupMigration(db)
  }
  return plan
}

/** 합친 결과 요약 (사람이 읽는 줄) */
export function mergeSummary(plan: MergePlan, labels: Partial<Record<string, string>>): string[] {
  const out: string[] = []
  for (const [t, st] of Object.entries(plan.stats)) {
    const label = labels[t]
    if (!label || !st || (!st.added && !st.updated)) continue
    out.push(`${label} ${st.added ? `+${st.added}` : ''}${st.added && st.updated ? ' · ' : ''}${st.updated ? `바뀜 ${st.updated}` : ''}`)
  }
  return out
}
