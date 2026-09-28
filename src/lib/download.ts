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
