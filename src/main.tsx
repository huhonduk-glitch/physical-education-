import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import UpdateBanner from './components/UpdateBanner'
import UpgradeBlocked from './components/UpgradeBlocked'
import { AUTO_BACKUP_NOTICE_KEY, prepareUpgrade } from './db/autoBackup'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import './index.css'
import { listenInstallPrompt } from './lib/install'

// 크롬의 [앱 설치] 신호는 한 번만 오므로 앱이 켜질 때부터 받아 둔다
listenInstallPrompt()

const root = createRoot(document.getElementById('root')!)

function start() {
  root.render(
    <StrictMode>
      {/* 해시 주소(#/students)를 써서 GitHub Pages에서 새로고침해도 404가 나지 않게 한다 */}
      <HashRouter>
        <App />
        <UpdateBanner />
      </HashRouter>
    </StrictMode>,
  )
}

// 저장 구조가 바뀌는 업데이트면, 새 버전으로 열기 전에 옛 자료를 기기 안에 통째로 복사해 둔다 (autoBackup.ts)
void prepareUpgrade().then((r) => {
  if (r.status === 'saved') {
    try {
      localStorage.setItem(AUTO_BACKUP_NOTICE_KEY, String(Date.now()))
    } catch {
      /* 알림만 못 보여 줄 뿐 백업은 됐다 */
    }
  }
  if (r.status === 'failed') {
    // 백업을 못 했으면 저장소를 새 버전으로 열지 않고 멈춘다. 교사가 파일로 받은 뒤에만 계속한다
    root.render(<UpgradeBlocked error={r.error} file={r.file} onContinue={start} />)
    return
  }
  start()
})
