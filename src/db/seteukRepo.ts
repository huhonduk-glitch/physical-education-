import type { PeDatabase } from './db'
import { newId } from './db'
import type { SeteukDraft } from './types'
import { AI_CONFIRM_ITEMS, checkSeteuk, editRatio } from '../lib/seteukCheck'

/** 세특 쓰기 저장 (6-5 ③). 수업반 · 학생마다 한 줄 */

export async function getDraft(db: PeDatabase, groupId: string, studentId: string): Promise<SeteukDraft | undefined> {
  return db.seteukDrafts.where('[groupId+studentId]').equals([groupId, studentId]).first()
}

async function upsert(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, patch: Partial<SeteukDraft>): Promise<SeteukDraft> {
  return db.transaction('rw', db.seteukDrafts, async () => {
    const cur = await getDraft(db, key.groupId, key.studentId)
    const now = Date.now()
    if (cur) {
      await db.seteukDrafts.update(cur.id, { ...patch, updatedAt: now })
      return { ...cur, ...patch, updatedAt: now }
    }
    const d: SeteukDraft = { id: newId(), ...key, text: '', status: 'draft', updatedAt: now, ...patch }
    await db.seteukDrafts.add(d)
    return d
  })
}

/** 교사가 글을 고침 (확정한 글을 고치면 다시 '초안'으로) */
export function saveText(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, text: string) {
  return upsert(db, key, { text, status: 'draft' })
}

/** AI가 다듬은 글을 받아 씀: 그 글을 기억해 두고, 교사 확인을 처음부터 다시 받는다 */
export function applyAi(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, aiText: string, basisKey?: string) {
  return upsert(db, key, { text: aiText, aiText, aiUsed: true, aiConfirm: AI_CONFIRM_ITEMS.map(() => false), status: 'draft', ...(basisKey !== undefined ? { basisKey } : {}) })
}

/** 틀 초안을 넣었을 때 근거 모양을 같이 남긴다 (근거가 바뀌면 다시 만들기 알림) */
export function saveDraftFromBasis(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, text: string, basisKey: string) {
  return upsert(db, key, { text, basisKey, status: 'draft' })
}

/** 교사가 정한 수준 (undefined = 앱 제안을 따름) */
export function setLevel(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, level: number | undefined) {
  return upsert(db, key, { level })
}

/** 근거 표시: 중요 · 빼기 (id 하나를 켜고 끔) */
export async function toggleMark(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, field: 'important' | 'excluded', id: string) {
  const cur = await getDraft(db, key.groupId, key.studentId)
  const list = cur?.[field] ?? []
  const other = field === 'important' ? 'excluded' : 'important'
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  // 중요와 빼기는 같이 켤 수 없다
  return upsert(db, key, { [field]: next, [other]: (cur?.[other] ?? []).filter((x) => x !== id) })
}

export function setAiConfirm(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, aiConfirm: boolean[]) {
  return upsert(db, key, { aiConfirm })
}

export interface ConfirmCheck {
  ok: boolean
  reasons: string[]
}

/**
 * 확정할 수 있는지 (기재요령 총칙 5-다):
 * 글이 있고 · 검사 오류가 없고 · AI 도움을 받았다면 교사가 고쳐 썼고(그대로 입력 금지) 확인 항목을 모두 체크했을 때
 */
export function canConfirm(d: Pick<SeteukDraft, 'text' | 'aiUsed' | 'aiText' | 'aiConfirm'>, opts: { schoolName?: string } = {}): ConfirmCheck {
  const reasons: string[] = []
  if (!d.text.trim()) reasons.push('글이 비어 있어요')
  const errors = checkSeteuk(d.text, opts).filter((h) => h.level === 'error')
  if (errors.length) reasons.push(`기재요령 검사 오류 ${errors.length}개를 고쳐 주세요`)
  if (d.aiUsed) {
    if (d.aiText !== undefined && editRatio(d.aiText.trim(), d.text.trim()) === 0) reasons.push('AI가 다듬은 글을 그대로 입력할 수 없어요(기재요령 총칙 5-다). 선생님 문장으로 고쳐 주세요')
    if (!(d.aiConfirm ?? []).every(Boolean) || (d.aiConfirm ?? []).length < AI_CONFIRM_ITEMS.length) reasons.push('AI 도움 확인 항목을 모두 체크해 주세요')
  }
  return { ok: reasons.length === 0, reasons }
}

export async function confirmDraft(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }, opts: { schoolName?: string } = {}): Promise<ConfirmCheck> {
  const cur = await getDraft(db, key.groupId, key.studentId)
  if (!cur) return { ok: false, reasons: ['글이 비어 있어요'] }
  const c = canConfirm(cur, opts)
  if (c.ok) await upsert(db, key, { status: 'confirmed', confirmedText: cur.text.trim(), confirmedAt: Date.now() })
  return c
}

export function unconfirm(db: PeDatabase, key: { schoolYear: number; groupId: string; studentId: string }) {
  return upsert(db, key, { status: 'draft' })
}
