import ComingSoon from '../components/ComingSoon'
import NeisGuide from '../components/NeisGuide'
import PageHeader from '../components/PageHeader'

export default function PapsPage() {
  return (
    <>
      <PageHeader title="PAPS" />
      <ComingSoon phase={4} items={['측정 기록 입력 · 붙여넣기', '자동 등급과 점수', '나이스 업로드 파일 내보내기']} />
      <div className="page pb-4">
        <NeisGuide kind="paps" />
      </div>
    </>
  )
}
