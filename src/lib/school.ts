import type { SchoolLevel } from '../db/types'

/** 학교급에 따라 고를 수 있는 학년 */
export function gradesFor(level: SchoolLevel): number[] {
  return level === '초' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]
}

/** 반 고르기 목록 (1~20반) */
export const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

/**
 * 브라우저가 저장 공간이 부족할 때 이 앱 데이터를 멋대로 지우지 않도록 요청한다.
 * 지원하지 않는 브라우저에서는 조용히 넘어간다.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* 무시 */
  }
  return false
}
