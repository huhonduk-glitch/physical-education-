import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'
import { db } from '../db/db'
import { useApp } from '../state/AppContext'

export default function ClassPage() {
  const { settings } = useApp()
  const count = useLiveQuery(() => db.students.where('schoolYear').equals(settings.schoolYear).count(), [settings.schoolYear])
  return (
    <>
      <PageHeader title="수업" />
      {count === 0 && (
        <div className="p-4 pb-0">
          <div className="card border-brand bg-brand-light">
            <p className="text-lg font-bold">먼저 학생 명렬을 올려 주세요</p>
            <p className="hint mt-1">나이스 명렬 엑셀을 올리거나, 명단을 복사해서 붙여넣으면 돼요.</p>
            <Link to="/students/import" className="btn btn-primary mt-3 w-full">
              명렬 올리기
            </Link>
          </div>
        </div>
      )}
      <ComingSoon
        phase={2}
        items={['번호 카드를 눌러 바로 기록 (미준비 · 솔선수범 · 견학 · 관찰)', '여러 명 한꺼번에 기록', '실행취소', '체육부장 관리']}
      />
    </>
  )
}
