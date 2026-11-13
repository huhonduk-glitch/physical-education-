// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SyncAskSheet from '../src/components/SyncAskSheet'

afterEach(cleanup)

describe('구글 동기화: 덮어쓰면 사라질 때 묻는 창', () => {
  it('양쪽 모두 바뀜 → 둘 다 살리기(추천) · 이 기기 것으로 · 구글 것으로 · 취소', () => {
    const onChoose = vi.fn()
    const onClose = vi.fn()
    render(<SyncAskSheet reason="both" remoteAt="2026-11-13T00:12:00.000Z" busy={false} onChoose={onChoose} onClose={onClose} />)
    expect(screen.getByText('양쪽 모두 바뀌었어요')).toBeTruthy()
    fireEvent.click(screen.getByText(/둘 다 살리기/))
    expect(onChoose).toHaveBeenLastCalledWith('merge')
    fireEvent.click(screen.getByText('이 기기 것으로 올리기'))
    expect(onChoose).toHaveBeenLastCalledWith('up')
    fireEvent.click(screen.getByText('구글 것으로 내려받기'))
    expect(onChoose).toHaveBeenLastCalledWith('down')
    fireEvent.click(screen.getByText(/취소/))
    expect(onClose).toHaveBeenCalled()
  })
  it('올리려는데 구글이 더 새로움 → 내려받기를 권함', () => {
    const onChoose = vi.fn()
    render(<SyncAskSheet reason="remote" busy={false} onChoose={onChoose} onClose={() => {}} />)
    expect(screen.getByText('구글 사본이 더 새로워요')).toBeTruthy()
    fireEvent.click(screen.getByText(/구글에서 내려받기/))
    expect(onChoose).toHaveBeenLastCalledWith('down')
    expect(screen.queryByText(/둘 다 살리기/)).toBeNull()
  })
  it('내려받으려는데 안 올린 기록 → 올리기를 권함', () => {
    const onChoose = vi.fn()
    render(<SyncAskSheet reason="local" busy={false} onChoose={onChoose} onClose={() => {}} />)
    expect(screen.getByText('아직 안 올린 기록이 있어요')).toBeTruthy()
    fireEvent.click(screen.getByText(/이 기기 것으로 올리기/))
    expect(onChoose).toHaveBeenLastCalledWith('up')
  })
})
