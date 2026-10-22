import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import PageHeader from '../../components/PageHeader'
import { saveBlob } from '../../lib/download'
import { delayFrames, fitSize, FrameRing } from '../../lib/motion'
import { useWakeLock } from '../../lib/wakeLock'
import DrawLayer, { paintShapes, type DrawTool, type Shape } from './DrawLayer'

/** 1초에 몇 장 기억할지 · 최대 몇 초 기억할지 · 기억할 장면 크기 (폰 메모리를 생각해 작게) */
const FPS = 15
const MAX_SEC = 10
const MAX_SIDE = 480
const DELAYS = [0, 2, 3, 5, 8, 10]
const SPEEDS = [0.25, 0.5, 1]

type Mode = 'idle' | 'live' | 'replay' | 'file'

const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * 동작 영상 피드백 (재설계 B-3, 2026-10-22).
 * - 카메라 지연 재생: 학생이 동작하고 돌아와 몇 초 전 자기 동작을 본다
 * - [멈추고 다시 보기]: 최근 10초를 0.25×·0.5×·1×로, 한 장씩 넘기며
 * - 선·각도 그리기 (계산은 src/lib/motion.ts)
 * - 휴대폰에 있는 영상 파일 열기
 * 영상은 이 기기 메모리에만 둔다. 서버·인터넷으로 보내는 코드는 없다. 저장은 교사가 [저장]을 누를 때만(이 기기 다운로드).
 */
export default function VideoPage() {
  const [mode, setMode] = useState<Mode>('idle')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [delay, setDelay] = useState(3)
  const [err, setErr] = useState('')
  const [filled, setFilled] = useState(0)
  const [size, setSize] = useState({ w: 16, h: 9 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const workRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ringRef = useRef(new FrameRing<ImageBitmap>(FPS * MAX_SEC))
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const delayRef = useRef(delay)
  delayRef.current = delay

  // 다시 보기
  const [frames, setFrames] = useState<ImageBitmap[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.5)
  // 그리기
  const [tool, setTool] = useState<DrawTool | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [msg, setMsg] = useState('')
  // 파일
  const fileVideoRef = useRef<HTMLVideoElement>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useWakeLock(mode === 'live' || mode === 'replay')

  const draw = useCallback((bmp: ImageBitmap | undefined) => {
    const c = viewRef.current
    if (!c || !bmp) return
    if (c.width !== bmp.width || c.height !== bmp.height) {
      c.width = bmp.width
      c.height = bmp.height
    }
    c.getContext('2d')!.drawImage(bmp, 0, 0)
  }, [])

  const stopCapture = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const capture = useCallback(async () => {
    const v = videoRef.current
    if (!v || v.readyState < 2 || busyRef.current) return
    busyRef.current = true
    try {
      const { w, h } = fitSize(v.videoWidth, v.videoHeight, MAX_SIDE)
      if (!w) return
      const work = (workRef.current ??= document.createElement('canvas'))
      work.width = w
      work.height = h
      work.getContext('2d')!.drawImage(v, 0, 0, w, h)
      const bmp = await createImageBitmap(work)
      ringRef.current.push(bmp)?.close() // 밀려난 옛 장면은 바로 메모리에서 지운다
      const ring = ringRef.current
      setFilled(ring.size)
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
      draw(ring.back(delayFrames(delayRef.current, FPS)))
    } finally {
      busyRef.current = false
    }
  }, [draw])

  const startCapture = useCallback(() => {
    stopCapture()
    timerRef.current = window.setInterval(() => void capture(), 1000 / FPS)
  }, [capture])

  const clearAll = () => {
    stopCapture()
    for (const b of ringRef.current.clear()) b.close()
    setFrames([])
    setFilled(0)
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = async (face = facing) => {
    setErr('')
    setMsg('')
    stopCamera()
    clearAll()
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: false })
      streamRef.current = s
      const v = videoRef.current!
      v.srcObject = s
      await v.play()
      setMode('live')
      setShapes([])
      startCapture()
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setErr(
        name === 'NotAllowedError'
          ? '카메라 사용이 막혀 있어요. 브라우저 주소창의 자물쇠(또는 설정)에서 카메라를 허용해 주세요.'
          : name === 'NotFoundError'
            ? '이 기기에서 카메라를 찾지 못했어요. 아래 [영상 파일 열기]로 찍어 둔 영상을 볼 수 있어요.'
            : '카메라를 켜지 못했어요. 이 브라우저가 카메라를 지원하지 않을 수 있어요. [영상 파일 열기]를 써 보세요.',
      )
      setMode('idle')
    }
  }

  // 화면을 나가면 카메라를 끄고 기억한 장면을 모두 지운다
  useEffect(
    () => () => {
      stopCapture()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      for (const b of ringRef.current.clear()) b.close()
    },
    [],
  )
  useEffect(() => () => void (fileUrl && URL.revokeObjectURL(fileUrl)), [fileUrl])

  const freeze = () => {
    stopCapture()
    const all = ringRef.current.toArray()
    if (all.length === 0) return
    setFrames(all)
    setIdx(Math.max(0, all.length - 1 - delayFrames(delay, FPS)))
    setPlaying(false)
    setMode('replay')
  }
  const backToLive = () => {
    setFrames([])
    setShapes([])
    setTool(null)
    setMode('live')
    startCapture()
  }

  // 다시 보기: 고른 장면 그리기 + 재생
  useEffect(() => {
    if (mode === 'replay') draw(frames[idx])
  }, [mode, frames, idx, draw])
  useEffect(() => {
    if (mode !== 'replay' || !playing) return
    const t = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 1000 / (FPS * speed))
    return () => window.clearInterval(t)
  }, [mode, playing, speed, frames.length])

  // 파일 영상: 재생 속도
  useEffect(() => {
    if (fileVideoRef.current) fileVideoRef.current.playbackRate = speed
  }, [speed, fileUrl])

  const openFile = (f: File | undefined) => {
    if (!f) return
    stopCamera()
    clearAll()
    setShapes([])
    setTool(null)
    setErr('')
    setMsg('')
    setFileUrl(URL.createObjectURL(f))
    setMode('file')
  }

  /** 지금 장면 + 그림을 PNG로 (이 기기에 내려받기) */
  const saveFrame = () => {
    const src = mode === 'file' ? fileVideoRef.current : viewRef.current
    if (!src) return
    const w = src instanceof HTMLVideoElement ? src.videoWidth : src.width
    const h = src instanceof HTMLVideoElement ? src.videoHeight : src.height
    if (!w || !h) return
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.drawImage(src, 0, 0, w, h)
    paintShapes(ctx, shapes, w, h)
    c.toBlob((b) => {
      if (!b) return
      saveBlob(`동작장면_${stamp()}.png`, b)
      setMsg('장면을 이 기기에 저장했어요(다운로드 폴더).')
    }, 'image/png')
  }

  /** 다시 보기 장면들을 1× 영상으로 (그림 포함). MediaRecorder가 없는 브라우저는 사진만 */
  const [recording, setRecording] = useState(false)
  const saveClip = async () => {
    if (!frames.length || typeof MediaRecorder === 'undefined') return setMsg('이 브라우저는 영상 저장을 지원하지 않아요. [장면 저장]을 써 주세요.')
    const type = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))
    if (!type) return setMsg('이 브라우저는 영상 저장을 지원하지 않아요. [장면 저장]을 써 주세요.')
    setRecording(true)
    setPlaying(false)
    const c = document.createElement('canvas')
    c.width = frames[0].width
    c.height = frames[0].height
    const ctx = c.getContext('2d')!
    const rec = new MediaRecorder(c.captureStream(FPS), { mimeType: type })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise<void>((res) => (rec.onstop = () => res()))
    rec.start()
    for (const f of frames) {
      ctx.drawImage(f, 0, 0)
      paintShapes(ctx, shapes, c.width, c.height)
      await new Promise((r) => setTimeout(r, 1000 / FPS))
    }
    rec.stop()
    await done
    saveBlob(`동작영상_${stamp()}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`, new Blob(chunks, { type: type.split(';')[0] }))
    setRecording(false)
    setMsg(`최근 ${Math.round(frames.length / FPS)}초 영상을 이 기기에 저장했어요(다운로드 폴더).`)
  }

  const stepFile = (dir: number) => {
    const v = fileVideoRef.current
    if (!v) return
    v.pause()
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir / 30))
  }

  const aspect = mode === 'file' && fileVideoRef.current?.videoWidth ? fileVideoRef.current.videoWidth / fileVideoRef.current.videoHeight : size.w / size.h
  const canDraw = mode === 'replay' || mode === 'file'

  return (
    <>
      <PageHeader title="동작 영상 피드백" back />
      <div className="page space-y-4 pb-10">
        <section className="rounded-2xl bg-fill px-4 py-3 text-[0.9rem] text-ink-2">
          <p className="font-bold text-ink">🔒 영상은 이 기기 메모리에만 있어요</p>
          <p>인터넷으로 보내지 않고, 이 화면을 나가면 지워져요. 남기고 싶을 때만 [저장]을 누르면 이 기기에 내려받아요. 학생 촬영은 학교 지침과 학생 동의를 따라 주세요.</p>
        </section>

        {/* 카메라 입력용 (화면에는 지연된 장면을 캔버스로 보여 준다) */}
        {/* display:none이면 일부 폰(아이폰)이 장면을 그리지 않아 검게 찍히므로, 보이지 않게만 둔다 */}
        <video ref={videoRef} className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0" playsInline muted aria-hidden />


        {(mode === 'idle' || mode === 'live') && (
          <section className="card space-y-3">
            <p className="card-title">카메라 지연 재생</p>
            <p className="hint">학생이 동작하고 돌아와서 몇 초 전 자기 동작을 봐요. 폰·태블릿을 세워 두고 쓰세요.</p>
            <div>
              <p className="label">몇 초 늦게 보여 줄까요?</p>
              <div className="flex flex-wrap gap-2">
                {DELAYS.map((d) => (
                  <button key={d} type="button" aria-pressed={delay === d} className="chip tabular-nums" onClick={() => setDelay(d)}>
                    {d === 0 ? '바로' : `${d}초`}
                  </button>
                ))}
              </div>
            </div>
            <div className="segment">
              <button type="button" aria-pressed={facing === 'environment'} onClick={() => (setFacing('environment'), mode === 'live' && void startCamera('environment'))}>
                뒤 카메라
              </button>
              <button type="button" aria-pressed={facing === 'user'} onClick={() => (setFacing('user'), mode === 'live' && void startCamera('user'))}>
                앞 카메라
              </button>
            </div>
            {mode === 'idle' && (
              <button type="button" className="btn btn-primary w-full text-lg" onClick={() => void startCamera()}>
                <Icon name="play" /> 카메라 켜기
              </button>
            )}
            {err && (
              <p className="rounded-xl bg-danger-light px-3 py-2 text-sm font-bold text-danger" role="alert">
                {err}
              </p>
            )}
          </section>
        )}

        {(mode === 'live' || mode === 'replay') && (
          <section className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
              <canvas ref={viewRef} className={`h-full w-full object-contain ${facing === 'user' && mode === 'live' ? '-scale-x-100' : ''}`} />
              {mode === 'live' && filled <= delayFrames(delay, FPS) && (
                <p className="absolute inset-0 grid place-items-center text-lg font-bold text-white">
                  {delay}초 모으는 중… {Math.min(delay, Math.floor(filled / FPS))}/{delay}
                </p>
              )}
              {mode === 'live' && (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-sm font-bold text-white">{delay === 0 ? '● 지금' : `● ${delay}초 전`}</span>
              )}
              {canDraw && <DrawLayer tool={tool} shapes={shapes} onChange={setShapes} aspect={aspect} />}
            </div>
            {mode === 'live' ? (
              <div className="flex gap-2">
                <button type="button" className="btn btn-soft" onClick={() => (stopCamera(), clearAll(), setMode('idle'))}>
                  <Icon name="stop" /> 끄기
                </button>
                <button type="button" className="btn btn-primary flex-1 text-lg" disabled={filled === 0} onClick={freeze}>
                  <Icon name="pause" /> 멈추고 다시 보기
                </button>
              </div>
            ) : (
              <Player
                count={frames.length}
                idx={idx}
                setIdx={(i) => (setPlaying(false), setIdx(i))}
                playing={playing}
                togglePlay={() => (idx >= frames.length - 1 && setIdx(0), setPlaying((p) => !p))}
                speed={speed}
                setSpeed={setSpeed}
                timeLabel={`${((idx - (frames.length - 1)) / FPS).toFixed(1)}초`}
              />
            )}
          </section>
        )}

        {mode === 'file' && fileUrl && (
          <section className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: `${aspect}` }}>
              <video ref={fileVideoRef} src={fileUrl} className="h-full w-full object-contain" playsInline muted onLoadedMetadata={() => setSize((s) => ({ ...s }))} />
              <DrawLayer tool={tool} shapes={shapes} onChange={setShapes} aspect={aspect} />
            </div>
            <div className="card space-y-2 p-3">
              <div className="flex gap-2">
                <button type="button" className="btn btn-soft px-3" aria-label="한 장 뒤로" onClick={() => stepFile(-1)}>
                  ◀
                </button>
                <button type="button" className="btn btn-primary flex-1" onClick={() => (fileVideoRef.current?.paused ? void fileVideoRef.current.play() : fileVideoRef.current?.pause())}>
                  <Icon name="play" /> 재생 / 멈춤
                </button>
                <button type="button" className="btn btn-soft px-3" aria-label="한 장 앞으로" onClick={() => stepFile(1)}>
                  ▶
                </button>
              </div>
              <SpeedChips speed={speed} setSpeed={setSpeed} />
            </div>
          </section>
        )}

        {canDraw && (
          <section className="card space-y-2 p-3">
            <p className="label mb-0">그리기 {tool === 'line' ? '— 두 점을 눌러요' : tool === 'angle' ? '— 세 점을 눌러요 (가운데가 꼭짓점)' : ''}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={tool === 'line'} className="chip" onClick={() => setTool((t) => (t === 'line' ? null : 'line'))}>
                ／ 선 · 기울기
              </button>
              <button type="button" aria-pressed={tool === 'angle'} className="chip" onClick={() => setTool((t) => (t === 'angle' ? null : 'angle'))}>
                ∠ 관절 각도
              </button>
              <button type="button" className="chip" disabled={!shapes.length} onClick={() => setShapes((s) => s.slice(0, -1))}>
                되돌리기
              </button>
              <button type="button" className="chip" disabled={!shapes.length} onClick={() => setShapes([])}>
                모두 지우기
              </button>
            </div>
            <p className="hint">선은 수평에서 기운 정도(0~90°), 각도는 세 점 사이 관절각(0~180°)이에요. 화면에서 잰 값이라 카메라 각도에 따라 달라지니 참고용으로 써 주세요.</p>
          </section>
        )}

        {canDraw && (
          <section className="space-y-2">
            <div className="flex gap-2">
              <button type="button" className="btn btn-soft flex-1" onClick={saveFrame}>
                <Icon name="download" /> 장면 저장
              </button>
              {mode === 'replay' && (
                <button type="button" className="btn btn-soft flex-1" disabled={recording} onClick={() => void saveClip()}>
                  <Icon name="download" /> {recording ? '저장하는 중…' : '영상 저장'}
                </button>
              )}
            </div>
            {mode === 'replay' && (
              <button type="button" className="btn btn-primary w-full text-lg" onClick={backToLive}>
                <Icon name="play" /> 다시 촬영(지연 재생으로)
              </button>
            )}
            {msg && <p className="text-sm font-bold text-ok">{msg}</p>}
          </section>
        )}

        <label className="btn btn-outline relative w-full">
          <Icon name="upload" /> 휴대폰에 있는 영상 파일 열기
          <input type="file" accept="video/*" className="sr-only" onChange={(e) => (openFile(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        <p className="hint text-center">각도 계산 방식은 Sports2D(BSD-3)의 관절각·분절각 정의를 참고했어요.</p>
      </div>
    </>
  )
}

function SpeedChips({ speed, setSpeed }: { speed: number; setSpeed: (s: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label mb-0">느리게</span>
      {SPEEDS.map((s) => (
        <button key={s} type="button" aria-pressed={speed === s} className="chip tabular-nums" onClick={() => setSpeed(s)}>
          {s}×
        </button>
      ))}
    </div>
  )
}

function Player({
  count,
  idx,
  setIdx,
  playing,
  togglePlay,
  speed,
  setSpeed,
  timeLabel,
}: {
  count: number
  idx: number
  setIdx: (i: number) => void
  playing: boolean
  togglePlay: () => void
  speed: number
  setSpeed: (s: number) => void
  timeLabel: string
}) {
  return (
    <div className="card space-y-2 p-3">
      <input
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        className="w-full accent-[var(--color-brand)]"
        aria-label="장면 고르기"
      />
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-soft px-3" aria-label="한 장 뒤로" onClick={() => setIdx(Math.max(0, idx - 1))}>
          ◀
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={togglePlay}>
          <Icon name={playing ? 'pause' : 'play'} /> {playing ? '멈춤' : '재생'}
        </button>
        <button type="button" className="btn btn-soft px-3" aria-label="한 장 앞으로" onClick={() => setIdx(Math.min(count - 1, idx + 1))}>
          ▶
        </button>
        <span className="w-16 text-right text-sm font-bold text-ink-3 tabular-nums">{timeLabel}</span>
      </div>
      <SpeedChips speed={speed} setSpeed={setSpeed} />
    </div>
  )
}
