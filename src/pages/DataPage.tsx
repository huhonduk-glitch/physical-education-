import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from '../components/BottomSheet'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import PinPad from '../components/PinPad'
import { backupFileName, checkBackup, compareCounts, countAll, exportAll, restoreAll, TABLE_LABELS, type BackupFile } from '../db/backup'
import { db } from '../db/db'
import { saveText } from '../lib/download'
import { PIN_SETTING_KEY, verifyPin, type StoredPin } from '../lib/pin'
import { useApp } from '../state/AppContext'

/** 백업 · 복원 · 학년도 넘기기 · 전체 삭제 (CLAUDE.md 4-11) */
export default function DataPage() {
  const { settings, updateSettings, readOnly } = useApp()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)
  const nowCounts = useLiveQuery(() => countAll(db), [])
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
      const c = checkBackup(JSON.parse(await f.text()))
      if (!c.ok) return setErr(c.error)
      setPending(c.file)
    } catch {
      setErr('백업 파일을 읽지 못했어요')
    }
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

        <section className="card space-y-3">
          <p className="card-title">복원</p>
          <p className="hint">백업 파일로 지금 자료를 바꿔요. 바꾸기 전에 지금 자료를 자동으로 한 번 더 백업해요.</p>
          <label className="btn btn-soft relative w-full">
            <Icon name="upload" /> 백업 파일 고르기
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (void pickRestore(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          {err && <p className="font-bold text-danger">{err}</p>}
          {pending && (
            <div className="space-y-2 rounded-2xl bg-caution-light p-4 text-caution">
              <p className="font-extrabold">이 백업으로 바꿀까요?</p>
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
              <div className="flex gap-2">
                <button type="button" className="btn btn-soft flex-1 bg-white" onClick={() => setPending(null)}>
                  취소
                </button>
                <button type="button" className="btn btn-danger flex-[2]" onClick={doRestore}>
                  바꾸기 (지금 자료 자동 백업)
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
