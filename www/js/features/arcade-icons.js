// 아케이드 그림: 뽀모도로 화폐 아이콘(빨강·노랑·초록 토마토, 토마토 조각), 뽑기권 티켓, 프로필 버튼 아이콘
//   이모지 대신 도트(픽셀) 느낌의 작은 SVG. 8×8 칸에 칠할 칸을 문자열로 그림
(() => {
  "use strict";

  // 칸 문자: 몸통 b, 밝은 점 h, 잎 l, 꼭지 s, 단면(속) i
  const TOMATO = [
    "...ss...",
    "..llll..",
    ".bbllbb.",
    "bhbbbbbb",
    "bhbbbbbb",
    "bbbbbbbb",
    ".bbbbbb.",
    "..bbbb..",
  ];
  const SLICE = [
    "........",
    "........",
    "bbbbbbbb",
    "biiiiiib",
    ".biiiib.",
    "..biib..",
    "...bb...",
    "........",
  ];
  // 뽑기권: 양옆 가운데가 파인 보라색 티켓, 오른쪽에 점선(뜯는 선), 왼쪽에 노란 별
  //   칸 문자: 몸통 b, 테두리 o, 점선 d, 별 h
  const TICKET = [
    "........",
    "oooooooo",
    "obhbbdbo",
    ".hhhbbb.",
    ".bhbbdb.",
    "obbbbbbo",
    "oooooooo",
    "........",
  ];
  const TICKET_COLORS = { o: "#6d3fd6", b: "#9b6cff", d: "#e9ddff", h: "#ffe58a" };
  const COLORS = {
    red: { b: "#e5533d", h: "#ffb3a3" },
    yellow: { b: "#f2b705", h: "#ffe58a" },
    green: { b: "#2fa84f", h: "#9fe0b0" },
    piece: { b: "#e5533d", i: "#ffd0c4" },
  };
  const LEAF = { l: "#3c8d2f", s: "#2a5f20" };

  function pixels(rows, palette) {
    let out = "";
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      const fill = palette[c];
      if (fill) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    }));
    return out;
  }

  // kind: red | yellow | green | piece
  function currency(kind, size = 18) {
    const rows = kind === "piece" ? SLICE : TOMATO;
    const pal = Object.assign({}, LEAF, COLORS[kind]);
    return `<svg class="cur-ico" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${pixels(rows, pal)}</svg>`;
  }

  function ticket(size = 18) {
    return `<svg class="cur-ico" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${pixels(TICKET, TICKET_COLORS)}</svg>`;
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
