import rosterSampleUrl from '../../references/neis-roster-sample.xlsx.xlsx?url'
import papsTemplateUrl from '../../references/neis-paps-template.xlsx.xlsx?url'
import { NEIS_PAPS_MENU_PATH } from '../data/neisGuide'

/**
 * 나이스에서 파일을 받는 경로 + 교사가 올려 둔 참고용 양식 내려받기.
 * 참고용 파일은 가명 샘플이다 (실제 학생 정보 없음).
 */
const FILES = {
  roster: {
    what: '학생명렬표',
    url: rosterSampleUrl,
    fileName: '참고용_나이스_학생명렬표(가명).xlsx',
    label: '참고용 명렬표 양식 받기',
  },
  paps: {
    what: 'PAPS 일괄업로드 양식',
    url: papsTemplateUrl,
    fileName: '참고용_나이스_PAPS일괄업로드양식(가명).xlsx',
    label: '참고용 PAPS 일괄업로드 양식 받기',
  },
} as const

/**
 * 한글 파일 이름이 그대로 붙도록 파일을 한 번 읽어서 내려받게 한다.
 * (앱에 미리 저장된 파일이라 인터넷이 없어도 된다.) 실패하면 기본 링크 동작에 맡긴다.
 */
async function downloadAs(e: React.MouseEvent<HTMLAnchorElement>, url: string, fileName: string) {
  e.preventDefault()
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blobUrl = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  } catch {
    location.href = url
  }
}

export default function NeisGuide({ kind }: { kind: 'roster' | 'paps' }) {
  const f = FILES[kind]
  return (
    <div className="space-y-3 rounded-xl border-2 border-zinc-200 bg-zinc-50 p-3">
      <p className="font-bold">📍 나이스에서 {f.what} 받는 곳</p>
      <ol className="flex flex-wrap items-center gap-1 text-[0.95rem]" aria-label="나이스 메뉴 경로">
        {NEIS_PAPS_MENU_PATH.map((step, i) => (
          <li key={step} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-zinc-500">›</span>}
            <span className="rounded-md bg-white px-2 py-1 font-bold ring-1 ring-zinc-300">{step}</span>
          </li>
        ))}
      </ol>
      <a href={f.url} download={f.fileName} className="btn btn-outline w-full" onClick={(e) => downloadAs(e, f.url, f.fileName)}>
        ⬇️ {f.label}
      </a>
      <p className="hint">참고용 양식은 이름을 가명으로 바꾼 샘플이에요. 실제 파일은 나이스에서 받아 주세요.</p>
    </div>
  )
}
