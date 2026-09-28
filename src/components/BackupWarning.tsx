import { Link } from 'react-router-dom'
import { backupOverdue } from '../db/backup'
import { useApp } from '../state/AppContext'
import Icon from './Icon'

/** 마지막 백업 후 7일이 지나면 홈에 띄우는 경고 (CLAUDE.md 4-11) */
export default function BackupWarning({ hasData }: { hasData: boolean }) {
  const { settings } = useApp()
  if (!hasData || !backupOverdue(settings.lastBackupAt)) return null
  const days = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 86400000) : null
  return (
    <Link to="/more/data" className="anim-pop flex items-center gap-3 rounded-2xl bg-caution-light px-4 py-3 text-caution">
      <Icon name="database" />
      <span className="flex-1 text-[0.95rem] font-bold">{days === null ? '아직 백업을 한 번도 안 했어요' : `백업한 지 ${days}일 지났어요`} — 지금 백업하기</span>
      <Icon name="chevronRight" />
    </Link>
  )
}
