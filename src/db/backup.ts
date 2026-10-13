/**
 * 전체 백업·복원 (CLAUDE.md 4-11). 파일은 이 기기에만 저장된다(서버로 보내지 않음).
 * 왕복오래달리기 음원(mp3)은 크기가 커서 백업에 넣지 않는다.
 */
import type { PeDatabase } from './db'
import { runGroupMigration } from './groupsRepo'

export const BACKUP_FORMAT = 'pe-records-backup'
export const BACKUP_VERSION = 1

const TABLES = ['settings', 'students', 'records', 'captains', 'absences', 'keywords', 'papsConfigs', 'papsResults', 'assessments', 'assessmentScores', 'timerPresets', 'groups', 'lessons'] as const
type TableName = (typeof TABLES)[number]

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  counts: Record<TableName, number>
  tables: Record<TableName, unknown[]>
}

export async function exportAll(db: PeDatabase): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>
  const counts = {} as Record<TableName, number>
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      tables[t] = await db.table(t).toArray()
      counts[t] = tables[t].length
    }
  })
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), counts, tables }
}

export function checkBackup(x: unknown): { ok: true; file: BackupFile } | { ok: false; error: string } {
  const f = x as Partial<BackupFile>
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) return { ok: false, error: '이 앱의 백업 파일이 아니에요' }
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) return { ok: false, error: '더 새 버전 앱에서 만든 백업이에요. 앱을 먼저 업데이트해 주세요' }
  if (!f.tables || typeof f.tables !== 'object') return { ok: false, error: '백업 안에 자료가 없어요' }
  for (const t of TABLES) {
    const v = (f.tables as Record<string, unknown>)[t]
    if (v !== undefined && !Array.isArray(v)) return { ok: false, error: `${t} 자료 형식이 잘못됐어요` }
  }
  return { ok: true, file: f as BackupFile }
}

/** 지금 자료를 모두 지우고 백업으로 바꾼다 (한 번에 — 중간에 실패하면 아무것도 안 바뀐다) */
export async function restoreAll(db: PeDatabase, file: BackupFile): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = file.tables[t] ?? []
      if (rows.length) await db.table(t).bulkAdd(rows)
    }
  })
  // 수업반이 생기기 전에 만든 백업이면 학적반 수업반을 만들어 붙인다
  await runGroupMigration(db)
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  // 'backup'으로 시작 → .gitignore가 막아 실수로 저장소에 올라가지 않는다
  return `backup_체육기록_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`
}

/** 마지막 백업 후 7일이 지났는지 (한 번도 안 했으면 학생이 있을 때만 경고) */
export function backupOverdue(lastBackupAt: number, now = Date.now(), days = 7): boolean {
  return now - lastBackupAt > days * 24 * 3600 * 1000
}

/** 사람이 알아보는 이름 (백업 내용 보여 주기). 설정·타이머 설정은 뺀다 */
export const TABLE_LABELS: Partial<Record<TableName, string>> = {
  students: '학생',
  groups: '수업반',
  records: '누가기록',
  absences: '견학',
  captains: '체육부장',
  papsResults: 'PAPS 기록 칸',
  assessments: '수행평가',
  assessmentScores: '채점한 학생',
  lessons: '수업 일지',
  keywords: '세특 키워드',
}

export async function countAll(db: PeDatabase): Promise<Record<TableName, number>> {
  const out = {} as Record<TableName, number>
  for (const t of TABLES) out[t] = await db.table(t).count()
  return out
}

/** 지금 자료 ↔ 백업 파일 비교 (복원 전 확인). 백업 쪽이 적은 줄은 fewer=true */
export function compareCounts(now: Partial<Record<string, number>>, file: BackupFile): { label: string; now: number; file: number; fewer: boolean }[] {
  return Object.entries(TABLE_LABELS).map(([t, label]) => {
    const f = file.counts?.[t as TableName] ?? (file.tables[t as TableName] as unknown[] | undefined)?.length ?? 0
    const n = now[t] ?? 0
    return { label: label!, now: n, file: f, fewer: f < n }
  })
}
