// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AfterUpdate, UpdatePreview } from '../src/components/WhatsNew'
import { SEEN_KEY } from '../src/lib/changelog'
import { AppContext } from '../src/state/AppContext'
import { defaultSettings } from '../src/db/settings'

const file = JSON.parse(fs.readFileSync('public/changelog.json', 'utf8'))
const latest = file.entries[0]

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(file))))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const withApp = (agreedAt: number) => {
  const settings = { ...defaultSettings(), termsAgreed: { version: 1, at: agreedAt } }
  const ctx = { settings, updateSettings: async () => {}, lock: () => {}, readOnly: false, standards: {} } as never
  return render(
    <AppContext.Provider value={ctx}>
      <MemoryRouter>
        <AfterUpdate />
      </MemoryRouter>
    </AppContext.Provider>,
  )
}

describe('업데이트 소식 팝업', () => {
  it('업데이트 알림 [무엇이 바뀌나요?]: 서버에서 새로 받아 보여 주고 [지금 업데이트]', async () => {
    const onUpdate = vi.fn()
    render(<UpdatePreview onUpdate={onUpdate} onClose={() => {}} />)
    expect(await screen.findByText(latest.title)).toBeTruthy()
    expect(String((fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])).toMatch(/changelog\.json\?t=\d+/)
    fireEvent.click(screen.getByText('지금 업데이트'))
    expect(onUpdate).toHaveBeenCalled()
  })
  it('예전부터 쓰던 선생님: 업데이트 뒤 한 번 보여 주고, 확인하면 다시 안 뜸', async () => {
    withApp(Date.parse('2026-09-01'))
    expect(await screen.findByText('업데이트됐어요')).toBeTruthy()
    expect(screen.getByText(latest.title)).toBeTruthy()
    fireEvent.click(screen.getByText('확인'))
    expect(localStorage.getItem(SEEN_KEY)).toBe(latest.id)
  })
  it('새로 시작한 선생님: 띄우지 않고 본 것으로 둠', async () => {
    withApp(Date.now())
    await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).toBe(latest.id))
    expect(screen.queryByText('업데이트됐어요')).toBeNull()
  })
  it('이미 최신을 봤으면 띄우지 않음', async () => {
    localStorage.setItem(SEEN_KEY, latest.id)
    withApp(Date.parse('2026-09-01'))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('업데이트됐어요')).toBeNull()
  })
})
