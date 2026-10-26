// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DirectEdit from '../src/pages/plans/DirectEdit'

describe('진도표 바로 입력', () => {
  it('내용을 적고 Enter → 저장, 비운 단원은 윗 차시 단원', () => {
    const onSave = vi.fn()
    render(<DirectEdit items={[{ id: 'a', unit: '농구', content: '', standards: [] }, { id: 'b', unit: '', content: '', standards: [] }]} target={2} readOnly={false} onSave={onSave} />)
    const c1 = screen.getByLabelText('1차시 학습 내용')
    fireEvent.change(c1, { target: { value: '드리블' } })
    fireEvent.keyDown(c1, { key: 'Enter' })
    const saved = onSave.mock.calls.at(-1)![0]
    expect(saved[0]).toMatchObject({ unit: '농구', content: '드리블' })
    expect(saved[1].unit).toBe('농구')
  })
  it('목표보다 적으면 빈 차시 채우기 버튼', () => {
    const onSave = vi.fn()
    render(<DirectEdit items={[]} target={3} readOnly={false} onSave={onSave} />)
    fireEvent.click(screen.getByText(/빈 차시 3개/))
    expect(onSave.mock.calls.at(-1)![0]).toHaveLength(3)
  })
})
