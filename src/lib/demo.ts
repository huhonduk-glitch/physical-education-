/**
 * 시연 모드 (2026-10-22 교사 요청: 다른 선생님들께 가상 학생으로 보여 주기).
 *
 * 주소에 ?demo=1 을 붙여 열면 시연 모드가 된다. 시연 모드는 실제 자료와 완전히 따로 논다:
 * - 저장소 이름이 다르다 (pe-records-demo) → 실제 학생 자료를 읽지도 쓰지도 않는다
 * - localStorage·sessionStorage 키 앞에 'demo:'를 붙인다 → 실제 앱의 화면 설정(고른 반·회차 등)과 섞이지 않는다
 * - 처음 열면 가상 학생·수업 예시를 넣는다 (src/db/demoSeed.ts)
 * - PIN 잠금 없이 바로 열린다 (시연용 PIN은 0000)
 *
 * 따로 주소(/demo/)를 두지 않은 까닭: 이미 앱을 설치한 기기에서는 오프라인 기능(service worker)이
 * /physical-education-/ 아래 모든 주소를 실제 앱으로 열어 버려, 시연하다 실제 학생 자료가 보일 수 있다.
 * 이 파일은 다른 모듈을 불러오지 않는다 (저장소보다 먼저 정해져야 하므로).
 */

const FLAG = 'pelog.demoMode'
export const DEMO_DB = 'pe-records-demo'
export const MAIN_DB_NAME = 'pe-records'
export const DEMO_PIN = '0000'
const PREFIX = 'demo:'

function readFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('demo')
    if (q === '1') sessionStorage.setItem(FLAG, '1')
    if (q === '0') sessionStorage.removeItem(FLAG)
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

/** 이 탭이 시연 모드인지 (주소 ?demo=1 → 탭을 닫을 때까지 유지) */
export const IS_DEMO = typeof window !== 'undefined' && readFlag()

export const dbName = (demo = IS_DEMO) => (demo ? DEMO_DB : MAIN_DB_NAME)

/** 시연 모드에서 브라우저 저장 키를 'demo:'로 나눈다 (실제 앱의 설정과 섞이지 않게) */
export function namespaceStorage(prefix = PREFIX): void {
  const proto = Storage.prototype
  const get = proto.getItem
  const set = proto.setItem
  const remove = proto.removeItem
  const key = (k: string) => (k === FLAG ? k : prefix + k)
  proto.getItem = function (k: string) {
    return get.call(this, key(k))
  }
  proto.setItem = function (k: string, v: string) {
    set.call(this, key(k), v)
  }
  proto.removeItem = function (k: string) {
    remove.call(this, key(k))
  }
}

/** 시연 끝내기: 표시를 지우고 실제 앱 주소로 */
export function exitDemo(base: string): void {
  try {
    sessionStorage.removeItem(FLAG)
  } catch {
    /* 무시 */
  }
  location.href = `${base}?demo=0`
}

/** 시연 모드로 여는 주소 (공유용) */
export const demoUrl = (origin: string, base: string) => `${origin}${base}?demo=1`
