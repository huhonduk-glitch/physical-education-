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
 *    PAPS 칸 · 출결 · 채점 · 세특 글 · 측정 종목 · 체육부장 · 수업 일지(수업반 · 날짜) · 견학(학생 · 날짜)은
 *    id가 달라도 같은 자리면 같은 줄로 본다. 누가기록은 학생 · 날짜 · 교시 · 수업반 · 항목 · 메모가 모두 같으면 같은 기록
 *    (두 기기에서 같은 것을 따로 넣은 것) — 다만 한 기기에서 같은 칭찬을 두 번 준 것은 두 줄 그대로.
 * 3) 설정은 이 기기 것을 그대로 두고, 이 기기에 없는 설정만 가져온다. 비밀 값(AI 키 · 공유 공간)은 오가지 않는다.
 *
 * 한쪽에서 지운 줄은 합치면 다시 생긴다(지운 기록을 남기지 않으므로) → 화면에서 알린다.
 */
import { BACKUP_TABLES, SECRET_KEYS, type BackupFile } from './backup'
import type { Tombstone } from './syncState'

type Row = Record<string, unknown> & { id?: string; key?: string }
type Tables = Partial<Record<(typeof BACKUP_TABLES)[number], Row[]>>
export type TableName = (typeof BACKUP_TABLES)[number]

export interface TableStat {
  added: number
  updated: number
  kept: number
  same: number
  /** 다른 기기에서 지워서 여기서도 지운 줄 (구글 동기화) */
  removed?: number
}

export interface MergePlan {
  /** 표마다 넣을(덧쓸) 줄 */
  put: Partial<Record<TableName, Row[]>>
  /** 표마다 지울 줄 id (다른 기기의 지운 기록, 구글 동기화에서만) */
  remove: Partial<Record<TableName, string[]>>
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
  // 수업 일지는 수업반 · 날짜마다 한 줄, 견학은 학생 · 날짜마다 한 줄(앱이 그렇게 저장한다)
  lessons: (r) => `${s(r.groupId)}|${s(r.date)}`,
  absences: (r) => `${s(r.studentId)}|${s(r.date)}`,
  // 누가기록: 두 기기에서 같은 학생 · 날짜 · 교시 · 수업반 · 항목 · 메모로 따로 넣은 것은 같은 기록 하나로 본다
  // (한 기기 안에서 같은 칭찬을 두 번 누른 것은 id가 달라도 그대로 둔다 — 이 기기 줄끼리는 비교하지 않음)
  records: (r) => `${s(r.studentId)}|${s(r.date)}|${s(r.period)}|${s(r.groupId)}|${s(r.type)}|${s(r.category)}|${s(r.note)}`,
}

/** 같은 자리에 여러 줄이 정상인 표 (같은 칭찬을 두 번 줄 수 있음) */
const MULTI = new Set<TableName>(['records'])

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

/**
 * 지금 자료(here)와 파일(incoming) → 넣을 줄 · 지울 줄 (순수 함수, 저장소를 건드리지 않는다)
 * 지운 기록(구글 동기화): localTomb = 이 기기에서 지운 줄 → 파일에 있어도 되살리지 않음(지운 뒤에 고친 줄이면 살림),
 * remoteTomb = 다른 기기에서 지운 줄 → 여기서도 지움(지운 뒤에 여기서 고친 줄이면 둠)
 * preferIncoming(구글 동기화의 올리기 · 내려받기): 같은 줄이 다르고 고친 시각으로 가릴 수 없으면 보내는 쪽(incoming)을 남긴다.
 *   없으면(잠금 파일 '합치기') 이 기기 것을 둔다.
 */
export function planMerge(here: Tables, incoming: Tables, opts: { localTomb?: readonly Tombstone[]; remoteTomb?: readonly Tombstone[]; preferIncoming?: boolean } = {}): MergePlan {
  const localDel = new Map((opts.localTomb ?? []).map((x) => [`${x.t}:${x.id}`, x.at]))
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
      const multi = MULTI.has(t)
      // 여러 줄이 될 수 있는 표(누가기록): 상대가 이미 아는 줄(같은 id가 파일에 있음)과는 자리로 맞추지 않는다
      const known = multi ? new Set((incoming[t] ?? []).map((r) => (r.id ? (map.get(r.id) ?? r.id) : ''))) : null
      if (slotOf) for (const r of hereRows) if (!known?.has(r.id!)) bySlot.set(slotOf(r) ?? '', r)
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
            // 누가기록은 한 줄과 한 번만 맞춘다 — 상대 쪽에 같은 기록이 두 번이면 하나는 새로 더한다
            if (multi) bySlot.delete(k!)
          }
        }
        if (done.has(r.id!)) continue // 파일 안에서 같은 자리가 두 번
        done.add(r.id!)
        const delAt = localDel.get(`${t}:${r.id}`)
        if (!old && delAt !== undefined && (timeOf(r) ?? 0) <= delAt) {
          stat.kept++ // 이 기기에서 지운 줄 — 되살리지 않음
          continue
        }
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
        if (a !== null && b !== null ? b > a : !!opts.preferIncoming) {
          rows.push(r)
          stat.updated++
        } else stat.kept++
      }
    }
    if (rows.length) put[t] = rows
    if (stat.added || stat.updated || stat.kept || stat.same) stats[t] = stat
  }

  // 다른 기기에서 지운 줄 → 여기서도 (지운 뒤에 여기서 고쳤으면 둔다)
  const remove: MergePlan['remove'] = {}
  for (const x of opts.remoteTomb ?? []) {
    const t = x.t as TableName
    if (t === 'settings' || !BACKUP_TABLES.includes(t)) continue
    const id = map.get(x.id) ?? x.id
    const row = (here[t] ?? []).find((r) => r.id === id)
    if (!row || (timeOf(row) ?? 0) > x.at) continue
    ;(remove[t] ??= []).push(id)
    if (put[t]) put[t] = put[t]!.filter((r) => r.id !== id)
    const st = (stats[t] ??= { added: 0, updated: 0, kept: 0, same: 0 })
    st.removed = (st.removed ?? 0) + 1
  }
  return { put, remove, stats, matched: map.size }
}

/** 계획을 저장소가 아닌 표 묶음(구글 사본)에 적용한 새 표 묶음 */
export function applyPlanToTables(tables: Tables, plan: MergePlan): Tables {
  const out: Tables = {}
  for (const t of BACKUP_TABLES) {
    const pk = t === 'settings' ? 'key' : 'id'
    const m = new Map<string, Row>()
    for (const r of tables[t] ?? []) m.set(String(r[pk]), r)
    for (const r of plan.put[t] ?? []) m.set(String(r[pk]), r)
    for (const id of plan.remove[t] ?? []) m.delete(id)
    out[t] = [...m.values()]
  }
  return out
}

/** 계획대로 넣고 지우기 (한 번에) */
export async function applyPlan(db: import('./db').PeDatabase, plan: MergePlan): Promise<void> {
  const tables = BACKUP_TABLES.map((t) => db.table(t))
  await db.transaction('rw', tables, async () => {
    for (const [t, rows] of Object.entries(plan.put)) if (rows?.length) await db.table(t).bulkPut(rows)
    for (const [t, ids] of Object.entries(plan.remove)) if (ids?.length) await db.table(t).bulkDelete(ids)
  })
}

/** 이 기기 저장소에 합치기 (한 번에 — 중간에 실패하면 아무것도 안 바뀐다) */
export async function mergeInto(db: import('./db').PeDatabase, file: BackupFile): Promise<MergePlan> {
  const tables = BACKUP_TABLES.map((t) => db.table(t))
  let plan: MergePlan = { put: {}, remove: {}, stats: {}, matched: 0 }
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

/** 합친 결과 요약 (사람이 읽는 줄): '누가기록 +3 · 바뀜 1 · 지움 2' */
export function mergeSummary(plan: MergePlan, labels: Partial<Record<string, string>>): string[] {
  const out: string[] = []
  for (const [t, st] of Object.entries(plan.stats)) {
    const label = labels[t]
    if (!label || !st || (!st.added && !st.updated && !st.removed)) continue
    const parts = [st.added ? `+${st.added}` : '', st.updated ? `바뀜 ${st.updated}` : '', st.removed ? `지움 ${st.removed}` : ''].filter(Boolean)
    out.push(`${label} ${parts.join(' · ')}`)
  }
  return out
}
