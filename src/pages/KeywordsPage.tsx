import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import ClassPicker, { classesOf, type ClassKey } from '../components/ClassPicker'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { KEYWORD_CATEGORIES } from '../data/keywordSeed'
import { db, newId } from '../db/db'
import type { Keyword } from '../db/types'
import { saveXlsx } from '../lib/download'
import { seteukRows } from '../lib/seteuk'
import { useApp } from '../state/AppContext'

/** 세특 키워드 (CLAUDE.md 4-7): 사전 관리 + 학생별 키워드·근거 엑셀. 문장은 만들지 않는다 */
export default function KeywordsPage() {
  const [tab, setTab] = useState<'dict' | 'export'>('dict')
  return (
    <>
      <PageHeader title="세특 키워드" back />
      <div className="page space-y-4 pb-8">
        <div className="segment" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'dict'} onClick={() => setTab('dict')}>
            키워드 사전
          </button>
          <button type="button" role="tab" aria-selected={tab === 'export'} onClick={() => setTab('export')}>
            엑셀 내보내기
          </button>
        </div>
        {tab === 'dict' ? <Dictionary /> : <Export />}
        <p className="hint px-1">이 앱은 세특 문장을 만들지 않아요. 키워드와 근거 기록만 정리해 드려요.</p>
      </div>
    </>
  )
}

function Dictionary() {
  const keywords = useLiveQuery(() => db.keywords.orderBy('sortOrder').toArray(), [])
  const cats = useMemo(() => [...new Set([...KEYWORD_CATEGORIES, ...(keywords ?? []).map((k) => k.category)])], [keywords])
  const [label, setLabel] = useState('')
  const [cat, setCat] = useState(KEYWORD_CATEGORIES[0])
  const [newCat, setNewCat] = useState('')
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)

  const add = async () => {
    const l = label.trim()
    const c = (cat === '__new' ? newCat : cat).trim()
    if (!l || !c) return
    const max = Math.max(-1, ...(keywords ?? []).map((k) => k.sortOrder))
    await db.keywords.add({ id: newId(), label: l, category: c, isActive: true, sortOrder: max + 1 })
    setLabel('')
    setNewCat('')
    if (cat === '__new') setCat(c)
  }
  const move = async (list: Keyword[], i: number, d: -1 | 1) => {
    const a = list[i]
    const b = list[i + d]
    if (!a || !b) return
    await db.transaction('rw', db.keywords, async () => {
      await db.keywords.update(a.id, { sortOrder: b.sortOrder })
      await db.keywords.update(b.id, { sortOrder: a.sortOrder })
    })
  }

  return (
    <>
      <section className="card space-y-3">
        <p className="card-title">키워드 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <select className="field" aria-label="카테고리" value={cat} onChange={(e) => setCat(e.target.value)}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new">+ 새 카테고리</option>
          </select>
          {cat === '__new' ? <input className="field" placeholder="카테고리 이름" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="새 카테고리" /> : <span />}
        </div>
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="예: 공정한 판정" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="키워드" />
          <button type="button" className="btn btn-primary" disabled={!label.trim()} onClick={add}>
            추가
          </button>
        </div>
      </section>
      {cats.map((c) => {
        const list = (keywords ?? []).filter((k) => k.category === c)
        if (!list.length) return null
        return (
          <section key={c} className="card overflow-hidden p-0">
            <p className="card-title px-5 pt-4 pb-1">{c}</p>
            <ul>
              {list.map((k, i) => (
                <li key={k.id} className={`list-row ${k.isActive ? '' : 'opacity-50'}`}>
                  {editing?.id === k.id ? (
                    <>
                      <input className="field flex-1" autoFocus value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} aria-label="키워드 이름" />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!editing.label.trim()}
                        onClick={async () => {
                          await db.keywords.update(k.id, { label: editing.label.trim() })
                          setEditing(null)
                        }}
                      >
                        확인
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-semibold">
                        {k.label} {!k.isActive && <span className="badge bg-fill-2 text-ink-3">꺼짐</span>}
                      </span>
                      <button type="button" className="btn btn-ghost px-2" aria-label={`${k.label} 위로`} disabled={i === 0} onClick={() => move(list, i, -1)}>
                        <Icon name="up" size={18} />
                      </button>
                      <button type="button" className="btn btn-ghost px-2" aria-label={`${k.label} 아래로`} disabled={i === list.length - 1} onClick={() => move(list, i, 1)}>
                        <Icon name="down" size={18} />
                      </button>
                      <button type="button" className="btn btn-ghost px-2" aria-label={`${k.label} 이름 바꾸기`} onClick={() => setEditing({ id: k.id, label: k.label })}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className={`btn min-h-[40px] px-3 text-sm ${k.isActive ? 'btn-soft' : 'btn-outline'}`} onClick={() => db.keywords.update(k.id, { isActive: !k.isActive })}>
                        {k.isActive ? '끄기' : '켜기'}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <p className="hint px-1">끈 키워드는 기록 창에 나오지 않지만, 이미 붙인 기록에는 그대로 남아요.</p>
    </>
  )
}

function Export() {
  const { settings } = useApp()
  const students = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).filter((s) => s.status !== '전출').toArray(), [settings.schoolYear])
  const classes = useMemo(() => classesOf(students ?? []), [students])
  const [cls, setCls] = useState<ClassKey | null>(null)
  const [neg, setNeg] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    const list = (students ?? []).filter((s) => !cls || (s.grade === cls.grade && s.classNo === cls.classNo))
    const ids = list.map((s) => s.id)
    const [records, keywords] = await Promise.all([db.records.where('studentId').anyOf(ids).toArray(), db.keywords.toArray()])
    const rows = seteukRows(list, records, keywords, { includeNegative: neg })
    await saveXlsx(`세특키워드_${settings.schoolYear}_${cls ? `${cls.grade}-${cls.classNo}반` : '전체'}.xlsx`, [
      { name: '세특 키워드', rows: [['학번', '이름', '키워드(빈도순)', '근거 기록'], ...rows.map((r) => [r.studentCode, r.name, r.keywords, r.evidence])], widths: [8, 10, 40, 90] },
    ])
    setMsg(`${rows.length}명의 키워드를 엑셀로 저장했어요.`)
  }
  return (
    <section className="card space-y-3">
      <p className="card-title">학생별 키워드 · 근거 엑셀</p>
      <p className="hint">학생 1명당 1줄: 학번 · 이름 · 키워드(빈도순) · 근거 기록(날짜와 메모).</p>
      <ClassPicker classes={classes} value={cls} onChange={setCls} allLabel="전체 반" />
      <label className="flex min-h-[48px] items-center gap-3">
        <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={neg} onChange={(e) => setNeg(e.target.checked)} />
        <span>
          <b>준비물 미준비 기록도 넣기</b>
          <span className="hint block">부정 기록이라 기본으로 빼요.</span>
        </span>
      </label>
      <button type="button" className="btn btn-primary w-full" onClick={run}>
        <Icon name="download" /> 엑셀 내려받기
      </button>
      {msg && <p className="font-bold text-ok">{msg}</p>}
    </section>
  )
}
