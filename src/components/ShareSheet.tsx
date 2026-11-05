import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { copyText, saveText } from '../lib/download'
import { SHARE_LABEL, encodePack, hasStudentInfo, shareFileName, shareLink, type SharePack } from '../lib/share'

/**
 * 보내기 창 (같이 쓰기 6-13): 링크 복사 · 파일 받기 · 다른 앱으로 보내기.
 * 링크의 자료는 주소 # 뒤에 있어 서버로 가지 않는다. 학생 정보는 들어가지 않는다(점수 · 수업반 · 진도 뺌).
 */
export default function ShareSheet({ pack, onClose }: { pack: SharePack; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const blocked = hasStudentInfo(pack)
  useEffect(() => {
    void encodePack(pack).then(setCode)
  }, [pack])
  const link = code ? shareLink(location.href, code) : ''
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <BottomSheet title={`${SHARE_LABEL[pack.type]} 보내기`} sub={pack.name} onClose={onClose}>
      <div className="space-y-3 px-5 pb-5">
        <p className="rounded-2xl bg-ok-light px-4 py-3 text-sm font-bold text-ok">
          ✓ 학생 정보(이름 · 점수 · 수업반 · 진도)는 빼고 틀만 보내요. 받는 선생님이 자기 수업반을 골라 넣어요.
        </p>
        {blocked ? (
          <p className="rounded-2xl bg-danger-light px-4 py-3 font-bold text-danger">학생 정보로 보이는 칸이 있어 보낼 수 없어요.</p>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={!link}
              onClick={async () => setMsg((await copyText(link)) ? '링크를 복사했어요. 메신저에 붙여 보내세요. 받는 선생님이 누르면 PE LOG가 열려요.' : '복사하지 못했어요. 파일로 받아 보내 주세요.')}
            >
              <Icon name="copy" size={18} /> 링크 복사
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-outline" onClick={() => saveText(shareFileName(pack), JSON.stringify(pack, null, 1), 'application/json;charset=utf-8')}>
                <Icon name="download" size={18} /> 파일 받기
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={!link || !canShare}
                onClick={() => void navigator.share({ title: `PE LOG ${SHARE_LABEL[pack.type]} · ${pack.name}`, text: `PE LOG ${SHARE_LABEL[pack.type]} '${pack.name}'을 보내요. 링크를 누르면 PE LOG에서 열려요.`, url: link }).catch(() => undefined)}
              >
                <Icon name="share" size={18} /> 다른 앱으로
              </button>
            </div>
            {msg && <p className="text-sm font-bold text-brand">{msg}</p>}
            <p className="hint">
              링크가 너무 길어 메신저에서 잘리면 [파일 받기]로 보내고, 받는 쪽은 [업무 → 받은 자료 넣기]에서 파일을 고르면 돼요. 링크 · 파일은 메신저에 남으니 학교 업무용 메신저로 보내세요.
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
