import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AUTO_BACKUP_NOTICE_KEY, listSnapshots } from '../db/autoBackup'
import { backupFileName } from '../db/backup'
import { saveText } from '../lib/download'
import Icon from './Icon'

function noticeAt(): number | null {
  try {
    const v = localStorage.getItem(AUTO_BACKUP_NOTICE_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/** 업데이트 전 자동 백업을 했다는 알림 (홈에 한 번, 닫으면 사라짐). 파일로도 받게 한다 */
export default function AutoBackupNotice() {
  const [at, setAt] = useState(noticeAt)
  const [err, setErr] = useState('')
  if (!at) return null
  const close = () => {
    try {
      localStorage.removeItem(AUTO_BACKUP_NOTICE_KEY)
    } catch {
      /* 무시 */
    }
    setAt(null)
  }
  const download = async () => {
    const [latest] = await listSnapshots()
    if (!latest) return setErr('자동 백업을 찾지 못했어요. [더보기 → 백업 · 학년도]에서 확인해 주세요.')
    saveText(backupFileName(new Date(latest.createdAt)).replace('backup_', 'backup_업데이트전_'), JSON.stringify(latest.file), 'application/json')
  }
  return (
    <section className="card space-y-2 bg-ok-light shadow-none" role="status">
      <div className="flex items-start gap-2">
        <Icon name="check" className="mt-0.5 shrink-0 text-ok" />
        <p className="flex-1 font-bold text-ok">업데이트 전에 지금까지의 자료를 이 기기 안에 자동 백업했어요</p>
        <button type="button" className="btn btn-ghost -mt-2 -mr-2 px-2 text-ink-3" aria-label="알림 닫기" onClick={close}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="text-sm text-ink-2">
        이제 PAPS를 한 학기에 여러 번(1회차·2회차…) 측정할 수 있어요. 예전 기록은 그대로 1회차예요. 안심하려면 파일로도 받아 두세요.
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-soft flex-1 bg-white" onClick={() => void download()}>
          <Icon name="download" /> 파일로 받기
        </button>
        <Link to="/more/data" className="btn btn-soft flex-1 bg-white">
          백업 화면
        </Link>
      </div>
      {err && <p className="text-sm font-bold text-danger">{err}</p>}
    </section>
  )
}
