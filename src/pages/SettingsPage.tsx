import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import type { AppSettings } from '../db/settings'
import { hashPin, isValidPin, PIN_SETTING_KEY, verifyPin, type StoredPin } from '../lib/pin'
import { useApp } from '../state/AppContext'
import { Segmented } from './SetupPage'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

/** 입력칸에서 벗어날 때 저장하는 글자 칸 */
function TextSetting({ id, label, k, hint, type = 'text' }: { id: string; label: string; k: keyof AppSettings; hint?: string; type?: string }) {
  const { settings, updateSettings } = useApp()
  const [v, setV] = useState(String(settings[k]))
  useEffect(() => setV(String(settings[k])), [settings, k])
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="field"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== String(settings[k]) && updateSettings({ [k]: v.trim() })}
      />
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings } = useApp()
  const { standards } = useApp()
  const papsInfo = { version: standards.version, source: standards.source }

  return (
    <>
      <PageHeader title="설정" back />
      <div className="page space-y-4 py-4">
        <Section title="학교 정보">
          <TextSetting id="schoolName" label="학교 이름" k="schoolName" />
          <Segmented
            label="학교급"
            value={settings.schoolLevel}
            options={['초', '중', '고']}
            names={{ 초: '초등학교', 중: '중학교', 고: '고등학교' }}
            onChange={(v) => updateSettings({ schoolLevel: v })}
          />
          <Segmented
            label="학생 성별"
            value={settings.schoolGenderType}
            options={['남', '여', '공학']}
            names={{ 남: '남학교', 여: '여학교', 공학: '남녀공학' }}
            onChange={(v) => updateSettings({ schoolGenderType: v })}
          />
          <p className="hint -mt-2">명렬에 성별 칸이 없을 때 쓰여요. 남녀공학이면 직접 골라야 해요.</p>
          <Link to="/more/data" className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-fill px-4">
            <span className="flex-1">
              <span className="label mb-0">현재 학년도</span>
              <span className="text-xl font-extrabold tabular-nums">{settings.schoolYear}학년도</span>
            </span>
            <span className="text-sm font-bold text-brand">학년도 바꾸기 ›</span>
          </Link>
        </Section>

        <Section title="나이스 기본값">
          <p className="hint">명렬표에 과정명·계열명·학과명이 비어 있을 때만 이 값을 써요.</p>
          <TextSetting id="course" label="과정명" k="defaultCourse" />
          <TextSetting id="track" label="계열명" k="defaultTrack" />
          <TextSetting id="dept" label="학과명" k="defaultDept" />
        </Section>

        <PinChange />

        <Section title="수업 기록">
          <Link to="/more/settings/buttons" className="btn btn-outline w-full justify-between">
            <span>기록 버튼 편집 (미준비·솔선수범·부장 활동)</span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/more/settings/timetable" className="btn btn-outline w-full justify-between">
            <span>수업 시간표 · 교시 시각</span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/more/keywords" className="btn btn-outline w-full justify-between">
            <span>세특 키워드 사전</span>
            <span aria-hidden>›</span>
          </Link>
          <Link to="/paps/setup" className="btn btn-outline w-full justify-between">
            <span>PAPS 설정 (나이스 양식 · 허용 범위 · 계산 방식)</span>
            <span aria-hidden>›</span>
          </Link>
        </Section>

        <Section title="연동 앱 주소">
          <TextSetting id="bracket" type="url" label="팀 편성 (SPORTS BRACKET)" k="bracketUrl" />
          <TextSetting id="tactic" type="url" label="전술 보드 (K-TacticBoard)" k="tacticUrl" />
          <p className="hint">연동 기능은 6단계에서 만들어요.</p>
        </Section>

        <Section title="PAPS 기준표">
          {papsInfo ? (
            <dl className="space-y-2">
              <div>
                <dt className="font-bold">버전</dt>
                <dd>{papsInfo.version}</dd>
              </div>
              <div>
                <dt className="font-bold">출처</dt>
                <dd className="text-sm">{papsInfo.source}</dd>
              </div>
            </dl>
          ) : (
            <p>불러오는 중…</p>
          )}
        </Section>

        <Section title="이 앱의 저장 방식">
          <p>
            학생 명렬과 기록은 <b>이 기기의 브라우저 안에만</b> 저장돼요. 인터넷으로 보내지 않아요.
            다른 기기에서는 보이지 않으니 백업 기능(6단계)을 꼭 써 주세요.
          </p>
        </Section>
      </div>
    </>
  )
}

function PinChange() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const change = async () => {
    setMsg(null)
    if (!isValidPin(next)) return setMsg({ ok: false, text: '새 PIN은 숫자 4~6자리여야 해요.' })
    if (next !== next2) return setMsg({ ok: false, text: '새 PIN 두 칸이 서로 달라요.' })
    setBusy(true)
    const row = await db.settings.get(PIN_SETTING_KEY)
    const ok = row ? await verifyPin(cur, row.value as StoredPin) : false
    if (!ok) {
      setBusy(false)
      return setMsg({ ok: false, text: '지금 PIN이 맞지 않아요.' })
    }
    await db.settings.put({ key: PIN_SETTING_KEY, value: await hashPin(next) })
    setBusy(false)
    setCur('')
    setNext('')
    setNext2('')
    setMsg({ ok: true, text: 'PIN을 바꿨어요.' })
  }

  const pinField = (id: string, label: string, v: string, set: (s: string) => void) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="field tracking-[0.4em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={v}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  )

  return (
    <Section title="PIN 바꾸기">
      {pinField('pinCur', '지금 PIN', cur, setCur)}
      {pinField('pinNew', '새 PIN (숫자 4~6자리)', next, setNext)}
      {pinField('pinNew2', '새 PIN 한 번 더', next2, setNext2)}
      {msg && <p className={`font-bold ${msg.ok ? 'text-ok' : 'text-danger'}`} role="status">{msg.text}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={busy || !cur || !next || !next2} onClick={change}>
        PIN 바꾸기
      </button>
    </Section>
  )
}
