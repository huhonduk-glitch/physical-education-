import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function TimerPage() {
  return (
    <>
      <PageHeader title="타이머" />
      <ComingSoon
        phase={3}
        items={['스톱워치 (랩을 학생 번호에 연결)', '카운트다운 · 인터벌', '전체화면 큰 숫자', 'PAPS 측정 보조 (신호음·메트로놈)']}
      />
    </>
  )
}
