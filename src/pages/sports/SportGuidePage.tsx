import { Link, Navigate, useParams } from 'react-router-dom'
import Collapse from '../../components/Collapse'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { sportOf } from '../../data/sports'
import { REF_BOARDS } from '../../data/refCalls'
import { SPORT_KEYS } from '../../data/sportKeys'
import { FigureView, KeyVisual } from './SlideView'

/** 종목 한 개: 공식 규칙서를 줄인 요약. 줄마다 조항, 맨 아래 출처(규칙서 판) */
export default function SportGuidePage() {
  const { sport = '' } = useParams()
  const s = sportOf(sport)
  if (!s) return <Navigate to="/sports" replace />
  return (
    <>
      <PageHeader title={`${s.emoji} ${s.name}`} sub={s.summary} back />
      <div className="page space-y-3 pb-10">
        <Link to={`/sports/${s.id}/slides`} className="flex min-h-[64px] items-center gap-3 rounded-3xl bg-brand px-5 text-white shadow-[var(--shadow-float)] active:scale-[0.99]">
          <Icon name="play" />
          <span className="min-w-0 flex-1">
            <b className="block">슬라이드로 보기 · PPT로 받기</b>
            <span className="text-sm font-semibold text-white/85">빔 화면에 띄워 수업 · 경기장 그림 · 사진 포함</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
        {REF_BOARDS[s.id] && (
          <Link to={`/sports/${s.id}/referee`} className="flex min-h-[56px] items-center gap-3 rounded-3xl bg-white px-5 shadow-[var(--shadow-card)] active:scale-[0.99]">
            <Icon name="flag" className="text-brand" />
            <span className="min-w-0 flex-1">
              <b className="block">보조심판</b>
              <span className="text-sm font-semibold text-ink-3">판정 버튼 · 점수 · 팀 파울 · AI에게 묻기</span>
            </span>
            <Icon name="chevronRight" className="text-ink-3" />
          </Link>
        )}
        {SPORT_KEYS[s.id] && (
          <section className="space-y-2">
            <p className="card-title px-1">{s.name.replace(/\s*\(.*\)\s*$/, '')}다운 핵심 규칙</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SPORT_KEYS[s.id].keys.map((k, i) => (
                <li key={k.title} className="overflow-hidden rounded-3xl bg-[#000] text-white shadow-[var(--shadow-card)]">
                  <div className="p-2">
                    <KeyVisual k={k} />
                  </div>
                  <div className="px-4 pb-4">
                    <p className="text-lg font-black">
                      <span className="mr-1.5 text-[#2997ff]">{i + 1}</span>
                      {k.title}
                    </p>
                    <p className="mt-1 leading-relaxed font-semibold text-white/90">{k.line}</p>
                    {k.why && <p className="mt-1 text-sm leading-relaxed text-[#a1a1a6]">{k.why}</p>}
                    <p className="mt-1.5 text-xs font-bold text-[#86868b]">[{k.ref}]</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="hint px-1">공식 규칙서를 직접 읽고 쉬운 말로 줄였어요. 작은 글씨 [ ]가 규칙서 조항이에요. 학교 수업에서는 시간 · 점수를 줄여 써도 돼요.</p>
        {s.sections.map((sec, i) => (
          <Collapse key={sec.title} title={<b className="text-ink">{sec.title}</b>} sub={`${sec.items.length}가지`} defaultOpen={i < 2} className="card px-2 py-1">
            {sec.lead && <p className="mx-2 mb-2 rounded-2xl bg-brand-light p-3 font-bold text-brand-ink">{sec.lead}</p>}
            {sec.specs && sec.specs.length > 0 && (
              <table className="mx-2 mb-2 w-[calc(100%-1rem)] text-left text-sm">
                <tbody>
                  {sec.specs.map((sp) => (
                    <tr key={sp.label} className="border-b border-line">
                      <th className="py-1.5 pr-2 font-bold text-ink-2">{sp.label}</th>
                      <td className="py-1.5 font-extrabold tabular-nums">
                        {sp.value}
                        {sp.ref && <span className="ml-1 text-xs font-bold text-ink-3">[{sp.ref}]</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sec.figure && (
              <div className="mx-2 mb-2">
                <FigureView figure={sec.figure} compact />
              </div>
            )}
            <ul className="space-y-2 px-2 pb-3">
              {sec.items.map((it) => (
                <li key={it.t} className="flex gap-2 leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="min-w-0 flex-1">
                    {it.t}
                    {it.ref && <span className="ml-1 whitespace-nowrap text-xs font-bold text-ink-3">[{it.ref}]</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Collapse>
        ))}

        {s.bracket && (
          <section className="card space-y-3">
            <p className="card-title">
              <Icon name="medal" className="mr-1 inline text-brand" size={20} />
              {s.name} 리그전 · 토너먼트 만들기
            </p>
            <p className="hint">SPORTS BRACKET(팀 편성 · 대진표 앱)에서 만들어요. 아래 순서대로 고르면 돼요.</p>
            <ol className="space-y-2">
              <li className="rounded-2xl bg-fill p-3">
                <b>① 명단 보내기</b>
                <span className="block text-sm text-ink-2">수업반 명단을 복사해 [팀편성] 탭의 일괄 입력에 붙여 넣고 팀을 나눠요.</span>
              </li>
              <li className="rounded-2xl bg-fill p-3">
                <b>② [대회설정] 탭</b>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                  <li>
                    방식: <b className="text-ink">{s.bracket.formats}</b>
                  </li>
                  <li>
                    스코어 방식: <b className="text-ink">{s.bracket.scoreMode}</b>
                  </li>
                  <li>
                    승점(리그전): 승 <b className="text-ink">{s.bracket.points.win}</b> · 무 <b className="text-ink">{s.bracket.points.draw}</b> · 패 <b className="text-ink">{s.bracket.points.loss}</b>
                    <span className="block text-xs text-ink-3">{s.bracket.pointsNote}</span>
                  </li>
                  <li>
                    득점자 기록: <b className="text-ink">{s.bracket.scorer ? '켜기' : '끄기'}</b>
                  </li>
                </ul>
              </li>
              <li className="rounded-2xl bg-fill p-3">
                <b>③ 알아 둘 것</b>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                  {s.bracket.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </li>
            </ol>
            <Link to="/tools/apps" className="btn btn-primary w-full">
              <Icon name="share" /> 반 명단 보내기 · SPORTS BRACKET 열기
            </Link>
          </section>
        )}

        <section className="card space-y-2">
          <p className="card-title">출처</p>
          <ul className="space-y-2">
            {s.sources.map((src) => (
              <li key={src.url} className="text-sm leading-snug">
                <a href={src.url} target="_blank" rel="noreferrer" className="font-bold text-brand underline">
                  {src.label}
                </a>
                <span className="block text-ink-3">{src.edition}</span>
              </li>
            ))}
          </ul>
          <p className="hint">규칙은 바뀔 수 있어요. 대회에 나갈 때는 그 대회 요강과 최신 규칙서를 확인하세요. 링크는 누를 때만 열려요(앱이 미리 불러오지 않음).</p>
        </section>
      </div>
    </>
  )
}
