import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BottomSheet from '../../components/BottomSheet'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import type { ClassGroup, Student } from '../../db/types'
import { assignRole, holdersOn, removeRole, ROLE_PRESETS, rotateRoles, type ClassRole } from '../../lib/classRoles'
import { shortDateLabel, todayStr } from '../../lib/dates'
import { memberNo } from '../../lib/groups'
import { useApp } from '../../state/AppContext'
import { useGroups } from '../../state/useGroups'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)

/**
 * 수업 역할 (2026-11-25, 슈퍼스쿨 '일인일역' 참고 — 문구 · 코드는 새로 씀).
 * 수업반마다 준비운동 리더 · 교구 담당 같은 역할과 맡은 학생을 정하고, [다음 사람으로 돌리기]로 바꾼다.
 * 바꾸면 오늘부터 적용 — 누가 언제 맡았는지 남아 세특 초안의 근거가 된다(역할 이름 · 하는 일만, 점수 없음).
 */
export default function RolesPage() {
  const { id = '' } = useParams()
  const { readOnly } = useApp()
  const { groups, membersOf } = useGroups(true)
  const group = groups?.find((g) => g.id === id)
  const members = useMemo(() => (group ? membersOf(group) : []), [group, membersOf])
  const today = todayStr()
  const [pick, setPick] = useState<ClassRole | null>(null)
  const [edit, setEdit] = useState<ClassRole | 'new' | null>(null)
  const [rotating, setRotating] = useState(false)
  const [msg, setMsg] = useState('')

  if (!group) return <PageHeader title="수업 역할" back />
  const roles = group.roles ?? []
  const terms = group.roleTerms ?? []
  const byId = new Map(members.map((s) => [s.id, s]))
  const who = (sid: string) => {
    const s = byId.get(sid)
    return s ? `${memberNo(group, s)} ${s.name}` : '(반에 없는 학생)'
  }
  const save = async (patch: Pick<ClassGroup, 'roles' | 'roleTerms'>, note?: string) => {
    await db.groups.update(group.id, patch)
    setMsg(note ?? '')
  }
  const order = members.map((s) => s.id)
  const rotatePlan = roles
    .map((r) => {
      const now = holdersOn(terms, r.id, today)
      if (!now.length) return null
      const after = holdersOn(rotateRoles(terms, [r], order, today, () => 'x'), r.id, today)
      return { r, now, after }
    })
    .filter((x): x is { r: ClassRole; now: string[]; after: string[] } => !!x)

  return (
    <>
      <PageHeader title="수업 역할" sub={group.name} back />
      <div className="page space-y-4 pb-10">
        <p className="hint px-1">역할을 정하고 맡은 학생을 고르세요. 바꾸면 <b>오늘부터</b> 적용되고, 앞사람이 맡았던 기간은 남아 세특 초안의 근거(역할 · 하는 일)가 돼요.</p>
        {msg && <p className="anim-pop rounded-2xl bg-ok-light px-4 py-3 font-bold text-ok">{msg}</p>}

        {rotatePlan.length > 0 && !readOnly && (
          <section className="card space-y-3">
            <div className="flex items-center gap-3">
              <Icon name="shuffle" className="text-brand" />
              <div className="min-w-0 flex-1">
                <b className="block">다음 사람으로 돌리기</b>
                <span className="hint">역할마다 지금 맡은 사람 다음 번호가 오늘부터 맡아요</span>
              </div>
              {!rotating && (
                <button type="button" className="btn btn-outline min-h-[44px] px-4" onClick={() => setRotating(true)}>
                  미리 보기
                </button>
              )}
            </div>
            {rotating && (
              <>
                <ul className="space-y-1 rounded-2xl bg-fill px-4 py-3 text-[0.95rem]">
                  {rotatePlan.map(({ r, now, after }) => (
                    <li key={r.id}>
                      <b>{r.name}</b> <span className="text-ink-3">{now.map(who).join(', ')}</span> → <b className="text-brand">{after.map(who).join(', ')}</b>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-soft flex-1" onClick={() => setRotating(false)}>
                    그만두기
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    onClick={() => {
                      setRotating(false)
                      void save({ roles, roleTerms: rotateRoles(terms, roles, order, today, newId) }, '오늘부터 다음 사람이 맡아요.')
                    }}
                  >
                    오늘부터 돌리기
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {roles.length === 0 ? (
          <section className="card space-y-2 text-center">
            <p className="font-bold">아직 역할이 없어요</p>
            <p className="hint">아래 [역할 더하기]에서 많이 쓰는 역할을 골라 시작하세요.</p>
          </section>
        ) : (
          <ul className="space-y-2">
            {roles.map((r) => {
              const now = holdersOn(terms, r.id, today)
              return (
                <li key={r.id} className="card space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <b className="block text-[1.08rem]">{r.name}</b>
                      {r.duty && <span className="hint block">{r.duty}</span>}
                    </div>
                    {!readOnly && (
                      <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-ink-3 hover:bg-fill" aria-label={`${r.name} 고치기`} onClick={() => setEdit(r)}>
                        <Icon name="edit" size={18} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {now.length ? (
                      now.map((sid) => (
                        <span key={sid} className="rounded-full bg-brand-light px-3 py-1.5 text-sm font-bold text-brand">
                          {who(sid)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-bold text-ink-3">맡은 학생 없음</span>
                    )}
                    {!readOnly && (
                      <button type="button" className="ml-auto rounded-full px-3 py-1.5 text-sm font-bold text-brand hover:bg-brand-light" onClick={() => setPick(r)}>
                        {now.length ? '바꾸기' : '학생 고르기'} ›
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!readOnly && (
          <section className="card space-y-3">
            <b className="block">역할 더하기</b>
            <div className="flex flex-wrap gap-2">
              {ROLE_PRESETS.filter((p) => !roles.some((r) => r.name === p.name)).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="min-h-[44px] rounded-full bg-fill px-4 font-bold active:bg-fill-2"
                  onClick={() => void save({ roles: [...roles, { id: newId(), name: p.name, duty: p.duty }], roleTerms: terms })}
                >
                  + {p.name}
                </button>
              ))}
              <button type="button" className="min-h-[44px] rounded-full border-2 border-dashed border-line px-4 font-bold text-ink-2" onClick={() => setEdit('new')}>
                + 직접 만들기
              </button>
            </div>
          </section>
        )}

        {terms.some((t) => t.to) && (
          <Collapse title="지난 기록" sub="역할마다 누가 언제 맡았는지">
            <ul className="space-y-3">
              {roles.map((r) => {
                const past = terms.filter((t) => t.roleId === r.id).sort((a, b) => b.from.localeCompare(a.from))
                if (!past.length) return null
                return (
                  <li key={r.id}>
                    <b className="block">{r.name}</b>
                    <ul className="mt-1 space-y-0.5 text-[0.92rem]">
                      {past.map((t) => (
                        <li key={t.id} className="flex justify-between gap-2">
                          <span>{who(t.studentId)}</span>
                          <span className="tabular-nums text-ink-3">
                            {shortDateLabel(t.from)} ~ {t.to ? shortDateLabel(t.to) : '지금'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </Collapse>
        )}

        <p className="hint px-1">
          맡았던 역할은 <Link to={`/seteuk/write?g=${group.id}`} className="font-bold text-brand">세특 쓰기</Link> 근거로 들어가요(예: 수업에서 &lsquo;교구 담당&rsquo; 역할을 맡아 교구를 준비하고 정리함). 하는 일은 &lsquo;…함 · …음&rsquo;으로 끝나게 적어 주세요.
        </p>
      </div>

      {pick && (
        <PickSheet
          role={pick}
          members={members}
          numberOf={(s) => memberNo(group, s)}
          initial={holdersOn(terms, pick.id, today)}
          onClose={() => setPick(null)}
          onSave={(ids) => {
            setPick(null)
            void save({ roles, roleTerms: assignRole(terms, pick.id, ids, today, newId) }, `${pick.name}: 오늘부터 적용했어요.`)
          }}
        />
      )}
      {edit && (
        <RoleSheet
          role={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSave={(r) => {
            setEdit(null)
            const next = edit === 'new' ? [...roles, { id: newId(), ...r }] : roles.map((x) => (x.id === edit.id ? { ...x, ...r } : x))
            void save({ roles: next, roleTerms: terms })
          }}
          onRemove={
            edit === 'new'
              ? undefined
              : () => {
                  setEdit(null)
                  const rest = removeRole(roles, terms, edit.id)
                  void save({ roles: rest.roles, roleTerms: rest.terms }, `${edit.name} 역할을 지웠어요.`)
                }
          }
        />
      )}
    </>
  )
}

function PickSheet({ role, members, numberOf, initial, onClose, onSave }: { role: ClassRole; members: Student[]; numberOf: (s: Student) => string; initial: string[]; onClose: () => void; onSave: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(initial)
  const toggle = (sid: string) => setSel((x) => (x.includes(sid) ? x.filter((y) => y !== sid) : [...x, sid]))
  return (
    <BottomSheet title={role.name} sub="맡을 학생을 고르세요 (여러 명 가능) · 오늘부터 적용" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {members.map((s) => {
            const on = sel.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl px-1 text-center ${on ? 'bg-brand text-white' : 'bg-fill'}`}
                onClick={() => toggle(s.id)}
              >
                <b className="tabular-nums">{numberOf(s)}</b>
                <span className="w-full truncate text-[0.8rem] font-semibold">{s.name}</span>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-soft flex-1" onClick={() => setSel([])}>
            모두 빼기
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onSave(members.filter((s) => sel.includes(s.id)).map((s) => s.id))}>
            {sel.length ? `${sel.length}명 저장` : '비워 두기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function RoleSheet({ role, onClose, onSave, onRemove }: { role: ClassRole | null; onClose: () => void; onSave: (r: Omit<ClassRole, 'id'>) => void; onRemove?: () => void }) {
  const [name, setName] = useState(role?.name ?? '')
  const [duty, setDuty] = useState(role?.duty ?? '')
  const [sure, setSure] = useState(false)
  return (
    <BottomSheet title={role ? '역할 고치기' : '역할 만들기'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="font-bold">역할 이름</span>
          <input className="field w-full" value={name} placeholder="예: 교구 담당" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-bold">하는 일</span>
          <input className="field w-full" value={duty} placeholder="예: 교구를 준비하고 정리함" onChange={(e) => setDuty(e.target.value)} />
          <span className="hint block">세특 초안에 &lsquo;수업에서 &lsquo;{name || '역할'}&rsquo; 역할을 맡아 {duty || '…'}&rsquo;로 들어가요.</span>
        </label>
        <div className="flex gap-2">
          {onRemove && (
            <button type="button" className={`btn flex-1 ${sure ? 'btn-danger' : 'btn-danger-soft'}`} onClick={() => (sure ? onRemove() : setSure(true))}>
              <Icon name="trash" size={18} /> {sure ? '지난 기록까지 지워요' : '지우기'}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), duty: duty.trim() })}>
            저장
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
