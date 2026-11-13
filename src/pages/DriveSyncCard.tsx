import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import SyncAskSheet from '../components/SyncAskSheet'
import { db } from '../db/db'
import { SyncPassError, peekRemote, removeRemote } from '../db/driveSync'
import { patchSyncConf, readSyncConf, writeSyncConf, type SyncConf } from '../db/syncState'
import { IS_DEMO } from '../lib/demo'
import { GOOGLE_CLIENT_ID, GOOGLE_TESTING, driveApi, preloadGis, revokeDriveToken } from '../lib/gdrive'
import { passwordProblem } from '../lib/lockFile'
import { SYNC_EVENT, deviceName, ensureToken, saveSessionToken, sessionToken, when } from '../state/driveSync'
import { useSyncRunner } from '../state/useSyncRunner'

/**
 * 구글 동기화 (선택, 2026-11-13 교사 결정: 아이클라우드처럼 구글 드라이브 사본이 기준).
 * 연결 = 안내 · 비밀번호 두 번 · 지침 확인 → 구글 로그인 → 구글 사본이 있는지 · 비밀번호가 맞는지 확인(아무것도 바꾸지 않음).
 * 연결된 뒤 [올리기] = 구글 사본을 이 기기 자료로 바꿈 · [내려받기] = 이 기기 자료를 구글 사본으로 바꿈.
 * 덮어쓰면 기록이 사라질 때는 먼저 묻는다(SyncAskSheet).
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
      <p className="card-title">구글 동기화 (선택)</p>
      {IS_DEMO ? (
        <p className="hint">시연 모드에서는 쓸 수 없어요.</p>
      ) : !GOOGLE_CLIENT_ID ? (
        <p className="hint">준비 중이에요. 그동안은 위 [다른 기기로 옮기기]를 써 주세요.</p>
      ) : conf?.enabled ? (
        <OnView conf={conf} onChange={reload} />
      ) : (
        <OffView onChange={reload} />
      )}
    </section>
  )
}

const NOTES = [
  '구글 드라이브의 사본이 기준이에요. [올리기]는 구글 사본을 이 기기 자료로 바꾸고, [내려받기]는 이 기기 자료를 구글 사본으로 바꿔요.',
  '바꾸면 기록이 사라질 때(다른 기기에서 먼저 올렸거나, 이 기기에 안 올린 기록이 있을 때)는 먼저 물어봐요.',
  '구글에는 비밀번호로 잠근 사본 하나만 올라가요(학생 · 기록 · 출결 · 견학 사유 · 점수 · 세특 모두 잠김). 구글도 PE LOG도 내용을 볼 수 없고, 앱은 드라이브의 다른 파일(행사 사진 등)을 보지 못해요.',
  '비밀번호는 이 기기에만 두고 어디에도 보내지 않아요. 다른 기기에서도 같은 구글 계정 · 같은 비밀번호로 연결해요. 잊으면 구글 사본은 아무도 못 열어요.',
  '학생 정보를 클라우드에 두는 일이라, 학교 · 교육청 정보보안 지침을 먼저 확인해 주세요.',
]

function OffView({ onChange }: { onChange: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const problem = pw ? passwordProblem(pw) : null
  const connect = async () => {
    setErr('')
    if (problem) return setErr(problem)
    if (pw !== pw2) return setErr('두 비밀번호가 달라요.')
    setBusy(true)
    try {
      // 구글 로그인은 이 버튼 안에서 먼저 (팝업 차단 방지)
      const tok = await ensureToken(true)
      if (!tok) throw new Error('구글에 연결하지 못했어요.')
      const api = driveApi(tok.token)
      const account = (await api.account?.()) ?? undefined
      // 구글 사본이 있으면 비밀번호가 맞는지 먼저 본다 (아무것도 바꾸지 않음)
      const remote = await peekRemote(api, pw)
      await writeSyncConf(db, {
        enabled: true,
        pass: pw,
        device: deviceName(),
        account,
        autoUp: true,
        ...(remote ? { remoteAt: remote.savedAt, remoteDevice: remote.device } : {}),
        lastNote: remote
          ? `구글에 ${remote.device}에서 ${when(remote.savedAt)}에 올린 사본이 있어요. 이 기기를 그 사본으로 맞추려면 [내려받기]를 누르세요.`
          : '구글에 아직 사본이 없어요. 이 기기 자료를 기준으로 올리려면 [올리기]를 누르세요.',
      })
      window.dispatchEvent(new CustomEvent(SYNC_EVENT))
      onChange()
    } catch (e) {
      setErr(e instanceof SyncPassError ? e.message : e instanceof Error ? e.message : '연결하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      {GOOGLE_TESTING && (
        <p className="rounded-2xl bg-caution-light px-3 py-2 text-sm font-bold text-caution">
          지금은 시범 운영 중이라, 앱 제작자가 등록한 구글 계정만 연결돼요. 연결이 막히면 위 [다른 기기로 옮기기]를 써 주세요.
        </p>
      )}
      <ul className="space-y-1.5 rounded-2xl bg-fill p-3 text-sm font-semibold text-ink-2">
        {NOTES.map((n) => (
          <li key={n} className="pl-3 -indent-3">
            · {n}
          </li>
        ))}
      </ul>
      <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="동기화 비밀번호 (8자 이상)" aria-label="동기화 비밀번호 (다른 기기에서도 같게)" />
      <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호 한 번 더" aria-label="동기화 비밀번호 확인" />
      {problem && <p className="text-sm font-bold text-caution">{problem}</p>}
      <a href={`${import.meta.env.BASE_URL}privacy/`} target="_blank" rel="noopener" className="block text-sm font-bold text-brand">
        개인정보 처리방침(구글 데이터를 어떻게 쓰는지) ›
      </a>
      <label className="flex min-h-[48px] items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span className="text-[0.95rem] font-bold">위 내용을 읽었고, 학교 · 교육청 정보보안 지침을 확인했어요.</span>
      </label>
      <button type="button" className="btn btn-primary w-full" disabled={busy || !agree || !pw || !pw2} onClick={() => void connect()}>
        <Icon name="lock" /> {busy ? '연결하는 중…' : '구글 계정 연결하기'}
      </button>
      {err && <p className="font-bold text-danger">{err}</p>}
    </div>
  )
}

function OnView({ conf, onChange }: { conf: SyncConf; onChange: () => void }) {
  const runner = useSyncRunner(() => onChange())
  const [off, setOff] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [offBusy, setOffBusy] = useState(false)
  const [offErr, setOffErr] = useState('')
  const setAuto = async (v: boolean) => {
    await patchSyncConf(db, { autoUp: v })
    window.dispatchEvent(new CustomEvent(SYNC_EVENT))
  }
  const disconnect = async () => {
    setOffErr('')
    setOffBusy(true)
    try {
      if (wipe) {
        const tok = await ensureToken(true)
        if (tok) await removeRemote(driveApi(tok.token))
      }
      const tok = sessionToken()
      if (tok) await revokeDriveToken(tok.token)
      saveSessionToken(null)
      await writeSyncConf(db, null)
      window.dispatchEvent(new CustomEvent(SYNC_EVENT))
      onChange()
    } catch (e) {
      setOffErr(e instanceof Error ? e.message : '연결을 끊지 못했어요.')
    } finally {
      setOffBusy(false)
    }
  }
  const busy = !!runner.busy || offBusy
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-ok-light px-3 py-2 text-sm font-bold text-ok">
        연결됨 · {conf.account ?? '구글 계정'} · 이 기기 {conf.device}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-soft h-auto min-h-[72px] flex-col gap-0.5 py-2" disabled={busy} onClick={() => runner.run('up')}>
          <span className="flex items-center gap-1.5 text-[1.05rem] font-extrabold">
            <Icon name="upload" /> {runner.busy === 'up' ? '올리는 중…' : '올리기'}
          </span>
          <span className="text-xs font-bold text-ink-3">이 기기 → 구글</span>
        </button>
        <button type="button" className="btn btn-soft h-auto min-h-[72px] flex-col gap-0.5 py-2" disabled={busy} onClick={() => runner.run('down')}>
          <span className="flex items-center gap-1.5 text-[1.05rem] font-extrabold">
            <Icon name="download" /> {runner.busy === 'down' ? '받는 중…' : '내려받기'}
          </span>
          <span className="text-xs font-bold text-ink-3">구글 → 이 기기</span>
        </button>
      </div>
      {runner.err ? (
        <p className="font-bold text-danger">{runner.err}</p>
      ) : (
        conf.lastNote && <p className="rounded-2xl bg-brand-light px-3 py-2 text-sm font-bold text-brand-ink">{conf.lastNote}</p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold text-ink-3">구글 사본</dt>
        <dd className="font-semibold">{conf.remoteAt ? `${when(conf.remoteAt)} · ${conf.remoteDevice ?? ''}에서 올림` : '아직 모름'}</dd>
        <dt className="font-bold text-ink-3">이 기기</dt>
        <dd className="font-semibold">
          {[conf.upAt ? `올림 ${when(conf.upAt)}` : '', conf.downAt ? `내려받음 ${when(conf.downAt)}` : ''].filter(Boolean).join(' · ') || '아직 안 함'}
        </dd>
      </dl>
      <p className="hint">
        구글 사본이 기준이에요. [올리기]는 구글 사본을 이 기기 자료로, [내려받기]는 이 기기 자료를 구글 사본으로 바꿔요. 바꾸면 기록이 사라질 때는 먼저 물어보고, 내려받기 전 이 기기 자료는 아래 [자동 백업]에 남아요. PIN · 홈 배치는 기기마다 그대로예요.
      </p>
      <label className="flex min-h-[48px] items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={conf.autoUp !== false} onChange={(e) => void setAuto(e.target.checked)} />
        <span>
          <span className="block font-bold">기록하면 자동으로 올리기</span>
          <span className="hint">앱을 연 뒤 맨 위 [동기화](또는 여기 버튼)를 한 번 누르면, 그다음 약 1시간은 기록할 때마다 저절로 올려요(구글 연결 시간). 다른 기기에서 먼저 올렸으면 자동으로 올리지 않고 물어봐요.</span>
        </span>
      </label>
      {!off ? (
        <button type="button" className="btn btn-ghost w-full text-ink-3" onClick={() => setOff(true)}>
          구글 연결 끊기
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl bg-fill p-3">
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
            <span className="font-bold">구글 사본도 지우기 (다른 기기도 다 끊을 때)</span>
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-soft flex-1 bg-white" onClick={() => setOff(false)}>
              취소
            </button>
            <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => void disconnect()}>
              끊기
            </button>
          </div>
          <p className="hint">끊어도 이 기기 안 자료는 그대로예요.</p>
          {offErr && <p className="font-bold text-danger">{offErr}</p>}
        </div>
      )}
      {runner.ask && <SyncAskSheet reason={runner.ask.reason} remoteAt={runner.ask.remoteAt} busy={busy} onChoose={runner.choose} onClose={runner.closeAsk} />}
    </div>
  )
}
