/**
 * 종목 자료 사진 (2026-10-27). 위키미디어 공용(Wikimedia Commons)의 자유 이용 사진만 — 저작권 만료(Public domain) · CC0 · CC BY · CC BY-SA.
 * 사진마다 저작자 · 라이선스 · 원본 주소를 화면과 PPT에 함께 적는다(CC 조건). 파일은 public/sports/ (800px로 줄여 앱에 넣음, 오프라인)
 */
export interface SportPhoto {
  src: string
  credit: string
  license: string
  url: string
}

export const PHOTOS: Record<string, SportPhoto> = {
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
}
