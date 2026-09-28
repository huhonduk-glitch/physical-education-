import { parseRosterGrid, type GridParseResult } from './rosterGrid'

/**
 * 명렬 파일(.xlsx / .xls / .csv)을 표(글자 2차원 배열)로 읽는다.
 * 모든 칸을 "화면에 보이는 글자 그대로" 읽어서 반코드 '01'의 앞 0이 사라지지 않게 한다.
 * 엑셀 라이브러리는 파일을 올릴 때만 불러온다 (첫 화면을 가볍게).
 */

export type Grid = string[][]

export interface RosterFileResult extends GridParseResult {
  sheetName: string
}

export class RosterFileError extends Error {}

export async function readGridsFromFile(data: ArrayBuffer, fileName: string): Promise<{ name: string; grid: Grid }[]> {
  const XLSX = await import('xlsx')
  const lower = fileName.toLowerCase()
  let wb
  try {
    if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
      // CSV는 글자로 풀어서 읽는다. raw: true → '01'을 숫자 1로 바꾸지 않는다.
      wb = XLSX.read(decodeText(data), { type: 'string', raw: true })
    } else {
      wb = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: false })
    }
  } catch {
    throw new RosterFileError('파일을 열지 못했어요. 엑셀(.xlsx, .xls) 또는 CSV 파일인지 확인해 주세요.')
  }
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false, // 셀에 보이는 글자 그대로 (서식이 '텍스트'인 '01'은 '01')
      defval: '',
      blankrows: true,
    })
    return { name, grid: grid.map((r) => r.map((v) => (v == null ? '' : String(v)))) }
  })
}

/** 첫 번째로 헤더가 발견되는 시트를 명렬로 읽는다. */
export async function readRosterFile(data: ArrayBuffer, fileName: string): Promise<RosterFileResult> {
  const sheets = await readGridsFromFile(data, fileName)
  for (const s of sheets) {
    const parsed = parseRosterGrid(s.grid, '행', `${s.name}:`)
    if (parsed.header) return { ...parsed, sheetName: s.name }
  }
  throw new RosterFileError(
    '명렬 헤더를 찾지 못했어요. 표 위쪽에 "번호", "성명(이름)" 같은 제목 칸이 있는지 확인해 주세요.',
  )
}

/**
 * 한국어 윈도우 엑셀은 CSV를 EUC-KR(CP949)로 저장하는 경우가 많다.
 * UTF-8로 먼저 읽어 보고, 깨지면 EUC-KR로 다시 읽는다.
 */
export function decodeText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('euc-kr').decode(bytes)
  }
}
