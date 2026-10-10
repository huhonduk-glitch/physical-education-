import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GroupPicker from '../components/GroupPicker'
import Icon from '../components/Icon'
import { db } from '../db/db'
import { copyText } from '../lib/download'
import { memberNo, readLastGroup } from '../lib/groups'
import { keywordSummary } from '../lib/recordStats'
import { evidenceText, studentEvidence } from '../lib/seteuk'
import { useGroups } from '../state/useGroups'

/**
 * 세특 모아보기 (재설계 5단계): 수업반 학생마다 키워드와 근거 기록을 한눈에.
 * 문장을 만들지 않는다. 근거가 적은 학생을 먼저 볼 수 있어 다음 수업에서 더 관찰할 학생을 찾는 데 쓴다.
 */
export default function SeteukCollect() {
  const [sp, setSp] = useSearchParams()
  const { groups, membersOf } = useGroups()
  const want = sp.get('g') ?? readLastGroup()
  const group = groups?.find((g) => g.id === want) ?? groups?.[0] ?? null
  const members = useMemo(() => (group ? membersOf(group).filter((s) => s.status === '재학') : []), [group, membersOf])
  const [neg, setNeg] = useState(false)
  const [sort, setSort] = useState<'no' | 'few'>('no')
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const ids = members.map((s) => s.id).join(',')
  const data = useLiveQuery(async () => {
    const list = ids ? ids.split(',') : []
    const [records, keywords, scores, assessments] = await Promise.all([
      db.records.where('studentId').anyOf(list).toArray(),
      db.keywords.toArray(),
      db.assessmentScores.where('studentId').anyOf(list).toArray(),
      db.assessments.toArray(),
    ])
    return { records, keywords, scores, titles: new Map(assessments.map((a) => [a.id, a.title])) }
  }, [ids])

  const rows = useMemo(() => {
    if (!data) return []
    const r = members.map((s) => {
      const recs = data.records.filter((x) => x.studentId === s.id)
      const notes = data.scores.filter((x) => x.studentId === s.id && x.note).map((x) => ({ title: data.titles.get(x.assessmentId) ?? '수행평가', note: x.note! }))
      const kw = keywordSummary(recs, data.keywords).map((k) => ({ label: k.keyword.label, count: k.count }))
      const items = studentEvidence(recs, data.keywords, notes, { includeNegative: neg })
      return { s, kw, items }
    })
    return sort === 'few' ? [...r].sort((a, b) => a.items.length - b.items.length) : r
  }, [data, members, neg, sort])

  const noEvidence = rows.filter((r) => r.items.length === 0).length

  const copyAll = async () => {
    const ok = await copyText(rows.map((r) => evidenceText(r.s.name, r.kw, r.items)).join('\n\n'))
    setMsg(ok ? `${rows.length}명의 키워드·근거를 복사했어요.` : '복사하지 못했어요. [엑셀 내보내기]를 써 주세요.')
  }

  if (groups && groups.length === 0) {
    return (
      <p className="card">
        수업반을 먼저 만들어 주세요.{' '}
        <Link to="/groups" className="font-bold text-brand underline">
          수업반 만들기
        </Link>
      </p>
    )
  }

  return (
    <>
      <section className="card space-y-3">
        <GroupPicker groups={groups ?? []} value={group?.id ?? null} onChange={(id) => setSp((p) => (p.set('g', id), p), { replace: true })} />
        <div className="segment" role="tablist" aria-label="정렬">
          <button type="button" role="tab" aria-selected={sort === 'no'} onClick={() => setSort('no')}>
            번호순
          </button>
          <button type="button" role="tab" aria-selected={sort === 'few'} onClick={() => setSort('few')}>
            근거 적은 학생 먼저
          </button>
        </div>
        <label className="flex min-h-[48px] items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={neg} onChange={(e) => setNeg(e.target.checked)} />
          <span className="font-bold">준비물 미준비 기록도 보기</span>
        </label>
        <p className="hint">
          {members.length}명 · 근거가 하나도 없는 학생 {noEvidence}명{noEvidence ? ' — 다음 수업에서 관찰해 보세요.' : ''}
        </p>
        <button type="button" className="btn btn-soft w-full" onClick={copyAll} disabled={rows.length === 0}>
          <Icon name="copy" /> 이 반 키워드·근거 모두 복사
        </button>
        {msg && <p className="font-bold text-ok">{msg}</p>}
      </section>

      <ul className="card divide-y divide-line p-0">
        {rows.map(({ s, kw, items }) => {
          const isOpen = open === s.id
          return (
            <li key={s.id}>
              <button type="button" className="list-row w-full text-left hover:bg-fill" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                <span className="w-12 shrink-0 font-extrabold tabular-nums">{group ? memberNo(group, s) : s.number}</span>
                <span className="min-w-0 flex-1">
                  <b className="block">{s.name}</b>
                  <span className="flex flex-wrap gap-1">
                    {kw.slice(0, 3).map((k) => (
                      <span key={k.label} className="badge bg-ok-light text-ok">
                        {k.label} {k.count}
                      </span>
                    ))}
                    {kw.length === 0 && <span className="hint">키워드 없음</span>}
                  </span>
                </span>
                <span className={`badge ${items.length ? 'bg-fill text-ink-2' : 'bg-caution-light text-caution'}`}>근거 {items.length}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 bg-fill px-4 py-3">
                  {items.length === 0 ? (
                    <p className="hint">아직 근거 기록이 없어요. 누가기록에서 칭찬·관찰 메모를 남기면 여기에 모여요.</p>
                  ) : (
                    <ol className="space-y-1 text-[0.95rem]">
                      {items.map((it, i) => (
                        <li key={i}>• {it.text}</li>
                      ))}
                    </ol>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-soft flex-1 bg-white"
                      onClick={async () => setMsg((await copyText(evidenceText(s.name, kw, items))) ? `${s.name} 근거를 복사했어요.` : '복사하지 못했어요.')}
                    >
                      <Icon name="copy" /> 복사
                    </button>
                    <Link to={`/students/${s.id}`} className="btn btn-soft flex-1 bg-white">
                      학생 기록
                    </Link>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
