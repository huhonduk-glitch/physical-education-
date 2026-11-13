import BottomSheet from './BottomSheet'
import { when, type Action, type AskReason } from '../state/driveSync'

/**
 * 구글 동기화: 덮어쓰면 기록이 사라질 때 먼저 묻는 창 (2026-11-13).
 *  - remote: 올리려는데 구글 사본이 다른 기기에서 더 새로 바뀜
 *  - local: 내려받으려는데 이 기기에 아직 안 올린 기록이 있음
 *  - both: 양쪽 모두 바뀜 → 둘 다 살리기(합쳐서 올리기)를 권함
 */
export default function SyncAskSheet({ reason, remoteAt, busy, onChoose, onClose }: { reason: AskReason; remoteAt?: string; busy: boolean; onChoose: (a: Action) => void; onClose: () => void }) {
  const other = remoteAt ? `다른 기기에서 ${when(remoteAt)}에 구글 사본을 바꿨어요.` : '다른 기기에서 구글 사본을 바꿨어요.'
  const opts: { action: Action; label: string; desc: string; tone: 'primary' | 'soft' }[] =
    reason === 'remote'
      ? [
          { action: 'down', label: '구글에서 내려받기', desc: '구글 사본으로 이 기기를 바꿔요(이 기기엔 안 올린 기록이 없어요).', tone: 'primary' },
          { action: 'up', label: '그래도 이 기기 것으로 올리기', desc: '다른 기기가 올린 기록이 구글에서 사라져요.', tone: 'soft' },
        ]
      : reason === 'local'
        ? [
            { action: 'up', label: '이 기기 것으로 올리기', desc: '구글 사본을 이 기기 자료로 바꿔요(구글 쪽은 그 뒤 바뀐 게 없어요).', tone: 'primary' },
            { action: 'down', label: '그래도 구글에서 내려받기', desc: '이 기기의 안 올린 기록이 사라져요(바꾸기 전 자료는 [자동 백업]에 남아요).', tone: 'soft' },
          ]
        : [
            { action: 'merge', label: '둘 다 살리기', desc: '구글 사본을 이 기기에 합친 뒤 올려요. 같은 기록은 하나로 합쳐요. 한쪽에서 지운 기록은 다시 생길 수 있어요.', tone: 'primary' },
            { action: 'up', label: '이 기기 것으로 올리기', desc: '다른 기기가 올린 기록이 구글에서 사라져요.', tone: 'soft' },
            { action: 'down', label: '구글 것으로 내려받기', desc: '이 기기의 안 올린 기록이 사라져요(바꾸기 전 자료는 [자동 백업]에 남아요).', tone: 'soft' },
          ]
  const title = reason === 'remote' ? '구글 사본이 더 새로워요' : reason === 'local' ? '아직 안 올린 기록이 있어요' : '양쪽 모두 바뀌었어요'
  const sub =
    reason === 'remote'
      ? `${other} 지금 올리면 그 기록이 구글에서 사라져요.`
      : reason === 'local'
        ? '이 기기에서 마지막으로 맞춘 뒤 바뀐 기록이 있어요. 내려받으면 이 기기 자료가 구글 사본으로 바뀌어요.'
        : `${other} 이 기기에도 아직 안 올린 기록이 있어요.`
  return (
    <BottomSheet title={title} sub={sub} onClose={onClose}>
      <div className="space-y-2">
        {opts.map((o) => (
          <button key={o.action} type="button" className={`btn ${o.tone === 'primary' ? 'btn-primary' : 'btn-soft'} h-auto w-full flex-col items-start gap-0.5 py-3 text-left`} disabled={busy} onClick={() => onChoose(o.action)}>
            <span className="text-[1.05rem] font-extrabold">
              {o.label}
              {o.tone === 'primary' ? ' (추천)' : ''}
            </span>
            <span className={`text-sm font-semibold ${o.tone === 'primary' ? 'text-white/90' : 'text-ink-3'}`}>{o.desc}</span>
          </button>
        ))}
        <button type="button" className="btn btn-ghost w-full text-ink-3" disabled={busy} onClick={onClose}>
          취소 (아무것도 안 바꿈)
        </button>
      </div>
    </BottomSheet>
  )
}
