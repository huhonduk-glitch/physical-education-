import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { CLAUDE_MODEL } from '../lib/aiPolish'

/** 세특 AI 연결 방법 · 주의사항 (6-5 ③). 회사 화면은 바뀔 수 있어서 메뉴 이름 위주로 적는다 */
export default function AiGuidePage() {
  return (
    <>
      <PageHeader title="AI 연결 방법" sub="세특 쓰기 · 주의사항" back />
      <div className="page space-y-4 pb-10">
        <section className="space-y-2 rounded-2xl bg-danger-light p-4 text-danger">
          <p className="text-lg font-extrabold">먼저 꼭 읽어 주세요</p>
          <ul className="list-disc space-y-1.5 pl-5 font-semibold">
            <li>
              <b>책임은 작성한 선생님 본인에게 있어요.</b> AI 도움을 받아 쓴 생기부의 내용 · 허위 · 과장 · 금지 사항 위반에 대한 책임은 모두 작성 교사에게 있어요. 이 앱과 AI 회사는 책임지지 않아요.
            </li>
            <li>
              <b>AI 글을 그대로 입력하면 안 돼요.</b> 「2026학년도 학교생활기록부 기재요령」 총칙 5-다: AI로 생성한 자료를 서술형 항목에 그대로 입력하는 행위는 금지예요. 윤문 등 보조로 쓸 때는 최종 입력 전에 허위 · 과장 여부와 기재요령 유의사항을 꼭 확인해야 해요. 그래서 이 앱은 AI 글을 한 글자도 안 고치면 확정할 수 없어요.
            </li>
            <li>
              <b>개인정보에 유의하세요.</b> AI를 쓰면 학생 이름 · 과목 · 근거 기록이 AI 회사 서버로 보내져요. 학교 · 교육청의 개인정보 · 생성형 AI 활용 지침을 먼저 확인하고, 허용된 범위에서만 쓰세요. 주민번호 · 연락처 · 건강 정보 · 가정 형편 같은 민감한 내용은 근거 기록에 적지 마세요.
            </li>
            <li>
              <b>무료 AI는 입력한 내용이 학습에 쓰일 수 있어요.</b> 무료 챗봇 · 무료 모델은 회사 정책에 따라 입력 내용을 저장하거나 모델 학습에 쓸 수 있어요. 학생 이름은 빼고 쓰는 것이 안전해요.
            </li>
            <li>
              <b>키는 비밀번호와 같아요.</b> 다른 사람과 나누지 말고, 공용 PC에 넣지 마세요. 앱은 키를 이 기기에만 저장하고 백업 파일에도 넣지 않아요. 키가 새어 나갔다면 바로 회사 사이트에서 지우세요.
            </li>
          </ul>
        </section>

        <Way
          title="① 키 없이 (무료) — 처음이라면 이것부터"
          sub="돈이 들지 않아요 · 앱은 인터넷을 쓰지 않아요"
          steps={[
            <>세특 쓰기 → [AI 연결]에서 <b>키 없이(무료)</b>를 고르세요.</>,
            <>학생을 눌러 편집 창을 열고 [AI 초안 요청문 복사] 또는 [다듬기 요청문 복사]를 누르세요.</>,
            <>무료 챗봇 웹사이트(예: ChatGPT · Gemini · Claude)에 로그인해 새 대화에 붙여 넣고 보내세요.</>,
            <>챗봇의 답을 복사해 앱의 [챗봇의 답 붙여 넣기] 칸에 넣고 [확인] → [받아 쓰기].</>,
            <>선생님 문장으로 고치고, 확인 4개를 체크한 뒤 [확정].</>,
          ]}
          images={[{ src: 'app-ai-setup.png', caption: '세특 쓰기 → [AI 연결 · 내 문체 예시]를 펼친 모습 (시연 모드)' }]}
          tips={['챗봇 설정에서 「대화 기록을 학습에 사용」을 끌 수 있으면 꺼 두세요.', '학생 이름을 빼고 싶으면 붙여 넣은 요청문에서 이름 줄을 지우고 보내도 돼요.']}
        />

        <Way
          title="② OpenRouter — 원하는 모델 · 무료 모델도"
          sub="여러 회사 모델을 한 키로 · 무료 모델은 하루 사용량 제한"
          steps={[
            <>
              openrouter.ai 에 접속해 [Sign in]으로 가입하세요(구글 계정 가능).
            </>,
            <>오른쪽 위 계정 메뉴 → <b>Keys</b>(API Keys) → <b>Create Key</b>. 이름(예: PE LOG)을 적고 만들면 sk-or-로 시작하는 키가 한 번만 보여요. 바로 복사해 두세요.</>,
            <>무료 모델만 쓸 거면 충전하지 않아도 돼요. 유료 모델을 쓰려면 <b>Credits</b>에서 충전하세요(적은 금액부터).</>,
            <>앱 세특 쓰기 → [AI 연결] → <b>OpenRouter</b> → 키 붙여 넣고 [키 저장].</>,
            <>[모델 목록 불러오기] → 「무료만」을 켜면 무료 모델이, 끄면 값과 함께 모든 모델이 나와요. 하나를 누르면 그 모델로 써요.</>,
          ]}
          images={[
            { src: 'openrouter-signin.png', caption: 'openrouter.ai 로그인 화면 — GitHub · Google 계정 또는 이메일' },
            { src: 'openrouter-free-models.png', caption: 'openrouter.ai/models 에서 가격을 FREE로 두면 보이는 무료 모델 (목록은 자주 바뀜)' },
          ]}
          tips={['무료 모델 목록은 자주 바뀌어요. 안 되면 다른 무료 모델을 고르세요.', '무료 모델은 하루 요청 수가 적어요(사용량 제한). 한 반을 한 번에 쓰기보다 나눠 쓰세요.', '값은 「100만 토큰당 달러」예요. 세특 한 명은 대략 수천 토큰이에요.']}
        />

        <Way
          title={`③ Claude API (Anthropic) — ${CLAUDE_MODEL}`}
          sub="품질이 가장 좋은 편 · 쓴 만큼 요금"
          steps={[
            <>platform.claude.com (Claude Console, 예전 주소 console.anthropic.com)에 접속해 가입 · 로그인하세요.</>,
            <>
              <b>Billing</b>(결제)에서 크레딧을 충전하세요. 충전이 없으면 키가 있어도 오류가 나요.
            </>,
            <>
              <b>API Keys</b> → <b>Create Key</b>. 이름을 적고 만들면 sk-ant-로 시작하는 키가 한 번만 보여요. 바로 복사하세요.
            </>,
            <>앱 세특 쓰기 → [AI 연결] → <b>Claude</b> → 키 붙여 넣고 [키 저장].</>,
          ]}
          images={[{ src: 'claude-console-signin.png', caption: 'Claude Console 로그인 화면 — Google 계정 또는 이메일' }]}
          tips={['요청이 정책상 거절되면 회사 서버가 다른 Claude 모델로 이어 받도록 설정해 두었어요.', '사용량 · 요금은 콘솔의 Usage(사용량)에서 볼 수 있어요. 월 한도도 정할 수 있어요.']}
        />

        <section className="card space-y-2">
          <p className="card-title">앱 안에서의 순서</p>
          <ol className="list-decimal space-y-1 pl-5 text-ink-2">
            <li>근거 기록 확인 → [기록으로 틀 초안 넣기](기기 안, 인터넷 안 씀)</li>
            <li>[AI 초안] 또는 선생님이 쓴 글에 [AI로 다듬기]</li>
            <li>[받아 쓰기] → 선생님 문장으로 고치기 (한 글자도 안 고치면 확정 안 됨)</li>
            <li>기재요령 검사(빨강 = 고쳐야 함, 노랑 = 확인) 확인</li>
            <li>확인 4개 체크 → [확정] → [나이스용 복사] 또는 엑셀</li>
          </ol>
          <p className="hint">[AI 연결] 아래 「내 문체 예시」에 선생님이 잘 쓴 세특을 몇 개 넣어 두면 AI가 그 문장 구성 · 어휘 · 길이를 따라 해요(예시의 내용은 가져오지 않아요).</p>
          <Link to="/seteuk/write" className="btn btn-primary w-full">
            세특 쓰기로
          </Link>
        </section>
        <p className="hint px-1">회사 사이트의 메뉴 이름 · 위치는 바뀔 수 있어요. 안 보이면 사이트 안에서 「API key」를 찾아보세요. 로그인한 뒤의 화면(키 만들기)은 계정마다 달라 사진 대신 메뉴 이름으로 적었어요. 사진: 각 사이트의 공개 화면을 2026년 10월에 직접 캡처.</p>
      </div>
    </>
  )
}

const img = (name: string) => `${import.meta.env.BASE_URL}guide/${name}`

function Way({ title, sub, steps, tips, images = [] }: { title: string; sub: string; steps: ReactNode[]; tips: string[]; images?: { src: string; caption: string }[] }) {
  return (
    <section className="card space-y-3">
      <div>
        <p className="card-title">{title}</p>
        <p className="hint">{sub}</p>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      {images.map((m) => (
        <figure key={m.src} className="space-y-1">
          <img src={img(m.src)} alt={m.caption} loading="lazy" className="w-full rounded-xl border border-line" />
          <figcaption className="hint text-center">{m.caption}</figcaption>
        </figure>
      ))}
      <ul className="space-y-1 rounded-xl bg-fill px-3 py-2 text-sm text-ink-2">
        {tips.map((t) => (
          <li key={t} className="flex gap-1.5">
            <Icon name="info" size={16} className="mt-0.5 shrink-0 text-brand" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
