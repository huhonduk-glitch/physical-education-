import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ClassPicker, { classKeyStr } from '../../components/ClassPicker'
import PageHeader from '../../components/PageHeader'
import { db } from '../../db/db'
import { bmiOf, cellsByEvent, setCell, setExcluded } from '../../db/papsRepo'
import type { Student } from '../../db/types'
import { cellLabel, MEASURE_LABEL, type MeasureKey } from '../../lib/neisHeaderParser'
import { checkValue, rangeText } from '../../lib/neisExport'
import { cellId, type CellSpec } from '../../lib/papsLayout'
import { eventName, eventPoints, fixed, levelKey, longRunSeconds, lookup, officialSuggestion, representative, tableRange, type EventId } from '../../lib/paps'
import { useApp } from '../../state/AppContext'
import { usePapsClass } from '../../state/usePapsClass'
import { GradeBadge, measureGroups, usePapsClassKey } from './common'

/** 번호순 연속 입력 (CLAUDE.md 4-5 입력 화면). 엔터 → 다음 칸/다음 학생 */
export default function PapsInputPage() {
  const { key = '' } = useParams()
  const { settings, standards, readOnly } = useApp()
  const { classes, cls, setCls } = usePapsClassKey()
  const pc = usePapsClass(cls)
  const group = measureGroups(pc.cells).find((g) => g.key === key)
  const cells: CellSpec[] = group?.cells ?? (key === 'bmi' ? [{ key: 'height', attempt: null, side: null }, { key: 'weight', attempt: null, side: null }] : [{ key: key as MeasureKey, attempt: null, side: null }])
  const title = key === 'bmi' ? '체질량지수 (신장·체중)' : key === 'pushUp' ? eventName(standards, 'pushUp') : (MEASURE_LABEL[key as MeasureKey] ?? key)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const [sp] = useSearchParams()
  const focusId = sp.get('s')
  useEffect(() => {
    if (!focusId || pc.loading) return
    const el = document.getElementById(`st-${focusId}`)
    el?.scrollIntoView({ block: 'center' })
    el?.querySelector('input')?.focus()
  }, [focusId, pc.loading])
  const focusNext = (from: HTMLInputElement) => {
    const list = inputs.current.filter(Boolean) as HTMLInputElement[]
    const i = list.indexOf(from)
    const next = list[i + 1]
    if (next) {
      next.focus()
      next.select()
      next.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else from.blur()
  }
  let order = 0
  const reg = () => {
    const i = order++
    return (el: HTMLInputElement | null) => {
      inputs.current[i] = el
    }
  }

  return (
    <>
      <PageHeader title={title} sub={cls ? `${cls.grade}학년 ${cls.classNo}반 · 엔터를 누르면 다음 칸` : undefined} back />
      <div className="page space-y-3 pb-8">
        <ClassPicker classes={classes} value={cls} onChange={setCls} />
        {readOnly && <p className="rounded-2xl bg-caution-light px-4 py-2.5 font-bold text-caution">지난 학년도는 읽기 전용이에요.</p>}
        <p className="hint px-1">{standards.events[key as EventId] ? `기록 단위 ${standards.events[key as EventId].unit} · 칸마다 등급을 따로 보여주고, 대표 기록에는 ★를 붙여요.` : ''}</p>
        <ul className="space-y-2">
          {pc.students.map((s) => (
            <StudentRow
              key={s.id}
              s={s}
              cells={cells}
              groupKey={key}
              vals={pc.values.get(s.id)}
              excludedReason={pc.excluded.get(s.id)}
              reg={reg}
              focusNext={focusNext}
              disabled={readOnly}
              year={settings.schoolYear}
            />
          ))}
        </ul>
        {cls && (
          <Link to={`/paps?c=${classKeyStr(cls)}`} className="btn btn-primary w-full">
            다 했어요
          </Link>
        )}
      </div>
    </>
  )
}

function StudentRow({
  s,
  cells,
  groupKey,
  vals,
  excludedReason,
  reg,
  focusNext,
  disabled,
  year,
}: {
  s: Student
  cells: CellSpec[]
  groupKey: string
  vals: Map<string, number> | undefined
  excludedReason: string | undefined
  reg: () => (el: HTMLInputElement | null) => void
  focusNext: (el: HTMLInputElement) => void
  disabled: boolean
  year: number
}) {
  const { settings, standards } = useApp()
  const excluded = excludedReason !== undefined
  const lv = levelKey(settings.schoolLevel, s.grade)
  const g = s.gender ?? 'M'
  const eventId = groupKey as EventId
  const byEvent = cellsByEvent(vals)
  const rep = standards.events[eventId] ? representative(standards, eventId, byEvent[eventId] ?? []) : null
  const save = (c: CellSpec, v: number | undefined) => setCell(db, year, s.id, c, v)

  const toggleExclude = async () => {
    if (excluded) return setExcluded(db, year, s.id, false)
    const reason = prompt('측정 제외 사유 (예: 부상, 장기결석)', '')
    if (reason !== null) await setExcluded(db, year, s.id, true, reason)
  }

  return (
    <li id={`st-${s.id}`} className={`card space-y-3 p-4 ${excluded ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-fill font-extrabold tabular-nums">{s.number}</span>
        <span className="flex-1 font-bold">
          {s.name} <span className="text-sm text-ink-3">{s.gender === 'F' ? '여' : '남'}</span>
          {groupKey === 'pushUp' && <span className="hint block">{eventName(standards, 'pushUp', g)}</span>}
        </span>
        <button type="button" className={`btn min-h-[40px] px-3 text-sm ${excluded ? 'btn-danger-soft' : 'btn-soft'}`} onClick={toggleExclude} disabled={disabled}>
          {excluded ? `제외됨${excludedReason ? ` · ${excludedReason}` : ''}` : '측정 제외'}
        </button>
      </div>
      {!excluded &&
        (groupKey === 'bmi' ? (
          <BmiInputs s={s} vals={vals} reg={reg} focusNext={focusNext} disabled={disabled} save={save} lv={lv} />
        ) : groupKey === 'longRunWalk' ? (
          <LongRunInput cell={cells[0]} vals={vals} lv={lv} g={g} reg={reg} focusNext={focusNext} disabled={disabled} save={save} />
        ) : groupKey === 'totalFlexibility' ? (
          <FlexInput cell={cells[0]} vals={vals} lv={lv} g={g} disabled={disabled} save={save} />
        ) : (
          <div className={`grid gap-2 ${cells.length >= 4 ? 'grid-cols-2' : cells.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {cells.map((c) => (
              <CellInput
                key={cellId(c)}
                cell={c}
                value={vals?.get(cellId(c))}
                eventId={c.key === 'heartRate' ? null : (c.key as EventId)}
                lv={lv}
                g={g}
                star={!!rep && rep.attempt === c.attempt && rep.side === c.side && cells.length > 1}
                reg={reg()}
                focusNext={focusNext}
                disabled={disabled}
                onSave={(v) => save(c, v)}
              />
            ))}
          </div>
        ))}
      {groupKey === 'stepTest' && !excluded && (
        <Link to="/timer" className="hint block text-brand">
          심박수로 PEI 계산하기 → 타이머 · PAPS 보조 · 스텝검사
        </Link>
      )}
    </li>
  )
}

function CellInput({
  cell,
  value,
  eventId,
  lv,
  g,
  star,
  reg,
  focusNext,
  disabled,
  onSave,
  label,
}: {
  cell: CellSpec
  value: number | undefined
  eventId: EventId | null
  lv: string
  g: 'M' | 'F'
  star: boolean
  reg: (el: HTMLInputElement | null) => void
  focusNext: (el: HTMLInputElement) => void
  disabled: boolean
  onSave: (v: number | undefined) => void
  label?: string
}) {
  const { settings, standards } = useApp()
  const range = settings.neisRanges[cell.key]
  const decimals = range?.decimals ?? 2
  const [text, setText] = useState(value === undefined ? '' : fixed(value, 4))
  useEffect(() => setText(value === undefined ? '' : fixed(value, 4)), [value])
  const num = text.trim() === '' || text === '-' ? undefined : Number(text)
  const bad = num !== undefined && Number.isFinite(num) ? checkValue(num, range) : null
  const band = eventId && num !== undefined && Number.isFinite(num) ? lookup(standards, eventId, lv, g, num) : null
  const points = band && eventId ? eventPoints(standards, eventId, band, settings.papsFlexMode) : null
  const suggestion = eventId && num !== undefined ? officialSuggestion(standards, eventId, num) : null
  const allowNeg = !!(eventId && standards.events[eventId]?.allowNegative)

  const commit = (el?: HTMLInputElement) => {
    if (num !== undefined && !Number.isFinite(num)) {
      setText(value === undefined ? '' : fixed(value, 4))
      return
    }
    if (num === value) return
    if (num !== undefined) {
      if (bad === 'range' && !confirm(`허용 범위(${rangeText(range!)})를 벗어났어요. 나이스 업로드가 거부될 수 있어요. 그래도 저장할까요?`)) {
        setText(value === undefined ? '' : fixed(value, 4))
        el?.focus()
        return
      }
      const tr = eventId ? tableRange(standards, eventId, lv, g) : null
      if (tr && (num < tr.min - Math.abs(tr.min) * 0.5 - 5 || num > tr.max * 1.5 + 5) && !confirm('기준표 범위를 크게 벗어난 값이에요. 맞게 입력했나요?')) {
        el?.focus()
        return
      }
    }
    onSave(num)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(e.currentTarget)
      focusNext(e.currentTarget)
    }
  }
  return (
    <div className={`rounded-2xl p-2.5 ${bad ? 'bg-danger-light' : 'bg-fill'}`}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-[0.8rem] font-bold text-ink-2">
          {star && <span className="text-[#f2994a]">★ </span>}
          {label ?? cellLabel(cell)}
        </span>
        {eventId && <GradeBadge band={band} points={points} />}
      </div>
      <div className="flex gap-1.5">
        {allowNeg && (
          <button
            type="button"
            className="btn btn-soft min-w-[44px] bg-white px-0 text-xl"
            aria-label="음수 바꾸기"
            disabled={disabled}
            onClick={() => setText((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`))}
          >
            ±
          </button>
        )}
        <input
          ref={reg}
          className={`field bg-white text-lg font-bold tabular-nums ${bad ? 'border-danger' : ''}`}
          inputMode={decimals === 0 && !allowNeg ? 'numeric' : 'decimal'}
          enterKeyHint="next"
          aria-label={label ?? cellLabel(cell)}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value.replace(/[^\d.-]/g, ''))}
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={onKey}
        />
      </div>
      {bad === 'range' && <p className="mt-1 text-[0.8rem] font-bold text-danger">허용 범위 {rangeText(range!)} 밖이에요</p>}
      {bad === 'decimals' && <p className="mt-1 text-[0.8rem] font-bold text-danger">소수 {decimals}자리까지만 넣을 수 있어요 (자동으로 고치지 않아요)</p>}
      {suggestion !== null && (
        <button type="button" className="mt-1 text-[0.82rem] font-bold text-brand underline" onClick={() => (setText(String(suggestion)), onSave(suggestion))}>
          공식 규칙대로면 {fixed(suggestion, 1)}입니다 [적용]
        </button>
      )}
    </div>
  )
}

function BmiInputs({ s, vals, reg, focusNext, disabled, save, lv }: { s: Student; vals: Map<string, number> | undefined; reg: () => (el: HTMLInputElement | null) => void; focusNext: (el: HTMLInputElement) => void; disabled: boolean; save: (c: CellSpec, v: number | undefined) => void; lv: string }) {
  const { standards } = useApp()
  const value = bmiOf(vals)
  const band = value !== null && s.gender ? lookup(standards, 'bmi', lv, s.gender, value) : null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(['height', 'weight'] as const).map((k) => {
          const c = { key: k, attempt: null, side: null }
          return (
            <CellInput key={k} cell={c} value={vals?.get(cellId(c))} eventId={null} lv={lv} g="M" star={false} reg={reg()} focusNext={focusNext} disabled={disabled} onSave={(v) => save(c, v)} label={k === 'height' ? '신장(cm)' : '체중(kg)'} />
          )
        })}
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 ring-1 ring-line">
        <span className="font-bold">BMI {value ?? '—'}</span>
        {band && <GradeBadge band={band} points={band.points} />}
      </div>
    </div>
  )
}

function LongRunInput({ cell, vals, lv, g, reg, focusNext, disabled, save }: { cell: CellSpec; vals: Map<string, number> | undefined; lv: string; g: 'M' | 'F'; reg: () => (el: HTMLInputElement | null) => void; focusNext: (el: HTMLInputElement) => void; disabled: boolean; save: (c: CellSpec, v: number | undefined) => void }) {
  const { standards, settings } = useApp()
  const cur = vals?.get(cellId(cell))
  const [m, setM] = useState(cur !== undefined ? String(Math.floor(cur / 60)) : '')
  const [sec, setSec] = useState(cur !== undefined ? String(cur % 60) : '')
  const [fouls, setFouls] = useState('0')
  const total = m === '' && sec === '' ? undefined : longRunSeconds(Number(m || 0), Number(sec || 0), Number(fouls || 0))
  const band = total !== undefined ? lookup(standards, 'longRunWalk', lv, g, total) : null
  const commit = () => total !== cur && save(cell, total)
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      focusNext(e.currentTarget)
    }
  }
  return (
    <div className="space-y-2 rounded-2xl bg-fill p-2.5">
      <div className="grid grid-cols-3 gap-2">
        <label>
          <span className="label">분</span>
          <input ref={reg()} className="field bg-white text-lg font-bold" inputMode="numeric" value={m} disabled={disabled} onChange={(e) => setM(e.target.value.replace(/\D/g, ''))} onBlur={commit} onKeyDown={onKey} />
        </label>
        <label>
          <span className="label">초 (소수 버림)</span>
          <input ref={reg()} className="field bg-white text-lg font-bold" inputMode="decimal" value={sec} disabled={disabled} onChange={(e) => setSec(e.target.value.replace(/[^\d.]/g, ''))} onBlur={commit} onKeyDown={onKey} />
        </label>
        <label>
          <span className="label">파울 (+5초)</span>
          <input className="field bg-white text-lg font-bold" inputMode="numeric" value={fouls} disabled={disabled} onChange={(e) => setFouls(e.target.value.replace(/\D/g, ''))} onBlur={commit} />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-bold tabular-nums">{total !== undefined ? `${total}초로 기록` : '—'}</span>
        <GradeBadge band={band} points={band ? eventPoints(standards, 'longRunWalk', band, settings.papsFlexMode) : null} />
      </div>
    </div>
  )
}

const FLEX_PARTS = ['어깨', '몸통', '옆구리', '하체']

/** 종합유연성: 4부위 × 좌우 성공/실패 8개 → 자동 합산 */
function FlexInput({ cell, vals, lv, g, disabled, save }: { cell: CellSpec; vals: Map<string, number> | undefined; lv: string; g: 'M' | 'F'; disabled: boolean; save: (c: CellSpec, v: number | undefined) => void }) {
  const { standards, settings } = useApp()
  const cur = vals?.get(cellId(cell))
  const [ok, setOk] = useState<boolean[]>(() => Array.from({ length: 8 }, (_, i) => cur !== undefined && i < cur))
  const sum = ok.filter(Boolean).length
  const band = lookup(standards, 'totalFlexibility', lv, g, cur ?? sum)
  return (
    <div className="space-y-2 rounded-2xl bg-fill p-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        {FLEX_PARTS.map((p, pi) =>
          (['왼', '오'] as const).map((side, si) => {
            const i = pi * 2 + si
            return (
              <button
                key={`${p}${side}`}
                type="button"
                disabled={disabled}
                aria-pressed={ok[i]}
                className={`min-h-[48px] rounded-xl text-sm font-bold ${ok[i] ? 'bg-ok text-white' : 'bg-white text-ink-3'}`}
                onClick={() => setOk((o) => o.map((x, k) => (k === i ? !x : x)))}
              >
                {p} {side}
                <span className="block text-[0.7rem]">{ok[i] ? '성공' : '실패'}</span>
              </button>
            )
          }),
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">
          합계 {sum}점 {cur !== undefined && cur !== sum && <span className="text-sm text-ink-3">(저장된 값 {cur}점)</span>}
        </span>
        <GradeBadge band={band} points={band ? eventPoints(standards, 'totalFlexibility', band, settings.papsFlexMode) : null} />
      </div>
      <button type="button" className="btn btn-primary w-full" disabled={disabled || cur === sum} onClick={() => save(cell, sum)}>
        {cur === sum ? '저장됨' : `${sum}점으로 저장`}
      </button>
    </div>
  )
}
