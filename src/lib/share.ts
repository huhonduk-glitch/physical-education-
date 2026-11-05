import type { Assessment, ProgressPlan } from '../db/types'
import type { WorkEvent } from './workCal'

/**
 * 같이 쓰기 · 보내기 받기 (2026-11-05 교사 결정: 서버 없이 먼저, CLAUDE.md 6-13).
 * 같은 학교 · 같은 교과 선생님께 진도표 · 수행평가 틀(차시 · 채점 기준 · 루브릭)을 링크 · 파일로 보내고 받는다.
 * - 학생 정보는 넣지 않는다: 점수는 다른 표(assessmentScores)라 원래 없고, 수업반 연결 · 끝낸 차시 · 빠진 수업도 뺀다
 * - 링크는 주소의 # 뒤에 담아 서버로 가지 않는다(GitHub Pages도 # 뒤는 받지 않음). 메신저로 보내면 그 메신저에는 남는다
 */

export type ShareType = 'plan' | 'assessment' | 'calendar'

export interface SharePack {
  app: 'PE LOG'
  v: 1
  type: ShareType
  name: string
  createdAt: number
  data: unknown
}

export class ShareError extends Error {}

export const SHARE_LABEL: Record<ShareType, string> = { plan: '교과 진도표', assessment: '수행평가', calendar: '업무 달력' }

type PlanShare = Omit<ProgressPlan, 'id' | 'schoolYear' | 'groupIds' | 'skips' | 'done' | 'createdAt' | 'updatedAt'>
type AssessShare = Omit<Assessment, 'id' | 'schoolYear' | 'groupIds'>

export function packPlan(p: ProgressPlan): SharePack {
  const { id: _id, schoolYear: _y, groupIds: _g, skips: _s, done: _d, createdAt: _c, updatedAt: _u, ...rest } = p
  void [_id, _y, _g, _s, _d, _c, _u]
  return { app: 'PE LOG', v: 1, type: 'plan', name: p.title, createdAt: Date.now(), data: rest satisfies PlanShare }
}

export function packAssessment(a: Assessment): SharePack {
  const { id: _id, schoolYear: _y, groupIds: _g, ...rest } = a
  void [_id, _y, _g]
  return { app: 'PE LOG', v: 1, type: 'assessment', name: a.title, createdAt: Date.now(), data: rest satisfies AssessShare }
}

/** 받은 진도표 → 내 진도표 (새 id · 이 학년도 · 고른 수업반, 진도는 처음부터) */
export function unpackPlan(pack: SharePack, o: { id: string; schoolYear: number; groupIds: string[]; now: number }): ProgressPlan {
  if (pack.type !== 'plan') throw new ShareError('진도표가 아니에요.')
  const d = pack.data as PlanShare
  if (!Array.isArray(d.items)) throw new ShareError('진도표 차시를 읽지 못했어요.')
  return { ...d, id: o.id, schoolYear: o.schoolYear, groupIds: o.groupIds, skips: {}, done: {}, createdAt: o.now, updatedAt: o.now }
}

/** 받은 수행평가 → 내 평가 (새 id · 이 학년도 · 고른 수업반). 채점 요소 id는 그대로 둔다(점수는 따로라 겹치지 않음) */
export function unpackAssessment(pack: SharePack, o: { id: string; schoolYear: number; groupIds: string[] }): Assessment {
  if (pack.type !== 'assessment') throw new ShareError('수행평가가 아니에요.')
  const d = pack.data as AssessShare
  if (typeof d.title !== 'string') throw new ShareError('수행평가를 읽지 못했어요.')
  return { ...d, id: o.id, schoolYear: o.schoolYear, groupIds: o.groupIds }
}

/** 업무 달력 일정 묶음 (id는 빼고, 받는 쪽에서 새로 붙인다) */
export function packCalendar(events: readonly WorkEvent[], name: string): SharePack {
  return { app: 'PE LOG', v: 1, type: 'calendar', name, createdAt: Date.now(), data: events.map(({ id: _id, ...e }) => (void _id, e)) }
}

export function unpackCalendar(pack: SharePack): Omit<WorkEvent, 'id'>[] {
  if (pack.type !== 'calendar' || !Array.isArray(pack.data)) throw new ShareError('업무 달력이 아니에요.')
  return pack.data as Omit<WorkEvent, 'id'>[]
}

/** 혹시라도 학생 정보 낱말이 섞였는지 (보내기 전에 한 번 더) */
export function hasStudentInfo(pack: SharePack): boolean {
  return /"(studentId|studentIds|students|memberIds|scores)"\s*:/.test(JSON.stringify(pack.data))
}

// ── 글자로 바꾸기: gzip(가능하면) + base64url. 앞 글자 z = 압축, j = 그냥 JSON ──
function toB64url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>))
  return new Uint8Array(await res.arrayBuffer())
}

export async function encodePack(pack: SharePack, opts: { compress?: boolean } = {}): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(pack))
  if (opts.compress !== false && typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + toB64url(await pipe(raw, new CompressionStream('gzip')))
    } catch {
      /* 아래로 */
    }
  }
  return 'j' + toB64url(raw)
}

export async function decodePack(code: string): Promise<SharePack> {
  const s = code.trim().replace(/^.*[?&#]d=/, '').replace(/&.*$/, '')
  if (!s) throw new ShareError('받은 코드가 비어 있어요.')
  let text: string
  try {
    if (s[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') throw new ShareError('이 브라우저는 압축된 코드를 못 읽어요. 파일로 받아 주세요.')
      text = new TextDecoder().decode(await pipe(fromB64url(s.slice(1)), new DecompressionStream('gzip')))
    } else if (s[0] === 'j') text = new TextDecoder().decode(fromB64url(s.slice(1)))
    else text = s // 파일 내용(JSON 그대로)
  } catch (e) {
    if (e instanceof ShareError) throw e
    throw new ShareError('코드를 읽지 못했어요. 끝까지 다 복사됐는지 확인해 주세요.')
  }
  let pack: SharePack
  try {
    pack = JSON.parse(text)
  } catch {
    throw new ShareError('코드를 읽지 못했어요. 끝까지 다 복사됐는지 확인해 주세요.')
  }
  if (pack?.app !== 'PE LOG' || pack.v !== 1 || !(pack.type in SHARE_LABEL)) throw new ShareError('PE LOG에서 보낸 자료가 아니에요.')
  return pack
}

/** 받는 링크: 이 앱 주소 + #/share?d=코드 (# 뒤라 서버로 가지 않음) */
export function shareLink(appUrl: string, code: string): string {
  return `${appUrl.split('#')[0].split('?')[0]}#/share?d=${code}`
}

export function shareFileName(pack: SharePack): string {
  const safe = pack.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || SHARE_LABEL[pack.type]
  return `PE LOG ${SHARE_LABEL[pack.type]} - ${safe}.pelog.json`
}
