/**
 * 잠금 백업 파일 (2026-11-12 교사 결정 '동기화는 A로', CLAUDE.md 6-21)
 *
 * 다른 기기로 자료를 옮길 때 쓰는, 비밀번호로 잠근 백업 파일.
 * 브라우저에 들어 있는 암호 기능(Web Crypto)만 쓴다: 비밀번호 → PBKDF2-SHA256(60만 번) → AES-GCM 256.
 * 서버 · 인터넷 없음. 파일을 어디에 둘지(메신저 · USB · 드라이브)는 교사가 정한다.
 * 비밀번호는 파일에도 기기에도 저장하지 않는다 → 잊으면 아무도 열 수 없다.
 *
 * 파일 모양 (밖에서 보이는 것은 만든 시각뿐):
 *   { format: 'pe-log-locked', v: 1, createdAt, kdf: { iterations, salt }, iv, z, data }
 *   data = AES-GCM( gzip?( 백업 JSON ) ), z = 압축했는지
 */

export const LOCK_FORMAT = 'pe-log-locked'
export const LOCK_ITERATIONS = 600_000
export const MIN_PASSWORD = 8

export interface LockedFile {
  format: typeof LOCK_FORMAT
  v: 1
  createdAt: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: 'AES-GCM'
  iv: string
  z: boolean
  data: string
}

export class LockError extends Error {}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(s: string): Uint8Array {
  const b = atob(s)
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>))
  return new Uint8Array(await res.arrayBuffer())
}

async function keyOf(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** 비밀번호 규칙: 8자 이상, 같은 글자만 반복하면 안 됨 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `비밀번호는 ${MIN_PASSWORD}자 이상으로 해 주세요.`
  if (new Set(pw).size < 3) return '같은 글자를 반복한 비밀번호는 쓸 수 없어요.'
  if (/^\d+$/.test(pw) && new Set(pw).size < 5) return '숫자만 쓸 때는 더 섞어 주세요.'
  return null
}

export async function lockJson(value: unknown, password: string, opts: { iterations?: number; now?: Date } = {}): Promise<LockedFile> {
  const problem = passwordProblem(password)
  if (problem) throw new LockError(problem)
  const iterations = opts.iterations ?? LOCK_ITERATIONS
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  let plain: Uint8Array = new TextEncoder().encode(JSON.stringify(value))
  let z = false
  if (typeof CompressionStream !== 'undefined') {
    try {
      plain = await pipe(plain, new CompressionStream('gzip'))
      z = true
    } catch {
      /* 압축 없이 */
    }
  }
  const key = await keyOf(password, salt, iterations)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource))
  return {
    format: LOCK_FORMAT,
    v: 1,
    createdAt: (opts.now ?? new Date()).toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: 'AES-GCM',
    iv: toB64(iv),
    z,
    data: toB64(data),
  }
}

export function isLocked(x: unknown): x is LockedFile {
  const f = x as Partial<LockedFile> | null
  return !!f && typeof f === 'object' && f.format === LOCK_FORMAT
}

export async function unlockJson(file: LockedFile, password: string): Promise<unknown> {
  if (!isLocked(file) || file.v !== 1 || file.cipher !== 'AES-GCM' || !file.kdf?.salt || !file.iv || !file.data) throw new LockError('잠금 파일 모양이 잘못됐어요.')
  if (file.kdf.iterations < 100_000 || file.kdf.iterations > 10_000_000) throw new LockError('잠금 파일 모양이 잘못됐어요.')
  let plain: Uint8Array
  try {
    const key = await keyOf(password, fromB64(file.kdf.salt), file.kdf.iterations)
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) as BufferSource }, key, fromB64(file.data) as BufferSource))
  } catch {
    throw new LockError('비밀번호가 맞지 않거나 파일이 망가졌어요.')
  }
  try {
    if (file.z) {
      if (typeof DecompressionStream === 'undefined') throw new LockError('이 브라우저는 압축된 파일을 못 열어요. 크롬 · 사파리 최신판으로 열어 주세요.')
      plain = await pipe(plain, new DecompressionStream('gzip'))
    }
    return JSON.parse(new TextDecoder().decode(plain))
  } catch (e) {
    if (e instanceof LockError) throw e
    throw new LockError('파일을 풀었는데 내용을 읽지 못했어요.')
  }
}

export function lockedFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  // 'backup'으로 시작하고 .json → .gitignore가 막는다
  return `backup_잠금_체육기록_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`
}
