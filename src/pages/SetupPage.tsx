import { useState } from 'react'
import Icon from '../components/Icon'
import PinPad from '../components/PinPad'
import { db } from '../db/db'
import type { SchoolGenderType, SchoolLevel } from '../db/types'
import { hashPin, PIN_SETTING_KEY } from '../lib/pin'
import { requestPersistentStorage } from '../lib/school'
import { useApp } from '../state/AppContext'

/** 처음 켰을 때: 학교 기본 정보 → PIN 만들기 → PIN 한 번 더 */
export default function SetupPage({ onDone }: { onDone: () => void }) {
  const { settings, updateSettings } = useApp()
  const [step, setStep] = useState<'info' | 'pin' | 'confirm'>('info')
  const [schoolName, setSchoolName] = useState(settings.schoolName)
  const [level, setLevel] = useState<SchoolLevel>(settings.schoolLevel)
  const [genderType, setGenderType] = useState<SchoolGenderType>(settings.schoolGenderType)
  const [year, setYear] = useState(settings.schoolYear)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const saveInfo = async () => {
    await updateSettings({ schoolName: schoolName.trim(), schoolLevel: level, schoolGenderType: genderType, schoolYear: year })
    setStep('pin')
  }

  const finish = async () => {
    if (pin2 !== pin) {
      setMessage('두 번 입력한 PIN이 달라요. 처음부터 다시 입력해 주세요.')
      setPin('')
      setPin2('')
      setStep('pin')
      return
    }
    setBusy(true)
    const stored = await hashPin(pin)
    await db.settings.put({ key: PIN_SETTING_KEY, value: stored })
    await requestPersistentStorage()
    onDone()
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md p-5">
      <span className="mt-6 mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-brand text-white shadow-[0_8px_20px_rgb(27_100_218/0.35)]">
        <Icon name="class" size={32} />
      </span>
      <h1 className="text-[1.7rem] font-extrabold tracking-tight">체육수업 누가기록</h1>
      <p className="hint mt-1">학생 정보는 이 기기 안에만 저장돼요. 인터넷으로 보내지 않아요.</p>

      {step === 'info' && (
        <div className="mt-6 space-y-5">
          <div>
            <label className="label" htmlFor="school">학교 이름 (선택)</label>
            <input id="school" className="field" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <Segmented label="학교급" value={level} options={['초', '중', '고']} onChange={setLevel} names={{ 초: '초등학교', 중: '중학교', 고: '고등학교' }} />
          <Segmented
            label="학생 성별"
            value={genderType}
            options={['남', '여', '공학']}
            onChange={setGenderType}
            names={{ 남: '남학교', 여: '여학교', 공학: '남녀공학' }}
          />
          <div>
            <label className="label" htmlFor="year">현재 학년도</label>
            <input
              id="year"
              className="field"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
          </div>
          <button type="button" className="btn btn-primary w-full text-lg" disabled={year < 2000} onClick={saveInfo}>
            다음: PIN 만들기
          </button>
        </div>
      )}

      {step === 'pin' && (
        <div className="mt-8">
          <p className="mb-1 text-center text-lg font-bold">앱 잠금 PIN을 정해 주세요</p>
          <p className="hint mb-6 text-center">숫자 4~6자리 · 폰을 잃어버려도 학생 정보를 지켜요</p>
          {message && <p className="mb-4 text-center font-bold text-danger">{message}</p>}
          <PinPad
            value={pin}
            onChange={setPin}
            submitLabel="다음"
            onSubmit={() => {
              if (pin.length >= 4) {
                setMessage('')
                setStep('confirm')
              }
            }}
          />
        </div>
      )}

      {step === 'confirm' && (
        <div className="mt-8">
          <p className="mb-6 text-center text-lg font-bold">한 번 더 입력해 주세요</p>
          <PinPad value={pin2} onChange={setPin2} onSubmit={finish} disabled={busy} submitLabel="완료" />
          <p className="hint mt-6 text-center">
            PIN을 잊으면 데이터를 되살릴 수 없어요. 꼭 기억해 두세요.
          </p>
        </div>
      )}
    </main>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  names,
  suffix = '',
}: {
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
  names?: Partial<Record<T, string>>
  suffix?: string
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="segment">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {names?.[o] ?? `${o}${suffix}`}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
