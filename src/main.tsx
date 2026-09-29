import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import UpdateBanner from './components/UpdateBanner'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 해시 주소(#/students)를 써서 GitHub Pages에서 새로고침해도 404가 나지 않게 한다 */}
    <HashRouter>
      <App />
      <UpdateBanner />
    </HashRouter>
  </StrictMode>,
)
