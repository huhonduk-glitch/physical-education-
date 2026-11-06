/**
 * 날씨 위치 정하기 (2026-11-06 교사 요청: 선생님마다 학교 위치가 다르니 자동으로, 아니면 손으로).
 * - 손으로: 시도 → 시군구 (기상청 공식 격자표 `src/data/kmaGrid.ts`)
 * - 자동: 나이스 학교 주소(이미 불러온 학교) 또는 [현재 위치로] → 가까운 시군구
 * - 미세먼지 측정소: 그 시군구의 읍면동 이름과 같은 측정소를 먼저 추천
 * 순수 함수만. 위도 · 경도는 저장하지 않는다.
 */
import { KMA_GRID } from '../data/kmaGrid'

export type GridRow = (typeof KMA_GRID)[number]

/** 격자표 시도 이름 (표 순서) */
export const GRID_SIDO: string[] = [...new Set(KMA_GRID.map((r) => r.s))]

export function sigunguOf(sido: string): GridRow[] {
  return KMA_GRID.filter((r) => r.s === sido)
}

export function rowOf(sido: string, sigungu: string): GridRow | undefined {
  return KMA_GRID.find((r) => r.s === sido && r.g === sigungu)
}

/** 2026 통합 전 옛 광주광역시 구 — 에어코리아는 아직 '광주' · '전남'을 나눈다 */
const OLD_GWANGJU = new Set(['동구', '서구', '남구', '북구', '광산구'])

const AIR_SIDO: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
}

/** 격자표 시도 → 에어코리아 시도 이름 */
export function airSido(row: Pick<GridRow, 's' | 'g'>): string {
  if (row.s.startsWith('전남광주')) return OLD_GWANGJU.has(row.g) ? '광주' : '전남'
  return AIR_SIDO[row.s] ?? ''
}

/** 주소에 쓰이는 시도 이름(옛 이름 · 줄임 포함) → 격자표 시도 */
const SIDO_ALIAS: [RegExp, string][] = [
  [/^서울/, '서울특별시'],
  [/^부산/, '부산광역시'],
  [/^대구/, '대구광역시'],
  [/^인천/, '인천광역시'],
  [/^(광주|전남|전라남도|전남광주)/, '전남광주통합특별시'],
  [/^대전/, '대전광역시'],
  [/^울산/, '울산광역시'],
  [/^세종/, '세종특별자치시'],
  [/^경기/, '경기도'],
  [/^강원/, '강원특별자치도'],
  [/^(충북|충청북도)/, '충청북도'],
  [/^(충남|충청남도)/, '충청남도'],
  [/^(전북|전라북도)/, '전북특별자치도'],
  [/^(경북|경상북도)/, '경상북도'],
  [/^(경남|경상남도)/, '경상남도'],
  [/^제주/, '제주특별자치도'],
]

const squash = (s: string) => s.replace(/\s+/g, '')
/** '이도2동' · '연동' → '이도동' · '연동' (숫자 동을 한 이름으로) */
const dongBase = (s: string) => s.replace(/\d+(가)?동$/, '동').replace(/제(\d)/, '$1')

/** 나이스 학교 주소(도로명) → 시군구 줄. 못 찾으면 시도까지만 */
export function placeFromAddress(addr: string): { row?: GridRow; sido?: string } {
  const a = addr.trim()
  if (!a) return {}
  const sido = SIDO_ALIAS.find(([re]) => re.test(a))?.[1]
  if (!sido) return {}
  const rows = sigunguOf(sido)
  if (rows.length === 1) return { row: rows[0], sido }
  const rest = squash(a.replace(/^\S+/, ''))
  // 가장 긴 이름부터 (수원시장안구가 수원시보다 먼저)
  const byName = [...rows].sort((x, y) => y.g.length - x.g.length).find((r) => r.g && rest.startsWith(squash(r.g)))
  if (byName) return { row: byName, sido }
  // 구 이름이 바뀐 곳(인천 2026 등): 주소 괄호 속 동 이름으로
  const dongs = [...a.matchAll(/\(([^)]+)\)/g)].flatMap((m) => m[1].split(/[,\s]+/)).map(dongBase)
  const byDong = rows.find((r) => r.d.some((d) => dongs.includes(dongBase(d))))
  return { row: byDong, sido }
}

/** 격자 번호 → 가장 가까운 시군구 줄 */
export function placeFromGrid(nx: number, ny: number): GridRow {
  let best = KMA_GRID[0]
  let bd = Infinity
  for (const r of KMA_GRID) {
    const d = (r.x - nx) ** 2 + (r.y - ny) ** 2
    if (d < bd) {
      bd = d
      best = r
    }
  }
  return best
}

/** 측정소 추천: 그 시군구 읍면동과 이름이 같은 측정소 → 시군구 이름이 들어간 측정소 */
export function suggestStation(stations: readonly string[], row: GridRow | undefined): string {
  if (!row || !stations.length) return ''
  const ds = new Set(row.d.map(dongBase))
  const byDong = stations.find((s) => ds.has(dongBase(s)))
  if (byDong) return byDong
  const core = row.g.replace(/(시|군|구)$/, '').replace(/^.*시/, '')
  return (core && stations.find((s) => s.includes(core))) || ''
}
