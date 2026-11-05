import { useCallback, useEffect, useState } from 'react'
import { SpaceError, listItems, type SpaceCol, type SpaceRow } from '../lib/space'
import { useApp } from './AppContext'

/** 공유 공간 한 묶음 읽기: 열 때 · 30초마다 · [새로고침]. 연결 안 했으면 conn = null */
export function useSpace<T>(col: SpaceCol) {
  const { settings } = useApp()
  const conn = settings.space
  const [rows, setRows] = useState<SpaceRow<T>[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    if (!conn) return
    setBusy(true)
    try {
      setRows(await listItems<T>(conn, col))
      setErr('')
    } catch (e) {
      setErr(e instanceof SpaceError ? e.message : '불러오지 못했어요.')
    } finally {
      setBusy(false)
    }
  }, [conn, col])
  useEffect(() => {
    void reload()
    const t = setInterval(() => document.visibilityState === 'visible' && void reload(), 30_000)
    return () => clearInterval(t)
  }, [reload])
  return { conn, rows, err, busy, reload }
}
