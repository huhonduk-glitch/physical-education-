import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { copyText } from '../../lib/download'
import { SPACE_URL_DEFAULT, SpaceError, checkSpace, createSpace, inviteText } from '../../lib/space'
import { useApp } from '../../state/AppContext'

/**
 * 학교 공유 공간 연결 (6-13, 0-4 예외): 새로 만들기 또는 받은 공유 코드로 들어가기.
 * 비밀번호는 이 기기에만(백업 파일에서 뺌). 공간에는 학생 정보를 올리지 않는다.
 */
export default function SpacePage() {
  const { settings, updateSettings, readOnly } = useApp()
  const conn = settings.space
  const [mode, setMode] = useState<'join' | 'create'>('join')
  const [url, setUrl] = useState(conn?.url ?? SPACE_URL_DEFAULT)
  const [code, setCode] = useState('')
  const [name, setName] = useState(settings.schoolName ?? '')
  const [pass, setPass] = useState('')
  const [me, setMe] = useState(conn?.me ?? settings.comciTeacherName ?? '')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setErr('')
    setBusy(true)
    try {
      if (!me.trim()) throw new SpaceError('기록에 남길 내 이름을 적어 주세요.')
      if (mode === 'create') {
        const r = await createSpace(url, name.trim(), pass)
        await updateSettings({ space: { url, code: r.code, pass, name: name.trim(), me: me.trim() } })
        setMsg(`공간을 만들었어요. 공유 코드 ${r.code} 를 같은 학교 체육 선생님께 알려 주세요.`)
      } else {
        const r = await checkSpace(url, code, pass)
        await updateSettings({ space: { url, code: code.trim().toUpperCase(), pass, name: r.name, me: me.trim() } })
        setMsg(`'${r.name}' 공간에 들어왔어요.`)
      }
    } catch (e) {
      setErr(e instanceof SpaceError ? e.message : '연결하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="학교 공유 공간" sub="같은 학교 체육 선생님끼리 교구 장부 · 체육관 예약" back />
      <div className="page space-y-4 pb-10">
        <section className="rounded-2xl bg-caution-light px-4 py-3 text-sm font-bold text-ink-2">
          ⚠️ 공유 공간은 인터넷(선생님 Cloudflare 계정)에 저장돼요. 교구 이름 · 수량 · 선생님 이름 · 날짜 · 교시 · 장소만 올리고, <b>학생 이름 · 정보는 적지 마세요.</b> 공유 코드와 비밀번호를 아는 선생님만 볼 수 있어요.
        </section>

        {conn ? (
          <section className="card space-y-3">
            <p className="text-sm font-bold text-brand">연결됨</p>
            <p className="text-xl font-extrabold">{conn.name}</p>
            <p className="hint">
              공유 코드 <b className="text-ink tabular-nums">{conn.code}</b> · 내 이름 {conn.me}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/work/lend" className="btn btn-primary">
                <Icon name="list" size={18} /> 교구 대여 장부
              </Link>
              <Link to="/work/book" className="btn btn-primary">
                <Icon name="calendar" size={18} /> 체육관 예약
              </Link>
            </div>
            <button type="button" className="btn btn-outline w-full" onClick={async () => setMsg((await copyText(inviteText(conn))) ? '초대 글을 복사했어요. 비밀번호는 따로(말 · 전화로) 알려 주세요.' : '복사하지 못했어요.')}>
              <Icon name="copy" size={18} /> 초대 글 복사 (비밀번호 빼고)
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full text-danger"
              disabled={readOnly}
              onClick={async () => {
                if (!confirm('이 기기에서 공유 공간 연결을 끊을까요? 공간의 자료는 그대로 남아요.')) return
                await updateSettings({ space: null })
                setMsg('')
              }}
            >
              연결 끊기
            </button>
            {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
          </section>
        ) : (
          <section className="card space-y-3">
            <div className="segment" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'join'} onClick={() => setMode('join')}>
                코드로 들어가기
              </button>
              <button type="button" role="tab" aria-selected={mode === 'create'} onClick={() => setMode('create')}>
                새로 만들기
              </button>
            </div>
            {mode === 'join' ? (
              <input className="field w-full uppercase tabular-nums" placeholder="공유 코드 8글자 (예: KQ7M3XPA)" value={code} maxLength={8} onChange={(e) => setCode(e.target.value)} />
            ) : (
              <input className="field w-full" placeholder="공간 이름 (예: ○○고 체육과)" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input className="field w-full" type="password" placeholder={mode === 'create' ? '비밀번호 정하기 (6글자 이상)' : '비밀번호'} value={pass} onChange={(e) => setPass(e.target.value)} />
            <input className="field w-full" placeholder="기록에 남길 내 이름 (예: 김체육)" value={me} onChange={(e) => setMe(e.target.value)} />
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-ink-3">공유 공간 주소 (보통 그대로)</summary>
              <input className="field mt-2 w-full" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
            </details>
            {err && <p className="text-sm font-bold text-danger">{err}</p>}
            {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
            <button type="button" className="btn btn-primary w-full" disabled={busy || readOnly || !pass || (mode === 'join' ? code.trim().length !== 8 : !name.trim())} onClick={() => void go()}>
              {busy ? '연결 중…' : mode === 'join' ? '들어가기' : '공간 만들기'}
            </button>
            <p className="hint">한 학교에 공간 하나면 돼요. 처음 한 선생님이 [새로 만들기]를 하고, 나머지 선생님은 공유 코드로 들어와요.</p>
          </section>
        )}
      </div>
    </>
  )
}
