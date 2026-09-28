/**
 * PIN 잠금 (CLAUDE.md 2장). PIN 숫자 자체는 저장하지 않고, 풀기 어렵게 섞은 값(해시)만 저장한다.
 * 브라우저에 들어 있는 암호 기능(Web Crypto, PBKDF2-SHA256)만 쓴다. 외부로 나가는 것은 없다.
 */

export interface StoredPin {
  salt: string
  hash: string
  iterations: number
}

export const PIN_SETTING_KEY = 'pinHash'
const ITERATIONS = 150_000

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPin(pin: string, iterations = ITERATIONS): Promise<StoredPin> {
  if (!isValidPin(pin)) throw new Error('PIN은 숫자 4~6자리여야 해요')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, iterations)
  return { salt: toB64(salt), hash: toB64(hash), iterations }
}

export async function verifyPin(pin: string, stored: StoredPin): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const got = await derive(pin, fromB64(stored.salt), stored.iterations)
  const want = fromB64(stored.hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}

/** 틀린 횟수에 따른 대기 시간(초). 5번 틀리면 30초, 그 뒤로 한 번 틀릴 때마다 더 길게. */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0
  return Math.min(30 * 2 ** (failures - 5), 15 * 60)
}
