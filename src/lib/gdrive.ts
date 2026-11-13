/**
 * 구글 동기화 (2026-11-13 교사 결정 '잠근 채로 · 선택 기능 · 지운 기록까지', 화면은 '올리기 · 내려받기').
 * - 권한은 drive.appdata 하나: 앱 전용 숨은 칸(appDataFolder)만 — 선생님 드라이브의 다른 파일은 보지도 건드리지도 못한다.
 *   (구글 분류: 민감하지 않은 권한)
 * - 서버 없음: 구글 로그인(Google Identity Services 토큰 방식)으로 받은 짧은 토큰(약 1시간)으로 브라우저가 바로 드라이브 API를 부른다.
 *   토큰을 다시 받으려면 선생님이 한 번 눌러야 한다(구글 정책) → 앱을 열 때 맨 위 [내려받기] 한 번.
 * - 올리는 것은 잠금 파일(lockFile.ts, 기기에서 비밀번호로 잠근 것) 하나뿐. 구글은 내용을 볼 수 없다.
 * - 이 파일만 구글과 통신한다. 구글 로그인 스크립트는 선생님이 켤 때만 불러온다.
 */

/** 구글 클라우드 'OAuth 클라이언트 ID' (공개 값 — 비밀이 아님). 비어 있으면 기능이 '준비 중'으로 보인다 */
export const GOOGLE_CLIENT_ID = '130208598798-hcdl9jfmp8hpgnshnkivo6ugen5rgq6q.apps.googleusercontent.com'
/**
 * 구글 클라우드 동의 화면이 아직 '테스트 중'인지 (2026-11-13 오후: 교사가 [앱 게시] → 프로덕션, 누구나 자기 구글 계정으로 연결).
 * true면 연결 화면에 '시범 운영' 안내가 보인다
 */
export const GOOGLE_TESTING: boolean = false
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const SYNC_FILE_NAME = 'pelog-sync.json'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export class DriveError extends Error {
  constructor(
    message: string,
    /** 'auth' = 다시 로그인해야 함 */
    public kind: 'auth' | 'net' | 'other' = 'other',
  ) {
    super(message)
  }
}

export interface DriveToken {
  token: string
  /** ms */
  expiresAt: number
}

export interface DriveFileMeta {
  id: string
  modifiedTime?: string
  size?: string
}

/** 드라이브와 주고받는 일 (시험에서는 가짜로 바꿔 끼운다) */
export interface DriveApi {
  find(): Promise<DriveFileMeta | null>
  download(id: string): Promise<string>
  /** id가 없으면 새로 만든다. 만든(바꾼) 파일의 id · 바뀐 때를 돌려준다 */
  upload(text: string, id?: string): Promise<DriveFileMeta>
  remove(id: string): Promise<void>
  /** 연결한 구글 계정 메일 (화면에 보여 줄 것, 못 읽으면 null) */
  account?(): Promise<string | null>
}

// ── 구글 로그인 (토큰) ──

type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (o: {
        client_id: string
        scope: string
        callback: (r: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => void
        error_callback?: (e: { type?: string; message?: string }) => void
      }) => TokenClient
      revoke: (token: string, done?: () => void) => void
    }
  }
}

let gisPromise: Promise<Gis> | null = null
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis }
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google)
  gisPromise ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => (w.google ? resolve(w.google) : reject(new DriveError('구글 로그인 도구를 불러오지 못했어요.', 'net')))
    s.onerror = () => {
      gisPromise = null
      reject(new DriveError('인터넷에 연결되지 않았어요. 연결된 곳에서 다시 눌러 주세요.', 'net'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** 구글 로그인 스크립트를 미리 받아 둔다 — 버튼을 누른 순간 팝업이 바로 열려야 막히지 않는다 */
export function preloadGis(): void {
  if (!GOOGLE_CLIENT_ID || typeof document === 'undefined') return
  void loadGis().catch(() => undefined)
}

/** 구글 로그인 창을 열어 토큰 받기 — 반드시 선생님이 누른 버튼 안에서, 다른 기다림 없이 먼저 부른다(팝업 차단) */
export async function requestDriveToken(clientId = GOOGLE_CLIENT_ID): Promise<DriveToken> {
  if (!clientId) throw new DriveError('아직 구글 연결이 설정되지 않았어요(앱 관리자 설정 필요).')
  const gis = await loadGis()
  return new Promise<DriveToken>((resolve, reject) => {
    // 로그인 창을 닫았는데 구글이 알려 주지 못하는 때가 있다(창 사이 보안 정책) → 5분이면 멈춘 것으로 본다
    const timer = setTimeout(() => reject(new DriveError('구글 로그인이 끝나지 않았어요. 다시 눌러 주세요.', 'auth')), 5 * 60_000)
    const fail = (e: DriveError) => {
      clearTimeout(timer)
      reject(e)
    }
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return fail(new DriveError(r.error === 'access_denied' ? '구글 연결을 허용하지 않았어요.' : '구글 로그인에 실패했어요.', 'auth'))
        clearTimeout(timer)
        resolve({ token: r.access_token, expiresAt: Date.now() + Math.max(60, (r.expires_in ?? 3600) - 60) * 1000 })
      },
      error_callback: (e) => fail(new DriveError(e.type === 'popup_closed' ? '구글 로그인 창을 닫았어요.' : e.type === 'popup_failed_to_open' ? '팝업이 막혔어요. 브라우저에서 팝업을 허용해 주세요.' : '구글 로그인에 실패했어요.', 'auth')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

/** 연결 끊기 (구글 쪽 허용도 거둔다) */
export async function revokeDriveToken(token: string): Promise<void> {
  try {
    const gis = await loadGis()
    await new Promise<void>((r) => gis.accounts.oauth2.revoke(token, () => r()))
  } catch {
    /* 이미 끊겼거나 인터넷 없음 — 기기 쪽 설정만 지워도 된다 */
  }
}

// ── 드라이브 API (앱 전용 칸) ──

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } })
  } catch {
    throw new DriveError('인터넷에 연결되지 않았어요.', 'net')
  }
  if (res.status === 401) throw new DriveError('구글 연결 시간이 끝났어요. [올리기]나 [내려받기]를 다시 눌러 주세요.', 'auth')
  if (res.status === 403) throw new DriveError('구글 드라이브가 요청을 막았어요(권한 · 사용량). 잠시 뒤 다시 해 보세요.', 'other')
  if (!res.ok) throw new DriveError(`구글 드라이브 요청이 실패했어요 (${res.status}).`, 'other')
  return res
}

/** 토큰으로 드라이브 API 묶음 만들기 */
export function driveApi(token: string): DriveApi {
  return {
    async find() {
      const q = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and trashed = false`)
      const res = await call(token, `${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)&orderBy=modifiedTime%20desc&pageSize=5`)
      const body = (await res.json()) as { files?: DriveFileMeta[] }
      return body.files?.[0] ?? null
    },
    async download(id) {
      const res = await call(token, `${API}/${encodeURIComponent(id)}?alt=media`)
      return res.text()
    },
    async upload(text, id) {
      if (id) {
        const res = await call(token, `${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text })
        return (await res.json()) as DriveFileMeta
      }
      const boundary = `pelog${Math.random().toString(36).slice(2)}`
      const meta = JSON.stringify({ name: SYNC_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' })
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`
      const res = await call(token, `${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
      return (await res.json()) as DriveFileMeta
    },
    async remove(id) {
      await call(token, `${API}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    async account() {
      try {
        const res = await call(token, 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')
        return ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null
      } catch {
        return null
      }
    },
  }
}
