import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { db } from '../db/db'
import { SyncPassError, removeRemote } from '../db/driveSync'
import { readSyncConf, writeSyncConf, type SyncConf } from '../db/syncState'
import { IS_DEMO } from '../lib/demo'
import { GOOGLE_CLIENT_ID, driveApi, preloadGis, revokeDriveToken } from '../lib/gdrive'
import { passwordProblem } from '../lib/lockFile'
import { SYNC_EVENT, deviceName, ensureToken, runSync, saveSessionToken, sessionToken } from '../state/driveSync'

/**
 * 구글 드라이브로 자동 맞추기 (선택, 2026-11-13 교사 결정): 잠금 파일 + 합치기를 드라이브 앱 전용 칸으로 자동으로.
 * 켜기 = 안내 읽기 · 비밀번호 두 번 · 지침 확인 체크 → 구글 연결 → 첫 맞추기. 다른 기기에서는 같은 비밀번호로 켠다.
 */
export default function DriveSyncCard() {
  const [conf, setConf] = useState<SyncConf | null | undefined>(undefined)
  const reload = () =>
    void readSyncConf(db)
      .then(setConf)
      .catch(() => setConf(null))
  useEffect(() => {
    reload()
    if (!IS_DEMO) preloadGis()
    window.addEventListener(SYNC_EVENT, reload)
    return () => window.removeEventListener(SYNC_EVENT, reload)
  }, [])
  if (conf === undefined) return null

  return (
    <section className="card space-y-3">
      <p className="card-title">구글 드라이브로 자동 맞추기 (선택)</p>
      {IS_DEMO ? (
        <p className="hint">시연 모드에서는 쓸 수 없어요.</p>
      ) : !GOOGLE_CLIENT_ID ? (
        <p className="hint">준비 중이에요. 앱 관리자가 구글 연결을 설정하면 켤 수 있어요. 그동안은 위 [다른 기기로 옮기기]를 써 주세요.</p>
      ) : conf?.enabled ? (
        <OnView conf={conf} onChange={reload} />
      ) : (
        <OffView onChange={reload} />
      )}
    </section>
  )
}

const NOTES = [
  '켜면 이 기기의 모든 자료(학생 · 기록 · 출결 · 견학 사유 · 점수 · 세특)를 비밀번호로 잠근 사본 하나가 선생님 구글 드라이브의 앱 전용 숨은 칸에 올라가요. 구글도 PE LOG도 내용을 볼 수 없어요.',
  '앱은 자기 칸만 볼 수 있어요 — 드라이브의 다른 파일(행사 사진 등)은 보지도 건드리지도 못해요.',
  '앱을 연 뒤 [맞추기]를 한 번 누르면, 그다음엔 기록할 때마다 자동으로 맞춰요(구글 연결은 약 1시간).',
  '다른 기기에서도 같은 비밀번호로 켜면 기록이 하나로 모이고, 한쪽에서 지운 기록은 다른 쪽에서도 지워져요.',
  '비밀번호는 이 기기에만 두고 어디에도 보내지 않아요. 잊으면 드라이브 사본은 아무도 열 수 없어요(기기 안 자료는 그대로).',
  '학생 정보를 클라우드에 두는 일이라, 학교 · 교육청 정보보안 지침을 먼저 확인해 주세요. 학교 · 교육청에서 받은 구글 계정이 있으면 그 계정을 권해요.',
]

function OffView({ onChange }: { onChange: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const problem = pw ? passwordProblem(pw) : null
  const turnOn = async () => {
    setErr('')
    if (problem) return setErr(problem)
    if (pw !== pw2) return setErr('두 비밀번호가 달라요.')
    setBusy(true)
    const conf: SyncConf = { enabled: true, pass: pw, device: deviceName() }
    try {
      // 구글 로그인은 이 버튼 안에서 (팝업)
      await ensureToken(true)
      await writeSyncConf(db, conf)
      await runSync(db, true)
      onChange()
    } catch (e) {
      // 비밀번호가 다르거나 실패하면 다시 꺼 둔다
      await writeSyncConf(db, null)
      setErr(e instanceof SyncPassError ? e.message : e instanceof Error ? e.message : '켜지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="hint">폰 · 교무실 PC처럼 여러 기기를 쓸 때, 파일을 옮기지 않아도 기록이 저절로 하나로 모여요. 처음엔 꺼져 있어요.</p>
      <ul className="space-y-1.5 rounded-2xl bg-fill p-3 text-sm font-semibold text-ink-2">
        {NOTES.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
      <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="맞추기 비밀번호 (8자 이상, 다른 기기에서도 같게)" aria-label="맞추기 비밀번호" />
      <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호 한 번 더" aria-label="맞추기 비밀번호 확인" />
      {problem && <p className="text-sm font-bold text-caution">{problem}</p>}
      <label className="flex min-h-[48px] items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span className="text-[0.95rem] font-bold">위 내용을 읽었고, 학교 · 교육청 정보보안 지침을 확인했어요.</span>
      </label>
      <button type="button" className="btn btn-primary w-full" disabled={busy || !agree || !pw || !pw2} onClick={() => void turnOn()}>
        <Icon name="lock" /> {busy ? '연결하는 중…' : '구글 계정 연결하고 켜기'}
      </button>
      {err && <p className="font-bold text-danger">{err}</p>}
    </div>
  )
}

function OnView({ conf, onChange }: { conf: SyncConf; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [off, setOff] = useState(false)
  const [wipe, setWipe] = useState(false)
  const now = async () => {
    setErr('')
    setBusy(true)
    try {
      await ensureToken(true) // 구글 로그인 창을 먼저 (팝업 차단 방지)
      await runSync(db, true)
      onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '맞추지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  const turnOff = async () => {
    setErr('')
    setBusy(true)
    try {
      if (wipe) {
        const tok = await ensureToken(true)
        if (tok) await removeRemote(driveApi(tok.token))
      }
      const tok = sessionToken()
      if (tok) await revokeDriveToken(tok.token)
      saveSessionToken(null)
      await writeSyncConf(db, null)
      onChange()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '끄지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-ok-light px-3 py-2 text-sm font-bold text-ok">
        켜져 있어요 · 이 기기 {conf.device}
        {conf.lastAt ? ` · 마지막 ${new Date(conf.lastAt).toLocaleString('ko-KR')}` : ''}
      </p>
      {conf.lastNote && <p className="hint">{conf.lastNote}</p>}
      <p className="hint">앱을 연 뒤 한 번 [지금 맞추기](또는 맨 위 [맞추기])를 누르면, 그다음엔 기록할 때마다 자동으로 맞춰요.</p>
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void now()}>
        <Icon name="reset" /> {busy ? '맞추는 중…' : '지금 맞추기'}
      </button>
      {!off ? (
        <button type="button" className="btn btn-ghost w-full text-ink-3" onClick={() => setOff(true)}>
          자동 맞추기 끄기
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl bg-fill p-3">
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
            <span className="font-bold">드라이브의 잠금 사본도 지우기 (다른 기기도 다 끌 때)</span>
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-soft flex-1 bg-white" onClick={() => setOff(false)}>
              취소
            </button>
            <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => void turnOff()}>
              끄기
            </button>
          </div>
          <p className="hint">꺼도 이 기기 안 자료는 그대로예요.</p>
        </div>
      )}
      {err && <p className="font-bold text-danger">{err}</p>}
    </div>
  )
}
