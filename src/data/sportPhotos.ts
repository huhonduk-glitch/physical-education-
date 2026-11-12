/**
 * 종목 자료 사진 (2026-10-27). 위키미디어 공용(Wikimedia Commons)의 자유 이용 사진만 — 저작권 만료(Public domain) · CC0 · CC BY · CC BY-SA.
 * 사진마다 저작자 · 라이선스 · 원본 주소를 화면과 PPT에 함께 적는다(CC 조건). 파일은 public/sports/ (800px로 줄여 앱에 넣음, 오프라인)
 */
export interface SportPhoto {
  src: string
  credit: string
  license: string
  url: string
  /** 삽화 · 도식(사진 아님): 슬라이드에서 자르지 않고 흰 카드 안에 온전히 */
  illust?: boolean
  /** 출처 사이트 (없으면 위키미디어 공용) */
  site?: string
}

/** '사진: 저작자 · 라이선스 · 사이트' 한 줄 */
export const photoCredit = (p: SportPhoto) => `${p.illust ? '그림' : '사진'}: ${p.credit} · ${p.license} · ${p.site ?? '위키미디어 공용'}`

export const PHOTOS: Record<string, SportPhoto> = {
  // 자유 이용 삽화 (2026-11-03 교사 요청 "자유 이용 삽화를 최대한 찾아서") — 위키미디어 공용 · rawpixel 퍼블릭 도메인(CC0)
  "il-bb-jumpshot": { src: "sports/il-bb-jumpshot.jpg", credit: "johnny_automatic (Open Clip Art Library)", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Basketball_player.svg", illust: true, site: "위키미디어 공용" },
  "il-fs-22": { src: "sports/il-fs-22.jpg", credit: "Sribit", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Formasi_futsal_2-2_GK_F_F_A_P.svg", illust: true, site: "위키미디어 공용" },
  "il-fb-offside": { src: "sports/il-fb-offside.jpg", credit: "NielsF", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Offsidelarge.svg", illust: true, site: "위키미디어 공용" },
  "il-jr-longrope": { src: "sports/il-jr-longrope.jpg", credit: "Ealita", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Permainan-Tradisional-Bermain-Lompat-Tali-3.svg", illust: true, site: "위키미디어 공용" },
  "il-vb-rotation": { src: "sports/il-vb-rotation.jpg", credit: "Nesnera", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Volleyball_rotation_pattern_and_zones.svg", illust: true, site: "위키미디어 공용" },
  "il-fb-player": { src: "sports/il-fb-player.jpg", credit: "퍼블릭 도메인 그림", license: "CC0", url: "https://www.rawpixel.com/image/6791797/vector-sticker-public-domain-blue", illust: true, site: "rawpixel" },
  "il-tt-players": { src: "sports/il-tt-players.jpg", credit: "퍼블릭 도메인 옛 그림", license: "CC0", url: "https://www.rawpixel.com/image/6605507/vector-vintage-public-domain-person", illust: true, site: "rawpixel" },
  "il-tn-player": { src: "sports/il-tn-player.jpg", credit: "퍼블릭 도메인 옛 그림", license: "CC0", url: "https://www.rawpixel.com/image/6449126/vector-sticker-public-domain-black", illust: true, site: "rawpixel" },
  "il-bs-batter": { src: "sports/il-bs-batter.jpg", credit: "퍼블릭 도메인 옛 그림", license: "CC0", url: "https://www.rawpixel.com/image/6439552/vector-vintage-public-domain-black", illust: true, site: "rawpixel" },
  // 2026-11-12 더 찾음 (교사 요청: 농구 · 배구 · 배드민턴 그림) — 위키미디어 공용, 눈으로 확인
  "il-bb-positions": { src: "sports/il-bb-positions.jpg", credit: "Henrik · GateKeeperX", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Basketball_positions.svg", illust: true, site: "위키미디어 공용" },
  "il-bb-zone": { src: "sports/il-bb-zone.jpg", credit: "Henrik · GateKeeperX · Makeemlighter", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Basketball_Defense_2-3_Zone.svg", illust: true, site: "위키미디어 공용" },
  "il-vb-court": { src: "sports/il-vb-court.jpg", credit: "Koreller", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Volleyball_Court.svg", illust: true, site: "위키미디어 공용" },
  "il-vb-picto": { src: "sports/il-vb-picto.jpg", credit: "Parutakupiu · Thadius856", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Volleyball_(indoor)_pictogram.svg", illust: true, site: "위키미디어 공용" },
  "il-bd-court": { src: "sports/il-bd-court.jpg", credit: "Koreller", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Badminton_Court.svg", illust: true, site: "위키미디어 공용" },
  "il-bd-serve": { src: "sports/il-bd-serve.jpg", credit: "Cmglee", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Badminton_court_legal_bounds.svg", illust: true, site: "위키미디어 공용" },
  "il-bd-picto": { src: "sports/il-bd-picto.jpg", credit: "Parutakupiu · Thadius856", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Badminton_pictogram.svg", illust: true, site: "위키미디어 공용" },
  "vb-morgan": { src: "sports/vb-morgan.jpg", credit: "Hayes", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:William_G._Morgan.jpg" },
  "il-bs-scene": { src: "sports/il-bs-scene.jpg", credit: "퍼블릭 도메인 옛 그림", license: "CC0", url: "https://www.rawpixel.com/image/6486989/image-vintage-public-domain-people", illust: true, site: "rawpixel" },
  "bb-naismith": { src: "sports/bb-naismith.jpg", credit: "작자 미상", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Dr._James_Naismith.jpg" },
  "bb-ball": { src: "sports/bb-ball.jpg", credit: "User: MrX", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Isolated_basketball.png" },
  "bb-shot": { src: "sports/bb-shot.jpg", credit: "noahsilliman", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Basketball_hitting_a_basketball_goal.jpg" },
  "fb-morley": { src: "sports/fb-morley.jpg", credit: "\"L.N.A.\"", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Ebenezer_Morley_1913.png" },
  "fb-ball": { src: "sports/fb-ball.jpg", credit: "TaurusEmerald", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Li-Ning_Size_5_Soccer_Ball.jpg" },
  "fb-laws1863": { src: "sports/fb-laws1863.jpg", credit: "Adrian Roebuck", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Original_laws_of_the_game_1863.jpg" },
  "fs-game": { src: "sports/fs-game.jpg", credit: "U.S. Navy photo by Petty Officer 1st Class Josh Huebner/Released", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Futsal_DVIDS249733.jpg" },
  "fs-ball": { src: "sports/fs-ball.jpg", credit: "BugWarp", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Adidas_Telstar_18_Futsal_at_the_2018_YOG_Futsal_draw.jpg" },
  "nb-match": { src: "sports/nb-match.jpg", credit: "Samson Ssemakadde", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:Netball_match.jpg" },
  "nb-1910": { src: "sports/nb-1910.jpg", credit: "National Library NZ on The Commons", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Netball_game,_ca_1910.jpg" },
  "tb-brandt": { src: "sports/tb-brandt.jpg", credit: "黃昱齊", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Dr-herman-brandt.jpg" },
  "tb-game": { src: "sports/tb-game.jpg", credit: "DavidSandoz from Crissier, Suisse", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:European_Tchoukball_Championships_2014.jpg" },
  "tb-frame": { src: "sports/tb-frame.jpg", credit: "Vimiye", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Tchoukball_vimi.jpg" },
  "ut-game": { src: "sports/ut-game.jpg", credit: "Drpoulette from Mexico City, Mexico", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Ultimate_frisbee_10.jpg" },
  "ut-disc": { src: "sports/ut-disc.jpg", credit: "작자 미상", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Discraft_UltraStar_Sportdisc_Ultimate_FrisbeeA.jpg" },
  "tt-match": { src: "sports/tt-match.jpg", credit: "Marcus Cyron", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Table_tennis_at_the_2018_Summer_Youth_Olympics_%E2%80%93_Women%27s_Singles_Bronze_Medal_Match_052.jpg" },
  "pb-court": { src: "sports/pb-court.jpg", credit: "Michael Barera", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Milwaukee_November_2022_34_(Plankinton_Arcade_pickleball_court).jpg" },
  "kb-touch": { src: "sports/kb-touch.jpg", credit: "Pierre-Yves Beaudouin", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:20e_journ%C3%A9e_du_championnat_de_france_2013-2014_de_Kin-Ball_009.jpg" },
}
