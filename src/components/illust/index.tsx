import type { ReactElement } from 'react'
import { NbDistance, NbNoContact, NbNoDribble, NbThreeSec, NbZones } from './netball'

/**
 * 핵심 규칙 삽화 등록부 (2026-11-03). sportKeys.ts의 KeyRule.illust가 이 이름을 가리킨다.
 * 삽화가 있으면 규칙 카드 · 한 장 그림 · 슬라이드 · PPT 모두 삽화를 쓰고, 없으면 예전 도식(RuleVisual).
 */
export const ILLUST = {
  nbNoContact: NbNoContact,
  nbDistance: NbDistance,
  nbNoDribble: NbNoDribble,
  nbZones: NbZones,
  nbThreeSec: NbThreeSec,
} satisfies Record<string, () => ReactElement>
export type IllustId = keyof typeof ILLUST

export function Illust({ id }: { id: IllustId }) {
  const C = ILLUST[id]
  return <C />
}
