import { useState } from 'react'
import { backupFileName, type BackupFile } from '../db/backup'
import { saveText } from '../lib/download'

/**
 * 업데이트 전 자동 백업이 실패했을 때 (드문 경우: 저장 공간 부족 등).
 * 저장소를 새 버전으로 열지 않고 멈춘 채, 읽어 둔 자료를 파일로 받게 한다. 받은 뒤에만 계속할 수 있다.
 */
export default function UpgradeBlocked({ error, file, onContinue }: { error: string; file: BackupFile | null; onContinue: () => void }) {
  const [saved, setSaved] = useState(false)
  const download = () => {
    if (!file) return
    saveText(backupFileName().replace('backup_', 'backup_업데이트전_'), JSON.stringify(file), 'application/json')
    setSaved(true)
  }
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 p-5 pt-[calc(env(safe-area-inset-top)+28px)]">
      <h1 className="text-[1.5rem] font-black">업데이트 전에 백업을 못 했어요</h1>
      <p className="text-ink-2">
        이번 업데이트는 PAPS 기록을 저장하는 방식을 넓혀요. 그 전에 지금 자료를 이 기기 안에 복사하려 했는데 실패했어요. 자료는 아직 하나도 바뀌지 않았어요.
      </p>
      <p className="rounded-2xl bg-danger-light px-4 py-3 text-sm font-bold text-danger">{error}</p>
      {file ? (
        <button type="button" className="btn btn-primary w-full text-lg" onClick={download}>
          지금 자료를 파일로 받기
        </button>
      ) : (
        <p className="hint">자료를 읽지 못해 파일을 만들 수 없어요. 앱을 닫았다가 다시 열어 보세요.</p>
      )}
      <button type="button" className="btn btn-soft w-full" disabled={!!file && !saved} onClick={onContinue}>
        {file && !saved ? '먼저 파일을 받아 주세요' : '파일을 받았어요 · 계속하기'}
      </button>
      <p className="hint">받은 파일은 [더보기 → 백업 · 학년도 → 복원]으로 언제든 되돌릴 수 있어요.</p>
    </main>
  )
}
