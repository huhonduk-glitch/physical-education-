import { useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  maxLength?: number
  submitLabel?: string
}

/** 큰 숫자 키패드. 폰 키보드가 뜨지 않아 체육관에서 한 손으로 누르기 쉽다. */
export default function PinPad({ value, onChange, onSubmit, disabled, maxLength = 6, submitLabel = '확인' }: Props) {
  const press = (d: string) => {
    if (disabled || value.length >= maxLength) return
    onChange(value + d)
  }
  const back = () => !disabled && onChange(value.slice(0, -1))

  // 교무실 PC에서는 키보드 숫자로도 입력할 수 있게 한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      if (/^\d$/.test(e.key)) {
        if (value.length < maxLength) onChange(value + e.key)
      } else if (e.key === 'Backspace') {
        onChange(value.slice(0, -1))
      } else if (e.key === 'Enter') {
        onSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, onChange, onSubmit, disabled, maxLength])

  const key = 'btn h-16 text-2xl border-zinc-400 bg-white text-black active:bg-zinc-200'
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-5 flex justify-center gap-3" aria-label={`${value.length}자리 입력됨`}>
        {Array.from({ length: maxLength }, (_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full border-2 border-brand ${i < value.length ? 'bg-brand' : 'bg-white'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        <button type="button" className={key} onClick={back} disabled={disabled} aria-label="지우기">
          ⌫
        </button>
        <button type="button" className={key} onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button
          type="button"
          className="btn btn-primary h-16 text-lg"
          onClick={onSubmit}
          disabled={disabled || value.length < 4}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
