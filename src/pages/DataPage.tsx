import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import PinPad from '../components/PinPad'
import { backupFileName, checkBackup, compareCounts, countAll, exportAll, restoreAll, TABLE_LABELS, type BackupFile } from '../db/backup'
import { listSnapshots, type AutoSnapshot } from '../db/autoBackup'
import { db } from '../db/db'
import { mergeInto, mergeSummary } from '../db/syncMerge'
import { saveText } from '../lib/download'
import { LockError, isLocked, lockJson, lockedFileName, passwordProblem, unlockJson, type LockedFile } from '../lib/lockFile'
import { PIN_SETTING_KEY, verifyPin, type StoredPin } from '../lib/pin'
import { useApp } from '../state/AppContext'
import DriveSyncCard from './DriveSyncCard'

/** 백업 · 복원 · 학년도 넘기기 · 전체 삭제 (CLAUDE.md 4-11) */
export default function DataPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [locked, setLocked] = useState<LockedFile | null>(null)
  const [merged] = useState(() => {
    try {
      const t = sessionStorage.getItem(MERGED_KEY)
      sessionStorage.removeItem(MERGED_KEY)
      return t ? (JSON.parse(t) as string[]) : null
    } catch {
      return null
    }
  })
  const nowCounts = useLiveQuery(() => countAll(db), [])
  const [snapshots, setSnapshots] = useState<AutoSnapshot[] | null>(null)
  useEffect(() => {
    listSnapshots()
      .then(setSnapshots)
      .catch(() => setSnapshots([]))
  }, [])
  const [wipe, setWipe] = useState(false)
  const years = useLiveQuery(async () => {
    const ys = new Set<number>()
    await db.students.each((s) => ys.add(s.schoolYear))
    ys.add(settings.schoolYear)
    return [...ys].sort((a, b) => b - a)
  }, [settings.schoolYear])
  const latest = Math.max(settings.latestYear, ...(years ?? [settings.schoolYear]))

  const backup = async (auto = false) => {
    const file = await exportAll(db)
    saveText(auto ? backupFileName().replace('backup_', 'backup_자동_복원전_') : backupFileName(), JSON.stringify(file), 'application/json')
    await updateSettings({ lastBackupAt: Date.now() })
    if (!auto) setMsg('백업 파일을 저장했어요. 잃어버리지 않게 PC나 드라이브에 옮겨 두세요.')
  }

  const pickRestore = async (f: File | undefined) => {
    setErr('')
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      if (isLocked(raw)) {
        setPending(null)
        return setLocked(raw)
      }
      const c = checkBackup(raw)
      if (!c.ok) return setErr(c.error)
      setPending(c.file)
    } catch {
      setErr('백업 파일을 읽지 못했어요')
    }
  }

  const unlocked = (value: unknown) => {
    const c = checkBackup(value)
    if (!c.ok) throw new LockError(c.error)
    setLocked(null)
    setPending(c.file)
  }

  const doMerge = async () => {
    if (!pending) return
    await backup(true) // 합치기 전에 지금 자료를 자동 백업
    const plan = await mergeInto(db, pending)
    const lines = mergeSummary(plan, TABLE_LABELS)
    try {
      sessionStorage.setItem(MERGED_KEY, JSON.stringify(lines.length ? lines : ['새로 더할 자료가 없었어요 (이미 같은 자료)']))
    } catch {
      /* 무시 */
    }
    location.reload()
  }

  const doRestore = async () => {
    if (!pending) return
    await backup(true) // 덮어쓰기 전에 지금 자료를 자동 백업
    await restoreAll(db, pending)
    location.reload()
  }

  const newYear = async () => {
    const next = latest + 1
    if (!confirm(`${next}학년도를 새로 시작할까요?\n\n· ${latest}학년도 기록은 그대로 보관되고 읽기 전용이 돼요.\n· 키워드 사전·기록 버튼·설정은 그대로 이어져요.\n· 새 학년도 명렬을 올려 주세요.`)) return
    await updateSettings({ schoolYear: next, latestYear: next, timetable: [] })
    setMsg(`${next}학년도를 시작했어요. 이제 새 명렬을 올려 주세요.`)
  }

  return (
    <>
      <PageHeader title="백업 · 학년도" back />
      <div className="page space-y-4 pb-8">
        {msg && <p className="card bg-ok-light font-bold text-ok shadow-none">{msg}</p>}
        {merged && (
          <div className="card space-y-1 bg-ok-light text-ok shadow-none">
            <p className="font-extrabold">다른 기기 자료를 합쳤어요</p>
            {merged.map((l) => (
              <p key={l} className="text-sm font-bold">
                {l}
              </p>
            ))}
          </div>
        )}

        {nowCounts && (
          <section className="card space-y-2">
            <p className="card-title">이 기기에 있는 자료 ({settings.schoolYear}학년도 포함 전체)</p>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {Object.entries(TABLE_LABELS).map(([t, label]) => (
                <div key={t} className="rounded-2xl bg-fill py-2">
                  <p className="text-lg font-extrabold tabular-nums">{nowCounts[t as keyof typeof nowCounts] ?? 0}</p>
                  <p className="text-[0.72rem] font-bold text-ink-3">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="card-title">전체 백업</p>
            <span className="hint">{settings.lastBackupAt ? `마지막 ${new Date(settings.lastBackupAt).toLocaleString('ko-KR')}` : '아직 한 번도 안 했어요'}</span>
          </div>
          <p className="hint">학생 명렬과 모든 기록은 이 기기 브라우저에만 있어요. 폰을 바꾸거나 브라우저 기록을 지우면 사라지니, 1주일에 한 번은 백업해 주세요. (왕복오래달리기 음원은 빠져요)</p>
          <button type="button" className="btn btn-primary w-full" onClick={() => backup()}>
            <Icon name="download" /> 지금 백업 파일 받기
          </button>
        </section>

        <LockedSection onMade={() => void updateSettings({ lastBackupAt: Date.now() })} />

        <DriveSyncCard />

        {snapshots && snapshots.length > 0 && (
          <section className="card space-y-3">
            <p className="card-title">자동 백업</p>
            <p className="hint">저장 방식이 바뀌는 업데이트 때, 그리고 구글에서 내려받기 전에 앱이 바꾸기 전 자료를 이 기기 안에 복사해 둔 거예요. 파일로 받거나, 아래 [복원]과 같은 확인을 거쳐 되돌릴 수 있어요.</p>
            <ul className="divide-y divide-line rounded-2xl bg-fill">
              {snapshots.map((s) => (
                <li key={s.id} className="space-y-2 px-4 py-3">
                  <p className="font-bold">
                    {new Date(s.createdAt).toLocaleString('ko-KR')} · {s.reason}
                  </p>
                  <p className="hint">
                    학생 {s.file.counts.students ?? 0} · 누가기록 {s.file.counts.records ?? 0} · PAPS 기록 칸 {s.file.counts.papsResults ?? 0}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-soft flex-1 bg-white whitespace-nowrap"
                      onClick={() => saveText(backupFileName(new Date(s.createdAt)).replace('backup_', 'backup_업데이트전_'), JSON.stringify(s.file), 'application/json')}
                    >
                      <Icon name="download" /> 파일로 받기
                    </button>
                    <button type="button" className="btn btn-soft flex-1 bg-white whitespace-nowrap" disabled={readOnly} onClick={() => (setErr(''), setPending(s.file))}>
                      이걸로 되돌리기
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card space-y-3">
          <p className="card-title">복원 · 다른 기기 자료 합치기</p>
          <p className="hint">백업 파일(잠금 파일 포함)을 고르면 [합치기] 또는 [통째로 바꾸기]를 골라요. 어느 쪽이든 그 전에 지금 자료를 자동으로 한 번 더 백업해요.</p>
          <label className="btn btn-soft relative w-full">
            <Icon name="upload" /> 백업 · 잠금 파일 고르기
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (void pickRestore(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          {err && <p className="font-bold text-danger">{err}</p>}
          {locked && <UnlockForm file={locked} onOpen={unlocked} onCancel={() => setLocked(null)} />}
          {pending && (
            <div className="space-y-2 rounded-2xl bg-caution-light p-4 text-caution">
              <p className="font-extrabold">이 백업을 어떻게 넣을까요?</p>
              <p className="text-sm font-semibold">{new Date(pending.createdAt).toLocaleString('ko-KR')}에 만든 백업</p>
              {nowCounts && (
                <table className="w-full rounded-xl bg-white text-sm text-ink">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="px-2 py-1 text-left">자료</th>
                      <th className="px-2 py-1 text-right">지금</th>
                      <th className="px-2 py-1 text-right">백업 파일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareCounts(nowCounts, pending).map((r) => (
                      <tr key={r.label} className={`border-t border-line ${r.fewer ? 'bg-danger-light font-bold text-danger' : ''}`}>
                        <td className="px-2 py-1">{r.label}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.now}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.file}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {nowCounts && compareCounts(nowCounts, pending).some((r) => r.fewer) && (
                <p className="text-sm font-bold text-danger">빨간 줄은 백업 파일 쪽이 더 적어요. 더 오래된 백업일 수 있으니 날짜를 확인하세요.</p>
              )}
              <ul className="space-y-1 text-sm font-semibold">
                <li>
                  · <b>합치기</b>: 지금 자료는 그대로 두고 파일에만 있는 기록을 더해요. 같은 학생 · 수업반은 하나로 맞추고, 같은 기록을 양쪽에서 고쳤으면 더 최근 것을 써요. 설정은 이 기기 것을 둬요.
                </li>
                <li>
                  · <b>통째로 바꾸기</b>: 지금 자료를 지우고 파일 그대로 바꿔요(설정 · PIN 포함).
                </li>
                <li>· 한쪽에서 지운 기록은 합치면 다시 생겨요. 지우기 · 정리는 한 기기에서 한 뒤, 다른 기기는 [통째로 바꾸기]를 쓰세요.</li>
              </ul>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-primary col-span-2" onClick={() => void doMerge()} disabled={readOnly}>
                  합치기 (지금 자료 자동 백업)
                </button>
                <button type="button" className="btn btn-soft bg-white" onClick={() => setPending(null)}>
                  취소
                </button>
                <button type="button" className="btn btn-danger" onClick={doRestore}>
                  통째로 바꾸기
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card space-y-3">
          <p className="card-title">학년도</p>
          <p className="hint">학년도가 바뀌면 [새 학년도 시작]을 누르세요. 지난 학년도 기록은 읽기 전용으로 보관돼요.</p>
          <label className="block">
            <span className="label">보고 있는 학년도</span>
            <select className="field" value={settings.schoolYear} onChange={(e) => updateSettings({ schoolYear: Number(e.target.value), latestYear: latest })}>
              {(years ?? []).map((y) => (
                <option key={y} value={y}>
                  {y}학년도{y < latest ? ' (읽기 전용)' : ''}
                </option>
              ))}
            </select>
          </label>
          {readOnly && <p className="rounded-xl bg-caution-light p-3 font-bold text-caution">지난 학년도를 보고 있어요. 기록·수정이 막혀 있어요.</p>}
          <button type="button" className="btn btn-outline w-full" onClick={newYear}>
            <Icon name="plus" /> {latest + 1}학년도 새로 시작
          </button>
          {!readOnly && (
            <Link to="/students/import" className="btn btn-ghost w-full text-brand">
              새 명렬 올리기 →
            </Link>
          )}
        </section>

        <section className="card space-y-3">
          <p className="card-title text-danger">전체 데이터 삭제</p>
          <p className="hint">이 기기의 모든 명렬·기록·설정을 지워요. 되돌릴 수 없어요. PIN을 다시 입력해야 해요.</p>
          <button type="button" className="btn btn-danger-soft w-full" onClick={() => setWipe(true)}>
            <Icon name="trash" /> 전체 삭제
          </button>
        </section>
      </div>
      {wipe && <WipeSheet onClose={() => setWipe(false)} />}
    </>
  )
}

const MERGED_KEY = 'pelog.mergedSummary'

/** 다른 기기로 옮기기: 비밀번호로 잠근 백업 파일 만들기 (6-21) */
function LockedSection({ onMade }: { onMade: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const problem = pw ? passwordProblem(pw) : null
  const make = async () => {
    setErr('')
    setDone('')
    if (problem) return setErr(problem)
    if (pw !== pw2) return setErr('두 비밀번호가 달라요.')
    setBusy(true)
    try {
      const file = await lockJson(await exportAll(db), pw)
      saveText(lockedFileName(), JSON.stringify(file), 'application/json')
      onMade()
      setPw('')
      setPw2('')
      setDone('잠금 파일을 저장했어요. 다른 기기에서 [백업 · 잠금 파일 고르기]로 열고 비밀번호를 넣으면 돼요.')
    } catch (e) {
      setErr(e instanceof LockError ? e.message : '잠금 파일을 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card space-y-3">
      <p className="card-title">다른 기기로 옮기기 (잠금 파일)</p>
      <p className="hint">
        폰 ↔ 교무실 PC처럼 다른 기기로 자료를 옮길 때 써요. 비밀번호로 잠근 백업 파일을 만들고, 다른 기기에서 열어 [합치기]를 누르면 두 기기 기록이 하나로 모여요. 서버 · 클라우드로 보내지 않아요. 파일을 어디에 둘지는 선생님이 정해요.
      </p>
      <ul className="space-y-1 rounded-2xl bg-fill p-3 text-sm font-semibold text-ink-2">
        <li>· 파일 안에는 학생 이름 · 출결 · 견학 사유 · 점수가 들어 있어요. 잠가도 학교 · 교육청 정보보안 지침을 따라 주세요(개인 클라우드 · 공용 PC에 두지 않기, 옮긴 뒤 지우기).</li>
        <li>· 비밀번호는 어디에도 저장하지 않아요. 잊으면 아무도 열 수 없어요.</li>
        <li>· 메신저로 보낼 때는 비밀번호를 같은 대화방에 적지 마세요.</li>
      </ul>
      <input className="field" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호 (8자 이상)" aria-label="비밀번호" />
      <input className="field" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호 한 번 더" aria-label="비밀번호 확인" />
      {problem && <p className="text-sm font-bold text-caution">{problem}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy || !pw || !pw2} onClick={() => void make()}>
        <Icon name="lock" /> {busy ? '잠그는 중…' : '잠금 파일 만들기'}
      </button>
      {err && <p className="font-bold text-danger">{err}</p>}
      {done && <p className="font-bold text-ok">{done}</p>}
    </section>
  )
}

function UnlockForm({ file, onOpen, onCancel }: { file: LockedFile; onOpen: (v: unknown) => void; onCancel: () => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const open = async () => {
    setErr('')
    setBusy(true)
    try {
      onOpen(await unlockJson(file, pw))
    } catch (e) {
      setErr(e instanceof LockError ? e.message : '파일을 열지 못했어요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="space-y-2 rounded-2xl bg-fill p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void open()
      }}
    >
      <p className="font-extrabold">잠금 파일이에요 · {new Date(file.createdAt).toLocaleString('ko-KR')}에 만듦</p>
      <input className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="만들 때 넣은 비밀번호" aria-label="잠금 파일 비밀번호" />
      {err && <p className="text-sm font-bold text-danger">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-soft flex-1 bg-white" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn-primary flex-[2]" disabled={busy || !pw}>
          {busy ? '여는 중…' : '열기'}
        </button>
      </div>
    </form>
  )
}

function WipeSheet({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const submit = async () => {
    const row = await db.settings.get(PIN_SETTING_KEY)
    if (!row || !(await verifyPin(pin, row.value as StoredPin))) {
      setErr('PIN이 맞지 않아요')
      setPin('')
      return
    }
    if (!confirm('정말 모두 지울까요? 백업 파일이 없으면 되살릴 수 없어요.')) return
    await db.delete()
    try {
      sessionStorage.clear()
    } catch {
      /* 무시 */
    }
    location.reload()
  }
  return (
    <BottomSheet title="PIN을 입력하면 모두 지워요" onClose={onClose}>
      {err && <p className="mb-3 text-center font-bold text-danger">{err}</p>}
      <PinPad value={pin} onChange={setPin} onSubmit={submit} submitLabel="삭제" />
    </BottomSheet>
  )
}
