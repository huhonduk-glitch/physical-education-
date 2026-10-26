import { COMCI_RELAY_DEFAULT } from './comcigan'
import { neisKeyOf } from './neisOpenApi'

/** 나이스에 물을 때 쓸 키: 선생님 인증키, 없으면 중계의 공용 키 (2026-10-27) */
export const neisKey = (s: { neisApiKey: string; comciRelayUrl: string }) => neisKeyOf(s.neisApiKey, s.comciRelayUrl || COMCI_RELAY_DEFAULT)
