import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ChangeList } from '../components/WhatsNew'
import { loadChangelog, type ChangeEntry } from '../lib/changelog'

/** 더보기 → 업데이트 소식: 지금까지 바뀐 것 전부 */
export default function ChangelogPage() {
  const [list, setList] = useState<ChangeEntry[] | null>(null)
  useEffect(() => {
    void loadChangelog(import.meta.env.BASE_URL, false).then(setList)
  }, [])
  return (
    <>
      <PageHeader title="업데이트 소식" sub="줄을 누르면 그 화면으로 가요" back />
      <div className="page pb-10">
        <div className="card">{list === null ? <p className="hint">불러오는 중…</p> : <ChangeList entries={list} linkable />}</div>
      </div>
    </>
  )
}
