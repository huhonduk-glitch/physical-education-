import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import type { ClassKey } from '../components/ClassPicker'
import { db } from '../db/db'
import { addRound, deleteRoundIfEmpty, loadRounds, setRoundDate } from '../db/papsRepo'
import { todayStr } from '../lib/dates'
import type { RoundInfo } from '../lib/papsRounds'
import { useApp } from './AppContext'

/**
 * 반마다 '지금 기록하는 회차' (B-5). PAPS 입력·붙여넣기·결과·스톱워치·왕복오래달리기가 모두 이 회차를 쓴다.
 * 고른 적 없으면 가장 늦은 회차. 기기 안(localStorage)에만 기억한다.
 */
const keyOf = (year: number, cls: ClassKey) => `pe.papsRound.${year}.${cls.grade}-${cls.classNo}`
const listeners = new Set<() => void>()
const subscribe = (f: () => void) => (listeners.add(f), () => listeners.delete(f))
const read = (k: string): string | null | undefined => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? undefined : v === '' ? null : v
  } catch {
    return undefined
  }
}
const write = (k: string, id: string | null) => {
  try {
    localStorage.setItem(k, id ?? '')
  } catch {
    /* 저장이 막힌 브라우저: 이번 화면에서만 */
  }
  listeners.forEach((f) => f())
}

export interface PapsRoundState {
  rounds: RoundInfo[]
  current: RoundInfo
  setCurrent: (id: string | null) => void
  /** 새 회차를 만들고 그 회차로 바꾼다 */
  add: (date?: string) => Promise<void>
  setDate: (r: RoundInfo, date: string) => Promise<void>
  /** 기록이 없는 회차만 지운다. 지웠으면 true */
  remove: (r: RoundInfo) => Promise<boolean>
}

const FIRST: RoundInfo = { id: null, round: 1, date: null, rowId: null }

export function usePapsRound(cls: ClassKey | null): PapsRoundState {
  const { settings } = useApp()
  const year = settings.schoolYear
  const rounds = useLiveQuery(() => (cls ? loadRounds(db, year, cls.grade, cls.classNo) : Promise.resolve([FIRST])), [year, cls?.grade, cls?.classNo]) ?? [FIRST]
  const k = cls ? keyOf(year, cls) : ''
  const chosen = useSyncExternalStore(subscribe, () => (k ? read(k) : undefined))
  const current = (chosen !== undefined && rounds.find((r) => r.id === chosen)) || rounds[rounds.length - 1]
  return {
    rounds,
    current,
    setCurrent: (id) => k && write(k, id),
    add: async (date = todayStr()) => {
      if (!cls) return
      const id = await addRound(db, year, cls.grade, cls.classNo, date)
      write(k, id)
    },
    setDate: (r, date) => (cls ? setRoundDate(db, year, cls.grade, cls.classNo, r, date) : Promise.resolve()),
    remove: async (r) => {
      if (!r.id) return false
      const ok = await deleteRoundIfEmpty(db, r.id)
      if (ok && chosen === r.id) write(k, null)
      return ok
    },
  }
}
