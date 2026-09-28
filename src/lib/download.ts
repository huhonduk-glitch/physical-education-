/** 파일 내려받기 (한글 파일 이름 유지). 기기 밖 서버로 보내는 것이 아니라 이 기기에 저장한다. */
export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function saveText(fileName: string, text: string, type = 'text/plain;charset=utf-8'): void {
  saveBlob(fileName, new Blob([text], { type }))
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 오래된 브라우저·권한 문제: 숨긴 입력칸으로 복사
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** 표 → xlsx 파일 내려받기 (글자는 글자로, 숫자는 숫자로) */
export async function saveXlsx(fileName: string, sheets: { name: string; rows: (string | number | null)[][]; widths?: number[] }[]): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map((v) => (v === null ? '' : v))))
    if (s.widths) ws['!cols'] = s.widths.map((w) => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  saveBlob(fileName, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}
