import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { loadChangelog, readSeen, unseen, writeSeen, type ChangeEntry } from '../lib/changelog'
import { IS_DEMO } from '../lib/demo'
import { useApp } from '../state/AppContext'

const BASE = import.meta.env.BASE_URL

/** 소식 목록. linkable이면 줄을 눌러 그 화면으로 (라우터 안에서만) */
export function ChangeList({ entries, linkable = false, onGo }: { entries: ChangeEntry[]; linkable?: boolean; onGo?: () => void }) {
  return (
    <div className="space-y-4">
      {entries.map((e) => (
        <section key={e.id}>
          <p className="font-extrabold">
            {e.title} <span className="ml-1 text-sm font-bold text-ink-3">{e.date.slice(5).replace('-', '/')}</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            {e.items.map((it) => (
              <li key={it.text} className="flex gap-2 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {linkable && it.to ? (
                  <Link to={it.to} onClick={onGo} className="min-w-0 flex-1 underline decoration-line underline-offset-4">
                    {it.text} <Icon name="chevronRight" size={14} className="inline text-ink-3" />
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1">{it.text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 업데이트 알림의 [무엇이 바뀌나요?]: 서버의 새 소식을 받아 보여 주고 바로 업데이트 */
export function UpdatePreview({ onUpdate, onClose }: { onUpdate: () => void; onClose: () => void }) {
  const [list, setList] = useState<ChangeEntry[] | null>(null)
  useEffect(() => {
    void loadChangelog(BASE, true).then((l) => setList(unseen(l, readSeen())))
  }, [])
  return (
    <BottomSheet title="새 버전에서 바뀌는 것" onClose={onClose}>
      <div className="space-y-4">
        {list === null ? <p className="hint">불러오는 중…</p> : list.length ? <ChangeList entries={list} /> : <p className="hint">바뀐 내용을 불러오지 못했어요(인터넷 확인). 업데이트하면 앱이 새 버전으로 열려요.</p>}
        <p className="hint">업데이트해도 기기에 저장한 학생 자료는 그대로예요. 저장 구조가 바뀌는 업데이트는 열기 전에 자동으로 백업해요.</p>
        <button type="button" className="btn btn-primary w-full" onClick={onUpdate}>
          <Icon name="download" /> 지금 업데이트
        </button>
      </div>
    </BottomSheet>
  )
}

/** 업데이트 뒤 처음 열 때 한 번: 이번에 바뀐 것 (시연 모드에서는 띄우지 않음) */
export function AfterUpdate() {
  const { settings } = useApp()
  const [list, setList] = useState<ChangeEntry[] | null>(null)
  useEffect(() => {
    if (IS_DEMO) return
    void loadChangelog(BASE, false).then((all) => {
      if (!all.length) return
      const seen = readSeen()
      // 이 기능이 생기기 전부터 쓰던 선생님(이용 안내 동의가 최신 소식보다 앞)은 최신 소식 하나를 보여 주고, 새로 시작한 선생님은 조용히 넘어간다
      if (seen === null && (settings.termsAgreed?.at ?? Date.now()) >= Date.parse(`${all[0].date}T00:00:00`)) return writeSeen(all[0].id)
      const fresh = unseen(all, seen)
      if (fresh.length) setList(all.slice(0, Math.max(1, fresh.length)))
      else writeSeen(all[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!list) return null
  const close = () => {
    writeSeen(list[0].id)
    setList(null)
  }
  return (
    <BottomSheet title="업데이트됐어요" sub="이번에 바뀐 것" onClose={close}>
      <div className="space-y-4">
        <ChangeList entries={list} linkable onGo={close} />
        <button type="button" className="btn btn-primary w-full" onClick={close}>
          확인
        </button>
      </div>
    </BottomSheet>
  )
}
