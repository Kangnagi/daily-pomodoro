// 아케이드 그림: 뽀모도로 화폐 아이콘(빨강·노랑·초록 토마토, 토마토 조각), 뽑기권 티켓, 프로필 버튼 아이콘
//   이모지 대신 도트(픽셀) 느낌의 작은 SVG. 칠할 칸을 문자열로 그림
//   도트 그림: 빨강·노랑·초록 토마토, 토마토 조각은 16×16, 뽑기권은 32×32 (칸 수가 달라도 같은 크기로 보임)
//   사용자가 그린 원본(.pixil, .png)은 docs/도트원본/ 에 있음
(() => {
  "use strict";

  // 토마토 (16×16, 사용자가 Pixilart로 그린 Tomato.pixil을 칸 문자로 옮김)
  //   칸 문자: 테두리 a·b·d, 그림자 쪽 몸통 h·j·k, 밝은 쪽 몸통 f, 하이라이트 g·l·m, 잎 c·e·i
  //   빨강은 사용자 그림 색 그대로, 노랑·초록은 같은 모양에 색만 바꿈(팔레트 교체)
  const TOMATO = [
    "................",
    "................",
    ".....abbbcd.....",
    "...aecffecgdd...",
    "..ahhhiceffggd..",
    ".ajhhhkeceeefgd.",
    ".ajhhhecfffcigd.",
    ".ajhhchfffffffd.",
    ".ajlhhhhkfffffd.",
    ".ajhmhhhkfffffd.",
    ".ajjlhhhkfffffd.",
    "..ajjlhhhkfffd..",
    "...ajjjjhkkfd...",
    "....aaaaabbd....",
    "................",
    "................",
  ];
  // 토마토 조각 (16×16, 사용자가 그린 peace_of_Tomato.pixil): 세로로 자른 토마토 웨지, 끝에 꼭지
  //   칸 문자: 꼭지 a·b, 껍질 테두리 c·d, 껍질 f·i, 과육 h, 밝은 과육 e, 하이라이트 g, 씨 j
  const PIECE = [
    "................",
    "................",
    "...........ab...",
    "..........cdd...",
    ".........deffd..",
    "........dgfhifd.",
    ".......dgehhhfd.",
    "......dgehjhifd.",
    ".....dgeeehhfd..",
    "....dggehhjifd..",
    "...dfeehjhhfd...",
    "..dfhhjhhhifd...",
    "..dfihhifffd....",
    "...dffffddd.....",
    "....dddd........",
    "................",
  ];
  const PIECE_COLORS = { a: "#477c1b", b: "#71a149", c: "#52971a", d: "#940216", e: "#ff7c58", f: "#bd1504", g: "#f8cdac", h: "#dc2f15", i: "#cc1504", j: "#fcbf3a" };
  // 뽑기권 (32×32, 케첩병 모티브 A안): 빨간 본체 + 계단 모서리 크림색 라벨(금테·파란 띠·토마토)
  //   + 오른쪽 흰 뚜껑 모양 꼬리표, 사이에 뜯는 점선. 상표 글자·로고는 없음
  const TICKET = [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "...aaaaaaaaaaaaaaaaaaa..........",
    "..abbbbbbbbbbbbbbbbbbcaa.dddd...",
    "..abeeffgggggggggffffca.dhhhid..",
    "..abeffggjjjjjjjggfffcaadiiiid..",
    "..acffggjjjklkjjjggffca.dhmmid..",
    "..aaffgjjjnklknjjjgffcaadiiiid..",
    "....abgjjnennnnnjjgffca.dhmmid..",
    "....abgjjnennnnnjjgffcaadiiiid..",
    "....abgoonnnnnnnoogffca.dhmmid..",
    "....abgooonnnnnooogffcaadiiiid..",
    "..aaffgjjjjjjjjjjjgffca.dhmmid..",
    "..abffgjjjjjjjjjjjgffcaadiiiid..",
    "..abffgjjjjjjjjjjjgffca.dhmmid..",
    "..abffgggggggggggggffcaadiiiid..",
    "..accccccccccccccccccca..dddd...",
    "...aaaaaaaaaaaaaaaaaaa..........",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ];
  const TICKET_COLORS = { a: "#4a0b0b", b: "#e2543b", c: "#8e1b12", d: "#9aa0aa", e: "#ffb59e", f: "#c0281b", g: "#b08a3e", h: "#ffffff", i: "#c9ced6", j: "#f6efe0", k: "#3f8f2c", l: "#2c6a1f", m: "#f2f4f7", n: "#e0352a", o: "#2f4fa2" };
  const COLORS = {
    red: { a: "#78041e", b: "#840522", d: "#900525", h: "#a80206", j: "#9e080c", k: "#b4050a", f: "#bf1600", g: "#e02d32", l: "#df353a", m: "#e95054", c: "#477c1b", e: "#36521f", i: "#71a149" },
    yellow: { a: "#7a4a02", b: "#8a5604", d: "#9c6406", h: "#d38f04", j: "#b97a05", k: "#df9d08", f: "#f0b10c", g: "#ffd23a", l: "#ffcf3a", m: "#ffe27a", c: "#477c1b", e: "#36521f", i: "#71a149" },
    // 초록 토마토는 몸통이 초록이라 잎을 올리브색으로 바꿔 구분되게
    green: { a: "#14431a", b: "#174d1d", d: "#1b5820", h: "#2a8a2c", j: "#237527", k: "#2f9a31", f: "#3bb03a", g: "#6fd065", l: "#68cc5e", m: "#9be38f", c: "#6b6a12", e: "#4a4a0c", i: "#a3a32a" },
  };

  function pixels(rows, palette) {
    let out = "";
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const fill = palette[c];
      if (fill) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    }));
    return out;
  }

  // 칸 수(8×8, 16×16 …)는 그림 줄 수로 정함 → 그림마다 해상도가 달라도 같은 크기로 보임
  function svg(rows, palette, size) {
    const n = rows.length;
    return `<svg class="cur-ico" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true">${pixels(rows, palette)}</svg>`;
  }

  // kind: red | yellow | green | piece
  function currency(kind, size = 18) {
    if (kind === "piece") return svg(PIECE, PIECE_COLORS, size);
    return svg(TOMATO, COLORS[kind], size);
  }

  function ticket(size = 18) {
    return svg(TICKET, TICKET_COLORS, size);
  }

  const NAMES = { red: "빨강 뽀모도로", yellow: "노랑 뽀모도로", green: "초록 뽀모도로", piece: "토마토 조각" };

  // 지갑 한 줄: [빨강 1] [노랑 0] [초록 3] [조각 7]  ……  [뽑기권 2] (tickets를 주면 오른쪽 끝에 따로)
  function wallet(w, size = 18, tickets = null) {
    const cur = ["red", "yellow", "green", "piece"].map((k) =>
      `<span class="cur" title="${NAMES[k]}">${currency(k, size)}<b>${w[k]}</b></span>`).join("");
    if (tickets == null) return cur;
    return `<span class="cur-group">${cur}</span><span class="cur cur-ticket" title="뽑기권">${ticket(size)}<b>${tickets}</b></span>`;
  }

  // 위쪽 바 프로필 버튼: 사람 모양 선 아이콘
  const PROFILE = '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  DT.ArcadeIcons = { currency, ticket, wallet, NAMES, PROFILE };
})();
