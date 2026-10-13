import { describe, expect, it } from 'vitest'
import { detectInstall, kakaoOpenExternal } from '../src/lib/install'
import { TERMS_ITEMS, TERMS_VERSION, termsAccepted } from '../src/lib/terms'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.8.0',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0',
  naver: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.6.4)',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

describe('홈 화면 추가 안내: 기기 알아보기', () => {
  it('아이폰 사파리 / 아이패드(맥처럼 보이지만 터치) / 맥', () => {
    expect(detectInstall(UA.iphoneSafari, 5, false)).toEqual({ platform: 'ios', standalone: false, inApp: null })
    expect(detectInstall(UA.ipad, 5, false).platform).toBe('ios')
    expect(detectInstall(UA.mac, 0, false).platform).toBe('desktop')
  })
  it('안드로이드 크롬 / 윈도우 PC', () => {
    expect(detectInstall(UA.android, 5, false).platform).toBe('android')
    expect(detectInstall(UA.windows, 0, false).platform).toBe('desktop')
  })
  it('홈 화면 앱으로 열림', () => {
    expect(detectInstall(UA.iphoneSafari, 5, true).standalone).toBe(true)
  })
  it('카카오톡·네이버 앱 안 브라우저', () => {
    expect(detectInstall(UA.kakaoAndroid, 5, false)).toEqual({ platform: 'android', standalone: false, inApp: '카카오톡' })
    expect(detectInstall(UA.kakaoIos, 5, false)).toMatchObject({ platform: 'ios', inApp: '카카오톡' })
    expect(detectInstall(UA.naver, 5, false).inApp).toBe('네이버 앱')
    expect(detectInstall(UA.iphoneSafari, 5, false).inApp).toBeNull()
  })
  it('카카오톡 바깥 브라우저 주소는 앱 주소를 그대로 담는다', () => {
    const url = 'https://huhonduk-glitch.github.io/physical-education-/'
    expect(kakaoOpenExternal(url)).toBe('kakaotalk://web/openExternal?url=' + encodeURIComponent(url))
  })
})

describe('이용 안내', () => {
  it('동의 판이 지금 판 이상이어야 통과', () => {
    expect(termsAccepted(null)).toBe(false)
    expect(termsAccepted(undefined)).toBe(false)
    expect(termsAccepted({ version: TERMS_VERSION - 1, at: 1 })).toBe(false)
    expect(termsAccepted({ version: TERMS_VERSION, at: 1 })).toBe(true)
  })
  it('꼭 알려야 할 내용이 들어 있다', () => {
    const text = TERMS_ITEMS.flatMap((t) => [t.title, ...t.body]).join(' ')
    for (const w of ['백업', '홈 화면에 추가', '7일', '공용 PC', '암호', '지침', '나이스 값이 우선', '책임지지 않아요']) expect(text).toContain(w)
  })
})
