import { useSyncExternalStore } from 'react'

/**
 * PC 왼쪽 하위 메뉴 열기 · 닫기 (2026-11-05 교사 요청: "사이드바처럼 접어서 본문을 크게").
 * 이 기기 브라우저에만 기억한다(학생 정보 아님). 묶음별 접기도 같이 기억한다.
 */
const OPEN_KEY = 'pelog.sideOpen'
const FOLD_KEY = 'pelog.sideFolded'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* 저장이 막힌 브라우저: 이번만 */
  }
  emit()
}

export function useSideOpen(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(subscribe, () => read(OPEN_KEY) !== '0', () => true)
  return [v, (open) => write(OPEN_KEY, open ? '1' : '0')]
}

/** 접은 묶음 이름들 ('큰메뉴/묶음') */
export function useFolded(): [Set<string>, (key: string) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(FOLD_KEY) ?? '', () => '')
  const set = new Set(raw ? raw.split('\n') : [])
  const toggle = (key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    write(FOLD_KEY, [...next].join('\n'))
  }
  return [set, toggle]
}
