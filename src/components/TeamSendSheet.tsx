import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db/db'
import { indexResults, loadClassPaps, studentSummary } from '../db/papsRepo'
import type { Student } from '../db/types'
import { copyText, saveText } from '../lib/download'
import { teamLevel, type EventId, type Factor } from '../lib/paps'
import { bracketCsv, bracketText, tacticBoardJson, tacticBoardLink, type TeamStudent } from '../lib/teamExport'
import { useApp } from '../state/AppContext'
import BottomSheet from './BottomSheet'
import Icon from './Icon'

/**
 * [팀 편성으로 보내기] (CLAUDE.md 4-10). 이 반에서 그날 참여 가능한 학생만(견학·전출 제외) 넘긴다.
 * 실력 수준은 평가 정보라서 기본으로 끈다.
 */
export default function TeamSendSheet({ students, date, onClose }: { students: Student[]; date: string; onClose: () => void }) {
  const { settings, standards } = useApp()
  const [withLevel, setWithLevel] = useState(false)
  const [withName, setWithName] = useState(false)
  const [msg, setMsg] = useState('')
  const ids = students.map((s) => s.id)
  const data = useLiveQuery(async () => {
    const absent = await db.absences.where('date').equals(date).filter((a) => ids.includes(a.studentId)).toArray()
    const s0 = students[0]
    const paps = s0 ? await loadClassPaps(db, settings.schoolYear, s0.grade, s0.classNo, ids) : null
    return { absent: new Set(absent.map((a) => a.studentId)), paps }
  }, [date, ids.join(',')])

  const list: TeamStudent[] = useMemo(() => {
    if (!data) return []
    const { values } = indexResults(data.paps?.results ?? [])
    const selected = (data.paps?.config?.selectedEvents ?? {}) as Partial<Record<Factor, EventId>>
    return students
      .filter((s) => s.status === '재학' && !data.absent.has(s.id))
      .map((s) => {
        const p = studentSummary(standards, s, settings.schoolLevel, selected, values.get(s.id), settings.papsFlexMode)
        return { number: s.number, name: s.name, gender: s.gender, level: p ? teamLevel(p) : null }
      })
  }, [data, students, standards, settings.schoolLevel, settings.papsFlexMode])

  const excludedCount = students.length - list.length
  const s0 = students[0]
  const cls = s0 ? `${s0.grade}-${s0.classNo}` : ''

  const sendBracket = async () => {
    const ok = await copyText(bracketText(list, withLevel))
    setMsg(ok ? `${list.length}명을 복사했어요. 팀 편성 앱의 [📝 일괄 입력] 칸에 붙여넣으세요.` : '복사하지 못했어요. CSV로 받아 주세요.')
    if (ok) window.open(settings.bracketUrl, '_blank', 'noopener')
  }

  return (
    <BottomSheet title="팀 편성으로 보내기" sub={`${cls}반 · 오늘 참여 ${list.length}명 (견학·전출 ${excludedCount}명 제외)`} onClose={onClose}>
      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl bg-fill p-4">
          <p className="card-title">SPORTS BRACKET (팀 편성)</p>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={withLevel} onChange={(e) => setWithLevel(e.target.checked)} />
            <span>
              <b>실력 수준(상·중·하) 함께 보내기</b>
              <span className="hint block">PAPS 종합등급으로 정해요. 평가 정보라서 기본은 꺼 둬요. 미측정 학생은 빈칸.</span>
            </span>
          </label>
          <p className="hint">팀 편성 앱은 다른 곳에서 명단을 받는 기능이 없어서, 복사 → 붙여넣기 한 번이 필요해요. 버튼을 누르면 복사와 앱 열기가 한 번에 돼요.</p>
          <pre className="max-h-40 overflow-auto rounded-xl bg-white p-3 text-sm">{bracketText(list.slice(0, 6), withLevel)}{list.length > 6 ? '\n…' : ''}</pre>
          <button type="button" className="btn btn-primary w-full" disabled={list.length === 0} onClick={sendBracket}>
            <Icon name="copy" /> 명단 복사하고 팀 편성 앱 열기
          </button>
          <button type="button" className="btn btn-soft w-full bg-white" disabled={list.length === 0} onClick={() => saveText(`팀편성_${cls}반_${date}.csv`, bracketCsv(list, withLevel), 'text/csv;charset=utf-8')}>
            <Icon name="download" /> CSV 파일로 받기
          </button>
        </section>

        <section className="space-y-3 rounded-2xl bg-fill p-4">
          <p className="card-title">K-TacticBoard (전술 보드)</p>
          <label className="flex min-h-[48px] items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
            <span>
              <b>이름도 넣기</b>
              <span className="hint block">기본은 번호만 넣어요 (전술 보드 권장: 실명 대신 번호).</span>
            </span>
          </label>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={list.length === 0}
            onClick={() => {
              window.open(tacticBoardLink(settings.tacticUrl, tacticBoardJson(list, { includeName: withName, group: `${cls}반` })), '_blank', 'noopener')
              setMsg(`전술 보드를 열었어요. [선수 명단]에 ${list.length}명이 들어가 있어요.`)
            }}
          >
            <Icon name="share" /> 명단 넣어서 전술 보드 열기
          </button>
          <p className="hint">
            전술 보드에 원래 있는 「공유 링크」 방식으로 열어요. 새 보드로 열리고, 전에 [저장]해 둔 보드는 지워지지 않아요. 명단은 인터넷으로 보내지지 않고 이 기기 브라우저 안에서만 전달돼요.
          </p>
          <details className="rounded-xl bg-white p-3">
            <summary className="cursor-pointer font-bold text-ink-2">파일로 받기 (링크가 안 열릴 때)</summary>
            <p className="mt-2 text-sm font-semibold text-caution">
              전술 보드의 [공유·출력 → JSON 불러오기]로 이 파일을 열면 명단이 채워져요. 이때 보드에 그려 둔 그림·장면·경기 기록은 지워지니, 새 보드에서 불러오세요.
            </p>
            <button
              type="button"
              className="btn btn-soft mt-2 w-full"
              disabled={list.length === 0}
              onClick={() => saveText(`전술보드명단_${cls}반.json`, tacticBoardJson(list, { includeName: withName, group: `${cls}반` }), 'application/json')}
            >
              <Icon name="download" /> 전술 보드용 명단 파일 받기
            </button>
          </details>
        </section>
        {msg && <p className="rounded-xl bg-ok-light p-3 font-bold text-ok" role="status">{msg}</p>}
      </div>
    </BottomSheet>
  )
}
